export const getActiveRoleKeys = (roles = {}) =>
  ['owner', 'nominee'].filter((key) => Boolean(roles?.[key]));

export const hasMultipleActiveRoles = (roles = {}) => getActiveRoleKeys(roles).length > 1;

export const toSessionRole = (roleKey) => {
  if (roleKey === 'nominee') return 'nominee';
  return 'user';
};

export const toRoleKey = (sessionRole) => {
  if (sessionRole === 'nominee') return 'nominee';
  return 'owner';
};

export const getRouteForSessionRole = (sessionRole) => {
  if (sessionRole === 'nominee') return '/nominee-dashboard';
  return '/(tabs)';
};

export const getDefaultSessionRole = (roles = {}, fallbackRole = 'user') => {
  const available = getActiveRoleKeys(roles);
  if (available.length === 0) {
    return fallbackRole;
  }

  const fallbackKey = toRoleKey(fallbackRole);
  if (available.includes(fallbackKey)) {
    return toSessionRole(fallbackKey);
  }

  return toSessionRole(available[0]);
};
