import type { Plugin } from 'vite'

/**
 * Correções de leitura/ordenação aplicadas apenas no build.
 * Não altera banco, Supabase, API, sincronização ou dados persistidos.
 */
export function multiDepartmentAndAlphabeticalTransform(): Plugin {
  return {
    name: 'multiplica-multi-dept-alpha-order',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, '/')

      if (normalizedId.endsWith('/src/services/db.ts')) {
        const oldHelper = `export function getPersonDepartments(person: Person): DepartmentRole[] {
  if (person.departments && person.departments.length > 0) {
    return person.departments;
  }
  return [{ department: person.department, role: person.role }];
}`

        const newHelper = `export function getPersonDepartments(person: Person): DepartmentRole[] {
  // Compatibilidade com cadastros antigos e novos: o departamento principal
  // sempre faz parte do conjunto efetivo, mesmo quando departments[] existe.
  // Isso evita que uma pessoa vinculada a dois departamentos desapareça de
  // uma das listas caso o vínculo principal não tenha sido duplicado no array.
  const assignments: DepartmentRole[] = [];
  const seen = new Set<string>();

  const normalizeDepartmentKey = (value: string = '') =>
    value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().toLowerCase();

  const addAssignment = (assignment?: DepartmentRole) => {
    if (!assignment?.department) return;
    const key = normalizeDepartmentKey(assignment.department);
    if (!key || seen.has(key)) return;
    seen.add(key);
    assignments.push(assignment);
  };

  addAssignment({ department: person.department, role: person.role });
  (person.departments || []).forEach(addAssignment);

  return assignments;
}`

        if (!code.includes(oldHelper)) {
          this.warn('getPersonDepartments não encontrado no formato esperado; transformação não aplicada.')
          return null
        }

        return { code: code.replace(oldHelper, newHelper), map: null }
      }

      if (normalizedId.endsWith('/src/views/RadarView.tsx')) {
        const oldSort = `.sort((a, b) => b.absences - a.absences || compareByName(a, b));`
        const newSort = `.sort((a, b) => a.absences - b.absences || compareByName(a, b));`

        if (!code.includes(oldSort)) {
          this.warn('Ordenação por faltas do Radar não encontrada no formato esperado; transformação não aplicada.')
          return null
        }

        return { code: code.replace(oldSort, newSort), map: null }
      }

      return null
    },
  }
}
