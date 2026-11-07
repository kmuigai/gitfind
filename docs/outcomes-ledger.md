# The Outcomes Ledger

One row per real-world event in a tracked project's life, stored in
`project_outcomes` (migration `005-project-outcomes.sql`).

**Why it exists:** GitFind scores 40,000+ projects every day, but a score is a
claim. The ledger records what *actually happened next*, so outcomes can be
joined back to the scores that preceded them — measuring whether the Early
Signal Score predicts anything, and producing the labeled dataset (score at
time T → outcome by time T+n) that makes that measurement possible. Anyone
can scrape GitHub; the outcome labels against GitFind's own daily record
exist only here. That is the moat this table builds.

## The taxonomy (v1 — 8 event types)

| event_type | Definition | Typical evidence |
|---|---|---|
| `funding` | The company/project raises money (pre-seed through late stage, grants with a named amount). | Announcement or coverage URL |
| `acquired` | The company or project is acquired, or the repo moves to an acquirer's org as part of a deal. | Announcement or coverage URL |
| `shutdown` | The company or hosted product shuts down. A *company/product* event — never inferred from repo state alone. | Shutdown notice or coverage URL |
| `pivot` | The project/company publicly abandons its original purpose for a materially different one. | Announcement, rebrand, or coverage URL |
| `adopted` | A major company or platform adopts, integrates, bundles, or standardizes on the project. | Adopter's announcement URL |
| `maintainer_move` | A key maintainer joins a major lab/company, or leaves to start something new. | Announcement or profile URL |
| `breakout` | A major launch or milestone: flagship release, headline integration, crossing a landmark the project itself announces. | Release/announcement URL |
| `dead` | The repo's life ends: archived on GitHub, or no pushes for 12+ months. A *repo-level* event — distinct from `shutdown`. | The repo itself (lifecycle scan) |

`dead` vs `shutdown` is the distinction v1 is most careful about: a dead repo
doesn't mean the company died, and a shut-down company sometimes leaves a live
repo behind. The lifecycle scan only ever writes `dead`.

## Evidence and confidence rules

- **`confirmed`** — the event is directly observed or documented:
  GitHub's own `archived` flag, or a primary source (the project's/company's
  announcement) at `source_url`. **A `confirmed` row should always carry a
  `source_url`.** If you don't have the link, it's not confirmed yet.
- **`likely`** — the event is inferred from strong observable signals:
  12+ months without pushes (`dead` by inactivity), secondary reporting
  without a primary source, an announcement that implies but doesn't state
  the event.
- `details` is free text for the specifics a future reader (or model) needs:
  amount raised, acquirer, who adopted it, which maintainer moved where.
- `event_date` is the date the event occurred (or, where the true date isn't
  observable, the closest anchor — see below), never the date we noticed, so
  joins against history stay honest. `created_at` already records when the
  row was written.
- `detected_by` names the writer: `lifecycle-scan` (automated),
  `news-sweep` (research passes), `manual` (Kayu, in the Table Editor).

### The lifecycle scan's event-date rule

`scripts/detect-lifecycle-outcomes.ts` detects only `dead`, from the `repos`
table's `archived` and `pushed_at` fields:

- archived → `dead` / `confirmed`; `event_date` = `pushed_at` (last activity
  before archival — the archive date itself isn't exposed), or the detection
  date if no `pushed_at` is on record.
- 365+ days without pushes → `dead` / `likely`; `event_date` = `pushed_at`,
  the day activity observably ceased.
- No `pushed_at` and not archived → no row. Without a last-activity date
  there is nothing honest to record.

The scan is idempotent (it skips repos that already have a `dead` row, and a
partial unique index enforces one `dead` row per repo) and dry-runs by
default — writing requires an explicit `--write`.

## Phase 2 — the news sweep

`scripts/detect-news-outcomes.ts` detects the seven company/product event
types (`funding`, `acquired`, `shutdown`, `pivot`, `adopted`,
`maintainer_move`, `breakout`) from news and writes them with
`detected_by = 'news-sweep'`. It never writes `dead` — that class belongs
to the lifecycle scan, and the taxonomy's `shutdown` ≠ `dead` distinction
is enforced in validation, not just by convention.

- **Sources** — two keyless feeds, both reachable from GitHub Actions:
  Google News RSS search (per repo: the exact `owner/name` path, plus the
  bare project name fenced by event vocabulary) and Hacker News via the
  Algolia API (story search by `owner/name`). Google News item links are
  Google News article links that redirect to the publisher; the publisher
  is named in each row's `details`, and HN items link the article (or the
  HN item page for self-posts).
