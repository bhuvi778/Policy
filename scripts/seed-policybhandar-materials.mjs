#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = process.env.BASE_URL || 'https://api2.primeimpact.in';
const SEED_TAG = 'policybhandar-seed';
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATALOG_FILE = path.resolve(__dirname, '../src/data/templateSeedCatalog.json');

const stripQuotes = (value) => (value ? String(value).replace(/^["']|["']$/g, '') : value);

const parseArgs = (rawArgs) => {
  const values = {};
  rawArgs.forEach((value, index) => {
    if (!value.startsWith('--')) return;

    const equals = value.indexOf('=');
    if (equals > -1) {
      const key = value.slice(2, equals);
      values[key] = value.slice(equals + 1);
      return;
    }

    const next = rawArgs[index + 1];
    if (next && !next.startsWith('--')) {
      values[value.slice(2)] = next;
    }
  });
  return values;
};

const provided = parseArgs(process.argv.slice(2));
const ADMIN_TOKEN =
  stripQuotes(process.env.ADMIN_TOKEN || '') ||
  stripQuotes(provided.token || '') ||
  '';
const ADMIN_IDENTIFIER =
  stripQuotes(process.env.ADMIN_IDENTIFIER || '') ||
  stripQuotes(process.env.ADMIN_EMAIL || '') ||
  stripQuotes(process.env.ADMIN_PHONE || '') ||
  stripQuotes(provided.identifier || '') ||
  '';
const ADMIN_PASSWORD =
  stripQuotes(process.env.ADMIN_PASSWORD || '') ||
  stripQuotes(provided.password || '');

const buildUrl = (path, params = {}) => {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const request = async (path, options = {}) => {
  const {
    method = 'GET',
    token,
    params,
    body,
    timeoutMs = 15000,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(buildUrl(path, params), {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload = raw;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch (_) {
      payload = raw;
    }

    if (!response.ok || payload?.success === false) {
      const message =
        payload?.message ||
        payload?.error ||
        `Request failed with status ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

const unwrapMaterials = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.data)) return payload.data.data;
  return [];
};

const createOrLogin = async () => {
  if (ADMIN_TOKEN) return ADMIN_TOKEN;
  if (!ADMIN_IDENTIFIER || !ADMIN_PASSWORD) {
    throw new Error(
      'Missing admin credentials. Set ADMIN_TOKEN, or ADMIN_IDENTIFIER + ADMIN_PASSWORD, or pass --identifier and --password.',
    );
  }

  const payload = await request('/api/auth/login', {
    method: 'POST',
    body: {
      identifier: ADMIN_IDENTIFIER,
      password: ADMIN_PASSWORD,
    },
    timeoutMs: 20000,
  });
  const token = payload?.data?.token || payload?.token || payload?.auth?.token;
  if (!token) {
    throw new Error('Admin login response did not include a token.');
  }
  return token;
};

const buildTemplateItems = () => {
  try {
    const raw = fs.readFileSync(CATALOG_FILE, 'utf8');
    const catalog = JSON.parse(raw || '{}');
    const groups = Array.isArray(catalog?.templateGroups) ? catalog.templateGroups : [];

    return groups
      .map((group = {}) => ({
        section: group.section || 'General',
        category: group.category || 'General',
        subcategory: group.subcategory || 'General',
        type: group.type || 'Template',
        tags: Array.isArray(group.tags) ? group.tags : [],
        items: Array.isArray(group.items) ? group.items : [],
      }))
      .filter((group) => group.items.length > 0);
  } catch (error) {
    console.error('[seed] failed to read template seed catalog:', error.message || error);
    return [];
  }
};

const templateItems = buildTemplateItems();

const toPayload = (group, item) => {
  const fileUrl = item.fileUrl || item.thumbnail || item.url || item.image;
  const downloadUrl = item.downloadUrl || fileUrl;

  return {
    title: item.title,
    description: item.description || `${group.section} template`,
    type: group.type || item.type || 'Template',
    fileUrl,
    thumbnail: item.thumbnail || fileUrl,
    downloadUrl,
    url: item.url || fileUrl,
    sourceUrl: item.sourceUrl || item.url || fileUrl,
    category: group.category,
    subcategory: group.subcategory,
    tags: Array.from(
      new Set([
        SEED_TAG,
        'PolicyBhandar',
        ...(group.tags || []),
        ...(item.tags || []),
      ]),
    ),
    imageUrl: fileUrl,
    fileType: fileUrl?.toLowerCase().includes('.mp4') ? 'video' : 'image',
    isPremium: false,
    isActive: true,
    isDownloadable: true,
  };
};

const seed = async () => {
  const totalToSeed = templateItems.reduce((count, group) => count + group.items.length, 0);

  if (DRY_RUN) {
    console.log('[seed dry-run]');
    console.log(`Total templates in seed file: ${totalToSeed}`);
    if (VERBOSE) {
      templateItems.forEach((group) => {
        console.log(` - ${group.section}: ${group.items.length} templates`);
      });
    }
    return;
  }

  const token = await createOrLogin();
  const existing = unwrapMaterials(await request('/api/materials', { params: { tag: SEED_TAG, limit: 200, page: 1 }, token }));
  const existingSignatures = new Set(
    existing.map((item) => `${String(item.title || '').toLowerCase()}::${String(item.fileUrl || item.file || item.thumbnail || '')}`),
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (const group of templateItems) {
    for (const item of group.items) {
      const sourceUrl = item.fileUrl || item.thumbnail || item.url || item.image || '';
      const signature = `${item.title.toLowerCase()}::${sourceUrl}`;
      if (existingSignatures.has(signature)) {
        skipped += 1;
        continue;
      }

      const payload = toPayload(group, item);
      if (!payload.fileUrl) {
        failed += 1;
        failures.push(`${group.section}:${item.title} (no fileUrl)`);
        continue;
      }

      try {
        await request('/api/admin/materials', {
          method: 'POST',
          token,
          body: payload,
          timeoutMs: 12000,
        });
        created += 1;
        if (VERBOSE) {
          console.log(`[created] ${item.title}`);
        }
      } catch (error) {
        failed += 1;
        failures.push(`${group.section}:${item.title} (${error.message || 'error'})`);
      }
    }
  }

  console.log('[seed complete]');
  console.log(`Created: ${created}`);
  console.log(`Skipped(existing): ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (failures.length) {
    console.log('Failures:');
    failures.forEach((message) => console.log(` - ${message}`));
  }

  if (failed > 0) {
    process.exitCode = 1;
    return;
  }

  console.log('Run with --dry-run to simulate inserts without calling admin APIs.');
};

seed().catch((error) => {
  console.error('[seed failed]', error.message || error);
  process.exitCode = 1;
});
