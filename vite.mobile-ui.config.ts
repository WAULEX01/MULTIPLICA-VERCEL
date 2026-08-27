import baseConfig from './vite.dashboard-charts.config.ts'
import { defineConfig } from 'vite'

const mobilePremiumNavigationTransform = () => ({
  name: 'multiplica-mobile-premium-navigation-v823',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    if (!normalizedId.endsWith('/src/App.tsx')) return null

    const themeState = "  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'light');"
    const navStartMarker = `      {/* 4. Bottom Nav for Mobile — all items with horizontal scroll */}`
    const navEndMarker = `\n\n      {/* Global Chat Widget — controlled from header */}`

    if (!code.includes(themeState) || !code.includes(navStartMarker) || !code.includes(navEndMarker)) {
      throw new Error('Mobile UI v8.2.3: estrutura esperada do App.tsx não encontrada; build interrompido por segurança.')
    }

    let transformed = code.replace(
      themeState,
      `${themeState}\n  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);`
    )

    const startIndex = transformed.indexOf(navStartMarker)
    const endIndex = transformed.indexOf(navEndMarker, startIndex)
    if (startIndex < 0 || endIndex < 0) {
      throw new Error('Mobile UI v8.2.3: navegação móvel não pôde ser substituída com segurança.')
    }

    const premiumNav = `      {/* 4. Bottom Nav for Mobile — mobile-first premium */}\n      {mobileMoreOpen && (\n        <div className="mobile-more-layer" role="presentation">\n          <button\n            type="button"\n            className="mobile-more-backdrop"\n            aria-label="Fechar menu Mais"\n            onClick={() => setMobileMoreOpen(false)}\n          />\n          <section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Mais opções">\n            <div className="mobile-more-handle" />\n            <div className="mobile-more-header">\n              <div>\n                <strong>Mais</strong>\n                <span>Outras áreas do Multiplica Plus</span>\n              </div>\n              <button type="button" className="mobile-more-close" onClick={() => setMobileMoreOpen(false)} aria-label="Fechar">×</button>\n            </div>\n            <div className="mobile-more-grid">\n              {filteredMenuItems\n                .filter(item => !['inicio', 'membros', 'presenca', 'radar'].includes(item.id))\n                .map(item => (\n                  <button\n                    type="button"\n                    key={item.id}\n                    className={\`mobile-more-item \${currentView === item.id ? 'active' : ''}\`}\n                    onClick={() => {\n                      setCurrentView(item.id);\n                      setMobileMoreOpen(false);\n                    }}\n                  >\n                    <span className="mobile-more-icon">{item.icon}</span>\n                    <span>{item.label}</span>\n                    {item.badge && radarCount > 0 && <b className="mobile-more-badge">{radarCount}</b>}\n                  </button>\n                ))}\n            </div>\n          </section>\n        </div>\n      )}\n\n      <nav className="mobile-nav mobile-nav-premium" aria-label="Navegação móvel">\n        {filteredMenuItems\n          .filter(item => ['inicio', 'membros', 'presenca', 'radar'].includes(item.id))\n          .map(item => (\n            <button\n              type="button"\n              key={item.id}\n              className={\`mobile-nav-item \${currentView === item.id ? 'active' : ''}\`}\n              onClick={() => {\n                setCurrentView(item.id);\n                setMobileMoreOpen(false);\n              }}\n              aria-current={currentView === item.id ? 'page' : undefined}\n            >\n              <span className="mobile-nav-icon">{item.icon}</span>\n              <span>{item.label === 'Radar Inteligente' ? 'Radar' : item.label}</span>\n              {item.badge && radarCount > 0 && <b className="mobile-nav-badge">{radarCount}</b>}\n            </button>\n          ))}\n        <button\n          type="button"\n          className={\`mobile-nav-item mobile-nav-more \${!['inicio', 'membros', 'presenca', 'radar'].includes(currentView) || mobileMoreOpen ? 'active' : ''}\`}\n          onClick={() => setMobileMoreOpen(open => !open)}\n          aria-expanded={mobileMoreOpen}\n          aria-label="Mais opções"\n        >\n          <span className="mobile-more-dots" aria-hidden="true">•••</span>\n          <span>Mais</span>\n        </button>\n      </nav>`

    transformed = transformed.slice(0, startIndex) + premiumNav + transformed.slice(endIndex)
    return { code: transformed, map: null }
  },
})

const config = baseConfig as any

export default defineConfig({
  ...config,
  plugins: [...(config.plugins || []), mobilePremiumNavigationTransform()],
})
