# Changelog

All notable changes to Mettadata Garden will be documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Click wikilink to create note (auto-creates file with title, inherits alias if present)
- Wikilink autocomplete popup when typing `[[` (search existing notes by title and alias)
- Slash commands for editor (`/heading`, `/list`, `/code`)
- Image embeds in editor
- Table support in editor
- Mermaid diagram rendering in code blocks
- Graph visualization of connected notes
- Calendar/daily notes view
- RSS feed for blog
- Obsidian vault import/migration tool

## [0.1.0] - 2026-03-24

### Added
- Digital garden with markdown notes and growth stages (seed, sprout, sapling, evergreen)
- Blog platform with wikilink references to garden notes
- Wikilinks with aliases (`[[Note|display text]]`) and backlinks
- Multi-garden scoping (professional, spiritual, academic, private)
- Google OAuth authentication with role-based access control
- Admin, steward, and viewer roles with garden-level permissions
- User management admin panel with SQLite persistence
- LLM seeding with Anthropic and OpenAI support (CLI + web UI)
- Tiptap WYSIWYG editor with live markdown rendering
- Interactive checkboxes, headings, bold/italic, lists, code blocks
- Inline editing on note pages (edit/save/cancel toggle)
- Light/dark theme with system preference detection
- Cmd+K search dialog (Pagefind)
- Inbox file drop system for quick note capture
- Public changelog page
- GitHub Actions CI/CD pipeline
- Monorepo architecture (Turborepo + pnpm workspaces)
