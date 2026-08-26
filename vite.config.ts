import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const lazyHeavyViewsBuildTransform = () => ({
  name: 'multiplica-lazy-heavy-views-v823',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    if (!normalizedId.endsWith('/src/App.tsx')) return null

    const reactImport = "import { useState, useEffect, useRef } from 'react';"
    const inicioImport = "import { InicioView } from './views/InicioView';"
    const dashboardImport = "import { DashboardView } from './views/DashboardView';"
    const departmentsImport = "import { DepartmentsView } from './views/DepartmentsView';"
    const peopleImport = "import { PeopleListView } from './views/PeopleListView';"
    const attendanceImport = "import { AttendanceView } from './views/AttendanceView';"
    const radarImport = "import { RadarView } from './views/RadarView';"
    const reportsImport = "import { ReportsView } from './views/ReportsView';"
    const agendaImport = "import { AgendaView } from './views/AgendaView';"
    const tutorialImport = "import { TutorialView } from './views/TutorialView';"
    const birthdaysImport = "import { BirthdaysView } from './views/BirthdaysView';"
    const settingsImport = "import { SettingsView } from './views/SettingsView';"
    const missionsImport = "import { SpecialMissionsView } from './views/SpecialMissionsView';"
    const chatImport = "import { ChatWidget } from './components/ChatWidget';"

    const inicioRender = "return <InicioView db={db} session={activeSession} onNavigate={setCurrentView} onChangeDepartment={handleSwitchSessionDepartment} />;"
    const dashboardRender = "return <DashboardView db={db} session={activeSession} onNavigate={setCurrentView} onOpenQuickAdd={() => setQuickAddModal({ open: true, type: 'membro' })} onUpdateDatabase={updateDatabase} onChangeDepartment={handleSwitchSessionDepartment} />;"
    const tutorialRender = "return <TutorialView session={activeSession} />;"
    const agendaRender = "return <AgendaView db={db} session={activeSession} onUpdateDatabase={updateDatabase} />;"
    const peopleRender = "return <PeopleListView db={db} session={activeSession} onUpdatePeople={updatePeople} onResetPassword={resetPersonPassword} initialDepartmentFilter={targetDepartmentFilter} onChangeDepartment={handleSwitchSessionDepartment} />;"
    const attendanceRender = "return <AttendanceView db={db} session={activeSession} onUpdateAttendances={updateAttendances} initialDepartmentFilter={targetDepartmentFilter} />;"
    const radarRender = "return <RadarView db={db} session={activeSession} onUpdatePastoralLogs={updatePastoralLogs} />;"
    const missionsRender = "return <SpecialMissionsView db={db} session={activeSession} onUpdateDatabase={updateDatabase} />;"
    const departmentsRender = "return <DepartmentsView db={db} session={activeSession} onUpdateDepts={updateDepartments} onHardDeleteDept={handleHardDeleteDept} onNavigate={handleNavigate} />;"
    const reportsRender = "return <ReportsView db={db} session={activeSession} />;"
    const birthdaysRender = "return <BirthdaysView db={db} session={activeSession} />;"
    const settingsRender = `return (\n          <SettingsView\n            db={db}\n            session={activeSession}\n            onResetData={resetAllData}\n            onUpdateGoals={updateGoals}\n            onUpdateDatabase={updateDatabase}\n            onForcePull={forcePullFromServer}\n            onForcePush={forcePushToServer}\n          />\n        );`

    const requiredFragments = [
      reactImport,
      inicioImport,
      dashboardImport,
      departmentsImport,
      peopleImport,
      attendanceImport,
      radarImport,
      reportsImport,
      agendaImport,
      tutorialImport,
      birthdaysImport,
      settingsImport,
      missionsImport,
      chatImport,
      inicioRender,
      dashboardRender,
      tutorialRender,
      agendaRender,
      peopleRender,
      attendanceRender,
      radarRender,
      missionsRender,
      departmentsRender,
      reportsRender,
      birthdaysRender,
      settingsRender,
    ]

    if (requiredFragments.some(fragment => !code.includes(fragment))) {
      throw new Error('Lazy Views v8.2.3: estrutura esperada do App.tsx não encontrada; build interrompido por segurança.')
    }

    const lazyView = (path: string, exportName: string) =>
      `const ${exportName} = lazy(() => import('${path}').then(module => ({ default: module.${exportName} })));`

    const wrap = (label: string, jsx: string) =>
      `return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando ${label}...</div>}>${jsx}</Suspense>;`

    const wrappedDashboard = wrap('painel', "<DashboardView db={db} session={activeSession} onNavigate={setCurrentView} onOpenQuickAdd={() => setQuickAddModal({ open: true, type: 'membro' })} onUpdateDatabase={updateDatabase} onChangeDepartment={handleSwitchSessionDepartment} />")
    const wrappedSettings = `return (\n          <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Carregando configurações...</div>}>\n            <SettingsView\n              db={db}\n              session={activeSession}\n              onResetData={resetAllData}\n              onUpdateGoals={updateGoals}\n              onUpdateDatabase={updateDatabase}\n              onForcePull={forcePullFromServer}\n              onForcePush={forcePushToServer}\n            />\n          </Suspense>\n        );`
    const lazyChatWrapper = `const LazyChatWidget = lazy(() => import('./components/ChatWidget').then(module => ({ default: module.ChatWidget })));\nconst ChatWidget = (props: any) => props.isOpen ? <Suspense fallback={null}><LazyChatWidget {...props} /></Suspense> : null;`

    let transformed = code
      .replace(reactImport, "import { useState, useEffect, useRef, lazy, Suspense } from 'react';")
      .replace(inicioImport, lazyView('./views/InicioView', 'InicioView'))
      .replace(dashboardImport, lazyView('./views/DashboardView', 'DashboardView'))
      .replace(departmentsImport, lazyView('./views/DepartmentsView', 'DepartmentsView'))
      .replace(peopleImport, lazyView('./views/PeopleListView', 'PeopleListView'))
      .replace(attendanceImport, lazyView('./views/AttendanceView', 'AttendanceView'))
      .replace(radarImport, lazyView('./views/RadarView', 'RadarView'))
      .replace(reportsImport, lazyView('./views/ReportsView', 'ReportsView'))
      .replace(agendaImport, lazyView('./views/AgendaView', 'AgendaView'))
      .replace(tutorialImport, lazyView('./views/TutorialView', 'TutorialView'))
      .replace(birthdaysImport, lazyView('./views/BirthdaysView', 'BirthdaysView'))
      .replace(settingsImport, lazyView('./views/SettingsView', 'SettingsView'))
      .replace(missionsImport, lazyView('./views/SpecialMissionsView', 'SpecialMissionsView'))
      .replace(chatImport, lazyChatWrapper)
      .replace(inicioRender, wrap('início', '<InicioView db={db} session={activeSession} onNavigate={setCurrentView} onChangeDepartment={handleSwitchSessionDepartment} />'))
      .replace(tutorialRender, wrap('tutorial', '<TutorialView session={activeSession} />'))
      .replace(agendaRender, wrap('agenda', '<AgendaView db={db} session={activeSession} onUpdateDatabase={updateDatabase} />'))
      .replace(peopleRender, wrap('membros', '<PeopleListView db={db} session={activeSession} onUpdatePeople={updatePeople} onResetPassword={resetPersonPassword} initialDepartmentFilter={targetDepartmentFilter} onChangeDepartment={handleSwitchSessionDepartment} />'))
      .replace(attendanceRender, wrap('presença', '<AttendanceView db={db} session={activeSession} onUpdateAttendances={updateAttendances} initialDepartmentFilter={targetDepartmentFilter} />'))
      .replace(radarRender, wrap('radar', '<RadarView db={db} session={activeSession} onUpdatePastoralLogs={updatePastoralLogs} />'))
      .replace(missionsRender, wrap('missões', '<SpecialMissionsView db={db} session={activeSession} onUpdateDatabase={updateDatabase} />'))
      .replace(departmentsRender, wrap('departamentos', '<DepartmentsView db={db} session={activeSession} onUpdateDepts={updateDepartments} onHardDeleteDept={handleHardDeleteDept} onNavigate={handleNavigate} />'))
      .replace(reportsRender, wrap('relatórios', '<ReportsView db={db} session={activeSession} />'))
      .replace(birthdaysRender, wrap('aniversariantes', '<BirthdaysView db={db} session={activeSession} />'))
      .replace(settingsRender, wrappedSettings)

    transformed = transformed.split(dashboardRender).join(wrappedDashboard)

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
