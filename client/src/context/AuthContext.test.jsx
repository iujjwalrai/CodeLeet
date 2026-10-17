import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from '../api/axios'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }))

const Consumer = () => {
  const { user, loading } = useAuth()
  if (loading) return <p>loading</p>
  return <p>{user ? `user:${user.username}` : 'anonymous'}</p>
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  )

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads the current user from /api/auth/me', async () => {
    axios.get.mockResolvedValue({ data: { user: { username: 'ada' } } })

    renderProvider()

    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText('user:ada')).toBeInTheDocument()
    expect(axios.get).toHaveBeenCalledWith('/api/auth/me')
  })

  it('treats a failed request as signed out', async () => {
    axios.get.mockRejectedValue(new Error('401'))

    renderProvider()

    expect(await screen.findByText('anonymous')).toBeInTheDocument()
  })

  it('treats a response without a user as signed out', async () => {
    axios.get.mockResolvedValue({ data: {} })

    renderProvider()

    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
  })
})
