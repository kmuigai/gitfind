import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'GitFind — GitHub, translated.',
    template: '%s — GitFind',
  },
  description:
    'The rising projects that matter — before everyone else sees them. Trending repos ranked, scored, and explained in plain English.',
  keywords: ['GitHub trending', 'open source discovery', 'product manager tools', 'GitHub intelligence', 'early signal'],
  authors: [{ name: 'GitFind' }],
  metadataBase: new URL('https://gitfind.ai'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://gitfind.ai',
    siteName: 'GitFind',
    title: 'GitFind — GitHub, translated.',
    description:
      'The rising projects that matter — before everyone else sees them. Trending repos ranked, scored, and explained in plain English.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GitFind — GitHub, translated.',
    description: 'The rising projects that matter — before everyone else sees them.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

const NAV_CATEGORIES = [
  { name: 'AI/ML', slug: 'ai-ml' },
  { name: 'Dev Tools', slug: 'developer-tools' },
  { name: 'Security', slug: 'security' },
  { name: 'Infrastructure', slug: 'infrastructure-devops' },
]

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('gitfind-theme');document.documentElement.setAttribute('data-theme',(s==='light'||s==='dark')?s:'dark');})();`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Navigation */}
        <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-sm">
          <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 font-mono text-sm font-semibold tracking-[-0.06em] text-[var(--foreground)] transition-opacity hover:opacity-80"
            >
              <span className="text-[var(--accent)]">❯</span>
              <span>gitfind</span>
              <span className="text-[var(--foreground-muted)]">.ai</span>
            </Link>

            {/* Category quick links — hidden on mobile */}
            <div className="hidden items-center gap-1 sm:flex">
              {NAV_CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="rounded-md px-3 py-1.5 text-xs text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-elevated)] hover:text-[var(--foreground)]"
                >
                  {cat.name}
                </Link>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/submit"
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Submit a project
              </Link>
            </div>
          </nav>
        </header>

        {/* Main content */}
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>

        {/* Footer */}
        <footer className="border-t border-[var(--border)] py-12 mt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              {/* Brand + links */}
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="font-mono text-[var(--accent)]">❯</span>
                  <span>gitfind.ai</span>
                </div>
                <p className="mt-2 font-mono text-xs text-[var(--foreground-muted)] leading-relaxed">
                  See what&apos;s moving. Know why it matters.
                </p>
                <ul className="mt-4 flex gap-4">
                  <li>
                    <Link
                      href="/submit"
                      className="font-mono text-xs text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                    >
                      Submit a project
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://github.com/kmuigai/gitfind"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                    >
                      GitHub
                    </a>
                  </li>
                </ul>
              </div>

              {/* Categories */}
              <div>
                <h3 className="font-mono text-[10px] font-medium text-[var(--foreground-muted)] uppercase tracking-wider mb-3">
                  Categories
                </h3>
                <ul className="space-y-2">
                  {[
                    { name: 'AI / Machine Learning', slug: 'ai-ml' },
                    { name: 'Developer Tools', slug: 'developer-tools' },
                    { name: 'Security', slug: 'security' },
                    { name: 'Data & Analytics', slug: 'data-analytics' },
                    { name: 'Web Frameworks', slug: 'web-frameworks' },
                    { name: 'Infrastructure & DevOps', slug: 'infrastructure-devops' },
                    { name: 'Mobile', slug: 'mobile' },
                    { name: 'Open Source Utilities', slug: 'open-source-utilities' },
                  ].map((cat) => (
                    <li key={cat.slug}>
                      <Link
                        href={`/category/${cat.slug}`}
                        className="text-xs text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                      >
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-[var(--border)] pt-6 text-center">
              <p className="font-mono text-xs text-[var(--foreground-subtle)]">
                Git Signal · Git Context · Git Clarity · <strong className="text-[var(--foreground-muted)]">Git Smarter</strong>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
