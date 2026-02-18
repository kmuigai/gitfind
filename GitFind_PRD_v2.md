# GitFind PRD — v2.2

**Git Signal · Git Context · Git Clarity · Git Smarter**
*GitHub, Translated for Product People*

> **Domain:** gitfind.ai · **Stack:** Next.js · TypeScript · PostgreSQL · Claude API
> **Status:** ACTIVE v2.2 · **MVP approach:** Directory First → Newsletter as Retention

---

## Document History

| Version | Session | Summary |
|---------|---------|---------|
| v1.0 | Session 1 | Original concept: AI-powered developer enrichment platform for technical recruiters. n8n workflow. $199/month SaaS. |
| v1.5 | Session 2 | Pivot: scrapped recruiting. Reframed as open source intelligence directory. Sponsorship-led revenue model. Claude Code replaces n8n. |
| v2.0 | Session 3 | Niche defined: PM audience primary. Newsletter-first MVP. 'Git Smarter' brand. gitfind.ai domain. OpenClaw case study informs Early Signal Score. |
| v2.1 | Session 3 | MVP flipped to directory-first. Newsletter becomes the retention mechanism at 1,000 monthly visitors, not the product itself. |
| **v2.2** | **Session 4 — Current** | **Removed Prisma (replaced with Supabase JS client + generated types). Deferred Reddit/X APIs to post-launch. Removed Algolia from MVP scope. Fixed Next.js version to 16.1.6.** |

---

## What Changed in v2.0

Every item below is a strategic decision made in the most recent session. These override or extend the v1.0 PRD where they conflict.

| Tag | Decision |
|-----|----------|
| **BRAND** | Hero tagline is now "Git Smarter" — animated on landing page cycling through: Git Signal → Git Context → Git Clarity → Git Smarter. Slot-machine deceleration effect. Final word is the permanent tagline. |
| **DOMAIN** | Primary domain is gitfind.ai (not .com, .io, or .co). gitfind.com is taken by a Mac Git client. .ai signals the product category to target audience. gitfind.io and gitfind.co redirect to .ai. |
| **AUDIENCE** | Primary audience is now Product Managers — non-technical people who need GitHub translated into product and market intelligence. VC/investor and devtool founder audiences are tier 2 and 3, monetised later via premium tiers. |
| **MVP** | Directory first, newsletter second. The directory is the product. The newsletter launches at 1,000 monthly visitors as the retention and re-engagement mechanism — "get the weekly digest of what just moved on gitfind.ai." 6-week build target. |
| **NICHE** | Three converging niches: (1) VC/investor deal sourcing signal, (2) devtool founder competitive intelligence, (3) PM digest of what's being built. All three served by the same content, different framing per tier. |
| **SIGNAL** | OpenClaw case study is the product's proof of concept. 9K → 200K stars in 60 days (fastest-growing repo in GitHub history). Nobody surfaced it early. GitFind's job: find the next OpenClaw at 9K stars, not 150K. |
| **SCORING** | Algorithm updated: add contributor-to-star ratio and cross-platform mention velocity (HN + Reddit + X). Add manipulation filter to flag star farming. Rename all instances of "Momentum Score" to "Early Signal Score". |
| **PRICING** | Sponsor pricing revised upward. Newsletter sponsorship target: $2,000–$5,000/issue at scale (was $500–$1,500). Benchmark: Lenny's Newsletter, The Pragmatic Engineer. PM + VC audience commands premium CPM. |

---

## Brand & Positioning

### Tagline: Git Smarter

The tagline works as both a command (go get smarter) and a state (become smarter). It uses the git/get pun that feels native to the developer world without excluding non-technical product managers.

**Animation mechanic — landing page hero:**

```
Git Signal    ← what GitFind finds (raw GitHub data)
Git Context   ← what GitFind adds (Claude enrichment + 'why it matters')
Git Clarity   ← what the reader feels (no more jargon)
Git Smarter   ← what the reader becomes  [lands here and holds]
```

> **Technical spec:** slot-machine deceleration. Fast cycling, slows over 2–3 seconds, lands on "Git Smarter". Dark background. Monospace or semi-monospace font for the cycling words.

### Positioning Statement

> "GitFind is the open source intelligence directory for product people. We translate what engineers are building into signal that matters for PMs, founders, and investors. **Git Smarter.**"

