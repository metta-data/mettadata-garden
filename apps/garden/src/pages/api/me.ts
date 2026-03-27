import type { APIRoute } from "astro";
import { getSessionUser } from "../../lib/auth";
import { resolveUser, upsertUserOnLogin } from "../../lib/roles";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const user = await getSessionUser(
      context.request.headers,
      resolveUser,
      upsertUserOnLogin,
    );

    return new Response(JSON.stringify({ user: user ?? null }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ user: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
