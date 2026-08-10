import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles'
import { CssBaseline, GlobalStyles } from '@mui/material'
import theme from './theme'
import { CommandProvider } from './commands/CommandProvider'
import { AuthProvider } from './auth/AuthContext'
import { FocusManagerProvider } from './focus/FocusManager'
import LanguageSynchronizer from './i18n/LanguageSynchronizer'
import PrerenderLanguageVisibilityGate from './startup/PrerenderLanguageVisibilityGate'

// Emotion inserts its style tags at runtime, after the bundled index.css, so the
// layer order is re-declared here as well. Whichever declaration the browser
// sees first wins, and both spell the same order — this only guarantees that
// `mui` is positioned even if Emotion gets to the document first.
const cssLayerOrder = <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrerenderLanguageVisibilityGate>
      <StyledEngineProvider enableCssLayer>
        {cssLayerOrder}
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <LanguageSynchronizer />
            <FocusManagerProvider>
              <CommandProvider>
                <App />
              </CommandProvider>
            </FocusManagerProvider>
          </AuthProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </PrerenderLanguageVisibilityGate>
  </StrictMode>,
)
