// src/views/MissionsView.tsx
import { useState, useEffect } from 'react';
import type { AppDatabase, UserSession, Person, WeeklyMission } from '../services/db';
import { getWeekKey, isYouthOrTeenDepartment, getPersonGender, isSameDepartment, createWeeklyMissionIfMissing, recordWeeklyMissionMessage, getPersonMother, isVirtualDepartment, personInDepartment, compareByName } from '../services/db';
import { MediaUploader } from '../components/MediaUploader';
import { Search, MessageSquare, CheckCircle, AlertTriangle, Users, ChevronDown, ChevronUp, Send, Eye, Filter, Download, Plus, RefreshCw, Edit2, Save, X, Image, Video } from 'lucide-react';

interface MissionsViewProps {
  db: AppDatabase;
  session: UserSession;
  onUpdateDatabase?: (newDB: AppDatabase) => void;
}

export const MissionsView: React.FC<MissionsViewProps> = ({ db, session, onUpdateDatabase }) => {
  const currentWeek = getWeekKey();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todas' | 'Concluída' | 'Em andamento' | 'Sem missão'>('Todas');
  const isRestrictedDept = session.role === 'Líder' || session.role === 'Multiplicador';
  const [deptFilter, setDeptFilter] = useState(session.department || 'Todos');

  useEffect(() => {
    if (session.department) {
      setDeptFilter(session.department);
    }
  }, [session.department]);
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);
  const [extraMissionLoading, setExtraMissionLoading] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<WeeklyMission | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMediaUrl, setEditMediaUrl] = useState<string | undefined>();
  const [editMediaType, setEditMediaType] = useState<'image' | 'video' | undefined>();
  const [editTemplate, setEditTemplate] = useState('');
  const [editUseFirstName, setEditUseFirstName] = useState(true);
  const [editTargetCount, setEditTargetCount] = useState(10);
  const isRestricted = session.role === 'Multiplicador';
  const canEdit = session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin' || session.role === 'Líder';

  // Get all multiplicadores (escopo: restrito ao departamento da sessão quando definido)
  const youthMultiplicadores = db.people.filter(
    p =>
      (p.role === 'Multiplicador' || p.role === 'Líder' || p.role === 'Pastor' || p.role === 'Pastor Admin' || p.role === 'Secretaria Geral') &&
      !p.deleted &&
      p.status === 'Ativo' &&
      (!session.department || personInDepartment(p, session.department))
  ).sort(compareByName);

  // Get missions for the current week only - one entry per mission (multi-department support)
  const missionsData = youthMultiplicadores
    .flatMap((multiplicador): Array<{ multiplicador: Person; mission: WeeklyMission | null; recipientPeople: Person[]; sentCount: number; targetCount: number; progress: number; status: 'Concluída' | 'Em andamento' | 'Falta ativar'; isCompleted: boolean }> => {
      const missions = db.weeklyMissions?.filter(
        m => m.assignedTo === multiplicador.id && m.weekKey === currentWeek && (deptFilter === 'Todos' || isSameDepartment(m.department, deptFilter))
      ) || [];
      if (missions.length === 0) {
        return [{ multiplicador, mission: null, recipientPeople: [], sentCount: 0, targetCount: 0, progress: 0, status: 'Falta ativar', isCompleted: false }];
      }
      return missions.map(mission => {
        const recipientPeople = mission.recipientIds
          .map(id => db.people.find(p => p.id === id))
          .filter((p): p is Person => Boolean(p));
        const sentCount = mission.sentIds.length || 0;
        const targetCount = mission.targetCount || 0;
        const isCompleted = sentCount >= targetCount;
        const progress = Math.min(100, Math.round((sentCount / targetCount) * 100));
        return { multiplicador, mission, recipientPeople, sentCount, targetCount, progress, status: isCompleted ? 'Concluída' : 'Em andamento', isCompleted };
      });
    })
    .filter(item => {
      if (statusFilter !== 'Todas' && item.status !== statusFilter) return false;
      if (searchTerm && !item.multiplicador.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });

  // Separate completed and in-progress missions
  const completedMissions = missionsData.filter(m => m.isCompleted);
  const inProgressMissions = missionsData.filter(m => m.status === 'Em andamento');
  const notActivatedMissions = missionsData.filter(m => m.status === 'Falta ativar');

  // Get unique departments for filter (from primary department + extra departments)
  const departments = Array.from(new Set(youthMultiplicadores.flatMap(m =>
    [m.department, ...(m.departments || []).map(d => d.department)]
  ))).filter(d => !isVirtualDepartment(d)).sort();

  // Stats
  const totalMissions = missionsData.length;
  const completedMissionsCount = completedMissions.length;
  const inProgressMissionsCount = inProgressMissions.length;
  const notActivatedCount = notActivatedMissions.length;
  const totalRecipients = missionsData.reduce((sum, m) => sum + m.recipientPeople.length, 0);
  const totalSent = missionsData.reduce((sum, m) => sum + m.sentCount, 0);

  const handleMissionSend = (missionId: string, recipient: Person, multiplicador: Person) => {
    if (!onUpdateDatabase) return;
    const phone = recipient.phone ? recipient.phone.replace(/\D/g, '') : '';
    if (!phone) {
      alert('Telefone do destinatário não está disponível.');
      return;
    }

    const mission = (db.weeklyMissions || []).find(m => m.id === missionId);
    const recipientFirstName = recipient.name.split(' ')[0];
    const useFirstName = mission?.useFirstName ?? true;
    const nameToUse = useFirstName ? recipientFirstName : recipient.name;
    let message = '';
    if (mission?.messageTemplate) {
      message = mission.messageTemplate
        .replace(/\{nome\}/g, nameToUse)
        .replace(/\{mensagem\}/g, mission?.description || '');
    } else {
      message = `Paz do Senhor ${nameToUse}`;
    }
    if (mission?.mediaUrl) {
      message += `\n\n📎 Confira o cartaz: ${mission.mediaUrl}`;
    }

    if (mission) {
      const updatedDb = recordWeeklyMissionMessage(db, mission.id, multiplicador, recipient, message);
      onUpdateDatabase(updatedDb);
    }
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');

    // Mother-child: if recipient has a mother, also send to the mother
    if (recipient.motherId) {
      const mother = getPersonMother(db, recipient);
      if (mother && mother.phone) {
        const motherPhone = mother.phone.replace(/\D/g, '');
        const motherName = mother.name.split(' ')[0];
        const motherMsg = `A paz do Senhor, ${motherName}! 💙\n\nEsta mensagem é também para o(a) seu(sua) filho(a) *${recipient.name}*:\n\n${message}`;
        window.open(`https://wa.me/55${motherPhone}?text=${encodeURIComponent(motherMsg)}`, '_blank');
      }
    }
  };

  const handleRequestExtraMission = (multiplicador: Person) => {
    if (!onUpdateDatabase) return;
    setExtraMissionLoading(multiplicador.id);

    setTimeout(() => {
      const updatedDb = createWeeklyMissionIfMissing(db, multiplicador, currentWeek, 10);
      onUpdateDatabase(updatedDb);
      setExtraMissionLoading(null);
    }, 300);
  };

  const openEditMission = (mission: WeeklyMission) => {
    setEditingMission(mission);
    setEditTitle(mission.title);
    setEditDesc(mission.description);
    setEditMediaUrl(mission.mediaUrl);
    setEditMediaType(mission.mediaType);
    setEditTemplate(mission.messageTemplate || '');
    setEditUseFirstName(mission.useFirstName ?? true);
    setEditTargetCount(mission.targetCount);
    setEditModalOpen(true);
  };

  const handleSaveMissionEdit = () => {
    if (!editingMission || !onUpdateDatabase) return;
    if (!editTitle.trim() || !editDesc.trim()) {
      alert('Preencha título e descrição.');
      return;
    }

    const updatedMissions = (db.weeklyMissions || []).map(m => {
      if (m.id === editingMission.id) {
        return {
          ...m,
          title: editTitle.trim(),
          description: editDesc.trim(),
          mediaUrl: editMediaUrl,
          mediaType: editMediaType,
          messageTemplate: editTemplate || undefined,
          useFirstName: editUseFirstName,
          targetCount: editTargetCount,
        };
      }
      return m;
    });

    onUpdateDatabase({ ...db, weeklyMissions: updatedMissions });
    setEditModalOpen(false);
    setEditingMission(null);
  };

  const formatWeekKey = (wk: string) => {
    const [year, week] = wk.split('-W');
    return `Semana ${week} de ${year}`;
  };

  const getPreviousWeek = (wk: string) => {
    const [year, week] = wk.split('-W').map(Number);
    let prevWeek = week - 1;
    let prevYear = year;
    if (prevWeek === 0) {
      prevWeek = 52;
      prevYear = year - 1;
    }
    return `${prevYear}-W${String(prevWeek).padStart(2, '0')}`;
  };

  const getNextWeek = (wk: string) => {
    const [year, week] = wk.split('-W').map(Number);
    let nextWeek = week + 1;
    let nextYear = year;
    if (nextWeek === 53) {
      nextWeek = 1;
      nextYear = year + 1;
    }
    return `${nextYear}-W${String(nextWeek).padStart(2, '0')}`;
  };

  return (
    <div className="animate-fade">
      <div className="view-header">
        <div>
          <h2>Missões dos Adolescentes e Jovens</h2>
          <p className="subtitle">Acompanhamento semanal de mensagens dos Multiplicadores e Líderes</p>
        </div>
      </div>

      {/* Week Selector & Stats */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--power-white)',
                minWidth: '180px',
                textAlign: 'center'
              }}
            >
              {formatWeekKey(currentWeek)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!isRestrictedDept && (
              <select
                className="form-control"
                style={{ width: 'auto', padding: '0.5rem 1rem' }}
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="Todos">Todos os Departamentos</option>
                {departments.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            <select
              className="form-control"
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="Todas">Todos os Status</option>
              <option value="Concluída">Concluídas</option>
              <option value="Em andamento">Em Andamento</option>
              <option value="Falta ativar">Falta Ativar</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="search-bar-container" style={{ marginBottom: '1rem' }}>
          <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nome do Multiplicador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="search-icon-inside" size={18} />
          </div>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem'
          }}
        >
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--power-line)' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--power-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Multiplicadores
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--power-white)' }}>
              {youthMultiplicadores.length}
            </p>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--power-line)' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Concluídas
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>
              {completedMissionsCount}
            </p>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--power-line)' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--power-orange)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Em Andamento
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--power-orange)' }}>
              {inProgressMissionsCount}
            </p>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--power-line)' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Falta Ativar
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
              {notActivatedCount}
            </p>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--power-line)' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--power-orange)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Destinatários
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--power-orange)' }}>
              {totalRecipients}
            </p>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--power-line)' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mensagens Enviadas
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
              {totalSent}
            </p>
          </div>
        </div>
      </div>

      {/* Missions List */}
      <div className="glass-card" style={{ padding: 0 }}>
        {missionsData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--power-muted)' }}>
            <Users size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p>Nenhuma missão encontrada com os filtros atuais.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Verifique se há Multiplicadores/Líderes cadastrados.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Completed Missions Section */}
            {completedMissions.length > 0 && (
              <>
                <div
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(22, 163, 74, 0.13)',
                    borderBottom: '1px solid rgba(34, 197, 94, 0.34)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <CheckCircle size={18} color="#16a34a" />
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#047857' }}>
                    Missões Concluídas ({completedMissions.length})
                  </h3>
                </div>
                {completedMissions.map(({ multiplicador, mission, recipientPeople, sentCount, targetCount, progress, status, isCompleted }) => {
                  const isExpanded = expandedMissionId === mission?.id;
                  const multiplicadorGender = getPersonGender(multiplicador);
                  const firstName = multiplicador.name.split(' ')[0];
                  return (
                    <div
                      key={multiplicador.id}
                      style={{
                        borderBottom: '1px solid var(--power-line)',
                        background: isExpanded ? 'var(--power-muted)' : 'white',
                        transition: 'background 0.2s'
                      }}
                    >
                      {/* Mission Header Row */}
                      <div
                        onClick={() =>
                          setExpandedMissionId(prev => (prev === mission?.id ? null : mission?.id ?? null))
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '1rem 1.5rem',
                          cursor: mission ? 'pointer' : 'default',
                          gap: '1rem',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                          <div
                            className="avatar-circle"
                            style={{
                              background:
                                multiplicador.role === 'Líder'
                                  ? 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)'
                                  : 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)',
                              width: '40px',
                              height: '40px',
                              minWidth: '40px',
                              fontSize: '1rem'
                            }}
                          >
                            {multiplicador.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: '1rem', color: 'var(--power-white)', fontWeight: 700, margin: 0 }}>
                                {multiplicador.name}
                              </h4>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.5rem',
                                  background:
                                    multiplicador.role === 'Líder'
                                      ? 'rgba(124, 58, 237, 0.08)'
                                      : 'rgba(13, 148, 136, 0.08)',
                                  color:
                                    multiplicador.role === 'Líder' ? 'var(--power-orange)' : 'var(--power-orange)',
                                  border:
                                    multiplicador.role === 'Líder'
                                      ? '1px solid rgba(124, 58, 237, 0.15)'
                                      : '1px solid rgba(13, 148, 136, 0.15)'
                                }}
                              >
                                {multiplicador.role}
                              </span>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.5rem',
                                  background: 'rgba(15, 23, 42, 0.5)',
                                  color: 'var(--power-muted)',
                                  border: '1px solid var(--power-line)'
                                }}
                              >
                                {multiplicadorGender === 'male'
                                  ? '♂ Masculino'
                                  : multiplicadorGender === 'female'
                                  ? '♀ Feminino'
                                  : '⚠ Indefinido'}
                              </span>
                            </div>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--power-muted)' }}>
                              {mission?.department || multiplicador.department}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '200px' }}>
                            <div
                              style={{
                                background: '#d1fae5',
                                padding: '0.5rem 1rem',
                                borderRadius: '10px',
                                border: '1px solid #34d399'
                              }}
                            >
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '0.75rem',
                                  color: '#047857',
                                  fontWeight: 600
                                }}
                              >
                                {sentCount} / {targetCount} enviadas
                              </p>
                              <div
                                style={{
                                  width: '120px',
                                  height: '6px',
                                  background: '#a7f3d0',
                                  borderRadius: '3px',
                                  marginTop: '0.25rem'
                                }}
                              >
                                <div
                                  style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    background: '#16a34a',
                                    borderRadius: '3px'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.35rem 0.75rem',
                              background: '#d1fae5',
                              color: '#047857',
                              border: '1px solid #34d399',
                              fontWeight: 700
                            }}
                          >
                            {status}
                          </span>
                          {canEdit && mission && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditMission(mission);
                              }}
                              title="Editar Missão"
                              style={{ padding: '0.4rem 0.5rem' }}
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          <div
                            style={{ color: 'var(--power-muted)', cursor: mission ? 'pointer' : 'default', padding: '0.2rem' }}
                            onClick={() =>
                              setExpandedMissionId(prev => (prev === mission?.id ? null : mission?.id ?? null))
                            }
                          >
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {mission && isExpanded && (
                        <div
                          style={{
                            padding: '0 1.5rem 1.5rem 1.5rem',
                            borderTop: '1px solid var(--power-line)',
                            background: 'var(--power-raised)'
                          }}
                        >
                          <div style={{ marginTop: '1rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '1rem',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                              }}
                            >
                              <div>
                                <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--power-white)' }}>
                                  {mission.title}
                                </h5>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--power-muted)' }}>
                                  {mission.description}
                                </p>
                                {mission.mediaUrl && mission.mediaType === 'image' && (
                                  <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                                    <img src={mission.mediaUrl} alt={mission.title} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--power-line)' }} />
                                  </div>
                                )}
                                {mission.mediaUrl && mission.mediaType === 'video' && (
                                  <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                                    <video src={mission.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--power-line)' }} />
                                  </div>
                                )}
                              </div>
                              <button
                                className="btn btn-secondary btn-small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestExtraMission(multiplicador);
                                }}
                                disabled={extraMissionLoading === multiplicador.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.45rem 0.9rem',
                                  fontSize: '0.8rem'
                                }}
                              >
                                {extraMissionLoading === multiplicador.id ? (
                                  <RefreshCw size={14} className="spin" />
                                ) : (
                                  <Plus size={14} />
                                )}
                                Solicitar +10 contatos
                              </button>
                            </div>

                            {/* Recipients List */}
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                              {recipientPeople.map((recipient, index) => {
                                const isSent = mission.sentIds.includes(recipient.id);
                                const recipientGender = getPersonGender(recipient);
                                const genderMatch =
                                  multiplicadorGender === 'unknown' ||
                                  recipientGender === 'unknown' ||
                                  multiplicadorGender === recipientGender;
                                const recipientFirstName = recipient.name.split(' ')[0];

                                return (
                                  <div
                                    key={recipient.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.75rem 1rem 1rem',
                                      background: isSent ? 'rgba(22, 163, 74, 0.13)' : 'white',
                                      borderRadius: '10px',
                                      border: `1px solid ${isSent ? 'rgba(34, 197, 94, 0.34)' : 'var(--power-line)'}`,
                                      opacity: isSent ? 0.8 : 1
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                                      <div
                                        className="avatar-circle"
                                        style={{
                                          background:
                                            recipientGender === 'female'
                                              ? 'linear-gradient(135deg, #ec4899 0%, #ff9a5f 100%)'
                                              : recipientGender === 'male'
                                              ? 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)'
                                              : 'linear-gradient(135deg, var(--power-muted) 0%, #94a3b8 100%)',
                                          width: '32px',
                                          height: '32px',
                                          minWidth: '32px',
                                          fontSize: '0.8rem'
                                        }}
                                      >
                                        {recipient.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                          <p
                                            style={{
                                              margin: 0,
                                              fontSize: '0.9rem',
                                              fontWeight: 600,
                                              color: 'var(--power-white)',
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis'
                                            }}
                                          >
                                            {recipient.name}
                                          </p>
                                          <span
                                            className="badge"
                                            style={{
                                              fontSize: '0.6rem',
                                              padding: '0.1rem 0.35rem',
                                              background:
                                                recipientGender === 'female'
                                                  ? 'rgba(255, 97, 1, 0.10)'
                                                  : recipientGender === 'male'
                                                  ? '#dbeafe'
                                                  : 'rgba(255, 255, 255, 0.05)',
                                              color:
                                                recipientGender === 'female'
                                                  ? 'var(--power-orange)'
                                                  : recipientGender === 'male'
                                                  ? 'var(--power-orange)'
                                                  : 'var(--power-muted)',
                                              border:
                                                recipientGender === 'female'
                                                  ? '1px solid #fbcfe8'
                                                  : recipientGender === 'male'
                                                  ? '1px solid #bfdbfe'
                                                  : '1px solid var(--power-line)'
                                            }}
                                          >
                                            {recipientGender === 'female' ? '♀' : recipientGender === 'male' ? '♂' : '⚠'}
                                          </span>
                                          {!genderMatch && (
                                            <span
                                              className="badge"
                                              style={{
                                                fontSize: '0.6rem',
                                                padding: '0.1rem 0.35rem',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: '#dc2626',
                                                border: '1px solid #fecaca'
                                              }}
                                            >
                                              Sexo difere do multiplicador
                                            </span>
                                          )}
                                        </div>
                                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--power-muted)' }}>
                                          {recipient.department}
                                        </p>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      {isSent ? (
                                        <span
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            color: '#16a34a',
                                            fontSize: '0.8rem',
                                            fontWeight: 600
                                          }}
                                        >
                                          <CheckCircle size={14} />
                                          Enviada
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-small"
                                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMissionSend(mission.id, recipient, multiplicador);
                                          }}
                                        >
                                          <Send size={12} style={{ marginRight: '0.25rem' }} />
                                          Enviar
                                        </button>
                                      )}
                                      {recipient.phone && recipient.phone !== '999999999' && recipient.phone !== '69999999999' && (
                                        <button
                                           type="button"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleMissionSend(mission.id, recipient, multiplicador);
                                           }}
                                           style={{
                                             display: 'flex',
                                             alignItems: 'center',
                                             justifyContent: 'center',
                                             width: '32px',
                                             height: '32px',
                                             borderRadius: '50%',
                                             background: '#25d366',
                                             color: 'white',
                                             border: 'none',
                                             cursor: 'pointer'
                                           }}
                                           title="Abrir WhatsApp"
                                         >
                                           <MessageSquare size={14} />
                                         </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {recipientPeople.length === 0 && (
                                <div
                                  style={{
                                    textAlign: 'center',
                                    padding: '1.5rem',
                                    color: 'var(--power-muted)',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--power-line)'
                                  }}
                                >
                                  Nenhum destinatário atribuído a esta missão.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* In Progress Missions Section */}
            {inProgressMissions.length > 0 && (
              <>
                <div
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#eef2ff',
                    borderBottom: '1px solid #c7d2fe',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <AlertTriangle size={18} color="var(--power-orange)" />
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--power-orange)' }}>
                    Missões Em Andamento ({inProgressMissions.length})
                  </h3>
                </div>
                {inProgressMissions.map(({ multiplicador, mission, recipientPeople, sentCount, targetCount, progress, status, isCompleted }) => {
                  const isExpanded = expandedMissionId === mission?.id;
                  const multiplicadorGender = getPersonGender(multiplicador);
                  const firstName = multiplicador.name.split(' ')[0];
                  return (
                    <div
                      key={multiplicador.id}
                      style={{
                        borderBottom: '1px solid var(--power-line)',
                        background: isExpanded ? 'var(--power-muted)' : 'white',
                        transition: 'background 0.2s'
                      }}
                    >
                      {/* Mission Header Row */}
                      <div
                        onClick={() =>
                          setExpandedMissionId(prev => (prev === mission?.id ? null : mission?.id ?? null))
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '1rem 1.5rem',
                          cursor: mission ? 'pointer' : 'default',
                          gap: '1rem',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                          <div
                            className="avatar-circle"
                            style={{
                              background:
                                multiplicador.role === 'Líder'
                                  ? 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)'
                                  : 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)',
                              width: '40px',
                              height: '40px',
                              minWidth: '40px',
                              fontSize: '1rem'
                            }}
                          >
                            {multiplicador.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: '1rem', color: 'var(--power-white)', fontWeight: 700, margin: 0 }}>
                                {multiplicador.name}
                              </h4>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.5rem',
                                  background:
                                    multiplicador.role === 'Líder'
                                      ? 'rgba(124, 58, 237, 0.08)'
                                      : 'rgba(13, 148, 136, 0.08)',
                                  color:
                                    multiplicador.role === 'Líder' ? 'var(--power-orange)' : 'var(--power-orange)',
                                  border:
                                    multiplicador.role === 'Líder'
                                      ? '1px solid rgba(124, 58, 237, 0.15)'
                                      : '1px solid rgba(13, 148, 136, 0.15)'
                                }}
                              >
                                {multiplicador.role}
                              </span>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.5rem',
                                  background: 'rgba(15, 23, 42, 0.5)',
                                  color: 'var(--power-muted)',
                                  border: '1px solid var(--power-line)'
                                }}
                              >
                                {multiplicadorGender === 'male'
                                  ? '♂ Masculino'
                                  : multiplicadorGender === 'female'
                                  ? '♀ Feminino'
                                  : '⚠ Indefinido'}
                              </span>
                            </div>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--power-muted)' }}>
                              {mission?.department || multiplicador.department}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '200px' }}>
                            <div
                              style={{
                                background: '#eef2ff',
                                padding: '0.5rem 1rem',
                                borderRadius: '10px',
                                border: '1px solid #c7d2fe'
                              }}
                            >
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '0.75rem',
                                  color: 'var(--power-orange)',
                                  fontWeight: 600
                                }}
                              >
                                {sentCount} / {targetCount} enviadas
                              </p>
                              <div
                                style={{
                                  width: '120px',
                                  height: '6px',
                                  background: '#dbeafe',
                                  borderRadius: '3px',
                                  marginTop: '0.25rem'
                                }}
                              >
                                <div
                                  style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    background: 'var(--power-orange)',
                                    borderRadius: '3px'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.35rem 0.75rem',
                              background: '#eef2ff',
                              color: 'var(--power-orange)',
                              border: '1px solid #c7d2fe',
                              fontWeight: 700
                            }}
                          >
                            {status}
                          </span>
                          {canEdit && mission && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditMission(mission);
                              }}
                              title="Editar Missão"
                              style={{ padding: '0.4rem 0.5rem' }}
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          <div
                            style={{ color: 'var(--power-muted)', cursor: mission ? 'pointer' : 'default', padding: '0.2rem' }}
                            onClick={() =>
                              setExpandedMissionId(prev => (prev === mission?.id ? null : mission?.id ?? null))
                            }
                          >
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {mission && isExpanded && (
                        <div
                          style={{
                            padding: '0 1.5rem 1.5rem 1.5rem',
                            borderTop: '1px solid var(--power-line)',
                            background: 'var(--power-raised)'
                          }}
                        >
                          <div style={{ marginTop: '1rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '1rem',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                              }}
                            >
                              <div>
                                <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--power-white)' }}>
                                  {mission.title}
                                </h5>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--power-muted)' }}>
                                  {mission.description}
                                </p>
                                {mission.mediaUrl && mission.mediaType === 'image' && (
                                  <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                                    <img src={mission.mediaUrl} alt={mission.title} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--power-line)' }} />
                                  </div>
                                )}
                                {mission.mediaUrl && mission.mediaType === 'video' && (
                                  <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                                    <video src={mission.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--power-line)' }} />
                                  </div>
                                )}
                              </div>
                              <button
                                className="btn btn-secondary btn-small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestExtraMission(multiplicador);
                                }}
                                disabled={extraMissionLoading === multiplicador.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.45rem 0.9rem',
                                  fontSize: '0.8rem'
                                }}
                              >
                                {extraMissionLoading === multiplicador.id ? (
                                  <RefreshCw size={14} className="spin" />
                                ) : (
                                  <Plus size={14} />
                                )}
                                Solicitar +10 contatos
                              </button>
                            </div>

                            {/* Recipients List */}
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                              {recipientPeople.map((recipient, index) => {
                                const isSent = mission.sentIds.includes(recipient.id);
                                const recipientGender = getPersonGender(recipient);
                                const genderMatch =
                                  multiplicadorGender === 'unknown' ||
                                  recipientGender === 'unknown' ||
                                  multiplicadorGender === recipientGender;
                                const recipientFirstName = recipient.name.split(' ')[0];

                                return (
                                  <div
                                    key={recipient.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.75rem 1rem 1rem',
                                      background: isSent ? 'rgba(22, 163, 74, 0.13)' : 'white',
                                      borderRadius: '10px',
                                      border: `1px solid ${isSent ? 'rgba(34, 197, 94, 0.34)' : 'var(--power-line)'}`,
                                      opacity: isSent ? 0.8 : 1
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                                      <div
                                        className="avatar-circle"
                                        style={{
                                          background:
                                            recipientGender === 'female'
                                              ? 'linear-gradient(135deg, #ec4899 0%, #ff9a5f 100%)'
                                              : recipientGender === 'male'
                                              ? 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)'
                                              : 'linear-gradient(135deg, var(--power-muted) 0%, #94a3b8 100%)',
                                          width: '32px',
                                          height: '32px',
                                          minWidth: '32px',
                                          fontSize: '0.8rem'
                                        }}
                                      >
                                        {recipient.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                          <p
                                            style={{
                                              margin: 0,
                                              fontSize: '0.9rem',
                                              fontWeight: 600,
                                              color: 'var(--power-white)',
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis'
                                            }}
                                          >
                                            {recipient.name}
                                          </p>
                                          <span
                                            className="badge"
                                            style={{
                                              fontSize: '0.6rem',
                                              padding: '0.1rem 0.35rem',
                                              background:
                                                recipientGender === 'female'
                                                  ? 'rgba(255, 97, 1, 0.10)'
                                                  : recipientGender === 'male'
                                                  ? '#dbeafe'
                                                  : 'rgba(255, 255, 255, 0.05)',
                                              color:
                                                recipientGender === 'female'
                                                  ? 'var(--power-orange)'
                                                  : recipientGender === 'male'
                                                  ? 'var(--power-orange)'
                                                  : 'var(--power-muted)',
                                              border:
                                                recipientGender === 'female'
                                                  ? '1px solid #fbcfe8'
                                                  : recipientGender === 'male'
                                                  ? '1px solid #bfdbfe'
                                                  : '1px solid var(--power-line)'
                                            }}
                                          >
                                            {recipientGender === 'female' ? '♀' : recipientGender === 'male' ? '♂' : '⚠'}
                                          </span>
                                          {!genderMatch && (
                                            <span
                                              className="badge"
                                              style={{
                                                fontSize: '0.6rem',
                                                padding: '0.1rem 0.35rem',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: '#dc2626',
                                                border: '1px solid #fecaca'
                                              }}
                                            >
                                              Sexo difere do multiplicador
                                            </span>
                                          )}
                                        </div>
                                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--power-muted)' }}>
                                          {recipient.department}
                                        </p>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      {isSent ? (
                                        <span
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            color: '#16a34a',
                                            fontSize: '0.8rem',
                                            fontWeight: 600
                                          }}
                                        >
                                          <CheckCircle size={14} />
                                          Enviada
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-small"
                                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMissionSend(mission.id, recipient, multiplicador);
                                          }}
                                        >
                                          <Send size={12} style={{ marginRight: '0.25rem' }} />
                                          Enviar
                                        </button>
                                      )}
                                      {recipient.phone && recipient.phone !== '999999999' && recipient.phone !== '69999999999' && (
                                        <button
                                           type="button"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleMissionSend(mission.id, recipient, multiplicador);
                                           }}
                                           style={{
                                             display: 'flex',
                                             alignItems: 'center',
                                             justifyContent: 'center',
                                             width: '32px',
                                             height: '32px',
                                             borderRadius: '50%',
                                             background: '#25d366',
                                             color: 'white',
                                             border: 'none',
                                             cursor: 'pointer'
                                           }}
                                           title="Abrir WhatsApp"
                                         >
                                           <MessageSquare size={14} />
                                         </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {recipientPeople.length === 0 && (
                                <div
                                  style={{
                                    textAlign: 'center',
                                    padding: '1.5rem',
                                    color: 'var(--power-muted)',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--power-line)'
                                  }}
                                >
                                  Nenhum destinatário atribuído a esta missão.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Not Activated Missions Section */}
            {notActivatedMissions.length > 0 && (
              <>
                <div
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderBottom: '1px solid #fecaca',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <AlertTriangle size={18} color="#dc2626" />
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#dc2626' }}>
                    Falta Ativar Missão ({notActivatedMissions.length})
                  </h3>
                </div>
                {notActivatedMissions.map(({ multiplicador, mission, recipientPeople, sentCount, targetCount, progress, status, isCompleted }) => {
                  const isExpanded = expandedMissionId === mission?.id;
                  const multiplicadorGender = getPersonGender(multiplicador);
                  const firstName = multiplicador.name.split(' ')[0];
                  return (
                    <div
                      key={multiplicador.id}
                      style={{
                        borderBottom: '1px solid var(--power-line)',
                        background: isExpanded ? 'var(--power-muted)' : 'white',
                        transition: 'background 0.2s'
                      }}
                    >
                      {/* Mission Header Row */}
                      <div
                        onClick={() =>
                          setExpandedMissionId(prev => (prev === mission?.id ? null : mission?.id ?? null))
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '1rem 1.5rem',
                          cursor: mission ? 'pointer' : 'default',
                          gap: '1rem',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                          <div
                            className="avatar-circle"
                            style={{
                              background:
                                multiplicador.role === 'Líder'
                                  ? 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)'
                                  : 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)',
                              width: '40px',
                              height: '40px',
                              minWidth: '40px',
                              fontSize: '1rem'
                            }}
                          >
                            {multiplicador.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: '1rem', color: 'var(--power-white)', fontWeight: 700, margin: 0 }}>
                                {multiplicador.name}
                              </h4>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.5rem',
                                  background:
                                    multiplicador.role === 'Líder'
                                      ? 'rgba(124, 58, 237, 0.08)'
                                      : 'rgba(13, 148, 136, 0.08)',
                                  color:
                                    multiplicador.role === 'Líder' ? 'var(--power-orange)' : 'var(--power-orange)',
                                  border:
                                    multiplicador.role === 'Líder'
                                      ? '1px solid rgba(124, 58, 237, 0.15)'
                                      : '1px solid rgba(13, 148, 136, 0.15)'
                                }}
                              >
                                {multiplicador.role}
                              </span>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.5rem',
                                  background: 'rgba(15, 23, 42, 0.5)',
                                  color: 'var(--power-muted)',
                                  border: '1px solid var(--power-line)'
                                }}
                              >
                                {multiplicadorGender === 'male'
                                  ? '♂ Masculino'
                                  : multiplicadorGender === 'female'
                                  ? '♀ Feminino'
                                  : '⚠ Indefinido'}
                              </span>
                            </div>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--power-muted)' }}>
                              {mission?.department || multiplicador.department}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.35rem 0.75rem',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              fontWeight: 700
                            }}
                          >
                            {status}
                          </span>
                          <button
                            className="btn btn-primary btn-small"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestExtraMission(multiplicador);
                            }}
                          >
                            <Plus size={12} style={{ marginRight: '0.25rem' }} />
                            Ativar missão
                          </button>
                          <div
                            style={{ color: 'var(--power-muted)', cursor: mission ? 'pointer' : 'default', padding: '0.2rem' }}
                            onClick={() =>
                              setExpandedMissionId(prev => (prev === mission?.id ? null : mission?.id ?? null))
                            }
                          >
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {mission && isExpanded && (
                        <div
                          style={{
                            padding: '0 1.5rem 1.5rem 1.5rem',
                            borderTop: '1px solid var(--power-line)',
                            background: 'var(--power-raised)'
                          }}
                        >
                          <div style={{ marginTop: '1rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '1rem',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                              }}
                            >
                              <div>
                                <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--power-white)' }}>
                                  {mission.title}
                                </h5>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--power-muted)' }}>
                                  {mission.description}
                                </p>
                              </div>
                            </div>

                            {/* Recipients List */}
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                              {recipientPeople.map((recipient, index) => {
                                const isSent = mission.sentIds.includes(recipient.id);
                                const recipientGender = getPersonGender(recipient);
                                const genderMatch =
                                  multiplicadorGender === 'unknown' ||
                                  recipientGender === 'unknown' ||
                                  multiplicadorGender === recipientGender;
                                const recipientFirstName = recipient.name.split(' ')[0];

                                return (
                                  <div
                                    key={recipient.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.75rem 1rem 1rem',
                                      background: isSent ? 'rgba(22, 163, 74, 0.13)' : 'white',
                                      borderRadius: '10px',
                                      border: `1px solid ${isSent ? 'rgba(34, 197, 94, 0.34)' : 'var(--power-line)'}`,
                                      opacity: isSent ? 0.8 : 1
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                                      <div
                                        className="avatar-circle"
                                        style={{
                                          background:
                                            recipientGender === 'female'
                                              ? 'linear-gradient(135deg, #ec4899 0%, #ff9a5f 100%)'
                                              : recipientGender === 'male'
                                              ? 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)'
                                              : 'linear-gradient(135deg, var(--power-muted) 0%, #94a3b8 100%)',
                                          width: '32px',
                                          height: '32px',
                                          minWidth: '32px',
                                          fontSize: '0.8rem'
                                        }}
                                      >
                                        {recipient.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                          <p
                                            style={{
                                              margin: 0,
                                              fontSize: '0.9rem',
                                              fontWeight: 600,
                                              color: 'var(--power-white)',
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis'
                                            }}
                                          >
                                            {recipient.name}
                                          </p>
                                          <span
                                            className="badge"
                                            style={{
                                              fontSize: '0.6rem',
                                              padding: '0.1rem 0.35rem',
                                              background:
                                                recipientGender === 'female'
                                                  ? 'rgba(255, 97, 1, 0.10)'
                                                  : recipientGender === 'male'
                                                  ? '#dbeafe'
                                                  : 'rgba(255, 255, 255, 0.05)',
                                              color:
                                                recipientGender === 'female'
                                                  ? 'var(--power-orange)'
                                                  : recipientGender === 'male'
                                                  ? 'var(--power-orange)'
                                                  : 'var(--power-muted)',
                                              border:
                                                recipientGender === 'female'
                                                  ? '1px solid #fbcfe8'
                                                  : recipientGender === 'male'
                                                  ? '1px solid #bfdbfe'
                                                  : '1px solid var(--power-line)'
                                            }}
                                          >
                                            {recipientGender === 'female' ? '♀' : recipientGender === 'male' ? '♂' : '⚠'}
                                          </span>
                                          {!genderMatch && (
                                            <span
                                              className="badge"
                                              style={{
                                                fontSize: '0.6rem',
                                                padding: '0.1rem 0.35rem',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: '#dc2626',
                                                border: '1px solid #fecaca'
                                              }}
                                            >
                                              Sexo difere do multiplicador
                                            </span>
                                          )}
                                        </div>
                                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--power-muted)' }}>
                                          {recipient.department}
                                        </p>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      {isSent ? (
                                        <span
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            color: '#16a34a',
                                            fontSize: '0.8rem',
                                            fontWeight: 600
                                          }}
                                        >
                                          <CheckCircle size={14} />
                                          Enviada
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-small"
                                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMissionSend(mission.id, recipient, multiplicador);
                                          }}
                                        >
                                          <Send size={12} style={{ marginRight: '0.25rem' }} />
                                          Enviar
                                        </button>
                                      )}
                                      {recipient.phone && recipient.phone !== '999999999' && recipient.phone !== '69999999999' && (
                                        <button
                                           type="button"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleMissionSend(mission.id, recipient, multiplicador);
                                           }}
                                           style={{
                                             display: 'flex',
                                             alignItems: 'center',
                                             justifyContent: 'center',
                                             width: '32px',
                                             height: '32px',
                                             borderRadius: '50%',
                                             background: '#25d366',
                                             color: 'white',
                                             border: 'none',
                                             cursor: 'pointer'
                                           }}
                                           title="Abrir WhatsApp"
                                         >
                                           <MessageSquare size={14} />
                                         </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {recipientPeople.length === 0 && (
                                <div
                                  style={{
                                    textAlign: 'center',
                                    padding: '1.5rem',
                                    color: 'var(--power-muted)',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--power-line)'
                                  }}
                                >
                                  Nenhum destinatário atribuído a esta missão.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit Mission Modal */}
      {editModalOpen && editingMission && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setEditModalOpen(false)}
        >
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--power-white)' }}>Editar Missão Semanal</h3>
              <button
                className="btn btn-ghost"
                onClick={() => setEditModalOpen(false)}
                style={{ padding: '0.4rem', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                  Título da Missão
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Ex: Evangelismo de Adolescentes"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                  Descrição
                </label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Descreva a missão..."
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                  Mídia (imagem ou vídeo)
                </label>
                <MediaUploader
                  currentUrl={editMediaUrl}
                  currentType={editMediaType}
                  onMediaChange={(url, type) => {
                    setEditMediaUrl(url);
                    setEditMediaType(type);
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                  Template de Mensagem
                </label>
                <textarea
                  value={editTemplate}
                  onChange={e => setEditTemplate(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                  placeholder={'Ex: Olá {nome}, temos uma missão especial para você! {mensagem}'}
                />
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Use {'{nome}'} para o primeiro nome do membro e {'{mensagem}'} para o texto da descrição.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="useFirstName"
                  checked={editUseFirstName}
                  onChange={e => setEditUseFirstName(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="useFirstName" style={{ fontSize: '0.85rem', color: '#374151', cursor: 'pointer' }}>
                  Incluir primeiro nome do membro na mensagem
                </label>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                  Meta de contatos
                </label>
                <input
                  type="number"
                  value={editTargetCount}
                  onChange={e => setEditTargetCount(Math.max(1, parseInt(e.target.value) || 10))}
                  min={1}
                  style={{
                    width: '100px',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setEditModalOpen(false)}
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveMissionEdit}
                style={{ padding: '0.6rem 1.25rem', background: 'var(--power-orange)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                <Save size={16} style={{ marginRight: '0.35rem' }} />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};