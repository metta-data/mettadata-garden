import type { APIRoute } from "astro";
import { auth } from "../../lib/auth";
import { resolveUser, canAccessGarden } from "../../lib/roles";
import { getGardenByName } from "../../lib/gardens";
import { queueContentSync } from "../../lib/content-sync";
import {
  createDailyNote,
  getJournalEntries,
  dailyNoteExists,
} from "../../lib/daily-notes";

export const prerender = false;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// POST - create or get today's daily note
export const POST: APIRoute = async (context) => {
  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session?.user) return json({ error: "Not authenticated" }, 401);

  const user = resolveUser({
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? undefined,
  });
  if (!user) return json({ error: "No role assigned" }, 403);

  const body = await context.request.json();
  const { garden: gardenName, date: dateStr } = body as {
    garden: string;
    date?: string;
  };

  if (!gardenName) return json({ error: "Garden is required" }, 400);
  if (!canAccessGarden(user, gardenName)) {
    return json({ error: "No permission for this garden" }, 403);
  }

  const garden = getGardenByName(gardenName);
  if (!garden) return json({ error: "Garden not found" }, 404);
  if (!garden.daily_notes_enabled) {
    return json({ error: "Daily notes not enabled for this garden" }, 400);
  }

  const date = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const result = createDailyNote(gardenName, garden, date);
  queueContentSync();

  return json({
    success: true,
    slug: result.slug,
    path: result.urlPath,
    existed: dailyNoteExists(gardenName, garden.daily_notes_folder, date),
  });
};

// GET - get journal entries for a month (for calendar)
export const GET: APIRoute = async (context) => {
  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session?.user) return json({ error: "Not authenticated" }, 401);

  const user = resolveUser({
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? undefined,
  });
  if (!user) return json({ error: "No role assigned" }, 403);

  const gardenName = context.url.searchParams.get("garden");
  const monthStr = context.url.searchParams.get("month"); // "2026-03"

  if (!gardenName) return json({ error: "garden parameter required" }, 400);
  if (!canAccessGarden(user, gardenName)) {
    return json({ error: "No permission" }, 403);
  }

  const garden = getGardenByName(gardenName);
  if (!garden) return json({ error: "Garden not found" }, 404);

  // Parse month
  let year: number, month: number;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    [year, month] = monthStr.split("-").map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const folder = garden.daily_notes_folder || "journal";
  const entries = getJournalEntries(gardenName, folder, year, month);

  return json({ entries, folder });
};
