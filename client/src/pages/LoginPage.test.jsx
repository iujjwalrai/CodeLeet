import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import toast from 'react-hot-toast'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { renderWithRouter } from '../test/renderWithRouter'
import LoginPage from './LoginPage'

vi.mock('../api/axios', () => ({ default: { post: vi.fn() } }))
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const fillAndSubmit = async (email = 'ada@example.com', password = 'secret123') => {
  await userEvent.type(screen.getByPlaceholderText('Enter your email'), email)
  await userEvent.type(screen.getByPlaceholderText('Enter your password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Login' }))
}

describe('LoginPage', () => {
  let setUser

  beforeEach(() => {
    setUser = vi.fn()
    useAuth.mockReturnValue({ user: null, setUser })
    renderWithRouter(<LoginPage />, { route: '/login' })
  })

  it('logs in, stores the user and goes to the dashboard', async () => {
    const user = { username: 'ada' }
    axios.post.mockResolvedValue({ data: { user, token: 't' } })

    await fillAndSubmit()

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'))
    expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'ada@example.com',
      password: 'secret123',
    })
    expect(setUser).toHaveBeenCalledWith(user)
    expect(toast.success).toHaveBeenCalled()
  })

  it('shows the server error message when login fails', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } })

    await fillAndSubmit()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid credentials'))
    expect(setUser).not.toHaveBeenCalled()
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled()
  })

  it('shows validation messages and does not call the API when fields are empty', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('toggles password visibility', async () => {
    const password = screen.getByPlaceholderText('Enter your password')
    expect(password).toHaveAttribute('type', 'password')

    const toggle = password.parentElement.querySelector('button[type="button"]')
    await userEvent.click(toggle)

    expect(password).toHaveAttribute('type', 'text')
  })

  it('links to the sign-up page', async () => {
    await userEvent.click(screen.getByText('Sign up'))

    expect(screen.getByTestId('location')).toHaveTextContent('/register')
  })
})
