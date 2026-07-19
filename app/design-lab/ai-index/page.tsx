import { redirect } from 'next/navigation'

// Convenience: /design-lab/ai-index -> the direction-I AI index mock
export default function DesignLabAiIndexShortcut() {
  redirect('/design-lab/i/ai-index')
}
