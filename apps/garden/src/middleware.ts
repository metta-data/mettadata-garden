import { defineMiddleware } from "astro:middleware";
import { auth } from "./lib/auth";
import { resolveUser, upsertUserOnLogin } from "./lib/roles";
import { getGardenByCustomDomain } from "./lib/gardens";

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.gardenDomain = undefined;

  try {
    const cookieHeader = context.request.headers.get("cookie");
    if (cookieHeader) {
      const session = await auth.api.getSession({
        headers: context.request.headers,
      });

      if (session?.user) {
        upsertUserOnLogin({
          email: session.user.email,
          name: session.user.name,
          image: session.user.image ?? undefined,
        });

        context.locals.user = resolveUser({
          email: session.user.email,
          name: session.user.name,
          image: session.user.image ?? undefined,
        });
      }
    }

    // Dev mode: auto-login as admin when no OAuth session
    if (!context.locals.user && process.env.NODE_ENV !== "production") {
      const adminEmail = import.meta.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@localhost";
      upsertUserOnLogin({ email: adminEmail, name: "Dev Admin" });
      context.locals.user = resolveUser({ email: adminEmail, name: "Dev Admin" });
    }
  } catch {
    // Session resolution failed — continue as anonymous
  }

  // Custom domain detection: rewrite requests to the appropriate garden
  const host = context.request.headers.get("host")?.split(":")[0];
  const mainDomain = process.env.MAIN_DOMAIN || "localhost";

  if (host && host !== mainDomain && host !== "localhost") {
    const garden = getGardenByCustomDomain(host);
    if (garden) {
      context.locals.gardenDomain = garden;
      const pathname = new URL(context.request.url).pathname;

      if (pathname === "/" || pathname === "") {
        return context.rewrite(`/garden?scope=${garden.name}`);
      } else if (!pathname.startsWith("/api/") && !pathname.startsWith("/_")) {
        return context.rewrite(`/garden/${garden.name}${pathname}`);
      }
    }
  }

  return next();
});
