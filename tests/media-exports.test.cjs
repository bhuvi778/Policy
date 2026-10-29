const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

// Execute the actual service and asset adapters, replacing only native/network/storage boundaries.
function harness({ platform = 'android', nativeFailure = false, serverUrl } = {}) {
  const calls = { image: [], video: [], download: [], share: [], quota: 0, server: 0 };
  const modules = new Map();
  const native = {
    async prepareCustomizedImage(...args) { calls.image.push(args); if (nativeFailure) throw new Error('Your photo/logo could not be loaded'); return { fileUri: 'file:///private/prepared.jpg', contentUri: 'content://test/image', filename: 'branded.jpg', mimeType: 'image/jpeg', customized: true }; },
    async prepareCustomizedVideo(...args) { calls.video.push(args); if (nativeFailure) throw new Error('Video export failed'); return { fileUri: 'file:///private/prepared.mp4', filename: 'branded.mp4', mimeType: 'video/mp4', customized: true }; },
    async download(...args) { calls.download.push(args); return { filename: args[1] }; },
    async shareFile(...args) { calls.share.push(args); return { uri: args[0] }; },
  };
  const api = {
    BASE_URL: 'https://api2.primeimpact.in',
    async downloadMaterial() { calls.server++; return { data: { url: serverUrl || 'https://cdn.test/original.mp4' } }; },
    async getDirectDownload() { return { data: null }; },
    async getDownloadJob() { return { data: null }; },
  };
  function load(filename) {
    filename = path.resolve(__dirname, '..', filename);
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] }).code;
    const requireMock = (specifier) => {
      if (specifier === 'react-native') return { NativeModules: { PolicyBhandarDownloader: native }, Platform: { OS: platform, Version: 36 }, Linking: {}, Share: {} };
      if (specifier === 'react') return { createContext: () => ({}) };
      if (specifier.endsWith('/storage')) return { __esModule: true, default: {} };
      if (specifier.endsWith('/api')) return api;
      if (specifier.endsWith('/downloadQuota')) return { assertCanDownload: async () => {}, recordDownload: async () => { calls.quota++; } };
      return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), specifier + '.js')));
    };
    new Function('require', 'module', 'exports', code)(requireMock, module, module.exports);
    return module.exports;
  }
  return { service: load('src/services/downloads.js'), assets: load('src/utils/profileAssets.js'), auth: load('src/context/AuthContext.js'), branding: load('src/utils/templateBranding.js'), calls };
}

const advisor = { id: 'advisor', name: 'Test Advisor', mobile: '9000000000', profileImage: { location: '/uploads/portrait.png' }, companyLogo: '/uploads/logo.png' };
const banner = { id: 'banner', type: 'banner', url: 'https://cdn.test/banner.jpg' };
const reel = { id: 'reel', type: 'reel', url: 'https://cdn.test/original.mp4' };

test('relative/nested images and business logos resolve independently', () => {
  const { assets } = harness();
  assert.equal(assets.getProfileImageUrl(advisor), 'https://api2.primeimpact.in/uploads/portrait.png');
  assert.equal(assets.getLogoImageUrl(advisor), 'https://api2.primeimpact.in/uploads/logo.png');
  assert.equal(assets.getProfileImageUrl({ data: { profilePicture: { uri: 'content://picker/photo' } } }), 'content://picker/photo');
  assert.equal(assets.getProfileImageUrl({ profile: { avatar: { secure_url: 'https://cdn.test/photo' } } }), 'https://cdn.test/photo');
});

for (const watermarkType of ['digicard', 'whatsapp', 'link']) {
  test(`banner ${watermarkType} sends the real portrait and logo into the exported file`, async () => {
    const { service, calls } = harness();
    const prepared = await service.prepareTemplateShareUrl(banner, { user: advisor, yourLogo: true, waterMark: true, watermarkType, includeLogoOverlay: true });
    assert.equal(calls.image.length, 1);
    assert.equal(calls.image[0][2].profileImageUrl, 'https://api2.primeimpact.in/uploads/portrait.png');
    assert.equal(calls.image[0][2].logoUrl, 'https://api2.primeimpact.in/uploads/logo.png');
    assert.equal(prepared.mimeType, 'image/jpeg');
    assert.equal(prepared.url, 'file:///private/prepared.jpg');
    assert.equal(calls.quota, 0, 'a preview must not consume a download');
  });
}

