#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/data}"
CONTENT_DIR="${CONTENT_DIR:-$DATA_DIR/content}"

# On first boot, seed the volume with initial content and database
if [ ! -f "$DATA_DIR/.initialized" ]; then
  echo "First boot — seeding persistent volume..."

  mkdir -p "$CONTENT_DIR"
  mkdir -p "$DATA_DIR"

  # Copy seed content if volume is empty
  if [ -d /app/seed-content ] && [ -z "$(ls -A "$CONTENT_DIR" 2>/dev/null)" ]; then
    echo "Copying seed content to $CONTENT_DIR"
    rsync -a /app/seed-content/ "$CONTENT_DIR/"
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
