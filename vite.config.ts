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
      reactImport, inicioImport, dashboardImport, departmentsImport, peopleImport,
      attendanceImport, radarImport, reportsImport, agendaImport, tutorialImport,
      birthdaysImport, settingsImport, missionsImport, chatImport, inicioRender,
      dashboardRender, tutorialRender, agendaRender, peopleRender, attendanceRender,
      radarRender, missionsRender, departmentsRender, reportsRender, birthdaysRender,
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

const peopleListPerformanceTransform = () => ({
  name: 'multiplica-people-list-perf-v823',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    if (!normalizedId.endsWith('/src/views/PeopleListView.tsx')) return null

    const censusImport = "import { CENSUS_DATA } from '../services/census_data';"
    const censusStateBlock = `  // Google Sheets Census Simulator State\n  const [isCensusSimulatorOpen, setIsCensusSimulatorOpen] = useState(false);\n  const [simulatedPeople, setSimulatedPeople] = useState(() => [...CENSUS_DATA]);\n  const [simulatorSearch, setSimulatorSearch] = useState('');\n  const [activeChangeDeptId, setActiveChangeDeptId] = useState<string | null>(null);\n  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);`
    const censusButtonBlock = `                        <button className="btn btn-secondary btn-sm" onClick={() => { setSimulatedPeople([...CENSUS_DATA]); setIsCensusSimulatorOpen(true); }}>\n                          <FileSpreadsheet size={16} style={{ color: 'var(--power-orange)' }} /> Simular Censo Google Sheets\n                        </button>\n`
    const censusHandlersStart = `\n  const handleMergeCensus = () => {`
    const componentReturnMarker = `\n  return (`
    const censusModalStart = `\n      {/* Modal Census Simulator */}`
    const baptismModalStart = `\n      {/* Modal Relatório de Batismo */}`
    const countsBlock = `const scopedPeople = db.people.filter(p => !p.deleted && (!session.department || personInDepartment(p, session.department)));\n  const activeCount = scopedPeople.filter(p => p.status === 'Ativo' || !p.status).length;\n  const visitorCount = scopedPeople.filter(p => p.status === 'Visitante').length;\n  const archivedCount = scopedPeople.filter(p => p.status === 'Arquivado').length;\n  const deletedCount = canViewDeletedRecords\n    ? db.people.filter(p => p.deleted).length\n    : db.people.filter(p => p.deleted && (!session.department || personInDepartment(p, session.department))).length;`
    const peopleMap = `{filteredPeople.map(p => {`
    const emptyMarker = `          {filteredPeople.length === 0 && (`
    const countsMarker = `  // Category counts (scoped to chosen department when defined)`

    const required = [censusImport, censusStateBlock, censusButtonBlock, censusHandlersStart, censusModalStart, baptismModalStart, countsBlock, peopleMap, emptyMarker, countsMarker]
    if (required.some(fragment => !code.includes(fragment))) {
      throw new Error('PeopleList perf v8.2.3: estrutura esperada não encontrada; build interrompido por segurança.')
    }

    const memoCounts = `const { activeCount, visitorCount, archivedCount, deletedCount } = useMemo(() => {\n    let activeCount = 0;\n    let visitorCount = 0;\n    let archivedCount = 0;\n    let deletedCount = 0;\n    for (const p of db.people) {\n      if (p.deleted) {\n        if (canViewDeletedRecords || !session.department || personInDepartment(p, session.department)) deletedCount++;\n        continue;\n      }\n      if (session.department && !personInDepartment(p, session.department)) continue;\n      if (p.status === 'Visitante') visitorCount++;\n      else if (p.status === 'Arquivado') archivedCount++;\n      else if (p.status === 'Ativo' || !p.status) activeCount++;\n    }\n    return { activeCount, visitorCount, archivedCount, deletedCount };\n  }, [db.people, session.department, canViewDeletedRecords]);`

    const resetVisible = `  useEffect(() => {\n    setVisibleCount(50);\n  }, [searchTerm, categoryTab, roleFilter, profileTab, deptFilter, missingContactFilter, showTrash, baptismFilter, session.department]);\n\n`

    const loadMoreBlock = `          {filteredPeople.length > visibleCount && (\n            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '1rem 0 0.5rem' }}>\n              <button type="button" className="btn btn-secondary" onClick={() => setVisibleCount(count => count + 50)}>\n                Carregar mais ({Math.min(50, filteredPeople.length - visibleCount)} de {filteredPeople.length - visibleCount} restantes)\n              </button>\n            </div>\n          )}\n\n`

    let transformed = code
      .replace(censusImport, '')
      .replace(censusStateBlock, `  const [activeChangeDeptId, setActiveChangeDeptId] = useState<string | null>(null);\n  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);\n  const [visibleCount, setVisibleCount] = useState(50);`)
      .replace(censusButtonBlock, '')
      .replace(countsBlock, memoCounts)
      .replace(peopleMap, `{filteredPeople.slice(0, visibleCount).map(p => {`)
      .replace(emptyMarker, loadMoreBlock + emptyMarker)
      .replace(countsMarker, resetVisible + countsMarker)

    const handlersStartIndex = transformed.indexOf(censusHandlersStart)
    const returnIndex = transformed.indexOf(componentReturnMarker, handlersStartIndex)
    if (handlersStartIndex < 0 || returnIndex < 0) {
      throw new Error('PeopleList perf v8.2.3: bloco legado do censo não pôde ser removido com segurança.')
    }
    transformed = transformed.slice(0, handlersStartIndex) + transformed.slice(returnIndex)

    const modalStartIndex = transformed.indexOf(censusModalStart)
    const baptismStartIndex = transformed.indexOf(baptismModalStart, modalStartIndex)
    if (modalStartIndex < 0 || baptismStartIndex < 0) {
      throw new Error('PeopleList perf v8.2.3: modal legado do censo não pôde ser removido com segurança.')
    }
    transformed = transformed.slice(0, modalStartIndex) + transformed.slice(baptismStartIndex)

    return { code: transformed, map: null }
  },
})

