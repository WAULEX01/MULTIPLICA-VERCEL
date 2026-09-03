import baseConfig from './vite.dashboard-charts.config.ts'
import { defineConfig } from 'vite'
import { multiDepartmentAndAlphabeticalTransform } from './vite.multi-dept-alpha.config.ts'

// A navegação premium é implementada diretamente em App.tsx para que o build
// não dependa de substituições textuais sensíveis à formatação do código.
// Esta camada adicional corrige somente leitura de múltiplos departamentos e
// ordenação visual do Radar; não altera dados, API ou sincronização.
const base = baseConfig as any

export default defineConfig({
  ...base,
  plugins: [
    ...(base.plugins || []),
    multiDepartmentAndAlphabeticalTransform(),
  ],
})
