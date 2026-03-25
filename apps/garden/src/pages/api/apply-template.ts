import type { APIRoute } from "astro";
import { auth } from "../../lib/auth";
import { resolveUser, canAccessGarden } from "../../lib/roles";
import { getTemplatesForGarden } from "../../lib/templates";
import { processTemplate } from "../../lib/template-engine";

export const prerender = false;

/**
 * POST /api/apply-template
 * Body: { garden, template, title?, folder? }
 * Returns: { body } — the processed template body ready to insert
 */
export const POST: APIRoute = async (context) => {
  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session?.user) {
    return json({ error: "Not authenticated" }, 401);
  }

  const user = resolveUser({
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? undefined,
  });
  if (!user) return json({ error: "No role assigned" }, 403);

  const body = await context.request.json();
  const { garden, template, title, folder } = body as {
    garden: string;
    template: string;
    title?: string;
    folder?: string;
  };

  if (!garden || !template) {
    return json({ error: "garden and template are required" }, 400);
  }

  if (!canAccessGarden(user, garden)) {
    return json({ error: "No permission for this garden" }, 403);
  }

  const templates = getTemplatesForGarden(garden);
  const found = templates.find((t) => t.name === template);
  if (!found) {
    return json({ error: `Template "${template}" not found` }, 404);
  }

  const processed = processTemplate(found.body, {
    title: title || "",
    garden,
    folder: folder || "",
  });

  // Process template variables in string property values too
  const processedProperties: Record<string, any> = {};
  for (const [key, value] of Object.entries(found.properties)) {
    if (typeof value === "string") {
      processedProperties[key] = processTemplate(value, {
        title: title || "",
        garden,
        folder: folder || "",
      });
    } else {
      processedProperties[key] = value;
    }
  }

  return json({ body: processed, name: found.name, properties: processedProperties });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
