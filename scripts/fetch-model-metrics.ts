// Fetch daily open-model metrics: Hugging Face cumulative downloads + GitHub
// velocity, upserted into model_metrics for the Open Model Index.
// Run: npx tsx scripts/fetch-model-metrics.ts

import { config } from 'dotenv'
config({ path: '.env.local' })
import { MODEL_REGISTRY } from '../lib/models.js'

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  console.log(`[${timestamp}] ${msg}`)
}

function logError(msg: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${msg}: ${message}`)
}

interface HfStats {
  downloads: number
  likes: number
}

async function fetchHfStats(hfRepoId: string): Promise<HfStats> {
  const res = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(hfRepoId).replace('%2F', '/')}`)
  if (!res.ok) {
    logError(`HF fetch failed for ${hfRepoId}`, `${res.status}`)
    return { downloads: 0, likes: 0 }
  }
  const data = (await res.json()) as { downloads?: number; likes?: number }
  return { downloads: data.downloads ?? 0, likes: data.likes ?? 0 }
}

interface GhStats {
  stars: number
  forks: number
}

async function fetchGhStats(owner: string, name: string): Promise<GhStats> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) {
    logError(`GitHub fetch failed for ${owner}/${name}`, `${res.status}`)
    return { stars: 0, forks: 0 }
  }
  const data = (await res.json()) as { stargazers_count?: number; forks_count?: number }
  return { stars: data.stargazers_count ?? 0, forks: data.forks_count ?? 0 }
}

async function main(): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const today = new Date().toISOString().slice(0, 10)
  log(`Fetching metrics for ${MODEL_REGISTRY.length} models (${today})`)

  // Contributors from our own repos table when we track the repo there
  const ghRepos = MODEL_REGISTRY.filter((m) => m.github != null)
  const { data: trackedRows } = await db
    .from('repos')
    .select('owner, name, contributors')
    .in('owner', [...new Set(ghRepos.map((m) => m.github!.owner))])
  const contributorsMap = new Map(
    ((trackedRows ?? []) as unknown as Array<{ owner: string; name: string; contributors: number }>).map(
      (r) => [`${r.owner}/${r.name}`, r.contributors]
    )
  )

  let written = 0
  for (const model of MODEL_REGISTRY) {
    try {
      const [hf, gh] = await Promise.all([
        model.hfRepoId ? fetchHfStats(model.hfRepoId) : Promise.resolve({ downloads: 0, likes: 0 }),
        model.github ? fetchGhStats(model.github.owner, model.github.name) : Promise.resolve({ stars: 0, forks: 0 }),
      ])
      const contributors = model.github
        ? contributorsMap.get(`${model.github.owner}/${model.github.name}`) ?? 0
        : 0

      const { error } = await db.from('model_metrics').upsert(
        {
          model_key: model.key,
          snapshot_date: today,
          hf_downloads: hf.downloads,
          hf_likes: hf.likes,
          gh_stars: gh.stars,
          gh_forks: gh.forks,
          gh_contributors: contributors,
        },
        { onConflict: 'model_key,snapshot_date' }
      )
      if (error) throw error
      written++
      log(`  ${model.key} ✓ (hf ${hf.downloads.toLocaleString()}, gh ${gh.stars.toLocaleString()}★)`)
    } catch (err) {
      logError(`Failed ${model.key}`, err)
    }
  }

  log(`Done — ${written}/${MODEL_REGISTRY.length} models written for ${today}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
