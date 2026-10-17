import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWithRouter } from '../test/renderWithRouter'
import OAuthSuccess from './OAuthSuccess'

// OAuthSuccess reads window.location directly rather than the router, so the
// query string is set on the jsdom URL.
const setSearch = (search) => window.history.replaceState({}, '', `/oauth-success${search}`)

describe('OAuthSuccess', () => {
  afterEach(() => window.history.replaceState({}, '', '/'))

  it('stores the token from the query string and goes to the dashboard', () => {
    setSearch('?token=abc.def.ghi')

    renderWithRouter(<OAuthSuccess />, { route: '/oauth-success' })

    expect(localStorage.getItem('token')).toBe('abc.def.ghi')
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
  })

  it('does nothing without a token', () => {
    setSearch('')

    const { container } = renderWithRouter(<OAuthSuccess />, { route: '/oauth-success' })

    expect(localStorage.getItem('token')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})
