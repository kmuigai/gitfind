import type { Metadata } from 'next'
import { getAICodeIndexData, getConfigAdoptionData, getSDKAdoptionData, getConfigAdoptionTimeSeries, getSDKAdoptionTimeSeries, getAgentPRData, getAgentPRTimeSeries, getCommunityBuzzData } from '@/lib/queries'
import AICodeIndexDashboard from '@/components/AICodeIndexDashboard'
import NewsletterSignup from '@/components/NewsletterSignup'
import './terminal.css'

export const metadata: Metadata = {
  title: 'AI Code Index — AI Coding Tool Adoption Tracker | GitFind',
  description:
    'Track which AI coding tools developers actually use. Daily commit volume, market share, and adoption data for Claude Code, Cursor, Copilot, and more.',
  openGraph: {
    title: 'AI Code Index — GitFind',
    description:
      'Which AI coding tool is winning? Live commit data across 7 tools on all public GitHub repos.',
    url: 'https://gitfind.ai/ai-code-index',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Code Index — GitFind',
    description:
      'The rise of AI-written code, tracked live across 7 tools.',
  },
}

export const revalidate = 3600

export default async function AICodeIndexPage() {
  const [chartData, configData, sdkData, configTimeSeries, sdkTimeSeries, agentPRData, agentPRTimeSeries, buzzData] = await Promise.all([
    getAICodeIndexData(),
    getConfigAdoptionData(),
    getSDKAdoptionData(),
    getConfigAdoptionTimeSeries(),
    getSDKAdoptionTimeSeries(),
    getAgentPRData(),
    getAgentPRTimeSeries(),
    getCommunityBuzzData(),
  ])

  return (
    <>
      <AICodeIndexDashboard
        chartData={chartData}
        configData={configData}
        sdkData={sdkData}
        configTimeSeries={configTimeSeries}
        sdkTimeSeries={sdkTimeSeries}
        agentPRData={agentPRData}
        agentPRTimeSeries={agentPRTimeSeries}
        buzzData={buzzData}
      />
      <NewsletterSignup />
    </>
  )
}
