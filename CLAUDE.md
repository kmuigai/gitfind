# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is
An open source intelligence directory for product managers.
Surfaces rising GitHub projects with plain-English context.
Built by a non-technical founder. Prioritise simplicity over cleverness.

Full product spec: `GitFind_PRD_v2.md` — read this when working on any new feature.

## Stack
- Next.js 16.1.6, TypeScript, Tailwind CSS
- PostgreSQL via Supabase (JS client + generated types)
- Claude API (claude-sonnet-4-6) for enrichment
- Resend for email
- Vercel for deployment

## Architecture
Uses the Next.js App Router (`app/` directory):
- Pages are `app/**/page.tsx` files
- Shared UI goes in `components/`
- Data fetching happens in Server Components by default — only add `"use client"` when interactivity is required
- API routes live in `app/api/`
- GitHub API calls are isolated in `app/api/github/` — see "What NOT to touch" below

## Design principles
- **Plain English always**: all GitHub data shown to users must be translated into non-technical language — no raw stats without context, no developer jargon
- **Simplicity over cleverness**: prefer the straightforward solution; don't abstract until clearly needed

## Early Signal Score
GitFind's proprietary algorithm. Do NOT change these weights without asking first.

| Signal | Weight |
|--------|--------|
| Star velocity (7-day) | 30% |
| Contributor-to-star ratio | 25% |
| Fork velocity relative to stars | 15% |
| Cross-platform mention velocity (HN + Reddit + X) | 15% |
| Commit frequency (30-day) | 10% |
| Manipulation filter | Penalty (flag star farming) |

## Directory categories (launch)
AI/ML, Developer Tools, Security, Data & Analytics, Web Frameworks, Infrastructure & DevOps, Mobile, Open Source Utilities

## Current build phase
**Week 1–2 — Data Pipeline**
Goal: GitHub data flowing into PostgreSQL automatically, scored and enriched.
- GitHub API client (star history, contributor counts, fork velocity)
- Early Signal Score algorithm in TypeScript (unit-testable)
- Claude API enrichment: plain-English summary, "why it matters for PMs", category tag
- Supabase table setup (SQL editor) + generate types with `supabase gen types typescript`
- HN Algolia API for mention signal (free, no auth) — Reddit + X deferred post-launch
- GitHub Actions cron job — nightly, no manual trigger

## Rules — follow these always
- Never change more than one feature at a time
- TypeScript strict mode, no `any` types
- After every change: run `npm run typecheck` and `npm run lint`
- Commit after every completed task with a descriptive message
- No schema migrations without showing me the plan first
- If something is unclear, ask — don't guess

## Commands
- `npm run dev` — local dev server
- `npm run typecheck` — TypeScript check (`tsc --noEmit`)
- `npm run lint` — ESLint
- `supabase gen types typescript --project-id <id> > lib/database.types.ts` — regenerate types after schema changes

## What NOT to touch without asking
- Supabase connection strings
- Any file with `api/github` in the path (rate limit sensitive)
- The Early Signal Score algorithm once it's written
