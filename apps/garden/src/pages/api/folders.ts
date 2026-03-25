import type { APIRoute } from "astro";
import { auth } from "../../lib/auth";
import { resolveUser } from "../../lib/roles";
import { getFoldersForGarden } from "../../lib/folders";
import { getGardenByName } from "../../lib/gardens";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const gardenName = context.url.searchParams.get("garden");
  if (!gardenName) {
    return new Response(JSON.stringify({ error: "garden parameter required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const garden = getGardenByName(gardenName);
  if (!garden) {
    return new Response(JSON.stringify({ error: "Garden not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const folders = getFoldersForGarden(garden.id);

  return new Response(
    JSON.stringify({
      folders: folders.map((f) => ({
        name: f.name,
        display_name: f.display_name,
        icon: f.icon,
        is_global: !!f.is_global,
      })),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