### The OpenClaw Proof Point

OpenClaw (formerly Clawdbot, then Moltbot) went from 9,000 to 200,000+ GitHub stars between November 2025 and early 2026 — the fastest-growing repo in GitHub history. Built by a solo Austrian developer over a weekend. It spawned Moltbook, an AI-only social network with 1.5M agent accounts in 5 days.

By the time mainstream tech media covered it, it already had 100K stars. Every VC, PM, and founder who cares about agentic AI missed the early signal.

> "OpenClaw hit 200,000 GitHub stars. Most PMs heard about it at 150,000. GitFind subscribers heard about it at 9,000."

This is the hero narrative for every marketing surface.

---

## Audience Architecture

Three audiences, one content engine, tiered monetisation. The newsletter serves all three. Premium tiers differentiate the experience for higher-value users.

| Tier | Audience | Job To Be Done | Monetisation |
|------|----------|----------------|--------------|
| 1 — Free | Product Managers | "Help me understand what engineers are building so I can make better product decisions" | Directory visitor. Ad-supported. Newsletter subscriber for retention. |
| 2 — Pro | VC / Angel Investors | "Show me the next OpenClaw before 100K stars so I can source deals earlier" | $99–$299/month. Early Signal alerts, deal flow filters. |
| 3 — Pro | Devtool Founders | "Tell me what's gaining traction in adjacent spaces before my competitors notice" | $99–$299/month. Competitive watch, category deep-dives. |

### Primary Avatar: The Product Manager

Non-technical. Works at a company building software. Reads tech news but finds GitHub impenetrable. Feels the anxiety of being the person who didn't know about OpenClaw until it was everywhere. Wants to be credible in engineering conversations without pretending to be an engineer.

> **Key insight:** You are the avatar. You're a non-technical person at iCapital who wants to understand what's being built on GitHub. Build for yourself. Every editorial decision should pass this test: "would I find this useful on a Tuesday morning?"

---

## MVP Definition: Directory First

The MVP is the directory. A fast, searchable, well-designed page that surfaces rising GitHub projects with plain-English context for non-technical people. It updates weekly. It compounds via SEO. It just sits there working.

The newsletter launches later as the retention mechanism — "get the weekly digest of what just moved on gitfind.ai." It's a feature of the directory, not the other way around.

### Directory MVP — What It Is

Launch with the minimum that makes it genuinely useful. No user accounts, no saved searches, no API. Just a fast, well-designed, browsable directory that updates weekly.

| Element | Description | Priority |
|---------|-------------|----------|
| Homepage | Hero with "Git Smarter" animation + featured rising projects | Must have |
| Category pages | 8–10 categories (AI/ML, DevTools, Security, etc.) with ranked projects | Must have |
| Project cards | Repo name, Early Signal Score, plain-English summary, "why it matters", language, stars, link | Must have |
| Search | Full-text search across repo names and summaries | Must have |
| Weekly update | Pipeline refreshes scores and adds new projects every Monday | Must have |
| Submit a project | Simple form — paid ($99) or free if score ≥ 60 | Nice to have |
| Newsletter signup | Single input at bottom of every page — "Get the weekly digest" | Nice to have |

### Directory Categories (Launch)

- AI / Machine Learning
- Developer Tools
- Security
- Data & Analytics
- Web Frameworks
- Infrastructure & DevOps
- Mobile
- Open Source Utilities

### Directory → Newsletter Trigger

**Launch the newsletter when:**

- 1,000 monthly active visitors (returning visitors, not just pageviews)
- At least one category page ranking on page 2 of Google
- Users are bookmarking and returning without being prompted

At that point you have proven the directory has value and you have an audience worth emailing. The newsletter becomes "stay updated on what's moving in the directory" — it drives return visits, not standalone value.

### Newsletter Format (When It Launches)

Five sections. Fixed every week. Claude drafts, you edit. Sent every Tuesday.

| Section | Content | Length |
|---------|---------|--------|
| 1. The Signal | One project that moved significantly this week + what it means | 3–4 paragraphs |
| 2. Three Projects Worth Knowing | 3 repos, 3 sentences each | 9 sentences |
| 3. The Trend Line | One macro pattern visible in this week's data | 1–2 paragraphs |
| 4. Competitive Watch | One category where multiple repos are racing | 1 para + list |
| 5. One-Sentence Signals | 5 repos, one sentence each | 5 lines |

