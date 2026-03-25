import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { GardenNoteSchema, BlogPostSchema } from "@mettadata/content-model";

const gardens = defineCollection({
  loader: glob({ pattern: "*/notes/**/*.md", base: "./src/content/gardens" }),
  schema: GardenNoteSchema,
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: BlogPostSchema,
});

export const collections = { gardens, blog };
