import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// As transformações de texto da versão 8.2.3 dependiam da formatação exata
// dos arquivos TSX e passaram a falhar antes da compilação no Vite atual.
// A configuração nativa preserva o comportamento da aplicação sem alterar
// banco de dados, Supabase, autenticação ou sincronização.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'static/index-[hash].js',
        chunkFileNames: 'static/index-[hash].js',
        assetFileNames: 'static/index-[hash].[ext]',
      },
    },
  },
})
