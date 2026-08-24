// src/views/DepartmentsView.tsx
import { useState } from 'react';
import type { AppDatabase, Department, UserSession } from '../services/db';
import { personInDepartment, generateUUID, compareByName } from '../services/db';
import { Network, Users, Calendar, Plus, Edit2, Trash2 } from 'lucide-react';

interface DepartmentsViewProps {
  db: AppDatabase;
  session: UserSession;
  onUpdateDepts: (newDepts: Department[]) => void;
  onHardDeleteDept?: (id: string, name: string) => void;
  onNavigate: (view: string, deptName?: string) => void;
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({ db, session, onUpdateDepts, onHardDeleteDept, onNavigate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const isAuthorized = session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin';
  const isRestricted = session.role === 'Líder' || session.role === 'Multiplicador';

  // Filter departments for list
  const filteredDepts = (db.departments || []).filter(
    d => d && !d.deleted && (!isRestricted || d.name === session?.department)
  ).sort(compareByName);

  const openAddModal = () => {
    setEditingDept(null);
    setFormName('');
    setFormDesc('');
    setIsModalOpen(true);
  };

  const openEditModal = (d: Department) => {
    setEditingDept(d);
    setFormName(d.name);
    setFormDesc(d.description);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingDept) {
      // Edit
      const updated = db.departments.map(d => {
        if (d.id === editingDept.id) {
          return { ...d, name: formName.trim(), description: formDesc.trim() };
        }
        return d;
      });
      
      // Update people's department names if they were linked to the old name
      // (This is a helpful cascade update!)
      onUpdateDepts(updated);
    } else {
      // Create
      const newDept: Department = {
        id: 'd_' + generateUUID(),
        name: formName.trim(),
        description: formDesc.trim()
      };
      onUpdateDepts([...db.departments, newDept]);
    }

    setIsModalOpen(false);
  };

  const toggleMissions = (deptId: string) => {
    const updated = db.departments.map(d => {
      if (d.id === deptId) {
        return { ...d, missionsEnabled: !d.missionsEnabled };
      }
      return d;
    });
    onUpdateDepts(updated);
  };

  const handleDelete = (id: string, name: string) => {
    // Check if people are linked to this department
    const linkedPeople = (db.people || []).filter(p => p && personInDepartment(p, name) && p.status !== 'Arquivado');
    if (linkedPeople.length > 0) {
      if (session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin') {
        if (window.confirm(`ATENÇÃO: O departamento "${name}" tem ${linkedPeople.length} pessoas vinculadas a ele.\n\nVocê deseja APAGAR DEFINITIVAMENTE este departamento e mover todos esses membros para "Geral (Sem Departamento)"?\n\nEsta ação não pode ser desfeita.`)) {
          if (onHardDeleteDept) onHardDeleteDept(id, name);
        }
      } else {
        alert(`Não é possível excluir o departamento "${name}" pois existem ${linkedPeople.length} pessoas vinculadas a ele. Transfira as pessoas de departamento primeiro.`);
      }
      return;
    }

    if (window.confirm(`ATENÇÃO: Deseja APAGAR DEFINITIVAMENTE o departamento "${name}"?\nIsso removerá ele do banco de dados para sempre.`)) {
      if (onHardDeleteDept) onHardDeleteDept(id, name);
    }
  };

  return (
    <div className="animate-fade">
      <div className="view-header">
        <div>
          <h2>Departamentos</h2>
          <p className="subtitle">Gestão de ministérios, departamentos e grupos da igreja</p>
        </div>
        
        {isAuthorized && (
          <button className="btn btn-primary btn-small" onClick={openAddModal}>
            <Plus size={16} />
            Novo Departamento
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {filteredDepts.map(dept => {
          // Calculate statistics
          const activePeople = (db.people || []).filter(p => p && personInDepartment(p, dept.name) && p.status === 'Ativo');
          const membersCount = activePeople.filter(p => p.role === 'Membro').length;
          
          const leaders = activePeople
            .filter(p => p.role === 'Líder')
            .map(p => p.name);
          const multipliers = activePeople
            .filter(p => p.role === 'Multiplicador')
            .map(p => p.name);

          const isUserDept = dept.name === session.department;

          return (
            <div 
              key={dept.id} 
              className="glass-card" 
              style={{ 
                borderLeft: isUserDept 
                  ? '5px solid var(--color-secondary)' 
                  : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '260px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <Network size={22} style={{ color: 'var(--power-orange)' }} />
                    {dept.name}
                  </h3>
                  {isUserDept && (
                    <span className="badge badge-active" style={{ fontSize: '0.65rem' }}>
                      Seu Dept
                    </span>
                  )}
                </div>

                <p style={{ color: 'var(--power-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', minHeight: '36px' }}>
                  {dept.description || 'Nenhuma descrição informada.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem', fontSize: '0.85rem', color: 'var(--power-muted)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--power-muted)' }}>
                      <Users size={14} /> Membros Ativos:
                    </span>
                    <span style={{ fontWeight: 700 }}>{membersCount}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--power-muted)', fontWeight: 600 }}>Liderança: </span>
                    <span style={{ fontWeight: 500 }}>{leaders.join(', ') || 'Sem líder cadastrado'}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--power-muted)', fontWeight: 600 }}>Multiplicadores: </span>
                    <span style={{ fontWeight: 500 }}>{multipliers.join(', ') || 'Nenhum'}</span>
                  </div>

                  {/* Missões Switch (visible to Pastor/Secretary or Líder of the department) */}
                  {(isAuthorized || isUserDept) && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--power-raised)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--power-line)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0, width: '100%' }}>
                        <input 
                          type="checkbox" 
                          checked={!!dept.missionsEnabled} 
                          onChange={() => toggleMissions(dept.id)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--color-secondary)' }}
                        />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--power-muted)' }}>Ativar Missões Semanais</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                borderTop: '1px solid var(--border-color)',
                paddingTop: '1rem',
                alignItems: 'center'
              }}>
                <button 
                  className="btn btn-secondary btn-small"
                  style={{ flex: 1, padding: '0.45rem 0.5rem' }}
                  onClick={() => onNavigate('membros', dept.name)}
                >
                  Membros
                </button>
                <button 
                  className="btn btn-primary btn-small"
                  style={{ flex: 1, padding: '0.45rem 0.5rem' }}
                  onClick={() => onNavigate('presenca', dept.name)}
                >
                  <Calendar size={13} />
                  Chamada
                </button>

                {/* Edit/Delete (Only for Pastor/Secretary) */}
                {isAuthorized && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="btn btn-secondary btn-small"
                      style={{ padding: '0.45rem 0.5rem', color: 'var(--color-text-main)' }}
                      onClick={() => openEditModal(dept)}
                      title="Editar Departamento"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      style={{ padding: '0.45rem 0.5rem', color: '#991b1b', background: 'rgba(239, 68, 68, 0.15)' }}
                      onClick={() => handleDelete(dept.id, dept.name)}
                      title="Apagar Definitivamente"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingDept ? 'Editar Departamento' : 'Adicionar Departamento'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="dept-name">Nome do Departamento</label>
                <input
                  id="dept-name"
                  type="text"
                  className="form-control"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Novo Alvorecer (Jovens)"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="dept-desc">Descrição / Detalhes</label>
                <textarea
                  id="dept-desc"
                  className="form-control"
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Descreva as reuniões ou propósito do departamento..."
                  style={{ resize: 'none', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDept ? 'Salvar Alterações' : 'Criar Departamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
