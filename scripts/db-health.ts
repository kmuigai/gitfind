import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

async function checkLatest(table: string, col: string, maxAgeDays: number): Promise<void> {
  const { data, error } = await sb
    .from(table)
    .select(col)
    .order(col, { ascending: false })
    .limit(1);

  if (error) {
    checks.push({ name: `${table}.${col}`, ok: false, detail: `query error: ${error.message}` });
    return;
  }

  const row = data?.[0] as unknown as Record<string, string> | undefined;
  const latest = row?.[col];
  if (!latest) {
    checks.push({ name: `${table}.${col}`, ok: false, detail: 'no rows' });
    return;
  }

  const latestDate = latest.slice(0, 10);
  const threshold = daysAgo(maxAgeDays);
  const ok = latestDate >= threshold;
  checks.push({
    name: `${table}.${col}`,
    ok,
    detail: `latest=${latestDate} (${ok ? 'fresh' : `stale, expected >= ${threshold}`})`,
  });
}

async function checkRowCount(table: string, minRows: number): Promise<void> {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    checks.push({ name: `${table}.count`, ok: false, detail: `query error: ${error.message}` });
    return;
  }
  const n = count ?? 0;
  checks.push({
    name: `${table}.count`,
    ok: n >= minRows,
    detail: `${n.toLocaleString()} rows (min ${minRows.toLocaleString()})`,
  });
}

async function main(): Promise<void> {
  console.log(`=== GitFind DB health check (${new Date().toISOString()}) ===\n`);

  // Pipeline (midnight UTC daily) updates repos.updated_at — allow 48h
  await checkLatest('repos', 'updated_at', 2);
  // Snapshot-light (6AM UTC daily) writes repo_snapshots for today
  await checkLatest('repo_snapshots', 'snapshot_date', 1);
  // Package downloads are fetched by pipeline — allow 48h
  await checkLatest('package_downloads', 'snapshot_date', 2);
  // Weekly stats run Sundays 8AM UTC — allow 8 days
  await checkLatest('weekly_stats', 'snapshot_date', 8);

  // Row-count sanity floors
  await checkRowCount('repos', 10_000);
  await checkRowCount('repo_snapshots', 100_000);
  await checkRowCount('categories', 1);

  const pad = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    console.log(`  ${c.ok ? 'OK  ' : 'FAIL'}  ${c.name.padEnd(pad)}  ${c.detail}`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n${failed.length === 0 ? 'All checks passed.' : `${failed.length} check(s) failed.`}`
  );
  if (failed.length > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error('Health check crashed:', err);
  process.exit(1);
});
