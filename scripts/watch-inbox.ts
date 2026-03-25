import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INBOX_DIR = path.resolve(__dirname, "../inbox");
const GARDENS_DIR = path.resolve(
  __dirname,
  "../apps/garden/src/content/gardens"
);

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
const GARDEN_REGEX = /^garden:\s*(\w+)/m;

function getDefaultFrontmatter(filename: string): string {
  const title = filename
    .replace(/\.md$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const now = new Date().toISOString().split("T")[0];

  return `---
title: "${title}"
aliases: []
stage: seed
tags: []
created: ${now}
updated: ${now}
publish: false
description: ""
---

`;
}

function processFile(filepath: string) {
  const filename = path.basename(filepath);
  if (!filename.endsWith(".md")) return;

  let content = fs.readFileSync(filepath, "utf-8");
  const hasFrontmatter = FRONTMATTER_REGEX.test(content);

  if (!hasFrontmatter) {
    // Inject default frontmatter
    content = getDefaultFrontmatter(filename) + content;
  }

  // Determine garden from frontmatter (optional `garden:` field)
  const fmMatch = content.match(FRONTMATTER_REGEX);
  let garden = "private"; // default to private
  if (fmMatch) {
    const gardenMatch = fmMatch[1].match(GARDEN_REGEX);
    if (gardenMatch) {
      garden = gardenMatch[1];
    }
    // Also support legacy `gardens: [...]` array — use first non-private
    const gardensMatch = fmMatch[1].match(/^gardens:\s*\[([^\]]*)\]/m);
    if (gardensMatch) {
      const gardens = gardensMatch[1]
        .split(",")
        .map((g) => g.trim().replace(/['"]/g, ""))
        .filter(Boolean);
      const nonPrivate = gardens.filter((g) => g !== "private");
      garden = nonPrivate.length > 0 ? nonPrivate[0] : "private";
      // Strip the gardens field since folder determines garden
      content = content.replace(/^gardens:\s*\[[^\]]*\]\n?/m, "");
    }
    // Strip the garden field too if present (folder determines it)
    content = content.replace(/^garden:\s*\w+\n?/m, "");
  }

  const targetDir = path.join(GARDENS_DIR, garden, "notes");

  // Ensure target directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, filename);

  if (fs.existsSync(targetPath)) {
    console.log(`  Skipping ${filename} — already exists at ${targetPath}`);
    return;
  }

  fs.writeFileSync(targetPath, content, "utf-8");
  fs.unlinkSync(filepath);
  console.log(`  Moved ${filename} → ${path.relative(process.cwd(), targetPath)}`);
}

function processInbox() {
  if (!fs.existsSync(INBOX_DIR)) {
    console.log("Inbox directory not found:", INBOX_DIR);
    return;
  }

  const files = fs.readdirSync(INBOX_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.log("Inbox is empty.");
    return;
  }

  console.log(`Processing ${files.length} file(s) from inbox...`);
  for (const file of files) {
    processFile(path.join(INBOX_DIR, file));
  }
  console.log("Done.");
}

// Run
const watchMode = process.argv.includes("--watch");

if (watchMode) {
  console.log(`Watching inbox at ${INBOX_DIR}...`);
  processInbox(); // process existing files first

  fs.watch(INBOX_DIR, (eventType, filename) => {
    if (filename?.endsWith(".md")) {
      const filepath = path.join(INBOX_DIR, filename);
      if (fs.existsSync(filepath)) {
        console.log(`\nNew file detected: ${filename}`);
        processFile(filepath);
      }
    }
  });
} else {
  processInbox();
}
