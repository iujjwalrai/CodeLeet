import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from '../context/AuthContext'
import { renderWithRouter } from '../test/renderWithRouter'
import ProtectedRoute from './ProtectedRoute'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

const renderProtected = () =>
  renderWithRouter(
    <ProtectedRoute>
      <p>secret dashboard</p>
    </ProtectedRoute>,
    { route: '/dashboard' },
  )

describe('ProtectedRoute', () => {
  it('shows a loading message while auth is resolving', () => {
    useAuth.mockReturnValue({ user: null, loading: true })

    renderProtected()

    expect(screen.getByText(/loading the details/i)).toBeInTheDocument()
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument()
  })

  it('redirects signed-out users to /login', () => {
    useAuth.mockReturnValue({ user: null, loading: false })

    renderProtected()

    expect(screen.getByTestId('location')).toHaveTextContent('/login')
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument()
  })

  it('renders the page for signed-in users', () => {
    useAuth.mockReturnValue({ user: { username: 'ada' }, loading: false })

    renderProtected()

    expect(screen.getByText('secret dashboard')).toBeInTheDocument()
  })
})
