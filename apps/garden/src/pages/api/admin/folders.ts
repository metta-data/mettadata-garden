import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { resolveUser } from "../../../lib/roles";
import {
  getAllFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} from "../../../lib/folders";
import { getAllGardens } from "../../../lib/gardens";

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

  const folders = getAllFolders();
  const gardens = getAllGardens();
  const gardenMap = Object.fromEntries(gardens.map((g) => [g.id, g]));

  return json({
    folders: folders.map((f) => ({
      ...f,
      gardenName: f.garden_id ? gardenMap[f.garden_id]?.display_name : null,
    })),
  });
};

export const POST: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { name, display_name, icon, is_global, garden_id } = body;

  if (!name?.trim()) return json({ error: "Folder name is required" }, 400);

  try {
    const folder = createFolder({
      name: name.trim(),
      display_name: display_name || name.trim(),
      icon: icon || "",
      is_global: !!is_global,
      garden_id: is_global ? null : garden_id,
    });
    return json({ success: true, folder });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Failed to create folder" }, 400);
  }
};

export const PUT: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { id, display_name, icon, default_template } = body;
  if (!id) return json({ error: "Folder ID required" }, 400);

  const folder = updateFolder(id, { display_name, icon, default_template });
  if (!folder) return json({ error: "Folder not found" }, 404);
  return json({ success: true, folder });
};

export const DELETE: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { id } = body;
  if (!id) return json({ error: "Folder ID required" }, 400);

  const result = deleteFolder(id);
  if (!result.success) return json({ error: result.error }, 400);
  return json({ success: true });
};