const attendancePerformanceTransform = () => ({
  name: 'multiplica-attendance-perf-v823',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    if (!normalizedId.endsWith('/src/views/AttendanceView.tsx')) return null

    const reactImport = "import { useState, useEffect, useRef } from 'react';"
    const activeBlock = `  const activeDeptPeople = db.people.filter(\n    p => p.status === 'Ativo' && !p.deleted && personInDepartment(p, selectedDept)\n  );\n\n  // Subgrupos disponíveis no departamento selecionado (ex.: 'Huperetes' após fusão)\n  const availableSubGroups = Array.from(new Set(\n    activeDeptPeople.map(p => getPersonSubGroup(p, selectedDept)).filter(Boolean) as string[]\n  ));\n\n  // Flag: is this the Atalaias de Cristo department?\n  const isAtalaias = selectedDept.toLowerCase().includes('atalaia');\n\n  // --- Atalaias: alphabetical split into Grupo A and Grupo B ---\n  const sortedMembers = activeDeptPeople\n    .filter(p => p.role === 'Membro')\n    .sort(compareByName);\n  const midPoint = Math.ceil(sortedMembers.length / 2);\n  const groupAMembers = sortedMembers.slice(0, midPoint);\n  const groupBMembers = sortedMembers.slice(midPoint);\n  const otherProfiles = activeDeptPeople\n    .filter(p => p.role !== 'Membro')\n    .sort(compareByName);\n  const currentGroupList =\n    groupTab === 'grupoA' ? groupAMembers\n    : groupTab === 'grupoB' ? groupBMembers\n    : otherProfiles;\n\n  // --- Standard departments: Membros or Outros ---\n  const filteredDeptPeople = activeDeptPeople.filter(p =>\n    roleFilter === 'membros' ? p.role === 'Membro' : p.role !== 'Membro'\n  );\n\n  // Aplica o filtro de subgrupo (ex.: separar Huperetes) sobre o filtro de perfil\n  const subgroupFiltered = subGroupFilter === 'todos'\n    ? filteredDeptPeople\n    : filteredDeptPeople.filter(p => getPersonSubGroup(p, selectedDept) === subGroupFilter);\n\n  // The active list for select-all depends on which mode we're in\n  const activeList = isAtalaias ? currentGroupList : subgroupFiltered;\n\n  // Total exibido no cabeçalho da lista (respeita o filtro de subgrupo)\n  const headerTotal = isAtalaias ? activeDeptPeople.length : (subGroupFilter === 'todos' ? activeDeptPeople.length : subgroupFiltered.length);`

    if (!code.includes(reactImport) || !code.includes(activeBlock)) {
      throw new Error('Attendance perf v8.2.3: estrutura esperada não encontrada; build interrompido por segurança.')
    }

    const memoBlock = `  const { activeDeptPeople, availableSubGroups, isAtalaias, activeList, headerTotal } = useMemo(() => {\n    const activeDeptPeople = db.people.filter(\n      p => p.status === 'Ativo' && !p.deleted && personInDepartment(p, selectedDept)\n    );\n    const availableSubGroups = Array.from(new Set(\n      activeDeptPeople.map(p => getPersonSubGroup(p, selectedDept)).filter(Boolean) as string[]\n    ));\n    const isAtalaias = selectedDept.toLowerCase().includes('atalaia');\n    const sortedMembers = activeDeptPeople.filter(p => p.role === 'Membro').sort(compareByName);\n    const midPoint = Math.ceil(sortedMembers.length / 2);\n    const groupAMembers = sortedMembers.slice(0, midPoint);\n    const groupBMembers = sortedMembers.slice(midPoint);\n    const otherProfiles = activeDeptPeople.filter(p => p.role !== 'Membro').sort(compareByName);\n    const currentGroupList = groupTab === 'grupoA' ? groupAMembers : groupTab === 'grupoB' ? groupBMembers : otherProfiles;\n    const filteredDeptPeople = activeDeptPeople.filter(p => roleFilter === 'membros' ? p.role === 'Membro' : p.role !== 'Membro');\n    const subgroupFiltered = subGroupFilter === 'todos'\n      ? filteredDeptPeople\n      : filteredDeptPeople.filter(p => getPersonSubGroup(p, selectedDept) === subGroupFilter);\n    const activeList = isAtalaias ? currentGroupList : subgroupFiltered;\n    const headerTotal = isAtalaias ? activeDeptPeople.length : (subGroupFilter === 'todos' ? activeDeptPeople.length : subgroupFiltered.length);\n    return { activeDeptPeople, availableSubGroups, isAtalaias, activeList, headerTotal };\n  }, [db.people, selectedDept, groupTab, roleFilter, subGroupFilter]);`

    return {
      code: code
        .replace(reactImport, "import { useState, useEffect, useRef, useMemo } from 'react';")
        .replace(activeBlock, memoBlock),
      map: null,
    }
  },
})

export default defineConfig({
  plugins: [peopleListPerformanceTransform(), attendancePerformanceTransform(), lazyHeavyViewsBuildTransform(), react()],
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
