import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Regressão: na primeira renderização do cadastro mobile só 30 cartões
// estão visíveis; o indicador de faltas não deve processar todas as pessoas.
describe('mobile member navigation work', () => {
  const source = readFileSync('src/views/PeopleListView.tsx', 'utf8');

  it('keeps global search and filters across the full member collection', () => {
    expect(source).toContain('db.people.filter(p => {');
    expect(source).toContain('filteredPeople.slice(0, visibleCount)');
    expect(source).toContain('useState(30)');
  });

  it('calculates absence indicators only for visible member cards', () => {
    expect(source).toContain('for (const p of visiblePeople)');
    expect(source).toContain('[visiblePeople, db.attendances]');
    expect(source).not.toContain('for (const p of db.people) {\n      if (p.deleted) continue;\n      map.set(p.id, calculateConsecutiveAbsences');
    expect(source).toContain('const absences = absencesMap.get(p.id) || 0;');
  });

  it('loads extra member cards on demand without changing stored attendance', () => {
    expect(source).toContain('count + 30');
    expect(source).toContain('visiblePeople.length < filteredPeople.length');
  });
});
