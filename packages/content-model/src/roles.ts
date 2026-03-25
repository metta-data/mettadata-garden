import { z } from "zod";
import type { GardenScope } from "./frontmatter.js";

export const USER_ROLES = ["admin", "steward"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const RoleEntrySchema = z.discriminatedUnion("role", [
  z.object({
    email: z.string().email(),
    role: z.literal("admin"),
  }),
  z.object({
    email: z.string().email(),
    role: z.literal("steward"),
    gardens: z.array(z.string()).min(1),
  }),
]);

export const RolesConfigSchema = z.object({
  roles: z.array(RoleEntrySchema),
});

export type RoleEntry = z.infer<typeof RoleEntrySchema>;
export type RolesConfig = z.infer<typeof RolesConfigSchema>;

export interface ResolvedUser {
  email: string;
  name: string;
  image?: string;
  role: UserRole;
  gardens: GardenScope[]; // gardens this user can manage (all for admin)
}
