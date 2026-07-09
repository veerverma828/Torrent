import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tailwind.css'
import '@fontsource-variable/inter/wght.css'
import './styles/animations.css'
import App from './app/App.jsx'
import ErrorBoundary from './components/system/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
