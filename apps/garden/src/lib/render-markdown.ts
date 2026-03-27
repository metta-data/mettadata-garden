import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { remarkWikilinks } from "@mettadata/remark-garden";
import { remarkMasked } from "@mettadata/remark-garden";
import { buildResolutionMapSync } from "./build-resolution-map";
import { GARDENS_DIR } from "./paths";

let processor: ReturnType<typeof unified> | null = null;

function getProcessor() {
  if (!processor) {
    const { qualified, unqualified } = buildResolutionMapSync(GARDENS_DIR);
    processor = unified()
      .use(remarkParse)
      .use(remarkWikilinks, { qualified, unqualified })
      .use(remarkMasked)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });
  }
  return processor;
}

/**
 * Render markdown to HTML string using the same remark plugins as Astro.
 * Used for runtime-created notes that aren't in the content collection.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const result = await getProcessor().process(markdown);
  return String(result);
}
