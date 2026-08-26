import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const lazyHeavyViewsBuildTransform = () => ({
  name: 'multiplica-lazy-heavy-views-v823',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    if (!normalizedId.endsWith('/src/App.tsx')) return null

    const reactImport = "import { useState, useEffect, useRef } from 'react';"
    const peopleImport = "import { PeopleListView } from './views/PeopleListView';"
    const missionsImport = "import { SpecialMissionsView } from './views/SpecialMissionsView';"
    const peopleRender = "return <PeopleListView db={db} session={activeSession} onUpdatePeople={updatePeople} onResetPassword={resetPersonPassword} initialDepartmentFilter={targetDepartmentFilter} onChangeDepartment={handleSwitchSessionDepartment} />;"
    const missionsRender = "return <SpecialMissionsView db={db} session={activeSession} onUpdateDatabase={updateDatabase} />;"

    if (
      !code.includes(reactImport) ||
      !code.includes(peopleImport) ||
      !code.includes(missionsImport) ||
      !code.includes(peopleRender) ||
      !code.includes(missionsRender)
    ) {
      throw new Error('Lazy Views v8.2.3: estrutura esperada do App.tsx não encontrada; build interrompido por segurança.')
    }

    const transformed = code
      .replace(reactImport, "import { useState, useEffect, useRef, lazy, Suspense } from 'react';")
      .replace(
        peopleImport,
        "const PeopleListView = lazy(() => import('./views/PeopleListView').then(module => ({ default: module.PeopleListView })));"
      )
      .replace(
        missionsImport,
        "const SpecialMissionsView = lazy(() => import('./views/SpecialMissionsView').then(module => ({ default: module.SpecialMissionsView })));"
      )
      .replace(
        peopleRender,
        "return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando membros...</div>}><PeopleListView db={db} session={activeSession} onUpdatePeople={updatePeople} onResetPassword={resetPersonPassword} initialDepartmentFilter={targetDepartmentFilter} onChangeDepartment={handleSwitchSessionDepartment} /></Suspense>;"
      )
      .replace(
        missionsRender,
        "return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando missões...</div>}><SpecialMissionsView db={db} session={activeSession} onUpdateDatabase={updateDatabase} /></Suspense>;"
      )

    return { code: transformed, map: null }
  },
})

export default defineConfig({
  plugins: [lazyHeavyViewsBuildTransform(), react()],
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
