import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import LogoutButton from './Logout'

describe('LogoutButton', () => {
  it('calls onLogout when clicked', async () => {
    const onLogout = vi.fn()
    render(<LogoutButton onLogout={onLogout} />)

    await userEvent.click(screen.getByRole('button', { name: /logout/i }))

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('is disabled and says so while logging out', async () => {
    const onLogout = vi.fn()
    render(<LogoutButton onLogout={onLogout} loading />)

    const button = screen.getByRole('button', { name: /logging out/i })
    expect(button).toBeDisabled()

    await userEvent.click(button)
    expect(onLogout).not.toHaveBeenCalled()
  })
})
