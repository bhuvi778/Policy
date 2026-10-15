export const isDisplayName = (value = '') => {
  const text = String(value || '').trim();
  return !!text && !/^\+?\d[\d\s-]{7,}$/.test(text) &&
    !['user', 'advisor', 'agent', 'member', 'insurance advisor'].includes(text.toLowerCase());
};

export const getAdvisorDisplayName = (...sources) => {
  const candidates = sources.flatMap((user = {}) => [
    user?.name, user?.fullName, user?.full_name, user?.advisorName, user?.advisor_name,
    user?.employeeName, user?.employee_name, user?.customerName, user?.customer_name,
    user?.profile?.name, user?.profile?.fullName, user?.profile?.full_name,
    user?.user?.name, user?.user?.fullName, user?.data?.name, user?.data?.fullName,
    [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    [user?.first_name, user?.last_name].filter(Boolean).join(' '),
  ]);
  return candidates.find(isDisplayName) || 'Insurance Advisor';
};
