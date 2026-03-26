import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

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
