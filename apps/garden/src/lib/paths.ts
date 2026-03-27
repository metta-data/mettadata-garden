import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Centralized path configuration.
 *
 * In production (Railway), set CONTENT_DIR and DATA_DIR to point at the
 * persistent volume. Locally they fall back to the source tree.
 */

/** Root of the content directory (contains gardens/, templates/, pages/, blog/) */
export const CONTENT_DIR =
  process.env.CONTENT_DIR || path.resolve(__dirname, "../content");

/** Directory containing garden subdirectories */
export const GARDENS_DIR = path.join(CONTENT_DIR, "gardens");

/** Directory containing blog posts */
export const BLOG_DIR = path.join(CONTENT_DIR, "blog");

/** Directory where the SQLite database lives */
export const DATA_DIR =
  process.env.DATA_DIR || path.resolve(__dirname, "../../../data");

/** Full path to the SQLite database file */
export const DB_PATH = path.join(DATA_DIR, "garden.db");

/** Trash directories for soft-deleted content */
export const NOTES_TRASH_DIR = path.join(GARDENS_DIR, ".trash");
export const BLOG_TRASH_DIR = path.join(BLOG_DIR, ".trash");
