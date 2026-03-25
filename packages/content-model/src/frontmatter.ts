import { z } from "zod";

export type GardenScope = string;

export const GROWTH_STAGES = [
  "seed",
  "sprout",
  "sapling",
  "evergreen",
] as const;

export type GrowthStage = (typeof GROWTH_STAGES)[number];

export const GardenNoteSchema = z.object({
  title: z.string(),
  aliases: z.array(z.string()).default([]),
  stage: z.enum(GROWTH_STAGES).default("seed"),
  tags: z.array(z.string()).default([]),
  created: z.coerce.date(),
  updated: z.coerce.date(),
  publish: z.boolean().default(false),
  description: z.string().optional(),
  seeded: z.boolean().default(false),
  seedSource: z.string().optional(),
});

export const BlogPostSchema = z.object({
  title: z.string(),
  slug: z.string().optional(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  description: z.string(),
  draft: z.boolean().default(false),
  gardenRefs: z.array(z.string()).default([]),
  coverImage: z.string().optional(),
});

export const TemplateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export type GardenNote = z.infer<typeof GardenNoteSchema>;
export type BlogPost = z.infer<typeof BlogPostSchema>;
export type Template = z.infer<typeof TemplateSchema>;
