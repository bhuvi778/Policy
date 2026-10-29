// Folder placeholders must not replace a previously usable catalog during a failed refresh.
export const sectionsHaveContent = (sections = {}) => Object.values(sections).some((items) =>
  Array.isArray(items) && items.some((item) => Array.isArray(item?.data) ? item.data.length > 0 : !!item),
);
