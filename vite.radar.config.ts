import baseConfig from './vite.config.ts'
import { defineConfig } from 'vite'

// Mantém o ponto de entrada histórico sem os transformadores frágeis de código.
export default defineConfig({ ...baseConfig })
