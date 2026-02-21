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

const TOOL_ICONS: Record<string, React.ReactNode> = {
  'Claude Code': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  ),
  'Cursor': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  ),
  'GitHub Copilot': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z" />
    </svg>
  ),
  'Gemini CLI': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
    </svg>
  ),
  'Aider': (
    <span className="flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold" style={{ fontFamily: 'var(--font-geist-mono)' }}>A</span>
  ),
  'Devin': (
    <span className="flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold" style={{ fontFamily: 'var(--font-geist-mono)' }}>D</span>
  ),
}

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
              { tool: 'Claude Code', method: 'Co-Authored-By trailer', color: '#6c6af6' },
              { tool: 'Cursor', method: 'Co-Authored-By trailer', color: '#f59e0b' },
              { tool: 'GitHub Copilot', method: 'Bot committer account', color: '#3b82f6' },
              { tool: 'Aider', method: 'Co-Authored-By trailer', color: '#22c55e' },
              { tool: 'Gemini CLI', method: 'Co-Authored-By trailer', color: '#ef4444' },
              { tool: 'Devin', method: 'Bot author email', color: '#a855f7' },
            ].map(({ tool, method, color }) => (
              <div
                key={tool}
                className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-4 py-3"
              >
                <div className="flex items-center gap-2 font-mono text-sm font-medium text-[var(--foreground)]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span style={{ color }}>{TOOL_ICONS[tool] ?? null}</span>
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
