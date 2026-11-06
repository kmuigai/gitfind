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
