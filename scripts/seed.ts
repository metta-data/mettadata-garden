import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GARDENS_DIR = path.resolve(
  __dirname,
  "../apps/garden/src/content/gardens"
);

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

async function seedNote(slug: string) {
  // slug is now "garden/note-slug"
  const segments = slug.split("/");
  if (segments.length < 2) {
    console.error("Usage: pnpm seed <garden>/<note-slug> [--force]");
    console.error("  e.g.: pnpm seed spiritual/stoicism");
    process.exit(1);
  }

  const garden = segments[0];
  const noteSlug = segments.slice(1).join("/");

  const notePath = path.join(GARDENS_DIR, garden, "notes", `${noteSlug}.md`);
  if (!fs.existsSync(notePath)) {
    console.error(`Note not found: ${notePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(notePath, "utf-8");
  const fmMatch = content.match(FRONTMATTER_REGEX);
  if (!fmMatch) {
    console.error(`No frontmatter found in: ${notePath}`);
    process.exit(1);
  }

  // Extract title from frontmatter
  const titleMatch = fmMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (!titleMatch) {
    console.error("No title found in frontmatter");
    process.exit(1);
  }
  const title = titleMatch[1];

  // Check if already seeded
  if (fmMatch[1].includes("seeded: true")) {
    console.log(`Note "${title}" is already seeded. Use --force to re-seed.`);
    if (!process.argv.includes("--force")) process.exit(0);
  }

  console.log(`Seeding "${title}" (${garden}/${noteSlug})...`);

  const provider = process.env.LLM_PROVIDER || "anthropic";
  let generatedContent: string;

  if (provider === "anthropic") {
    generatedContent = await seedWithAnthropic(title);
  } else if (provider === "openai") {
    generatedContent = await seedWithOpenAI(title);
  } else {
    console.error(`Unknown LLM_PROVIDER: ${provider}`);
    process.exit(1);
  }

  // Insert generated content after frontmatter
  const bodyStart = fmMatch.index! + fmMatch[0].length;
  const existingBody = content.slice(bodyStart);

  const updatedFrontmatter = fmMatch[0]
    .replace(/seeded:\s*false/, "seeded: true")
    .replace(
      /---\s*$/,
      fmMatch[1].includes("seeded") ? "---" : "seeded: true\n---"
    );

  const newContent =
    updatedFrontmatter +
    "\n\n" +
    generatedContent.trim() +
    "\n" +
    existingBody;

  fs.writeFileSync(notePath, newContent, "utf-8");
  console.log(`Seeded "${title}" successfully.`);
}

async function seedWithAnthropic(title: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Write a concise, encyclopedic lead section (2-3 paragraphs) about "${title}". Include key facts, context, and significance. Use a neutral, informative tone similar to the opening of a Wikipedia article. Use plain text with markdown formatting where appropriate. Do not include any headers or the title itself — just the body text.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Anthropic API error: ${response.status} ${error}`);
    process.exit(1);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function seedWithOpenAI(title: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY not set");
    process.exit(1);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Write a concise, encyclopedic lead section (2-3 paragraphs) about "${title}". Include key facts, context, and significance. Use a neutral, informative tone similar to the opening of a Wikipedia article. Use plain text with markdown formatting where appropriate. Do not include any headers or the title itself — just the body text.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`OpenAI API error: ${response.status} ${error}`);
    process.exit(1);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// CLI entry
const slug = process.argv[2];
if (!slug) {
  console.log("Usage: pnpm seed <garden>/<note-slug> [--force]");
  console.log("  e.g.: pnpm seed spiritual/stoicism");
  console.log("  LLM_PROVIDER=anthropic|openai (default: anthropic)");
  process.exit(1);
}

seedNote(slug);
