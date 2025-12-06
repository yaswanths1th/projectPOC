export const hasPermission = (codename) => {
  const user = JSON.parse(localStorage.getItem("user"));
  const perms = user?.permissions || [];
  return perms.includes(codename);
};
