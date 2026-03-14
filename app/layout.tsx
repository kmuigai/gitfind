import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import TerminalNav from '@/components/TerminalNav'
import Ticker from '@/components/Ticker'
import Footer from '@/components/Footer'
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

        <Footer />
        <Analytics />
      </body>
    </html>
  )
}