for (const type of ['reel', 'ai-reel']) {
  test(`${type} is rendered locally with branding rather than falling back to raw video`, async () => {
    const { service, calls } = harness();
    const prepared = await service.prepareMediaShareUrl({ ...reel, type }, advisor);
    assert.equal(calls.video.length, 1);
    assert.equal(calls.server, 0);
    assert.equal(prepared.url, 'file:///private/prepared.mp4');
    assert.equal(calls.video[0][2].includeLogo, true);
    assert.equal(calls.video[0][2].includeLogoOverlay, true);
    assert.equal(calls.video[0][2].profileImageUrl, 'https://api2.primeimpact.in/uploads/portrait.png');
  });
}

test('confirming download saves the exact preview without fetching/rendering again', async () => {
  const { service, calls } = harness();
  const prepared = await service.prepareMediaShareUrl(reel, advisor);
  const again = await service.prepareMediaShareUrl(reel, advisor);
  assert.equal(calls.video.length, 1);
  assert.equal(again.url, prepared.url);
  await service.downloadPreparedFileToDevice(prepared, reel, advisor);
  assert.equal(calls.download[0][0], prepared.url);
  assert.equal(calls.video.length, 1);
  assert.equal(calls.quota, 1);
});

test('changing the profile photo invalidates a previously prepared export', async () => {
  const { service, calls } = harness();
  await service.prepareMediaShareUrl(reel, advisor);
  await service.prepareMediaShareUrl(reel, { ...advisor, profileImage: 'file:///private/cropped-new.png' });
  assert.equal(calls.video.length, 2);
  assert.equal(calls.video[1][2].profileImageUrl, 'file:///private/cropped-new.png');
});

test('WhatsApp receives the branded file URI and correct MIME type', async () => {
  const { service, calls } = harness();
  const prepared = await service.prepareMediaShareUrl(reel, advisor, { watermarkType: 'whatsapp' });
  await service.shareFileToWhatsApp(prepared, 'Test message');
  assert.equal(calls.share[0][0], 'file:///private/prepared.mp4');
  assert.equal(calls.share[0][2], 'video/mp4');
  assert.equal(calls.quota, 1);
});

test('failed video/photo rendering rejects; it never returns an unbranded original', async () => {
  const { service, calls } = harness({ nativeFailure: true });
  await assert.rejects(service.prepareMediaShareUrl(reel, advisor), /Video export failed/);
  await assert.rejects(service.prepareTemplateShareUrl(banner, { user: advisor, yourLogo: true }), /photo\/logo/);
  assert.equal(calls.server, 0);
  assert.equal(calls.download.length, 0);
  assert.equal(calls.quota, 0);
});

test('copy-link refuses a server response that is only the unbranded source', async () => {
  const { service } = harness({ serverUrl: reel.url });
  await assert.rejects(service.prepareMediaShareUrl(reel, advisor, { remote: true }), /Personalized media is unavailable/);
});

test('copy-link uses a public rendered URL, never a private device content URI', async () => {
  const { service, calls } = harness({ serverUrl: 'https://cdn.test/rendered-with-footer.mp4' });
  const prepared = await service.prepareMediaShareUrl(reel, advisor, { remote: true });
  assert.equal(prepared.url, 'https://cdn.test/rendered-with-footer.mp4');
  assert.equal(calls.video.length, 0);
});

test('a fresh backend photo alias replaces the older saved profileImage after refresh', () => {
  const { auth, assets } = harness();
  const merged = auth.mergeUserData({ name: 'Advisor', profileImage: '/uploads/old.jpg' }, { profilePhoto: { location: '/uploads/new.jpg' } });
  assert.equal(assets.getProfileImageUrl(merged), 'https://api2.primeimpact.in/uploads/new.jpg');
  assert.equal(merged.name, 'Advisor');
});

test('nested profile save responses preserve user identity and the new image', () => {
  const { auth, assets } = harness();
  const saved = { name: 'Advisor', mobile: '9999999999', profile: { profilePhoto: '/uploads/new.jpg' } };
  const extracted = auth.extractUserData({ success: true, data: { user: saved } });
  assert.equal(extracted, saved);
  assert.equal(assets.getProfileImageUrl(extracted), 'https://api2.primeimpact.in/uploads/new.jpg');
  assert.equal(auth.extractUserData({ success: true, message: 'Saved' }), null);
});

