import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { Analytics } from '@vercel/analytics/next'
import TerminalNav from '@/components/TerminalNav'
import Ticker from '@/components/Ticker'
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
    default: 'GitFind — GitHub, Translated | Trending Projects Ranked & Explained',
    template: '%s — GitFind',
  },
  description:
    'Discover the fastest-growing open source projects on GitHub, ranked and explained in plain English for builders, founders, and investors.',
  keywords: ['GitHub trending', 'open source discovery', 'open source intelligence', 'GitHub intelligence', 'early signal', 'trending repositories', 'GitHub projects'],
  authors: [{ name: 'GitFind' }],
  metadataBase: new URL('https://gitfind.ai'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://gitfind.ai',
    siteName: 'GitFind',
    title: 'GitFind — GitHub, Translated | Trending Projects Ranked & Explained',
    description:
      'Discover the fastest-growing open source projects on GitHub, ranked and explained in plain English.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GitFind — GitHub, Translated | Trending Projects Ranked & Explained',
    description: 'Discover the fastest-growing open source projects on GitHub, ranked and explained in plain English for builders, founders, and investors.',
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
        <link rel="alternate" type="application/rss+xml" title="GitFind Insights" href="/insights/feed.xml" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="sticky top-0 z-50">
          <TerminalNav />
          <Ticker />
        </div>

        {/* Main content */}
        <main className="min-h-[calc(100vh-3.5rem)]" style={{ overflowX: 'clip' }}>{children}</main>

        {/* Footer */}
        <footer className="border-t border-[var(--border)] py-6" style={{ overflowX: 'clip', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
            <div className="px-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
                <Link href="/" className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors">
                  <span className="text-[var(--accent)] font-bold">❯</span>
                  <span className="font-bold text-[var(--foreground)]">gitfind.ai</span>
                </Link>
                <span className="text-[var(--border)]">·</span>
                <Link href="/ai-code-index" className="hover:text-[var(--foreground)] transition-colors">AI Code Index</Link>
                <span className="text-[var(--border)]">·</span>
                <Link href="/insights" className="hover:text-[var(--foreground)] transition-colors">Insights</Link>
                <span className="text-[var(--border)]">·</span>
                <Link href="/submit" className="hover:text-[var(--foreground)] transition-colors">Submit</Link>
                <span className="text-[var(--border)]">·</span>
                <a href="https://github.com/kmuigai/gitfind" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors">GitHub</a>
              </div>
              <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-[var(--foreground-subtle)]">
                Git Signal · Git Context · Git Clarity · <strong className="text-[var(--foreground-muted)]">Git Smarter</strong>
              </p>
            </div>
        </footer>
        <Analytics />
      </body>
    </html>
  )
}
