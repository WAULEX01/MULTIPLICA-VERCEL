import baseConfig from './vite.dashboard-charts.config.ts'
import { defineConfig } from 'vite'

// A navegação premium é implementada diretamente em App.tsx para que o build
// não dependa de substituições textuais sensíveis à formatação do código.
export default defineConfig({ ...baseConfig })
