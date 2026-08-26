import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const lazyHeavyViewsBuildTransform = () => ({
  name: 'multiplica-lazy-heavy-views-v823',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    if (!normalizedId.endsWith('/src/App.tsx')) return null

    const reactImport = "import { useState, useEffect, useRef } from 'react';"
    const dashboardImport = "import { DashboardView } from './views/DashboardView';"
    const peopleImport = "import { PeopleListView } from './views/PeopleListView';"
    const attendanceImport = "import { AttendanceView } from './views/AttendanceView';"
    const radarImport = "import { RadarView } from './views/RadarView';"
    const reportsImport = "import { ReportsView } from './views/ReportsView';"
    const agendaImport = "import { AgendaView } from './views/AgendaView';"
    const missionsImport = "import { SpecialMissionsView } from './views/SpecialMissionsView';"
    const dashboardRender = "return <DashboardView db={db} session={activeSession} onNavigate={setCurrentView} onOpenQuickAdd={() => setQuickAddModal({ open: true, type: 'membro' })} onUpdateDatabase={updateDatabase} onChangeDepartment={handleSwitchSessionDepartment} />;"
    const agendaRender = "return <AgendaView db={db} session={activeSession} onUpdateDatabase={updateDatabase} />;"
    const peopleRender = "return <PeopleListView db={db} session={activeSession} onUpdatePeople={updatePeople} onResetPassword={resetPersonPassword} initialDepartmentFilter={targetDepartmentFilter} onChangeDepartment={handleSwitchSessionDepartment} />;"
    const attendanceRender = "return <AttendanceView db={db} session={activeSession} onUpdateAttendances={updateAttendances} initialDepartmentFilter={targetDepartmentFilter} />;"
    const radarRender = "return <RadarView db={db} session={activeSession} onUpdatePastoralLogs={updatePastoralLogs} />;"
    const reportsRender = "return <ReportsView db={db} session={activeSession} />;"
    const missionsRender = "return <SpecialMissionsView db={db} session={activeSession} onUpdateDatabase={updateDatabase} />;"

    if (
      !code.includes(reactImport) ||
      !code.includes(dashboardImport) ||
      !code.includes(peopleImport) ||
      !code.includes(attendanceImport) ||
      !code.includes(radarImport) ||
      !code.includes(reportsImport) ||
      !code.includes(agendaImport) ||
      !code.includes(missionsImport) ||
      !code.includes(dashboardRender) ||
      !code.includes(agendaRender) ||
      !code.includes(peopleRender) ||
      !code.includes(attendanceRender) ||
      !code.includes(radarRender) ||
      !code.includes(reportsRender) ||
      !code.includes(missionsRender)
    ) {
      throw new Error('Lazy Views v8.2.3: estrutura esperada do App.tsx não encontrada; build interrompido por segurança.')
    }

    const transformed = code
      .replace(reactImport, "import { useState, useEffect, useRef, lazy, Suspense } from 'react';")
      .replace(
        dashboardImport,
        "const DashboardView = lazy(() => import('./views/DashboardView').then(module => ({ default: module.DashboardView })));"
      )
      .replace(
        peopleImport,
        "const PeopleListView = lazy(() => import('./views/PeopleListView').then(module => ({ default: module.PeopleListView })));"
      )
      .replace(
        attendanceImport,
        "const AttendanceView = lazy(() => import('./views/AttendanceView').then(module => ({ default: module.AttendanceView })));"
      )
      .replace(
        radarImport,
        "const RadarView = lazy(() => import('./views/RadarView').then(module => ({ default: module.RadarView })));"
      )
      .replace(
        reportsImport,
        "const ReportsView = lazy(() => import('./views/ReportsView').then(module => ({ default: module.ReportsView })));"
      )
      .replace(
        agendaImport,
        "const AgendaView = lazy(() => import('./views/AgendaView').then(module => ({ default: module.AgendaView })));"
      )
      .replace(
        missionsImport,
        "const SpecialMissionsView = lazy(() => import('./views/SpecialMissionsView').then(module => ({ default: module.SpecialMissionsView })));"
      )
      .replace(
        dashboardRender,
        "return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando painel...</div>}><DashboardView db={db} session={activeSession} onNavigate={setCurrentView} onOpenQuickAdd={() => setQuickAddModal({ open: true, type: 'membro' })} onUpdateDatabase={updateDatabase} onChangeDepartment={handleSwitchSessionDepartment} /></Suspense>;"
      )
      .replace(
        agendaRender,
        "return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando agenda...</div>}><AgendaView db={db} session={activeSession} onUpdateDatabase={updateDatabase} /></Suspense>;"
      )
      .replace(
        peopleRender,
        "return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando membros...</div>}><PeopleListView db={db} session={activeSession} onUpdatePeople={updatePeople} onResetPassword={resetPersonPassword} initialDepartmentFilter={targetDepartmentFilter} onChangeDepartment={handleSwitchSessionDepartment} /></Suspense>;"
      )
      .replace(
        attendanceRender,
        "return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando presença...</div>}><AttendanceView db={db} session={activeSession} onUpdateAttendances={updateAttendances} initialDepartmentFilter={targetDepartmentFilter} /></Suspense>;"
      )
      .replace(
        radarRender,
        "return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando radar...</div>}><RadarView db={db} session={activeSession} onUpdatePastoralLogs={updatePastoralLogs} /></Suspense>;"
      )
      .replace(
        reportsRender,
        "return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando relatórios...</div>}><ReportsView db={db} session={activeSession} /></Suspense>;"
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
