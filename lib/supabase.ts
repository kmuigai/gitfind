import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type PublicClient = SupabaseClient<Database>

let publicClient: PublicClient | null = null

function getPublicClient(): PublicClient {
  if (!publicClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
    }

    publicClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)
  }
  return publicClient
}

// Public client — uses anon key, safe to use in the browser and Server Components.
//
// Created lazily on first use, not at import time. Importing this module must
// never throw: server-side scripts import it for createServiceClient() alone
// and run with only NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// present (the lifecycle scan's first CI run died at module load because the
// eager version demanded the anon key too). The Proxy forwards every access
// to the real client, so existing call sites behave identically.
export const supabase: PublicClient = new Proxy({} as PublicClient, {
  get(_target, prop) {
    const client = getPublicClient() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value
  },
})

// Service role client — uses service role key, server-side only (pipeline, API routes)
// Never expose the service role key to the browser
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL. This client is for server-side use only.')
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. This client is for server-side use only.')
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
