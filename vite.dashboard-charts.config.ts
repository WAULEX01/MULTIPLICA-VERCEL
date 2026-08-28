import baseConfig from './vite.radar.config.ts'
import { defineConfig } from 'vite'

// Mantém a cadeia de configuração usada pelo build de produção.
export default defineConfig({ ...baseConfig })
