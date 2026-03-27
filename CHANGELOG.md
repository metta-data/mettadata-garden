# Changelog

## [Unreleased]

### Added
- **Masked content syntax** — Use `%%text%%` in notes and blog posts to hide text from visitors. Admins (and eventually stewards) see masked content with an accent border. Implemented as a remark plugin (`remarkMasked`).
- **Delete-to-trash** — Notes and blog posts can be deleted from the inline editor. Files move to `.trash/` directories instead of being permanently deleted.
- **Trash admin page** — View, restore, and permanently delete trashed items at `/admin/trash`.
- **Dev auto-login** — Automatically sign in as admin during local development (no OAuth needed). Disabled in production builds.
- **Visitor preview mode** — Append `?preview=visitor` to any URL in dev mode to see the page as an anonymous visitor.
- **Git-based content backup** — Content changes are automatically committed and pushed to a `content/{instance}` branch on GitHub. Requires `GITHUB_TOKEN`, `GITHUB_REPO`, and `INSTANCE_NAME` env vars on Railway.
- **Git-based content recovery** — On fresh deploy with empty volume, the entrypoint restores content from the git backup branch before falling back to seed data.

### Changed
- **Auth helper consolidation** — Replaced direct `auth.api.getSession()` calls with `getSessionUser()` across all API routes and pages, enabling consistent dev-mode bypass.
- **Blog delete** — Changed from permanent delete (`unlinkSync`) to soft-delete (move to `.trash/`).

### Fixed
- **Private garden visible to admins** — Admin users can now see the private garden in the garden listing, selector dropdown, and all private notes.

### Planned
- **Image uploads to CDN** — Upload images to Cloudflare R2 or S3 and insert URLs into markdown. Currently images are backed up via git which works for moderate use but won't scale for media-heavy content.

### Removed
- Extra sample content — kept one note (`stoicism.md`), one blog post (`building-a-digital-garden.md`), and both templates. Removed empty garden directories (academic, example, professional).

## [0.1.0] - 2026-03-26

### Added
- Initial release with Railway deployment support
- Google OAuth authentication via Better Auth
- Garden notes with growth stages, wikilinks, and inline editing
- Blog posts with draft support
- Admin dashboard with garden, folder, user, template, and page management
- AI content seeding via Anthropic/OpenAI
- Custom domain support per garden
- Daily notes with calendar view
- TiptapEditor with wikilink autocomplete
