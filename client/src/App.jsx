import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import Router from './routes/Router'
import { AuthProvider } from './context/AuthContext'
const App = () => {
  return (
    <div>
      <BrowserRouter>
        <AuthProvider>
          <Router></Router>
        </AuthProvider>
      </BrowserRouter>
    </div>
  )
}

export default App