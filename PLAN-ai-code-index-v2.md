# AI Code Index v2 — Product Plan

## Executive Summary

The AI Code Index currently tracks one signal: daily commit counts for 7 tools.
That's a good start, but it's a single-dimension view of a multi-dimension shift.

The opportunity: build the **Bloomberg Terminal for AI-written code** — a page so
data-dense and differentiated that it becomes the default reference for anyone
tracking AI coding tool adoption.

---

## What We Have Today

- 7-tool daily commit chart (Claude Code, Cursor, Copilot, Aider, Gemini CLI, Devin, Codex)
- Head-to-head comparison pages (21 pairings)
- Methodology section explaining detection methods
- PNG export
- Homepage Claude Code spotlight chart

**What's missing:** The page has one chart and one data type. No summary metrics,
no tables, no secondary signals, no "at a glance" value. A visitor can't answer
"which tool is growing fastest?" without hovering over the chart and doing math.

---

## Part 1: New KPIs — What Else Can We Track?

### Signal 1: Config File Adoption (repos with AI tool config files)

The strongest adoption signal isn't commits — it's when a team adds a config file
to their repo. That's a conscious decision to integrate a tool into their workflow.

| File | Tool | GitHub Code Search Query | Est. Repos |
|------|------|--------------------------|------------|
| `AGENTS.md` | Claude Code | `filename:AGENTS.md path:/` | ~55K |
| `CLAUDE.md` | Claude Code | `filename:CLAUDE.md path:/` | ~14K |
| `.cursorrules` | Cursor | `filename:.cursorrules` | ~13K |
| `.cursor/rules` | Cursor | `path:.cursor filename:rules` | ~3K |
| `.github/copilot-instructions.md` | Copilot | `filename:copilot-instructions.md path:.github` | ~39K |
| `.windsurfrules` | Windsurf | `filename:.windsurfrules` | ~2K |
| `.aider.conf.yml` | Aider | `filename:.aider.conf.yml` | ~600 |

**API:** GitHub Code Search (`GET /search/code`), 10 req/min.
**Approach:** Query once per file type daily, store `total_count` as the metric.
7 queries = under 1 minute. Run alongside the commit script.

**Why this matters:** This is a *cumulative* adoption metric. Commits fluctuate
daily, but config files only go up. It answers: "How many teams have adopted
this tool?" — a fundamentally different question than "How many commits today?"

### Signal 2: SDK/Dependency Adoption

Track how many projects depend on AI tool SDKs:

| Package | Ecosystem | Query |
|---------|-----------|-------|
| `@anthropic-ai/sdk` | npm | `"@anthropic-ai/sdk" filename:package.json` |
| `anthropic` | PyPI | `"anthropic" filename:requirements.txt` |
| `openai` | npm | `"openai" filename:package.json` |
| `openai` | PyPI | `"openai" filename:requirements.txt` |
| `langchain` | PyPI | `"langchain" filename:requirements.txt` |

**API:** Same code search endpoint. 5 more queries/day.

### Signal 3: Composite AI Code Index Score

Combine all three signals into a single headline number — the "AI Code Index."
Like the S&P 500 or Fear & Greed Index. One number that captures the overall
state of AI coding tool adoption.

**Formula concept:**
```
AI Code Index = (Normalized Commits × 0.5) + (Normalized Config Adoption × 0.3) + (Normalized SDK Adoption × 0.2)
```

Base it to 100 on a reference date. Track daily. Show it as the hero metric
on the page — "The AI Code Index is at 347, up 2.4% this week."

---

## Part 2: Page Redesign — Yahoo Finance Meets GitHub

### Current: One big chart, methodology section, comparison links
### Proposed: Data-dense dashboard with multiple sections

### Above the Fold

```
┌─────────────────────────────────────────────────────────┐
│  AI Code Index                                          │
│                                                         │
│  347.2        ▲ +12.4% (30d)                           │
│  ───────────────────────                                │
│  Total commits tracked: 15.1M                           │
│                                                         │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐    │
│  │Claude│Cursor│Copil.│Aider │Gemini│Devin │Codex │    │
│  │ Code │      │      │      │ CLI  │      │      │    │
│  │260k  │ 28k  │ 1.2k │ 890  │ 450  │ 320  │ 580  │    │
│  │▲ 18% │▼ 84% │▲ 12% │▲ 5%  │▲ 34% │▲ 8%  │▲ 22% │    │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘    │
│                                                         │
│  [1W] [1M] [3M] [1Y] [ALL]              [PNG]          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Main commit chart                   │    │
│  │                                                  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Key elements:**
1. **Hero metric** — Composite index score, large typography, color-coded trend
2. **Tool cards row** — 7 cards showing latest daily count + 30d trend for each tool.
   Immediately answers "who's winning?" without touching the chart.
3. **Main chart** — Same multi-tool line chart, but now it's contextualized by the
   metrics above it.

### Section 2: Tool Adoption Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  Tool Adoption                                          │
│                                                         │
│  Config files across public repos                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Tool           │ Config Files │ 30d Change     │    │
│  │─────────────────┼──────────────┼────────────────│    │
│  │  Claude Code    │    69,400    │  ▲ +4,200      │    │
│  │  GitHub Copilot │    38,880    │  ▲ +1,100      │    │
│  │  Cursor         │    15,844    │  ▲ +890        │    │
│  │  Windsurf       │     2,124    │  ▲ +340        │    │
│  │  Aider          │       564    │  ▲ +45         │    │
│  └─────────────────┴──────────────┴────────────────┘    │
│                                                         │
│  These are repos with tool-specific config files like   │
│  AGENTS.md, .cursorrules, or copilot-instructions.md.   │
│  A config file signals intentional adoption.            │
└─────────────────────────────────────────────────────────┘
```