---

## Early Signal Score (formerly Momentum Score)

The Early Signal Score is GitFind's proprietary algorithm for identifying projects worth knowing about before they become mainstream. Specifically designed to surface the next OpenClaw at 9K stars, not 150K.

| Signal | Weight | Rationale | OpenClaw Indicator? |
|--------|--------|-----------|---------------------|
| Star velocity (7-day) | 30% | Real-time demand signal | ✓ Visible early |
| Contributor-to-star ratio | 25% | High ratio = builders not fans. Builders join before fans star. | ✓ Strong early signal |
| Fork velocity relative to stars | 15% | People building on top before they star it | ✓ Strongest early signal |
| Cross-platform mention velocity | 15% | HN + Reddit + X chatter before mainstream press picks it up | ✓ Preceded the star explosion |
| Commit frequency (30-day) | 10% | Active maintenance. Inactive repos score lower. | ✗ Neutral |
| Manipulation filter | Penalty | Flag repos where stars cluster from new accounts or don't correlate with commit activity | N/A — quality control |

> **Why we renamed it:** "Momentum Score" describes what's already happening. "Early Signal Score" describes what's about to happen. The rename changes the product promise from reactive to predictive — which is the entire value proposition for VC and PM audiences.

---

## Domain Decision

| Domain | Decision | Rationale |
|--------|----------|-----------|
| **gitfind.ai** | ✅ PRIMARY | AI-native signal. Target audience reads .ai as a quality mark. Product is fundamentally AI-powered. Cleanly avoids confusion with gitfinder.com (Mac Git client). |
| gitfind.io | → REDIRECT | .io is oversaturated and facing ccTLD deprecation risk. Redirect to .ai. |
| gitfind.co | → REDIRECT | Reads as .com typo to non-technical audiences. No upside. Redirect to .ai. |
| gitfind.com | 🚫 AVOID | Owned by GitFinder — an established Mac Git client. Brand confusion risk. Leave alone entirely. |

---

## 6-Week MVP Build Plan

Directory only. No newsletter yet. Built entirely with Claude Code. Target: directory live on gitfind.ai by end of Week 5, newsletter launches at 1,000 monthly visitors.

### Weeks 1–2 — Data Pipeline

**Goal:** GitHub data flowing into PostgreSQL automatically, scored and enriched.

- Claude Code builds GitHub API client — fetches trending repos, star history, contributor counts, fork velocity
- Early Signal Score algorithm in TypeScript (unit-testable)
- Claude API enrichment: plain-English summary, "why it matters for PMs", category tag, relevance score
- Supabase table setup (via SQL editor) — repos, scores, categories, enrichment cache. Generate TypeScript types with `supabase gen types typescript`.
- HN Algolia API for cross-platform mention signal (free, no auth). Reddit + X deferred to post-launch.
- GitHub Actions cron job runs pipeline nightly — no manual trigger needed

### Weeks 3–4 — Directory UI

**Goal:** Fast, searchable, good-looking directory on gitfind.ai.

- Next.js 16.1.6 app with Tailwind — dark mode, mobile-responsive
- Homepage: "Git Smarter" hero animation + featured rising projects
- Category pages: ranked project cards with Early Signal Score, summary, language, stars
- Project cards: repo name, score badge, plain-English summary, "why it matters", links
- Full-text search across names and summaries
- Newsletter signup field on every page (Resend connected, ready for when it launches)

### Week 5 — Launch

**Goal:** Directory live. Post publicly. Start driving traffic.

