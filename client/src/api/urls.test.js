import { afterEach, describe, expect, it, vi } from 'vitest'

// API_BASE_URL is read once at import, so each case re-imports the module
// after stubbing the env.
const load = async (env) => {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE_URL', env.VITE_API_BASE_URL ?? '')
  vi.stubEnv('VITE_API_BASE_URL_WS', env.VITE_API_BASE_URL_WS ?? '')
  return import('./urls')
}

const setPage = (url) => window.history.replaceState({}, '', url)

describe('API_BASE_URL', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is empty (same site as the page) when unset', async () => {
    const { API_BASE_URL } = await load({})
    expect(API_BASE_URL).toBe('')
  })

  it('uses VITE_API_BASE_URL when set', async () => {
    const { API_BASE_URL } = await load({ VITE_API_BASE_URL: 'https://api.example.com' })
    expect(API_BASE_URL).toBe('https://api.example.com')
  })
})

describe('wsUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses the page origin with ws:// and /ws when nothing is set', async () => {
    const { wsUrl } = await load({})
    expect(wsUrl()).toBe(`ws://${window.location.host}/ws`)
  })

  it('switches https to wss', async () => {
    const { wsUrl } = await load({ VITE_API_BASE_URL: 'https://api.example.com' })
    expect(wsUrl()).toBe('wss://api.example.com/ws')
  })

  it('follows VITE_API_BASE_URL when only that is set', async () => {
    const { wsUrl } = await load({ VITE_API_BASE_URL: 'http://localhost:5000' })
    expect(wsUrl()).toBe('ws://localhost:5000/ws')
  })

  it('prefers VITE_API_BASE_URL_WS when set', async () => {
    const { wsUrl } = await load({
      VITE_API_BASE_URL: 'https://api.example.com',
      VITE_API_BASE_URL_WS: 'wss://sockets.example.com',
    })
    expect(wsUrl()).toBe('wss://sockets.example.com')
  })

  it('keeps the page path out of the URL', async () => {
    setPage('/problem/two-sum?tab=1')
    const { wsUrl } = await load({})
    expect(wsUrl()).toBe(`ws://${window.location.host}/ws`)
    setPage('/')
  })
})
