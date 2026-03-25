import type { APIRoute } from "astro";
import { canSeedNote } from "../../lib/roles";
import { isValidGarden } from "../../lib/gardens";
import fs from "node:fs";
import path from "node:path";
import { GARDENS_DIR } from "../../lib/paths";

export const prerender = false;

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await context.request.json();
  const { slug, force } = body as { slug: string; force?: boolean };

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse garden from slug: "garden/noteSlug"
  const segments = slug.split("/");
  if (segments.length < 2 || !isValidGarden(segments[0])) {
    return new Response(JSON.stringify({ error: "Invalid slug — expected garden/slug" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const garden = segments[0];
  const noteSlug = segments.slice(1).join("/");

  // Find the note file
  const notePath = path.join(GARDENS_DIR, garden, "notes", `${noteSlug}.md`);
  if (!fs.existsSync(notePath)) {
    return new Response(JSON.stringify({ error: "Note not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read the note and extract frontmatter
  const content = fs.readFileSync(notePath, "utf-8");
  const fmMatch = content.match(FRONTMATTER_REGEX);
  if (!fmMatch) {
    return new Response(JSON.stringify({ error: "Invalid note format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check permission using garden
  if (!canSeedNote(user, [garden])) {
    return new Response(
      JSON.stringify({ error: "No permission to seed this note" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check if already seeded
  if (fmMatch[1].includes("seeded: true") && !force) {
    return new Response(
      JSON.stringify({ error: "Note already seeded. Use force=true to re-seed." }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  // Extract title
  const titleMatch = fmMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (!titleMatch) {
    return new Response(JSON.stringify({ error: "No title found" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const title = titleMatch[1];

  // Call LLM
  try {
    const provider = import.meta.env.LLM_PROVIDER || "anthropic";
    const generatedContent =
      provider === "openai"
        ? await seedWithOpenAI(title)
        : await seedWithAnthropic(title);

    // Update the file
    const bodyStart = fmMatch.index! + fmMatch[0].length;
    const existingBody = content.slice(bodyStart);

    let updatedFrontmatter = fmMatch[0];
    if (fmMatch[1].includes("seeded:")) {
      updatedFrontmatter = updatedFrontmatter.replace(
        /seeded:\s*(true|false)/,
        "seeded: true"
      );
    } else {
      updatedFrontmatter = updatedFrontmatter.replace(
        /---\s*$/,
        "seeded: true\n---"
      );
    }

    const newContent =
      updatedFrontmatter +
      "\n\n" +
      generatedContent.trim() +
      "\n" +
      existingBody;

    fs.writeFileSync(notePath, newContent, "utf-8");

    return new Response(
      JSON.stringify({ success: true, title, provider }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "LLM call failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

async function seedWithAnthropic(title: string): Promise<string> {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

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
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function seedWithOpenAI(title: string): Promise<string> {
  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

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
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
