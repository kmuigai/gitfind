import type { Metadata } from 'next'
import { getModelMetrics } from '@/lib/queries'
import NewsletterSignup from '@/components/NewsletterSignup'
import Reveal from '@/components/Reveal'
import {
  ModelStatsStrip,
  ModelVolumeChart,
  ModelShareBar,
  ModelSmallMultiples,
  ModelMomentumTable,
  ModelRuntimeLayer,
  ModelBrief,
} from '@/components/OpenModelIndex'

export const metadata: Metadata = {
  title: 'The Open Model Index — Open-Weight Model Adoption Tracker | GitFind',
  description:
    'Which open-weight AI models are developers actually building with? Daily Hugging Face weight downloads, GitHub velocity, and runtime traction for DeepSeek, Llama, Qwen, Kimi, Mistral, and GLM.',
  openGraph: {
    title: 'The Open Model Index — GitFind',
    description:
      'Which open-weight AI models are developers actually building with? Tracked daily across Hugging Face and GitHub.',
    url: 'https://gitfind.ai/open-model-index',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Open Model Index — GitFind',
    description: 'Open-weight model adoption, tracked daily: downloads, velocity, momentum.',
  },
}

export const revalidate = 3600

export default async function OpenModelIndexPage() {
  const rows = await getModelMetrics()

  return (
    <div>
      {/* Spec header */}
      <div className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--muted)]">
            open-weight adoption — tracked daily
          </p>
          <h1 className="font-display mt-4 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            THE OPEN MODEL INDEX
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            Which open-weight models are developers actually building with?
            Hugging Face weight downloads and GitHub velocity for DeepSeek,
            Llama, Qwen, Kimi, Mistral, and GLM — plus the runtime layer that
            runs them. Every number says what it is; nothing here is made up.
          </p>
          <ModelStatsStrip rows={rows} />
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* fig. 01 — total daily downloads */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 1 — weight downloads, daily</p>
          <p>fig. 01</p>
        </div>
        <Reveal chart className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--paper)] p-4">
            <ModelVolumeChart rows={rows} />
            <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
              hugging face trailing 30-day weight downloads per day, across all tracked models.
            </p>
          </div>
        </Reveal>

        {/* fig. 02 — share */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 2 — share of new downloads</p>
          <p>fig. 02</p>
        </div>
        <Reveal className="mt-4">
          <div className="border-2 border-[var(--line)] bg-[var(--paper)] p-4">
            <ModelShareBar rows={rows} />
          </div>
        </Reveal>

        {/* fig. 03 — small multiples */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 3 — each model, same scale</p>
          <p>fig. 03</p>
        </div>
        <Reveal className="mt-4">
          <ModelSmallMultiples rows={rows} />
        </Reveal>

        {/* fig. 04 — momentum */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 4 — momentum, ranked</p>
          <p>fig. 04</p>
        </div>
        <Reveal className="mt-4">
          <ModelMomentumTable rows={rows} />
        </Reveal>

        {/* fig. 05 — runtime layer */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 5 — the runtime layer</p>
          <p>fig. 05</p>
        </div>
        <Reveal className="mt-4">
          <ModelRuntimeLayer rows={rows} />
        </Reveal>

        {/* fig. 06 — intelligence brief */}
        <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between font-mono text-[12px] text-[var(--muted)]">
          <p className="font-bold tracking-[0.2em] text-[var(--ink)]">§ 6 — intelligence brief</p>
          <p>fig. 06</p>
        </div>
        <Reveal className="mt-4">
          <ModelBrief rows={rows} />
        </Reveal>

        <div className="mt-12">
          <NewsletterSignup />
        </div>
      </main>
    </div>
  )
}
