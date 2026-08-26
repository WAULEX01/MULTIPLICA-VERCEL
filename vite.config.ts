import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const lazyMembersBuildTransform = () => ({
  name: 'multiplica-lazy-members-v823',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    if (!normalizedId.endsWith('/src/App.tsx')) return null

    const reactImport = "import { useState, useEffect, useRef } from 'react';"
    const peopleImport = "import { PeopleListView } from './views/PeopleListView';"
    const peopleRender = "return <PeopleListView db={db} session={activeSession} onUpdatePeople={updatePeople} onResetPassword={resetPersonPassword} initialDepartmentFilter={targetDepartmentFilter} onChangeDepartment={handleSwitchSessionDepartment} />;"

    if (!code.includes(reactImport) || !code.includes(peopleImport) || !code.includes(peopleRender)) {
      throw new Error('Lazy Members v8.2.3: estrutura esperada do App.tsx não encontrada; build interrompido por segurança.')
    }

    const transformed = code
      .replace(reactImport, "import { useState, useEffect, useRef, lazy, Suspense } from 'react';")
      .replace(
        peopleImport,
        "const PeopleListView = lazy(() => import('./views/PeopleListView').then(module => ({ default: module.PeopleListView })));"
      )
      .replace(
        peopleRender,
        "return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando membros...</div>}><PeopleListView db={db} session={activeSession} onUpdatePeople={updatePeople} onResetPassword={resetPersonPassword} initialDepartmentFilter={targetDepartmentFilter} onChangeDepartment={handleSwitchSessionDepartment} /></Suspense>;"
      )

    return { code: transformed, map: null }
  },
})

export default defineConfig({
  plugins: [lazyMembersBuildTransform(), react()],
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
