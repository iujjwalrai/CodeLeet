import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LocationProbe from './LocationProbe'

// Renders `ui` at `route`, plus a catch-all route that shows where the app
// navigated to. Tests that need auth state mock `useAuth` from
// ../context/AuthContext.
export const renderWithRouter = (ui, { route = '/', path = route } = {}) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
