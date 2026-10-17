import { useLocation } from 'react-router-dom'

// Renders the current path so tests can assert on navigation.
const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

export default LocationProbe
