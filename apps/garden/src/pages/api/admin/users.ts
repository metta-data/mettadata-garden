import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { resolveUser } from "../../../lib/roles";
import { userQueries } from "../../../lib/db";

export const prerender = false;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
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
  const admin = await requireAdmin(context.request);
  if (!admin) return json({ error: "Admin access required" }, 403);

  const users = userQueries.getAll.all();
  return json({ users });
};

export const PUT: APIRoute = async (context) => {
  const admin = await requireAdmin(context.request);
  if (!admin) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { id, role, gardens } = body as {
    id: string;
    role: string;
    gardens?: string[];
  };

  if (!id || !role) {
    return json({ error: "Missing id or role" }, 400);
  }

  if (!["admin", "steward", "viewer"].includes(role)) {
    return json({ error: "Invalid role" }, 400);
  }

  const gardensJson = JSON.stringify(gardens || []);
  userQueries.updateRole.run(role, gardensJson, id);

  return json({ success: true });
};

export const DELETE: APIRoute = async (context) => {
  const admin = await requireAdmin(context.request);
  if (!admin) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { id } = body as { id: string };

  if (!id) return json({ error: "Missing id" }, 400);

  userQueries.deleteUser.run(id);
  return json({ success: true });
};