- Deploy to Vercel
- Post on LinkedIn: "I built a GitHub intelligence directory for product managers — gitfind.ai"
- Submit to Hacker News Show HN
- Post in Lenny's, Mind the Product, and relevant PM Slack communities
- Submit to directory directories (Product Hunt, There's An AI For That, etc.)
- **Goal: 500 unique visitors in launch week**

### Week 6 — Iterate

**Goal:** Fix what's broken. Improve what's weak. Keep driving traffic.

- Every piece of feedback from launch week is a product brief — act on the top 3
- Add submit-a-project form ($99 paid, free if Early Signal Score ≥ 60)
- SEO basics: meta descriptions, og tags, sitemap, category page titles
- **Goal: 1,000 monthly visitors before newsletter launch**

---

## Revised Revenue Model

Directory-first changes the revenue sequence. Sponsored listings and paid submissions unlock immediately at launch. Newsletter sponsorship comes later once the subscriber list has depth.

| Revenue Stream | Price | When Available | Benchmark |
|----------------|-------|----------------|-----------|
| Paid project submission | $99 one-time | At directory launch | Auto-approve if Early Signal Score ≥ 60 |
| Directory sponsored listing | $299–$599/month | At directory launch (cap 3 per category) | Console.dev, Changelog — similar model |
| Newsletter sponsorship | $500–$1,500/issue (launch) → $2,000–$5,000/issue (scale) | When newsletter launches at 1,000 monthly visitors | Lenny's: ~$8K/issue @ 700K subs. Pragmatic Engineer: ~$5K @ 300K subs. |
| Pro tier — VC/Founder | $99–$299/month | After 2,000 newsletter subscribers | Early Signal alerts + deal flow filters |

### Revenue Projections

| Month | Monthly Visitors | Newsletter Subs | MRR | Key Driver |
|-------|-----------------|-----------------|-----|------------|
| 1–2 (Build) | 0 | 0 | $0 | Building, no revenue |
| 3 (Launch) | 500 | 0 | $198 | 2 paid submissions |
| 4 | 1,500 | 0 | $597 | First sponsored listing |
| 5 | 3,000 | 500 | $1,495 | 2 listings + newsletter launches |
| 6 | 5,000 | 1,200 | $2,990 | 3 listings + first newsletter sponsor |
| 9 | 12,000 | 3,500 | $6,470 | Full listings + newsletter sponsors at $2K/issue |
| 12 | 25,000 | 8,000 | $12,460 | Newsletter at $3–5K/issue + full tier stack |

---

## Updated Risk Register

| Risk | Severity | Notes |
|------|----------|-------|
| SEO takes longer than expected | Medium | Directory growth is partly SEO-dependent. Mitigate with community launch (HN, LinkedIn, PM Slack) to drive early traffic independent of search. |
| GitHub API rate limits | Medium | Directory requires more frequent API calls than newsletter-only. Mitigate with nightly cron (not real-time), caching, and incremental updates. |
| Claude API costs | Low–Medium | Directory enriches more repos than newsletter. ~200 repos/week ≈ $20–$50/week at scale. Still trivial vs revenue at 1,000 visitors. |
| PM audience too small to monetise | Low–Medium | Mitigated by tier 2/3 (VC, founders) adding revenue density. Directory also attracts devtool companies who want sponsored listings. |
| Non-technical founder building solo | Low | The non-technical voice is a differentiator. Risk is only if Claude Code build becomes a blocker — scope directory MVP tightly and cut features aggressively. |
| Sponsor market slower than expected | Medium | Mitigate by reaching out to potential sponsors at 500 monthly visitors, before you need the revenue. Early relationships compound. |
| Star manipulation / gaming Early Signal Score | Medium | Manipulation filter built into algorithm. Explicit penalty for star farming. Needs ongoing monitoring as the directory becomes known. |

---

## Tech Stack Reference

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 16.1.6 + TypeScript + Tailwind CSS | Directory, category pages, project cards, search |
| Database | PostgreSQL via Supabase (JS client + generated types) | Repo data, scores, enrichment cache |
| AI Enrichment | Claude API (claude-sonnet-4-6) | Plain-English summaries, "why it matters for PMs", category tagging |
| Data Pipeline | TypeScript + GitHub Actions cron | GitHub API fetch, Early Signal Score calculation, nightly automation |
| Email | Resend | Newsletter delivery (phase 2), subscriber management |
| Deployment | Vercel | Zero-config Next.js deployment, edge caching for fast directory pages |
| GitHub Data | GitHub REST API | Star history, contributor counts, commit frequency, fork velocity |
| Cross-platform signals | HN Algolia API (launch) — Reddit + X deferred post-launch | Cross-platform mention velocity for Early Signal Score |
| Search | Postgres full-text search | Directory search across repo names, summaries, categories |

---

*GitFind PRD v2.2 · February 2026 · Directory-First MVP*
*gitfind.ai · Git Signal · Git Context · Git Clarity · **Git Smarter***
