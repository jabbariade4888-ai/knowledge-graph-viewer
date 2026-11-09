import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Theme } from '@consta/uikit/Theme'
import App from './App'
import { useAppTheme } from './theme'
import './styles.css'

function Root() {
  const { mode, toggleTheme, preset } = useAppTheme()

  return (
    <Theme className="app-theme" preset={preset}>
      <App themeMode={mode} onToggleTheme={toggleTheme} />
    </Theme>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
