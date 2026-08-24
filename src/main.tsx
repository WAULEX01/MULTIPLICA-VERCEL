import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/multiplica-typeui.css'
import App from './App.tsx'

// Aplica o tema salvo (dia/noite) antes do React montar, evitando flash de tema errado
(function applySavedTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  } catch (e) {
    // localStorage indisponível — mantém o tema claro padrão
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
