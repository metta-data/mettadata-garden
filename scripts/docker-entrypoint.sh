#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/data}"
CONTENT_DIR="${CONTENT_DIR:-$DATA_DIR/content}"

# Git-based content recovery: if the volume is empty but a content branch exists,
# restore from git instead of using seed data.
restore_from_git() {
  if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_REPO" ]; then
    return 1
  fi

  INSTANCE_NAME="${INSTANCE_NAME:-default}"
  BRANCH="content/${INSTANCE_NAME}"
  REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"

  echo "Checking for content backup on branch ${BRANCH}..."

  # Check if the branch exists on remote
  if git ls-remote --exit-code --heads "$REPO_URL" "$BRANCH" >/dev/null 2>&1; then
    echo "Found content backup — restoring from git..."
    git clone --single-branch --branch "$BRANCH" --depth 1 "$REPO_URL" "$CONTENT_DIR"
    # Remove .git dir — the content-sync module will re-init at runtime
    rm -rf "$CONTENT_DIR/.git"
    echo "Content restored from git backup."
    return 0
  else
    echo "No content backup branch found."
    return 1
  fi
}

# On first boot, seed the volume with initial content and database
if [ ! -f "$DATA_DIR/.initialized" ]; then
  echo "First boot — seeding persistent volume..."

  mkdir -p "$CONTENT_DIR"
  mkdir -p "$DATA_DIR"

  # Try git restore first, fall back to seed content
  if [ -z "$(ls -A "$CONTENT_DIR" 2>/dev/null)" ]; then
    if ! restore_from_git; then
      # Copy seed content if volume is empty and no git backup
      if [ -d /app/seed-content ]; then
        echo "Copying seed content to $CONTENT_DIR"
        rsync -a /app/seed-content/ "$CONTENT_DIR/"
      fi
    fi
  fi

  # Copy seed database if none exists
  if [ -d /app/seed-data ] && [ ! -f "$DATA_DIR/garden.db" ]; then
    echo "Copying seed database to $DATA_DIR"
    cp -a /app/seed-data/. "$DATA_DIR/" 2>/dev/null || true
  fi

  touch "$DATA_DIR/.initialized"
  echo "Volume initialization complete."
fi

# Ensure content directories exist
mkdir -p "$CONTENT_DIR/gardens"
mkdir -p "$CONTENT_DIR/templates"
mkdir -p "$CONTENT_DIR/pages"
mkdir -p "$CONTENT_DIR/blog"

echo "Starting server..."
exec "$@"
