import {
  type ResolvedUser,
  type GardenScope,
} from "@mettadata/content-model";
import { userQueries } from "./db";
import { getGardenNames } from "./gardens";

interface UserRow {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
  gardens: string;
  created_at: string;
  last_login: string | null;
}

/**
 * Resolve a full user object from OAuth profile + SQLite role data.
 * Returns null if the user has no elevated role (viewer).
 */
export function resolveUser(profile: {
  email: string;
  name: string;
  image?: string;
}): ResolvedUser | null {
  const row = userQueries.getByEmail.get(profile.email) as UserRow | undefined;
  if (!row) return null;

  const role = row.role as "admin" | "steward";
  if (role !== "admin" && role !== "steward") return null;

  const gardens: string[] =
    role === "admin"
      ? getGardenNames()
      : (JSON.parse(row.gardens || "[]") as string[]);

  return {
    email: row.email,
    name: row.name,
    image: row.image ?? undefined,
    role,
    gardens,
  };
}

/**
 * Upsert a user on OAuth login. Creates if new, updates name/image/last_login if existing.
 */
export function upsertUserOnLogin(profile: {
  email: string;
  name: string;
  image?: string;
}) {
  const id = crypto.randomUUID();
  userQueries.upsertOnLogin.run(
    id,
    profile.email,
    profile.name,
    profile.image || null
  );
}

/**
 * Check if a user can access/manage a specific garden.
 */
export function canAccessGarden(
  user: ResolvedUser | null,
  garden: string
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.gardens.includes(garden);
}

/**
 * Check if a user can seed a note that belongs to the given gardens.
 */
export function canSeedNote(
  user: ResolvedUser | null,
  noteGardens: string[]
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return noteGardens.some((g) => user.gardens.includes(g));
}
