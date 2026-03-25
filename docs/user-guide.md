# Mettadata Garden — User Guide

## Overview

Mettadata Garden is a digital garden + blogging platform. Notes grow through stages, connect via wikilinks, and are organized into scoped gardens.

## Gardens

Notes belong to one or more gardens that control where they appear:

| Garden | Visibility | Use For |
|---|---|---|
| `professional` | Public | Career, tech, industry knowledge |
| `spiritual` | Public | Philosophy, meditation, practice |
| `academic` | Public | Research, study notes, citations |
| `private` | Never published | Journal, personal notes, drafts |

Notes can appear in multiple public gardens. Private notes never appear on the website.

## Creating Notes

### Method 1: Direct File Creation

Create a `.md` file in `apps/garden/src/content/garden/` with this frontmatter:

```yaml
---
title: My Note Title
aliases: [alternate name, another name]
stage: seed
tags: [topic1, topic2]
created: 2026-03-24
updated: 2026-03-24
publish: true
gardens: [professional]
description: A brief description for previews and SEO.
---

Your content here...
```

### Method 2: Inbox Drop

Drop a `.md` file into the `inbox/` folder, then run:

```bash
pnpm inbox          # Process once
pnpm inbox:watch    # Watch for new files continuously
```

Files without frontmatter will get default frontmatter added (private garden, seed stage). Files with frontmatter are routed to the appropriate location based on their `gardens` field.

## Growth Stages

Notes progress through four stages as they mature:

| Stage | Meaning |
|---|---|
| `seed` | Just planted — an initial idea or stub |
| `sprout` | Growing — developing structure and content |
| `sapling` | Maturing — mostly formed but still evolving |
| `evergreen` | Established — reliable reference material |

Set the stage in frontmatter: `stage: sprout`

## Wikilinks

Link between notes using double-bracket syntax:

| Syntax | Result |
|---|---|
| `[[Stoicism]]` | Links to the Stoicism note |
| `[[Stoicism\|stoic philosophy]]` | Links to Stoicism, displays "stoic philosophy" |
| `[[Nonexistent Note]]` | Renders as a red "missing" link |

Wikilinks resolve by matching against:
1. Note titles (exact, case-insensitive)
2. Aliases defined in frontmatter
3. Filenames

Links to private notes from public notes render as "(private note)" with no clickable link.

## Blog Posts

Blog posts live in `apps/garden/src/content/blog/` and use this frontmatter:

```yaml
---
title: My Blog Post
date: 2026-03-24
tags: [topic1, topic2]
description: A summary for previews.
draft: false
gardens: [professional]
gardenRefs: [stoicism, marcus-aurelius]
---
```

- Blog posts can use the same `[[wikilink]]` syntax to link to garden notes
- The `gardenRefs` field creates a "Referenced Garden Notes" section at the bottom
- Set `draft: true` to hide from the public site

## Backlinks

Each garden note automatically shows a "Linked from" section listing all other notes that link to it. This is computed at build time from wikilinks across all content.

## Search

Press `Cmd+K` (or `Ctrl+K`) to open the search dialog. Search indexes note titles, content, and tags. Search is powered by Pagefind and works entirely client-side after the site is built.

## LLM Seeding

For notes that are stubs (stage: `seed`), you can use LLM seeding to generate a Wikipedia-style lead section:

**CLI:**
```bash
LLM_PROVIDER=anthropic pnpm seed stoicism
LLM_PROVIDER=openai pnpm seed stoicism --force  # Re-seed an already seeded note
```

**Web UI:** When logged in with the appropriate role, a "Seed with AI" button appears on unseeded garden note pages. Admins can also re-seed previously seeded notes.

## Authentication & Roles

Sign in with Google using the "Sign in" button in the header.

| Role | What You Can Do |
|---|---|
| Admin | Full access — seed any note, manage all gardens |
| Steward | Seed notes only in your assigned gardens |
| Anonymous | Read published content, search, browse |

Your role is assigned by the site admin in the roles configuration. If you sign in but aren't in the roles config, you'll have the same read-only access as anonymous visitors.

## Themes

Toggle between light mode, dark mode, and system preference using the theme button in the header. Your preference is saved in your browser.
