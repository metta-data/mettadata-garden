# Mettadata Garden — Admin Guide

## Prerequisites

- Node.js 22+
- pnpm 10+

## Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd mettadata-garden

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with your API keys
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | No | `anthropic` (default) or `openai` |
| `ANTHROPIC_API_KEY` | For seeding | Anthropic API key |
| `OPENAI_API_KEY` | For seeding | OpenAI API key |
| `GOOGLE_CLIENT_ID` | For auth | Google OAuth client ID (see below) |
| `GOOGLE_CLIENT_SECRET` | For auth | Google OAuth client secret |
| `BETTER_AUTH_SECRET` | For auth | Session secret (generate with `openssl rand -base64 32`) |

## Authentication & Roles

### Setting Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `http://localhost:4321/api/auth/callback/google` (dev) and `https://yourdomain.com/api/auth/callback/google` (prod)
4. Copy the Client ID and Client Secret to your `.env`

### Role Configuration

Roles are managed in `apps/garden/src/config/roles.json`:

```json
{
  "roles": [
    {
      "email": "you@gmail.com",
      "role": "admin"
    },
    {
      "email": "contributor@gmail.com",
      "role": "steward",
      "gardens": ["spiritual", "academic"]
    }
  ]
}
```

**Roles:**
- `admin` — Full access to all features and all gardens
- `steward` — Can seed notes only in their assigned gardens

Users not in this file can still sign in via Google but will have no elevated permissions (read-only access like anonymous visitors).

### Adding a New Steward

1. Edit `apps/garden/src/config/roles.json`
2. Add an entry with their email, role `"steward"`, and the gardens they can manage
3. Rebuild and deploy

## Development

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

The dev server runs at `http://localhost:4321` by default.

## Project Structure

```
mettadata-garden/
├── apps/garden/           # Astro site (main application)
│   ├── src/content/
│   │   ├── garden/        # Garden notes (markdown)
│   │   │   ├── private/   # Private notes (gitignored, never published)
│   │   │   └── *.md       # Public notes
│   │   └── blog/          # Blog posts (markdown)
│   ├── src/pages/         # Route pages
│   ├── src/components/    # Astro + React components
│   ├── src/layouts/       # Page layouts
│   └── src/lib/           # Utilities (wikilinks, graph)
├── packages/
│   ├── content-model/     # Zod schemas & TypeScript types
│   ├── remark-garden/     # Wikilink remark plugin
│   └── ui/                # Shared React components (ThemeToggle, Search)
├── scripts/
│   ├── watch-inbox.ts     # Inbox file processor
│   └── seed.ts            # LLM seeding CLI
├── inbox/                 # Drop .md files here
└── docs/                  # This documentation
```

## Content Management

### Adding Garden Notes

Place `.md` files in `apps/garden/src/content/garden/`. See the User Guide for frontmatter format.

### Private Notes

Files in `apps/garden/src/content/garden/private/` are:
- Gitignored (never committed)
- Never included in builds
- Wikilinks to them from public notes render as "(private note)"

### Inbox Processing

```bash
pnpm inbox           # Process files once
pnpm inbox:watch     # Watch mode (uses fs.watch)
```

Dropped files without frontmatter default to `private` garden with `seed` stage.

## LLM Seeding

```bash
# Seed a specific note
pnpm seed stoicism

# Force re-seed
pnpm seed stoicism --force

# Use OpenAI instead of default Anthropic
LLM_PROVIDER=openai pnpm seed stoicism
```

## Build & Deployment

### Building

```bash
pnpm build
```

Output goes to `apps/garden/dist/`. Private notes are automatically excluded.

### GitHub Actions

The CI/CD pipeline (`.github/workflows/deploy.yml`) runs on push to `main`:
1. Installs dependencies
2. Builds the site
3. Uploads build artifact

To enable deployment, uncomment the deploy job in the workflow and configure secrets:

**For Hostinger (SFTP):**
- `FTP_SERVER` — Your Hostinger FTP hostname
- `FTP_USERNAME` — FTP username
- `FTP_PASSWORD` — FTP password

**For Railway:**
- `RAILWAY_TOKEN` — Railway API token

### Manual Deployment

```bash
pnpm build
# Upload apps/garden/dist/ to your hosting provider
```

## Monorepo Commands

```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages + app
pnpm lint             # Type-check all packages
```

Filter to specific package:
```bash
pnpm --filter @mettadata/garden dev
pnpm --filter @mettadata/content-model build
```

## Adding a New Garden Scope

1. Edit `packages/content-model/src/frontmatter.ts`
2. Add the new scope to `GARDEN_SCOPES` array
3. The garden index page automatically picks up new public gardens
4. Rebuild

## Troubleshooting

### Wikilinks not resolving
- Check that the target note's `title` or `aliases` match the wikilink text (case-insensitive)
- Run `pnpm build` — the resolution map is built at config time from markdown files on disk

### Build fails
- Run `pnpm install` to ensure dependencies are up to date
- Check for TypeScript errors: `pnpm --filter @mettadata/garden lint`

### Search not working
- Search requires a production build (`pnpm build`)
- Pagefind indexes are generated during build
- In dev mode, search will show "No results found"
