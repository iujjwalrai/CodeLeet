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
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '14px',
            padding: '12px 16px',
          },
          success: {
            iconTheme: { primary: '#a855f7', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#fff' },
          },
        }}
      />
    </div>
  )
}

export default App