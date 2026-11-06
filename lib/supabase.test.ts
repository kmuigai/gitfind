// Regression tests for lib/supabase.ts lazy client creation.
// Run with: npm test (Vitest)
//
// The bug (Lifecycle Scan run #1, Nov 6, 2026): lib/supabase.ts built its
// public client eagerly at module scope and threw when
// NEXT_PUBLIC_SUPABASE_ANON_KEY was unset — so ANY import of the module
// exploded, including scripts/detect-lifecycle-outcomes.ts, which only
// needs createServiceClient() and runs with just NEXT_PUBLIC_SUPABASE_URL
// + SUPABASE_SERVICE_ROLE_KEY in CI. The client is now created on first
// use; these tests pin that importing is always safe and only actual
// client use can throw.

import { afterEach, describe, expect, it, vi } from 'vitest'

const URL = 'https://placeholder.supabase.co'
const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) {
      vi.stubEnv(key, '')
    } else {
      vi.stubEnv(key, values[key])
    }
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('lib/supabase module loading', () => {
  it('imports without throwing when the anon key is unset (service-role-only environment)', async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: URL,
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    })
    vi.resetModules()

    const mod = await import('./supabase')
    expect(typeof mod.createServiceClient).toBe('function')
    expect(mod.supabase).toBeDefined()
  })

  it('createServiceClient() constructs with only URL + service role key', async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: URL,
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    })
    vi.resetModules()

    const { createServiceClient } = await import('./supabase')
    const client = createServiceClient()
    expect(typeof client.from).toBe('function')
  })

  it('imports without throwing when no Supabase env is set at all', async () => {
    setEnv({})
    vi.resetModules()

    await expect(import('./supabase')).resolves.toBeDefined()
  })

  it('throws the missing-env error on first public-client use, not at import', async () => {
    setEnv({})
    vi.resetModules()

    const { supabase } = await import('./supabase')
    expect(() => supabase.from('repos')).toThrow(/Missing Supabase environment variables/)
  })

  it('throws a service-specific error when the service role key is missing', async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: URL })
    vi.resetModules()

    const { createServiceClient } = await import('./supabase')
    expect(() => createServiceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('public client is usable when the anon key is present', async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    })
    vi.resetModules()

    const { supabase } = await import('./supabase')
    expect(typeof supabase.from).toBe('function')
  })
})