test('editing an image at the same backend URL bypasses the old asset cache', () => {
  const { assets } = harness();
  assert.equal(assets.getProfileImageUrl({ profileImage: '/uploads/photo.jpg', _profileImageRevision: 42 }), 'https://api2.primeimpact.in/uploads/photo.jpg?_pbv=42');
  assert.equal(assets.getProfileImageUrl({ profileImage: 'https://other.test/signed.jpg?signature=abc', _profileImageRevision: 42 }), 'https://other.test/signed.jpg?signature=abc');
});

test('public copy-links reject local-only photos while local file sharing still works', async () => {
  const { service } = harness();
  const localUser = { ...advisor, profileImage: 'file:///private/cropped.png' };
  await assert.rejects(service.prepareMediaShareUrl(reel, localUser, { remote: true }), /save your profile photo\/logo online/);
  const prepared = await service.prepareMediaShareUrl(reel, localUser);
  assert.equal(prepared.url, 'file:///private/prepared.mp4');
});

test('exports use the same real display name as the profile instead of a phone-number name', async () => {
  const { service, calls } = harness();
  await service.prepareMediaShareUrl(reel, { ...advisor, name: '9000000000', fullName: 'Actual Advisor' });
  assert.equal(calls.video[0][2].advisorName, 'Actual Advisor');
  await service.prepareMediaShareUrl(reel, { ...advisor, name: '9000000000' });
  assert.equal(calls.video[1][2].advisorName, 'Insurance Advisor');
});

test('sharing a downloaded reel reuses its identical branded file across delivery modes', async () => {
  const { service, calls } = harness();
  const downloaded = await service.prepareMediaShareUrl(reel, advisor, { watermarkType: 'digicard' });
  const shared = await service.prepareMediaShareUrl(reel, advisor, { watermarkType: 'whatsapp' });
  assert.equal(calls.video.length, 1);
  assert.equal(shared.url, downloaded.url);
  assert.equal(calls.quota, 0);
});

test('turning on a QR footer still prepares a different image', async () => {
  const { service, calls } = harness();
  await service.prepareTemplateShareUrl(banner, { user: advisor, yourLogo: true, qrCode: false, watermarkType: 'digicard' });
  await service.prepareTemplateShareUrl(banner, { user: advisor, yourLogo: true, qrCode: true, watermarkType: 'whatsapp' });
  assert.equal(calls.image.length, 2);
});

test('public server renders keep distinct delivery modes in their cache keys', async () => {
  const { service, calls } = harness({ serverUrl: 'https://cdn.test/rendered-with-footer.mp4' });
  await service.prepareMediaShareUrl(reel, advisor, { remote: true, watermarkType: 'digicard' });
  await service.prepareMediaShareUrl(reel, advisor, { remote: true, watermarkType: 'link' });
  assert.equal(calls.server, 2);
});

test('draggable app logo and footer portrait stay independent in the native export',async()=>{
 const {service,branding,calls}=harness();
 await service.prepareTemplateShareUrl(banner,{user:advisor,yourLogo:true,waterMark:true,includeLogoOverlay:true,logoOverlayUrl:branding.getAppOverlayLogoUrl()});
 assert.equal(calls.image[0][2].logoOverlayUrl,'policybhandar://logo');
 assert.equal(calls.image[0][2].profileImageUrl,'https://api2.primeimpact.in/uploads/portrait.png');
 assert.notEqual(calls.image[0][2].profileImageUrl,calls.image[0][2].logoOverlayUrl);
 assert.ok(branding.getAppOverlayLogoUrl(true).startsWith('data:image/png;base64,'));
});

test('remote rendering can receive the exact bundled app logo while private profile assets stay blocked',async()=>{
 const {service,branding,calls}=harness({serverUrl:'https://cdn.test/personalized-banner.jpg'});
 const encoded=branding.getAppOverlayLogoUrl(true).split(',')[1];
 assert.ok(Buffer.from(encoded,'base64').equals(fs.readFileSync(path.resolve(__dirname,'../src/assets/images/policybhandar_logo.png'))));
 await service.prepareTemplateShareUrl(banner,{user:advisor,yourLogo:true,waterMark:true,includeLogoOverlay:true,logoOverlayUrl:branding.getAppOverlayLogoUrl(true)},{remote:true});
 assert.equal(calls.server,1);
});
