import { type NextRequest, NextResponse } from 'next/server'
import { getAICodeIndexData, type AICodeIndexRow } from '@/lib/queries'

const TOOL_SLUG_MAP: Record<string, string> = {
  'claude-code': 'Claude Code',
  'cursor': 'Cursor',
  'copilot': 'GitHub Copilot',
  'aider': 'Aider',
  'gemini-cli': 'Gemini CLI',
  'devin': 'Devin',
  'codex': 'Codex',
}

const VALID_RANGES = ['7d', '30d', '90d', '365d', 'all'] as const
type Range = (typeof VALID_RANGES)[number]

function filterByRange(rows: AICodeIndexRow[], range: Range): AICodeIndexRow[] {
  if (range === 'all') return rows

  const days = parseInt(range.replace('d', ''), 10)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  return rows.filter((row) => row.date >= cutoffStr)
}

function filterByTool(rows: AICodeIndexRow[], toolDisplayName: string): AICodeIndexRow[] {
  return rows.map((row) => ({
    date: row.date,
    [toolDisplayName]: row[toolDisplayName] ?? 0,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse and validate query params
    const toolSlug = searchParams.get('tool')
    const rangeParam = searchParams.get('range') ?? 'all'
    const format = searchParams.get('format') ?? 'json'

    if (format !== 'json') {
      return NextResponse.json(
        { error: 'Unsupported format. Only "json" is supported.' },
        { status: 400 }
      )
    }

    if (!VALID_RANGES.includes(rangeParam as Range)) {
      return NextResponse.json(
        { error: `Invalid range. Must be one of: ${VALID_RANGES.join(', ')}` },
        { status: 400 }
      )
    }

    let toolDisplayName: string | null = null
    if (toolSlug) {
      toolDisplayName = TOOL_SLUG_MAP[toolSlug] ?? null
      if (!toolDisplayName) {
        return NextResponse.json(
          { error: `Unknown tool "${toolSlug}". Valid slugs: ${Object.keys(TOOL_SLUG_MAP).join(', ')}` },
          { status: 400 }
        )
      }
    }

    const range = rangeParam as Range

    // Fetch data
    const allData = await getAICodeIndexData()

    // Apply filters
    let filtered = filterByRange(allData, range)

    if (toolDisplayName) {
      filtered = filterByTool(filtered, toolDisplayName)
    }

    // Determine which tools are present in the response
    const tools = toolDisplayName
      ? [toolDisplayName]
      : Object.values(TOOL_SLUG_MAP)

    // Find the last date in the data
    const lastUpdated = filtered.length > 0
      ? filtered[filtered.length - 1].date
      : null

    const response = NextResponse.json({
      data: filtered,
      meta: {
        tools,
        range,
        dataPoints: filtered.length,
        lastUpdated,
      },
    })

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=600'
    )

    return response
  } catch (error) {
    console.error('AI Code Index API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
