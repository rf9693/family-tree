import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Toaster } from 'sonner'
import { AuthProvider } from './store/AuthContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster theme="dark" position="top-center" richColors />
    </AuthProvider>
  </React.StrictMode>
)
