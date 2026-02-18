import { type NextRequest, NextResponse } from 'next/server'
import { searchRepos } from '@/lib/queries'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json([], { status: 200 })
  }

  const results = await searchRepos(q, 10)
  return NextResponse.json(results)
}
