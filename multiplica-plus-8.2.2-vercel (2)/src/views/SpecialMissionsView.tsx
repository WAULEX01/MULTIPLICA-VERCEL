import React, { useState } from 'react';
import type { AppDatabase, UserSession, SpecialMission, Person, SpecialMissionAssignment } from '../services/db';
import { isSameDepartment, distributeSpecialMissionRecipients, generateUUID, isVirtualDepartment, compareByName } from '../services/db';
import { MediaUploader } from '../components/MediaUploader';
import { Plus, Edit2, Trash2, Eye, EyeOff, Save, X, Sparkles, Target, Users, MessageSquare, Send } from 'lucide-react';

interface SpecialMissionsViewProps {
  db: AppDatabase;
  session: UserSession;
  onUpdateDatabase?: (newDB: AppDatabase) => void;
}

export const SpecialMissionsView: React.FC<SpecialMissionsViewProps> = ({ db, session, onUpdateDatabase }) => {
  const isPastorOrSecretary = session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin';
  const isLeader = session.role === 'Líder';
  const canManage = isPastorOrSecretary || isLeader;

  // Filter special missions based on user role / selected department
  const visibleMissions = (db.specialMissions || []).filter(sm => {
    if (sm.deleted) return false;
    if (isPastorOrSecretary && !session.department) return true;
    if (session.department) {
      // Com departamento definido, vê missões do departamento OU 'todos'
      return sm.targetDepartment === 'todos' || isSameDepartment(sm.department, session.department);
    }
    if (isLeader) return false;
    return false;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<SpecialMission | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formTargetDept, setFormTargetDept] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formMediaUrl, setFormMediaUrl] = useState<string | undefined>();
  const [formMediaType, setFormMediaType] = useState<'image' | 'video' | undefined>();
  const [formTemplate, setFormTemplate] = useState('');
  const [formUseFirstName, setFormUseFirstName] = useState(true);
  const [formActive, setFormActive] = useState(true);

  const departments = db.departments.filter(d => !d.deleted && !isVirtualDepartment(d.name)).map(d => d.name).sort();
  const multiplicadores = db.people.filter(p =>
    (p.role === 'Multiplicador' || p.role === 'Líder' || p.role === 'Pastor' || p.role === 'Pastor Admin' || p.role === 'Secretaria Geral') && p.status === 'Ativo' && !p.deleted
  ).sort(compareByName);

  const openCreateModal = () => {
    setEditingMission(null);
    setFormTitle('');
    setFormDesc('');
    setFormDept(isLeader && session.department ? session.department : '');
    setFormTargetDept(isLeader && session.department ? session.department : '');
    setFormAssignedTo('');
    setFormMediaUrl(undefined);
    setFormMediaType(undefined);
    setFormTemplate('');
    setFormUseFirstName(true);
    setFormActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (sm: SpecialMission) => {
    setEditingMission(sm);
    setFormTitle(sm.title);
    setFormDesc(sm.description);
    setFormDept(sm.department);
    setFormTargetDept(sm.targetDepartment);
    setFormAssignedTo(sm.assignedTo || '');
    setFormMediaUrl(sm.mediaUrl);
    setFormMediaType(sm.mediaType);
    setFormTemplate(sm.messageTemplate || '');
    setFormUseFirstName(sm.useFirstName ?? true);
    setFormActive(sm.active);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formTitle.trim() || !formDesc.trim()) {
      alert('Preencha título e descrição.');
      return;
    }
    if (!canManage || !onUpdateDatabase || !session.personId) return;

    const now = new Date().toISOString();
    const specialMissions = db.specialMissions || [];

    if (editingMission) {
      // Update existing
      const updated = specialMissions.map(sm => {
        if (sm.id === editingMission.id) {
          let updatedSm: SpecialMission = {
            ...sm,
            title: formTitle.trim(),
            description: formDesc.trim(),
            department: formTargetDept === 'todos' ? session.department || formDept : formTargetDept,
            targetDepartment: formTargetDept,
            assignedTo: formAssignedTo || undefined,
            mediaUrl: formMediaUrl,
            mediaType: formMediaType,
            messageTemplate: formTemplate || undefined,
            useFirstName: formUseFirstName,
            active: formActive,
            targetPerMultiplier: 15,
            version: (sm.version || 0) + 1,
            updatedAt: now,
            updatedBy: session.personId,
          };
          // Se ativa, redistribuir membros
          if (updatedSm.active) {
            updatedSm = distributeSpecialMissionRecipients(db, updatedSm, 15);
          }
          return updatedSm;
        }
        return sm;
      });
      onUpdateDatabase({ ...db, specialMissions: updated });
    } else {
      // Create new
      let newMission: SpecialMission = {
        id: 'sp_' + generateUUID(),
        title: formTitle.trim(),
        description: formDesc.trim(),
        department: formTargetDept === 'todos' ? session.department || formDept : formTargetDept,
        targetDepartment: formTargetDept,
        assignedTo: formAssignedTo || undefined,
        mediaUrl: formMediaUrl,
        mediaType: formMediaType,
        createdBy: session.personId,
        createdAt: now,
        active: formActive,
        messageTemplate: formTemplate || undefined,
        useFirstName: formUseFirstName,
        targetPerMultiplier: 15,
        version: 1,
      };
      // Distribuir automaticamente 15 membros por multiplicador sem repetição
      if (newMission.active) {
        newMission = distributeSpecialMissionRecipients(db, newMission, 15);
      }
      onUpdateDatabase({ ...db, specialMissions: [...specialMissions, newMission] });
    }

    setIsModalOpen(false);
  };

  const handleDelete = (sm: SpecialMission) => {
    if (!canManage || !onUpdateDatabase) return;
    if (!window.confirm(`Excluir missão especial "${sm.title}"?`)) return;

    const updated = (db.specialMissions || []).map(m => {
      if (m.id === sm.id) return { ...m, deleted: true, version: (m.version || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: session.personId };
      return m;
    });
    onUpdateDatabase({ ...db, specialMissions: updated });
  };

  const toggleActive = (sm: SpecialMission) => {
    if (!canManage || !onUpdateDatabase) return;
    const now = new Date().toISOString();
    const updated = (db.specialMissions || []).map(m => {
      if (m.id === sm.id) {
        const toggled = { ...m, active: !m.active, version: (m.version || 0) + 1, updatedAt: now, updatedBy: session.personId };
        // Se ativando, distribuir membros automaticamente
        if (toggled.active) {
          return distributeSpecialMissionRecipients(db, toggled, m.targetPerMultiplier || 15);
        }
        return toggled;
      }
      return m;
    });
    onUpdateDatabase({ ...db, specialMissions: updated });
  };

  const getAssignedName = (personId?: string) => {
    if (!personId) return 'Todos os multiplicadores';
    const p = db.people.find(pp => pp.id === personId);
    return p ? p.name : 'Desconhecido';
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  if (!canManage) {
    return (
      <div className="animate-fade">
        <div className="view-header">
          <div>
            <h2>Missões Especiais</h2>
            <p className="subtitle">Apenas pastores e líderes podem gerenciar missões especiais.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <div className="view-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={22} color="var(--power-orange)" />
            Missões Especiais
          </h2>
          <p className="subtitle">
            {isPastorOrSecretary
              ? 'Crie missões com imagem/vídeo para departamentos específicos ou para todos.'
              : 'Crie missões especiais para o seu departamento.'}
          </p>
        </div>
        <button className="btn btn-primary btn-small" onClick={openCreateModal}>
          <Plus size={16} />
          Nova Missão Especial
        </button>
      </div>

      {/* List */}
      <div className="glass-card" style={{ padding: 0 }}>
        {visibleMissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--power-muted)' }}>
            <Sparkles size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p>Nenhuma missão especial encontrada.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Clique em "Nova Missão Especial" para criar uma.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleMissions.map(sm => (
              <div
                key={sm.id}
                style={{
                  borderBottom: '1px solid var(--power-line)',
                  padding: '1.25rem 1.5rem',
                  background: sm.active ? 'white' : 'var(--power-muted)',
                  opacity: sm.active ? 1 : 0.7,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--power-white)' }}>
                        {sm.title}
                      </h4>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.65rem', padding: '0.15rem 0.5rem',
                          background: sm.active ? '#d1fae5' : '#fef2f2',
                          color: sm.active ? '#047857' : '#dc2626',
                          border: `1px solid ${sm.active ? '#34d399' : '#fecaca'}`,
                        }}
                      >
                        {sm.active ? 'Ativa' : 'Inativa'}
                      </span>
                      <span className="badge" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: 'rgba(15, 23, 42, 0.5)', color: 'var(--power-muted)', border: '1px solid var(--power-line)' }}>
                        {sm.targetDepartment === 'todos' ? 'Todos os departamentos' : sm.department}
                      </span>
                    </div>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--power-muted)' }}>
                      {sm.description}
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)' }}>
                        <Target size={12} style={{ marginRight: '0.25rem' }} />
                        {getAssignedName(sm.assignedTo)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)' }}>
                        Criada em {formatDate(sm.createdAt)}
                      </span>
                      {sm.mediaUrl && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--power-orange)' }}>
                          {sm.mediaType === 'video' ? '🎬 Vídeo' : '🖼️ Imagem'} anexada
                        </span>
                      )}
                      {sm.messageTemplate && (
                        <span style={{ fontSize: '0.75rem', color: '#6366f1' }}>
                          <MessageSquare size={12} style={{ marginRight: '0.25rem' }} />
                          Template personalizado
                        </span>
                      )}
                    </div>
                    {/* Media preview inline */}
                    {sm.mediaUrl && sm.mediaType === 'image' && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <img src={sm.mediaUrl} alt={sm.title} style={{ maxWidth: '200px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--power-line)' }} />
                      </div>
                    )}
                    {sm.mediaUrl && sm.mediaType === 'video' && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <video src={sm.mediaUrl} controls style={{ maxWidth: '200px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--power-line)' }} />
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => toggleActive(sm)}
                      title={sm.active ? 'Desativar' : 'Ativar'}
                      style={{ padding: '0.4rem 0.6rem' }}
                    >
                      {sm.active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => openEditModal(sm)}
                      title="Editar"
                      style={{ padding: '0.4rem 0.6rem' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => handleDelete(sm)}
                      title="Excluir"
                      style={{ padding: '0.4rem 0.6rem', color: '#dc2626' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de criação/edição */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingMission ? 'Editar Missão Especial' : 'Nova Missão Especial'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Título *</label>
                <input
                  className="form-control"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ex: Culto de Jovens - Julho"
                />
              </div>
              <div>
                <label className="form-label">Descrição *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Descreva o objetivo da missão especial..."
                />
              </div>

              {/* Department scope */}
              {isPastorOrSecretary && (
                <div>
                  <label className="form-label">Escopo da Missão</label>
                  <select
                    className="form-control"
                    value={formTargetDept}
                    onChange={e => setFormTargetDept(e.target.value)}
                  >
                    <option value="">Selecione um departamento...</option>
                    <option value="todos">Todos os departamentos</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assigned to specific multiplier */}
              <div>
                <label className="form-label">Atribuir a (opcional)</label>
                <select
                  className="form-control"
                  value={formAssignedTo}
                  onChange={e => setFormAssignedTo(e.target.value)}
                >
                  <option value="">Todos os multiplicadores do departamento</option>
                  {multiplicadores
                    .filter(p => formTargetDept === 'todos' || isSameDepartment(p.department, formTargetDept) || p.departments?.some(d => isSameDepartment(d.department, formTargetDept)))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                    ))}
                </select>
              </div>

              {/* Media */}
              <div>
                <label className="form-label">Mídia (imagem ou vídeo)</label>
                <MediaUploader
                  currentUrl={formMediaUrl}
                  currentType={formMediaType}
                  onMediaChange={(url, type) => {
                    setFormMediaUrl(url);
                    setFormMediaType(type);
                  }}
                />
              </div>

              {/* Message template */}
              <div>
                <label className="form-label">Template de Mensagem</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={formTemplate}
                  onChange={e => setFormTemplate(e.target.value)}
                  placeholder={'A paz do Senhor, {nome}! {mensagem}'}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--power-muted)', marginTop: '0.25rem' }}>
                  Use {'{nome}'} para o nome do membro e {'{mensagem}'} para a descrição da missão.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="useFirstName"
                  checked={formUseFirstName}
                  onChange={e => setFormUseFirstName(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="useFirstName" style={{ fontSize: '0.85rem', color: 'var(--power-muted)', cursor: 'pointer' }}>
                  Usar apenas o primeiro nome do membro na mensagem
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="activeMission"
                  checked={formActive}
                  onChange={e => setFormActive(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="activeMission" style={{ fontSize: '0.85rem', color: 'var(--power-muted)', cursor: 'pointer' }}>
                  Missão ativa
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={16} />
                {editingMission ? 'Salvar Alterações' : 'Criar Missão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