- **Method** — classification is two-stage. Keyword patterns nominate the
  plausible event classes for each headline; an item with no nomination
  never goes further. Nominated candidates for one repo go to a single
  Anthropic call (`claude-sonnet-4-6`, the digest's model and secret)
  that returns structured proposals. Proposals are opinions until the
  deterministic validation in `lib/news-outcomes.ts` accepts them:
  the event type must be a news class, the `source_url` must be one of
  the fetched items, the evidence quote must appear **verbatim** in that
  item's headline or snippet, the event date must be a real date not in
  the future (the article's date when the text states none), and
  `details` must be non-empty. Every accepted row carries the quote into
  its `details` (`Evidence: "…" (Publisher, date)`), so the evidence a
  row rests on is readable from the row itself.
- **Confidence** — `confirmed` only when the item is a primary source
  (the project's, company's, or acquirer's own announcement) **and** its
  quote verified; secondary reporting is `likely`, however strong.
- **Rejections are logged, not just counted** — every proposal the
  validation gate turns away produces one log line naming the repo, the
  proposed event type, and the specific gate that refused it (evidence
  quote not verbatim in the fetched item, source URL not among the
  fetched items, invalid or future event date, a non-news class such as
  `dead`, empty details, duplicate of an accepted proposal). Across a
  1,000-repo backfill, those lines are the audit trail for the gate
  itself: they show what it caught, and would show it misfiring.
- **Idempotency** — one row per (repo, event type, event date): existing
  keys are skipped in code, and migration `009` adds the matching partial
  unique index (005's one-`dead`-per-repo index is the same pattern).
- **Runs** — dry-run by default, `--write` to insert, `--repo` /
  `--limit` / `--since-days` bound the input. It runs weekly on Tuesdays
  (`.github/workflows/news-sweep.yml`) over recent candidates, and the
  2025–26 backfill below covers the historical window it cannot reach.

## The 2025–26 backfill (gate G8)

`scripts/backfill-outcomes.ts` runs the same sweep engine over the top
1,000 projects for the full 2025–26 window, and — unlike the weekly
sweep — records every pass it completes. Gate G8 is measured on that
record, not on the outcomes themselves: **1,000 / 1,000 projects carrying
an outcome row or a recorded "checked, no outcome" pass.**

- **The target set** is the site's own definition of "top": `enrichments`
  ordered by Early Signal Score descending (the ranking `getTopRepos`
  serves), capped at 1,000. Only scored projects can be in it — the score
  is the thing the ledger exists to validate.
- **The window** is 2025-01-01 through the day each pass runs. A pass
  fetches one day wider than the window and records only outcomes dated
  inside it, so an opening-day event can never be missed by an hour or
  leaked in from 2024.
- **`outcome_checks` (migration `010`)** is the coverage record: one row
  per completed pass — `repo_id`, `checked_at`, `window_start`,
  `window_end`, `checker` (`news-sweep-backfill`), `result`
  (`outcome_found` / `none_found`), and `outcomes_found`. It exists
  because `project_outcomes` cannot prove a negative: no outcome row
  might mean "nothing happened" or "nobody looked". A check row is
  written only after the pass completes and its outcomes are inserted;
  a failed pass records nothing and is retried by a later batch, so a
  recorded pass always means the pass actually happened.
- **Running it** — dry-run by default (a dry run sweeps and reports but
  writes nothing: no outcomes, no check rows). Real batches are explicit
  and bounded, sized to sit comfortably inside one GitHub Actions window
  alongside the per-repo fetch + classification time:

  ```
  npx tsx scripts/backfill-outcomes.ts                  # dry run, first 50 unchecked
  npx tsx scripts/backfill-outcomes.ts --write          # one batch of 50
  npx tsx scripts/backfill-outcomes.ts --write --limit 100
  npx tsx scripts/backfill-outcomes.ts --write --offset 200   # skip 200 unchecked
  ```

  The full set is ~20 batches of 50. Run them sequentially — each batch
  skips everything already checked, so the campaign is resumable across
  days and a stopped batch costs nothing. Progress is logged every 25
  repos, with a checked / found / none / failed summary at the end.
- **Measuring G8** — count the target set's coverage in `outcome_checks`:

  ```sql
  SELECT COUNT(DISTINCT repo_id) FROM outcome_checks
  WHERE checker = 'news-sweep-backfill' AND window_start = '2025-01-01';
  ```

  1,000 distinct repos (against the current top-1,000 ranking) closes
  the gate. Events that occur after a project's pass are not lost: the
  weekly Tuesday sweep keeps covering the recent window for every repo,
  checked or not.

## How the ledger joins to score history

The point of the table is this query shape:

```
outcome.event_date  →  look BACKWARD from it
repo_snapshots.snapshot_date / enrichments.scored_at  →  the score as it was
```

- Join key: `project_outcomes.repo_id = repos.id`, and
  `snapshot_date <= event_date` for the closest snapshot on or before the
  event (point-in-time: never use a score recorded *after* the event).
- Example questions it answers once it has depth: of repos that scored 80+
  while under 1,000 stars, what fraction raised or were acquired within 12
  months — versus the base rate for everything tracked? Did `dead` repos show
  a score signature (contributor decay, velocity collapse) quarters before
  they died?
- Because scores and snapshots are recorded daily and never restated, the
  labels accumulate honestly. Every month the ledger runs, the labeled
  dataset gets a month deeper — and a competitor starting later starts with
  zero labels no matter how good their scraper is.

## Access

The table has RLS enabled and **no public policies at all** — every read and
write goes through the service role. Nothing on the public site reads it.
That is deliberate: the ledger is a proprietary asset, not site content.

`outcome_checks` (migration `010`) carries the identical posture — RLS
enabled, no policies, service-role only — for the same reason.

It is also frozen in full every day by the Archive Snapshot workflow
(Directive 1), alongside the score history it joins to. The ledger is small
and append-only, and as the ledger of record it is copied whole rather than
sliced by date — no slice boundary can ever drop an outcome.

