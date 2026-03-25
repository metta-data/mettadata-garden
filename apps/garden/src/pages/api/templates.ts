import type { APIRoute } from "astro";
import { isValidGarden } from "../../lib/gardens";
import { getTemplatesForGarden } from "../../lib/templates";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const garden = context.url.searchParams.get("garden");

  if (!garden || !isValidGarden(garden)) {
    return new Response(JSON.stringify({ error: "Valid garden parameter required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const templates = getTemplatesForGarden(garden);

  return new Response(
    JSON.stringify({
      templates: templates.map((t) => ({
        name: t.name,
        description: t.description,
        source: t.source,
      })),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
