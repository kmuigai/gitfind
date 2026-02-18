import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  const db = createClient(url, key)

  const { data, error } = await db.from('repos').select('count').limit(1)

  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
      console.log('Connected ✓ — tables not yet created.')
      console.log('Next step: paste supabase-schema.sql into Supabase → SQL Editor → Run')
    } else {
      console.error('Connection error:', error.message)
      process.exit(1)
    }
  } else {
    console.log('Connected ✓ — repos table exists')
    console.log('Result:', data)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
