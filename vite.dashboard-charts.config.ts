import baseConfig from './vite.radar.config.ts'
import { defineConfig } from 'vite'

const dashboardChartsPerformanceTransform = () => ({
  name: 'multiplica-dashboard-charts-perf-v823',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    if (!normalizedId.endsWith('/src/views/DashboardView.tsx')) return null

    const growthStart = `  // 1. Growth chart (total members registered monthly - dynamic last 6 months)\n  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];`
    const attendanceStart = `  // 2. Attendance history chart (last N weeks, summing all departments per date)\n  const allAttendances = db.attendances.filter(a => !a.deleted && (!deptFilter || isSameDepartment(a.department, deptFilter)));`
    const chartPluginMarker = `\n  const growthDatalabelsPlugin = {`

    if (!code.includes(growthStart) || !code.includes(attendanceStart) || !code.includes(chartPluginMarker)) {
      throw new Error('Dashboard charts perf v8.2.3: estrutura esperada não encontrada; build interrompido por segurança.')
    }

    let transformed = code.replace(
      growthStart,
      `  // 1. Growth chart (total members registered monthly - dynamic last 6 months)\n  const { growthData, growthChartMax } = useMemo(() => {\n  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];`
    )

    transformed = transformed.replace(
      attendanceStart,
      `  return { growthData, growthChartMax };\n  }, [db.people, deptFilter, todayStr]);\n\n  // 2. Attendance history chart (last N weeks, summing all departments per date)\n  const { groupedRecords, attendanceChartData } = useMemo(() => {\n  const allAttendances = db.attendances.filter(a => !a.deleted && (!deptFilter || isSameDepartment(a.department, deptFilter)));`
    )

    transformed = transformed.replace(
      chartPluginMarker,
      `\n  return { groupedRecords, attendanceChartData };\n  }, [db.attendances, deptFilter, attendanceWeeks, todayStr]);\n\n  const growthDatalabelsPlugin = {`
    )

    return { code: transformed, map: null }
  },
})

const config = baseConfig as any

export default defineConfig({
  ...config,
  plugins: [...(config.plugins || []), dashboardChartsPerformanceTransform()],
})
