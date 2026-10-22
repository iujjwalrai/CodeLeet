import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import Router from './routes/Router'
import { AuthProvider } from './context/AuthContext'
import { Toaster } from 'react-hot-toast'

const App = () => {
  return (
    <div>
      <BrowserRouter>
        <AuthProvider>
          <Router></Router>
        </AuthProvider>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--surface)',
            color: 'var(--fg)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            fontSize: '14px',
            padding: '10px 14px',
            boxShadow: 'var(--elev-pop)',
          },
          success: {
            iconTheme: { primary: 'var(--ok)', secondary: 'var(--surface)' },
          },
          error: {
            iconTheme: { primary: 'var(--bad)', secondary: 'var(--surface)' },
          },
        }}
      />
    </div>
  )
}

export default App