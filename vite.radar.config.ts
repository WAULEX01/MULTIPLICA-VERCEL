import baseConfig from './vite.config'
import { defineConfig } from 'vite'

const radarPerformanceTransform = () => ({
  name: 'multiplica-radar-perf-v823',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    if (!normalizedId.endsWith('/src/views/RadarView.tsx')) return null

    const reactImport = "import { useState } from 'react';"
    const startMarker = `  const fallbackDate = getLocalDateISO();\n  const radarData = db.people`
    const endMarker = `\n\n  const getAlertColor = (severity: string) => {`

    const start = code.indexOf(startMarker)
    const end = code.indexOf(endMarker, start)
    if (!code.includes(reactImport) || start < 0 || end < 0) {
      throw new Error('Radar perf v8.2.3: estrutura esperada não encontrada; build interrompido por segurança.')
    }

    const optimizedBlock = `  const fallbackDate = getLocalDateISO();\n  const radarData = useMemo(() => {\n    const attendancesByDept = new Map<string, typeof db.attendances>();\n    for (const attendance of db.attendances) {\n      if (attendance.deleted) continue;\n      const list = attendancesByDept.get(attendance.department) || [];\n      list.push(attendance);\n      attendancesByDept.set(attendance.department, list);\n    }\n    for (const list of attendancesByDept.values()) {\n      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());\n    }\n\n    const normalizedSearch = searchTerm.trim().toLowerCase();\n    return db.people\n      .filter(p => p.status !== 'Arquivado' && p.status !== 'Inativo' && p.status !== 'Visitante' && (!deptFilter || personInDepartment(p, deptFilter)) && !p.deleted)\n      .map(person => {\n        const targetDept = deptFilter || person.department;\n        const absences = calculateConsecutiveAbsences(person.id, targetDept, person.startDate || fallbackDate, db.attendances);\n        const sorted = attendancesByDept.get(targetDept) || [];\n\n        let lastPresence = 'Nenhuma chamada';\n        for (const rec of sorted) {\n          if (rec.presentIds.includes(person.id)) {\n            const parts = rec.date.split('-');\n            lastPresence = \`${'${parts[2]}/${parts[1]}/${parts[0]}'}\`;\n            break;\n          }\n        }\n\n        let severity: 'yellow' | 'orange' | 'red' | 'none' = 'none';\n        let action = '';\n        if (absences === 1) { severity = 'yellow'; action = 'Enviar mensagem'; }\n        else if (absences === 2) { severity = 'orange'; action = 'Ligar'; }\n        else if (absences >= 3) { severity = 'red'; action = 'Visitar'; }\n\n        return { person, absences, lastPresence, severity, action };\n      })\n      .filter(item => item.absences >= 1 && (normalizedSearch === '' || item.person.name.toLowerCase().includes(normalizedSearch)))\n      .filter(item => {\n        if (alertFilter === '1') return item.absences === 1;\n        if (alertFilter === '2') return item.absences === 2;\n        if (alertFilter === '3') return item.absences === 3;\n        if (alertFilter === '4_plus') return item.absences >= 4;\n        return item.absences >= 1;\n      })\n      .sort((a, b) => b.absences - a.absences || compareByName(a.person, b.person));\n  }, [db.people, db.attendances, deptFilter, searchTerm, alertFilter, fallbackDate]);`

    return {
      code: code
        .replace(reactImport, "import { useState, useMemo } from 'react';")
        .slice(0, start)
        + optimizedBlock
        + code.replace(reactImport, "import { useState, useMemo } from 'react';").slice(end),
      map: null,
    }
  },
})

const config = baseConfig as any

export default defineConfig({
  ...config,
  plugins: [...(config.plugins || []), radarPerformanceTransform()],
})
