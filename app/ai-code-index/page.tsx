import type { Metadata } from 'next'
import Link from 'next/link'
import { getAICodeIndexData } from '@/lib/queries'
import AICodeIndexChart from '@/components/AICodeIndexChart'
import NewsletterSignup from '@/components/NewsletterSignup'

export const metadata: Metadata = {
  title: 'AI Code Index',
  description:
    'Daily commit counts for Claude Code, Cursor, Copilot, Aider, Gemini CLI, and Devin across all public GitHub repos. The rise of AI-written code, tracked live.',
  openGraph: {
    title: 'AI Code Index — GitFind',
    description:
      'Daily commit counts for Claude Code, Cursor, Copilot, Aider, Gemini CLI, and Devin across all public GitHub repos.',
    url: 'https://gitfind.ai/ai-code-index',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Code Index — GitFind',
    description:
      'The rise of AI-written code, tracked live across 6 tools.',
  },
}

export const revalidate = 3600

export default async function AICodeIndexPage() {
  const data = await getAICodeIndexData()

  return (
    <div>
      {/* Header */}
      <section className="border-b border-[var(--border)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-[var(--foreground-subtle)]">
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              GitFind
            </Link>
            <span>/</span>
            <span className="text-[var(--foreground-muted)]">AI Code Index</span>
          </nav>

          <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
            AI Code Index
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-sm text-[var(--foreground-muted)] leading-relaxed">
            Daily commit counts for 6 AI coding tools across all public GitHub repositories.
            Data captured daily — a dataset that compounds over time.
          </p>
        </div>
      </section>

      {/* Chart */}
      <section className="px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-4xl">
          {data.length >= 2 ? (
            <AICodeIndexChart data={data} />
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] py-16 text-center">
              <p className="text-sm text-[var(--foreground-muted)]">
                No data yet — run{' '}
                <code className="font-mono text-[var(--accent)]">npx tsx scripts/search-commits.ts</code>{' '}
                to start collecting.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Methodology */}
      <section className="border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            How we track this
          </h2>
          <p className="mt-2 font-mono text-sm text-[var(--foreground-muted)] leading-relaxed">
            We query the GitHub Search API daily for commit signatures left by each tool.
            Claude Code, Cursor, and Aider add Co-Authored-By trailers. Copilot&apos;s coding
            agent commits as a bot account. Devin uses a distinct author email. These are
            public commits only — the true volume is higher.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { tool: 'Claude Code', method: 'Co-Authored-By trailer' },
              { tool: 'Cursor', method: 'Co-Authored-By trailer' },
              { tool: 'GitHub Copilot', method: 'Bot committer account' },
              { tool: 'Aider', method: 'Co-Authored-By trailer' },
              { tool: 'Gemini CLI', method: 'Co-Authored-By trailer' },
              { tool: 'Devin', method: 'Bot author email' },
            ].map(({ tool, method }) => (
              <div
                key={tool}
                className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-4 py-3"
              >
                <div className="font-mono text-sm font-medium text-[var(--foreground)]">
                  {tool}
                </div>
                <div className="mt-1 font-mono text-xs text-[var(--foreground-muted)]">
                  {method}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  )
}
