// 🔐 Check if user has a specific permission
// Uses UserContext (which gets data from profile API)
// NOT from localStorage

export const hasPermission = (codename, userContext) => {
  const user = userContext?.user;
  const perms = user?.permissions || [];
  return perms.includes(codename);
};

