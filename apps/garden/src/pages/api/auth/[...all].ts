import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";

export const prerender = false;

export const ALL: APIRoute = async (context) => {
  try {
    const response = await auth.handler(context.request);
    // If Better Auth returns an error with empty body, log it
    if (response.status >= 400) {
      const cloned = response.clone();
      const body = await cloned.text();
      console.error(`[auth] ${context.request.method} ${context.url.pathname} → ${response.status}`, body || "(empty body)");
    }
    return response;
  } catch (err) {
    console.error("[auth] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Auth error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
