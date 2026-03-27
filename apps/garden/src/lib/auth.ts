import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import type { ResolvedUser } from "@mettadata/content-model";

// Pre-populate all tables Better Auth needs (singular names)
const db: Record<string, any[]> = {
  user: [],
  session: [],
  account: [],
  verification: [],
  jwks: [],
  oauthApplication: [],
  oauthAccessToken: [],
  oauthConsent: [],
};

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4321",
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me-in-production",
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  database: memoryAdapter(db),
});

/**
 * Get the authenticated user from a request.
 * In dev mode, falls back to the admin user when no OAuth session exists.
 */
export async function getSessionUser(
  headers: Headers,
  resolveUser: (profile: { email: string; name: string; image?: string }) => ResolvedUser | null,
  upsertUserOnLogin?: (profile: { email: string; name: string; image?: string }) => void,
): Promise<ResolvedUser | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null);

  if (session?.user) {
    return resolveUser({
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? undefined,
    });
  }

  // Dev mode: auto-login as admin
  if (process.env.NODE_ENV !== "production") {
    const adminEmail = import.meta.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@localhost";
    const profile = { email: adminEmail, name: "Dev Admin" };
    upsertUserOnLogin?.(profile);
    return resolveUser(profile);
  }

  return null;
}
