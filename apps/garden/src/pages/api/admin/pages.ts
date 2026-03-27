import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { resolveUser } from "../../../lib/roles";
import { getPage, getNavPages, getAllPages, writePage, deletePage } from "../../../lib/pages";
import { queueContentSync } from "../../../lib/content-sync";

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

  const pages = getAllPages();
  return json({ pages });
};

export const POST: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { slug, title, description, nav_order, nav_label, draft, html } = body;

  if (!slug?.trim()) return json({ error: "Slug is required" }, 400);
  if (!title?.trim()) return json({ error: "Title is required" }, 400);

  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleanSlug) return json({ error: "Invalid slug" }, 400);

  // Check if page already exists
  const existing = getPage(cleanSlug);
  if (existing) return json({ error: `Page "${cleanSlug}" already exists` }, 400);

  writePage(cleanSlug, {
    title: title.trim(),
    description: description?.trim() || undefined,
    nav_order: nav_order !== undefined && nav_order !== "" ? Number(nav_order) : undefined,
    nav_label: nav_label?.trim() || undefined,
    draft: !!draft,
  }, html || "");
  queueContentSync();

  return json({ success: true });
};

export const PUT: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { slug, title, description, nav_order, nav_label, draft, html } = body;

  if (!slug) return json({ error: "Slug is required" }, 400);

  const existing = getPage(slug);
  if (!existing) return json({ error: "Page not found" }, 404);

  writePage(slug, {
    title: title?.trim() || existing.meta.title,
    description: description?.trim() || undefined,
    nav_order: nav_order !== undefined && nav_order !== "" ? Number(nav_order) : undefined,
    nav_label: nav_label?.trim() || undefined,
    draft: draft !== undefined ? !!draft : existing.meta.draft,
  }, html !== undefined ? html : existing.html);
  queueContentSync();

  return json({ success: true });
};

export const DELETE: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { slug } = body;

  if (!slug) return json({ error: "Slug is required" }, 400);

  const success = deletePage(slug);
  if (!success) return json({ error: "Page not found" }, 404);

  queueContentSync();
  return json({ success: true });
};
