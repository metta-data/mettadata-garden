import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import { remarkWikilinks } from "@mettadata/remark-garden";
import { buildResolutionMapSync } from "./src/lib/build-resolution-map.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gardensContentDir = path.join(__dirname, "src/content/gardens");

// Build the resolution maps at config time by reading files directly
const { qualified, unqualified } = buildResolutionMapSync(gardensContentDir);

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    remarkPlugins: [
      [remarkWikilinks, { qualified, unqualified }],
    ],
  },
});
