export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ["/login", "/login2", "/signup"];
  const isPublicPath = publicPaths.some((path) => to.path.startsWith(path));
  if (isPublicPath) return;

  try {
    await $fetch("/wallet-api/auth/session", {
      method: "GET",
      credentials: "include",
    });
  } catch {
    const redirect = encodeURIComponent(to.fullPath || "/");
    return navigateTo(`/login?redirect=${redirect}`);
  }
});
