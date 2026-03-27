import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CONTENT_DIR } from "./paths";

const exec = promisify(execFile);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // e.g., "metta-data/mettadata-garden"
const INSTANCE_NAME = process.env.INSTANCE_NAME; // e.g., "blog-mott-blog"

const BRANCH = INSTANCE_NAME ? `content/${INSTANCE_NAME}` : "content/default";

let initialized = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

/**
 * Run a git command in the content directory.
 */
async function git(...args: string[]) {
  const { stdout, stderr } = await exec("git", args, { cwd: CONTENT_DIR });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

/**
 * Initialize git repo in the content directory if not already done.
 */
async function ensureGitRepo() {
  if (initialized) return true;
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return false;
  }

  try {
    // Check if already a git repo
    await git("rev-parse", "--git-dir");
  } catch {
    // Not a git repo — initialize
    await git("init");
    await git("checkout", "-b", BRANCH);
  }

  // Configure remote
  const remoteUrl = `https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git`;
  try {
    await git("remote", "set-url", "origin", remoteUrl);
  } catch {
    await git("remote", "add", "origin", remoteUrl);
  }

  // Configure git identity for commits
  await git("config", "user.email", "garden-bot@mettadata.org");
  await git("config", "user.name", "Garden Content Sync");

  // Ensure we're on the right branch
  try {
    const { stdout: currentBranch } = await git("branch", "--show-current");
    if (currentBranch !== BRANCH) {
      await git("checkout", "-B", BRANCH);
    }
  } catch {
    await git("checkout", "-b", BRANCH);
  }

  initialized = true;
  console.log(`[content-sync] Initialized git repo on branch ${BRANCH}`);
  return true;
}

/**
 * Perform the actual git add, commit, and push.
 */
async function doSync() {
  if (syncing) return;
  syncing = true;

  try {
    const ready = await ensureGitRepo();
    if (!ready) return;

    // Stage all changes in content directory (excluding .trash)
    await git("add", "-A", ".");

    // Check if there are staged changes
    try {
      await git("diff", "--cached", "--quiet");
      // No changes — nothing to commit
      return;
    } catch {
      // There are changes — proceed with commit
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await git("commit", "-m", `Content sync ${now}`);

    // Push (create remote branch if needed)
    try {
      await git("push", "-u", "origin", BRANCH);
    } catch (err) {
      // If push fails (e.g., network), log but don't crash
      console.error("[content-sync] Push failed:", err);
    }

    console.log("[content-sync] Synced content to git");
  } catch (err) {
    console.error("[content-sync] Sync error:", err);
  } finally {
    syncing = false;
  }
}

/**
 * Queue a content sync. Debounces — waits 5 seconds after the last call
 * before actually syncing. Fire-and-forget: never blocks the caller.
 */
export function queueContentSync() {
  // Skip in dev mode
  if (import.meta.env.DEV) return;
  if (!GITHUB_TOKEN || !GITHUB_REPO) return;

  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    doSync();
  }, 5000);
}
