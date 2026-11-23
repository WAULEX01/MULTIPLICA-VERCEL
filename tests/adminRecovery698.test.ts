import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('recuperação administrativa atual', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const people = readFileSync('src/views/PeopleListView.tsx', 'utf8');
  const inicio = readFileSync('src/views/InicioView.tsx', 'utf8');
  const syncEngine = readFileSync('src/services/syncEngine.ts', 'utf8');

  it('não mantém o aviso de sincronização ocupando a tela', () => {
    expect(app).toContain('readyNoticeTimer = setTimeout(() => setVersionNotice(null), ms)');
    expect(app).toContain('if (firstActivation)');
  });

  it('mostra ao Pastor Admin todos os excluídos sem depender da categoria', () => {
    expect(people).toContain('const globalDeletedView = showTrash && canViewDeletedRecords');
    expect(people).toContain('Excluídos / Lixeira');
    expect(people).toContain('Restaurar cadastro');
  });

  it('transfere o cadastro atualizando também a lista de departamentos', () => {
    expect(people).toContain('departments: [{ department: newDepartment, role: person.role }, ...extraAssignments]');
    expect(people).toContain('transferPerson(person, newDept)');
  });

  it('inclui arquivados e excluídos no resumo do Pastor Admin', () => {
    expect(inicio).toContain("session.role === 'Pastor Admin'");
    expect(inicio).toContain('archivedMembers');
    expect(inicio).toContain('deletedMembers');
  });

  it('mantém alterações de cadastro no patch genérico enviado ao Supabase', () => {
    expect(syncEngine).toContain('buildEntityPatch');
    expect(syncEngine).toContain('patch[key] = newItem[key]');
  });
});
