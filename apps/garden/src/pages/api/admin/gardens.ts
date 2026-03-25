import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { resolveUser } from "../../../lib/roles";
import {
  getAllGardens,
  createGarden,
  updateGarden,
  updateGardenConfig,
  renameGarden,
  deleteGarden,
  getGardenNoteCount,
} from "../../../lib/gardens";

export const prerender = false;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  const user = resolveUser({
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? undefined,
  });
  if (!user || user.role !== "admin") return null;
  return user;
}

export const GET: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const gardens = getAllGardens().map((g) => ({
    ...g,
    noteCount: getGardenNoteCount(g.name),
  }));

  return json({ gardens });
};

export const POST: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { name, display_name, description, icon, icon_type, published } = body;

  if (!name?.trim()) {
    return json({ error: "Garden name is required" }, 400);
  }

  try {
    const garden = createGarden({
      name: name.trim(),
      display_name: display_name || name.trim(),
      description: description || "",
      icon: icon || "",
      icon_type: icon_type || "emoji",
      published: !!published,
    });
    return json({ success: true, garden });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Failed to create garden" }, 400);
  }
};

export const PUT: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { id, name, display_name, description, icon, icon_type, published, sort_order,
    daily_notes_enabled, daily_notes_template, daily_notes_folder, calendar_enabled, custom_domain } = body;

  if (!id) return json({ error: "Garden ID is required" }, 400);

  // Handle rename if name changed
  if (name !== undefined) {
    const renamed = renameGarden(id, name);
    if (!renamed && name) {
      return json({ error: "Failed to rename garden — name may be taken or invalid" }, 400);
    }
  }

  const garden = updateGarden(id, {
    display_name,
    description,
    icon,
    icon_type,
    published,
    sort_order,
    custom_domain,
  });

  if (!garden) return json({ error: "Garden not found" }, 404);

  // Update daily notes / calendar config if any provided
  if (daily_notes_enabled !== undefined || daily_notes_template !== undefined ||
      daily_notes_folder !== undefined || calendar_enabled !== undefined) {
    updateGardenConfig(id, {
      daily_notes_enabled: daily_notes_enabled !== undefined ? !!daily_notes_enabled : undefined,
      daily_notes_template,
      daily_notes_folder,
      calendar_enabled: calendar_enabled !== undefined ? !!calendar_enabled : undefined,
    });
  }

  // Re-fetch to include config changes
  const updated = getAllGardens().find((g) => g.id === id);
  return json({ success: true, garden: updated || garden });
};

export const DELETE: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { id } = body;

  if (!id) return json({ error: "Garden ID is required" }, 400);

  const result = deleteGarden(id);
  if (!result.success) {
    return json({ error: result.error }, 400);
  }

  return json({ success: true });
};
