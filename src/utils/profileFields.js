const aliases = {
  dob: ['dob', 'dateOfBirth', 'date_of_birth', 'birthDate'],
  pinCode: ['pinCode', 'pincode', 'pin_code', 'postalCode'],
  licBranch: ['licBranch', 'lic_branch', 'branchName', 'branch'],
};

export const normalizeProfileFields = (user = {}) => {
  const fields = {};
  for (const [key, names] of Object.entries(aliases)) {
    const value = names.flatMap((name) => [user[name], user.profile?.[name]])
      .find((entry) => (typeof entry === 'string' && entry.trim()) || (key === 'pinCode' && typeof entry === 'number' && Number.isFinite(entry)));
    if (value !== undefined) fields[key] = String(value).trim();
  }
  return { ...user, ...fields, ...(user._localProfileFields || {}) };
};

export const applySavedProfileFields = (previous, submitted, returned = {}) => {
  submitted = Object.fromEntries(Object.entries(submitted).filter(([, value]) => value !== undefined));
  const local = Object.fromEntries(Object.keys(aliases).map((key) => [key, String(submitted[key] ?? '').trim()]));
  return normalizeProfileFields({ ...previous, ...returned, ...submitted, _localProfileFields: local });
};