**Why this section matters:** This is data nobody else has. Star-history tracks
stars. OSSInsight tracks general activity. Nobody is tracking AI tool config file
proliferation across GitHub. This is GitFind's moat.

### Section 3: Market Share (Pie/Bar Chart)

Show relative market share by commits (last 30 days). Simple horizontal bar
chart or donut chart. Answers the question everyone has: "What % of AI-written
code comes from each tool?"

### Section 4: Leaderboard — Fastest Growing

```
┌─────────────────────────────────────────────────────────┐
│  Fastest Growing (30d)                                  │
│                                                         │
│  1. Gemini CLI      ▲ +34%    450 → 603 avg/day       │
│  2. Codex           ▲ +22%    475 → 580 avg/day       │
│  3. Claude Code     ▲ +18%    220k → 260k avg/day     │
│  4. GitHub Copilot  ▲ +12%    1.1k → 1.2k avg/day    │
│  5. Devin           ▲ +8%     296 → 320 avg/day       │
│  6. Aider           ▲ +5%     848 → 890 avg/day       │
│  7. Cursor          ▼ -84%    28k → 400 avg/day       │
└─────────────────────────────────────────────────────────┘
```

This is the "Top Movers" pattern from CoinMarketCap. Scannable, sorted by
momentum, color-coded. A journalist can screenshot this and use it in a story.

### Section 5: Head-to-Head Comparisons (existing, enhanced)

Keep the comparison cards but add sparkline previews showing the last 30 days
of each matchup inline. Makes the cards more visually compelling.

### Section 6: Methodology (existing, keep as-is)

---

## Part 3: Additional Feature Ideas

### 1. Daily/Weekly Digest Embed

Show a "This Week in AI Code" summary card on the page:
- "Claude Code crossed 250K commits/day for the first time"
- "Gemini CLI is the fastest growing tool this month (+34%)"
- "Cursor attribution dropped 84% after opt-out change"

Auto-generated from the data. Makes the page feel alive and editorial.

### 2. Embeddable Widgets

Let people embed a live chart or metric card on their blog/site:
```html
<iframe src="https://gitfind.ai/embed/ai-code-index?tool=claude-code&range=3m" />
```
Drives backlinks and brand awareness. Star-history's entire growth strategy.

### 3. API Access

`GET /api/ai-code-index?tool=claude-code&range=30d`

Returns JSON. Free tier with rate limit. Lets researchers and journalists
pull data programmatically. Positions GitFind as the data source of record.

### 4. Alerts / Watchlist

"Alert me when Gemini CLI crosses 1,000 commits/day" — ties into the
newsletter/digest feature. Drives email signups.

### 5. Historical Milestones Timeline

Annotate the chart with key events:
- "Jan 27: Cursor enables attribution by default"
- "Feb 25: Cursor makes attribution opt-out"
- "Oct 8: Codex adds Co-authored-by trailer"

Turns the chart into a narrative. Journalists love this.

---

## Part 4: Implementation Priority

### Phase 1: Quick wins (1-2 days)
- [ ] **Tool summary cards** above the chart (daily count + 30d trend per tool)
- [ ] **Growth leaderboard** section (sorted by 30d % change)
- [ ] **Market share bar chart** (horizontal bars, last 30d)
- [ ] Vercel Analytics `track()` on PNG download button

### Phase 2: New data signals (3-5 days)
- [ ] **Config file adoption script** — new daily GitHub Action querying code search
- [ ] **Config adoption table** on the page
- [ ] **New DB table** `tool_adoption_signals` (tool, signal_type, count, date)
- [ ] Historical backfill of config file counts

### Phase 3: Composite index (1 week)
- [ ] Define and implement composite AI Code Index score
- [ ] Hero metric display with trend badge
- [ ] Daily index value stored in DB

### Phase 4: Engagement features (ongoing)
- [ ] Embeddable widget/iframe endpoint
- [ ] Public API endpoint with JSON response
- [ ] Chart event annotations (milestone timeline)
- [ ] Auto-generated weekly insight cards

---

## Part 5: What Makes This Differentiated

| Feature | Star-History | OSSInsight | GitFind AI Code Index |
|---------|-------------|------------|----------------------|
| Star tracking | Core product | Yes | No (different focus) |
| AI tool commits | No | No | **Yes — 7 tools daily** |
| Config file adoption | No | No | **Planned — unique** |
| SDK dependency tracking | No | No | **Planned — unique** |
| Composite index score | No | No | **Planned — unique** |
| Tool comparisons | No | Collections | **Yes — 21 pairings** |
| PNG export | No | No | **Yes** |
| Plain English context | No | Partial | **Yes — core principle** |

**The moat:** Nobody else is tracking the full picture of AI coding tool adoption.
Commits + config files + SDK dependencies = a composite signal that only GitFind
has. This compounds daily — every day of data collection makes it harder to catch up.

---

## Technical Feasibility Notes

- Config file queries use GitHub Code Search API (10 req/min). 7 queries/day is trivial.
- SDK dependency queries: 5 more queries/day. Total: 12 queries for new signals.
- Can run in the same `chart-data.yml` GitHub Action after search-commits.ts.
- New table needed: `tool_adoption_signals` with columns:
  `(id, tool_name, signal_type, count, date)` where signal_type is
  'config_file' or 'sdk_dependency'.
- total_count from GitHub is approximate but consistent day-to-day, so trends are reliable.
- All frontend changes are in existing files — no new pages needed for Phase 1.
