import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OLD_CONTENT_DIR = path.resolve(
  __dirname,
  "../apps/garden/src/content/garden"
);
const NEW_GARDENS_DIR = path.resolve(
  __dirname,
  "../apps/garden/src/content/gardens"
);

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
const GARDENS_REGEX = /^gardens:\s*\[([^\]]*)\]/m;

interface MigrationResult {
  file: string;
  targetGarden: string;
  hadMultipleGardens: boolean;
  originalGardens: string[];
}

function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

function stripGardensFromFrontmatter(content: string): string {
  return content.replace(/^gardens:\s*\[[^\]]*\]\n?/m, "");
}

function migrate() {
  const files = findMarkdownFiles(OLD_CONTENT_DIR);
  const results: MigrationResult[] = [];
  const multiGardenNotes: MigrationResult[] = [];

  console.log(`Found ${files.length} notes to migrate.\n`);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");
    const fmMatch = content.match(FRONTMATTER_REGEX);
    if (!fmMatch) {
      console.log(`  Skipping ${filePath} — no frontmatter`);
      continue;
    }

    const fm = fmMatch[1];
    const gardensMatch = fm.match(GARDENS_REGEX);
    const gardens = gardensMatch
      ? gardensMatch[1]
          .split(",")
          .map((g) => g.trim().replace(/['"]/g, ""))
          .filter(Boolean)
      : ["private"];

    // Determine target garden: first non-private, or private if private-only
    const nonPrivateGardens = gardens.filter((g) => g !== "private");
    const targetGarden =
      nonPrivateGardens.length > 0 ? nonPrivateGardens[0] : "private";

    const filename = path.basename(filePath);
    const targetDir = path.join(NEW_GARDENS_DIR, targetGarden, "notes");
    const targetPath = path.join(targetDir, filename);

    // Strip gardens field from frontmatter
    const newContent = stripGardensFromFrontmatter(content);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetPath, newContent, "utf-8");

    const result: MigrationResult = {
      file: filename,
      targetGarden,
      hadMultipleGardens: gardens.length > 1,
      originalGardens: gardens,
    };
    results.push(result);

    if (gardens.length > 1) {
      multiGardenNotes.push(result);
    }

    console.log(
      `  ${filename} → ${targetGarden}/notes/ (was: [${gardens.join(", ")}])`
    );
  }

  console.log(`\nMigrated ${results.length} notes.`);

  if (multiGardenNotes.length > 0) {
    console.log(
      `\n⚠ ${multiGardenNotes.length} note(s) were in multiple gardens and need manual review:`
    );
    for (const note of multiGardenNotes) {
      console.log(
        `  - ${note.file}: was [${note.originalGardens.join(", ")}], placed in ${note.targetGarden}`
      );
    }
  }
}

migrate();
