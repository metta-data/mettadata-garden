import type { APIRoute } from "astro";
import { getAllGardens, getPublicGardens } from "../../lib/gardens";
import { auth } from "../../lib/auth";
import { resolveUser } from "../../lib/roles";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  // Check if user is authenticated — if so, return gardens they can access
  const session = await auth.api.getSession({
    headers: context.request.headers,
  });

  if (session?.user) {
    const user = resolveUser({
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? undefined,
    });

    if (user) {
      // Admin sees all, steward sees their assigned gardens + private
      const all = getAllGardens();
      const visible = user.role === "admin"
        ? all
        : all.filter((g) => g.name === "private" || user.gardens.includes(g.name));

      return new Response(JSON.stringify({ gardens: visible }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Unauthenticated or no role — return only public gardens
  const publicGardens = getPublicGardens();
  return new Response(JSON.stringify({ gardens: publicGardens }), {
    headers: { "Content-Type": "application/json" },
  });
};
