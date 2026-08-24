import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('recuperação administrativa e UX do hotfix R1', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const people = readFileSync('src/views/PeopleListView.tsx', 'utf8');
  const inicio = readFileSync('src/views/InicioView.tsx', 'utf8');
  const php = readFileSync('public/api.php', 'utf8');

  it('não mantém o aviso de sincronização ocupando a tela', () => {
    expect(app).not.toContain('sincronizada com o banco oficial da Hostinger');
    expect(app).toContain('readyNoticeTimer = setTimeout(() => setVersionNotice(null), ms)');
    expect(app).toContain('if (firstActivation)');
  });

  it('mostra ao Pastor Admin todos os excluídos sem depender da categoria', () => {
    expect(people).toContain('const globalDeletedView = showTrash && canViewDeletedRecords');
    expect(people).toContain('const matchesCategory = showTrash ||');
    expect(people).toContain('Excluídos / Lixeira');
    expect(people).toContain('{deletedCount}');
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

  it('mantém batismo e intenção no contrato de gravação MySQL', () => {
    expect(php).toContain('baptized=VALUES(baptized)');
    expect(php).toContain('baptismIntention=VALUES(baptismIntention)');
    expect(php).toContain("array_key_exists('baptized', $p)");
  });
});
