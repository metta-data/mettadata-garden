import type { APIRoute } from "astro";
import { auth } from "../../lib/auth";
import { resolveUser } from "../../lib/roles";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    });

    if (!session?.user) {
      return new Response(JSON.stringify({ user: null }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const resolved = resolveUser({
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? undefined,
    });

    return new Response(JSON.stringify({ user: resolved }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ user: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
