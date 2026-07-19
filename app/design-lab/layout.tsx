import type { Metadata } from 'next'
import { Source_Serif_4, VT323, Silkscreen } from 'next/font/google'
import './design-lab.css'

const sourceSerif = Source_Serif_4({
  variable: '--font-dl-serif',
  subsets: ['latin'],
})

const vt323 = VT323({
  variable: '--font-dl-vt323',
  weight: '400',
  subsets: ['latin'],
})

const silkscreen = Silkscreen({
  variable: '--font-dl-pixel',
  weight: ['400', '700'],
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Design Lab — GitFind',
  robots: { index: false, follow: false },
}

export default function DesignLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sourceSerif.variable} ${vt323.variable} ${silkscreen.variable}`}>
      {/*
        Hide the live terminal nav, ticker, and footer while previewing mock-ups
        so each direction can be judged on its own chrome. This <style> tag only
        exists while a /design-lab route is mounted — the live chrome returns
        as soon as you navigate away. Nothing outside design-lab is touched.
      */}
      <style>{`
        body > div.sticky.top-0 { display: none !important; }
        body > footer { display: none !important; }
      `}</style>
      {children}
    </div>
  )
}
