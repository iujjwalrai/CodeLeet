import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from '../context/AuthContext'
import { renderWithRouter } from '../test/renderWithRouter'
import Navbar from './Navbar'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

describe('Navbar', () => {
  it('offers Sign In to signed-out users', async () => {
    useAuth.mockReturnValue({ user: null })
    renderWithRouter(<Navbar />, { route: '/home', path: '/home' })

    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('offers Dashboard to signed-in users', async () => {
    useAuth.mockReturnValue({ user: { username: 'ada' } })
    renderWithRouter(<Navbar />, { route: '/home', path: '/home' })

    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dashboard' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
  })

  it('links to the problem list', async () => {
    useAuth.mockReturnValue({ user: null })
    renderWithRouter(<Navbar />, { route: '/home', path: '/home' })

    await userEvent.click(screen.getByRole('button', { name: 'Problems' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/problems')
  })
})
