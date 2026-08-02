export const buildRegistrationTempPassword = (mobile = '') => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return `Bima@${digits.slice(-4)}2024`;
};
