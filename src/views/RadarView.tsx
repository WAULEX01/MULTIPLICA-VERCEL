import { getLocalDateISO } from '../utils/localDate';
import { useState } from 'react';
import type { AppDatabase, UserSession, PastoralLog } from '../services/db';
import { calculateConsecutiveAbsences, getCriticalAbsenteesForDepartment, personInDepartment, generateUUID, compareByName } from '../services/db';
import { AlertTriangle, MessageSquare, Phone, Search, Calendar, Sparkles, Clock, PlusCircle, FileText, Send } from 'lucide-react';
import { getDynamicHumanMessage } from '../services/genderMsg';

interface RadarViewProps {
  db: AppDatabase;
  session: UserSession;
  onUpdatePastoralLogs: (newLogs: PastoralLog[]) => void;
}

export const RadarView: React.FC<RadarViewProps> = ({ db, session, onUpdatePastoralLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [alertFilter, setAlertFilter] = useState('Todos');
  const [contactedIds, setContactedIds] = useState<string[]>([]);

  // States for WhatsApp Dynamic Template Modal
  const [waModal, setWaModal] = useState<{
    open: boolean;
    person: { id: string; name: string; phone: string; absences: number; department: string } | null;
    messageText: string;
  }>({ open: false, person: null, messageText: '' });

  // States for Pastoral Log Form Modal
  const [logModal, setLogModal] = useState<{
    open: boolean;
    person: { id: string; name: string; department: string } | null;
    type: 'Mensagem' | 'Ligação' | 'Visita';
    notes: string;
  }>({ open: false, person: null, type: 'Mensagem', notes: '' });

  // List of expanded logs (collapsible) per member
  const [expandedLogs, setExpandedLogs] = useState<string[]>([]);
  // List of expanded card details per member
  const [expandedDetails, setExpandedDetails] = useState<string[]>([]);

  // States for Batch Send — 3 steps: select → template → send
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchStep, setBatchStep] = useState<'select' | 'template' | 'send'>('select');
  const [batchQueue, setBatchQueue] = useState<any[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchDefaultMessage, setBatchDefaultMessage] = useState('');
  const [batchMessageText, setBatchMessageText] = useState('');

  const deptFilter = session.department || undefined;

  const criticalAbsentees = getCriticalAbsenteesForDepartment(db, deptFilter, 8);

  // Find members who missed the last service
  const getLastServiceAbsentees = () => {
    const lastAttendanceByDept: { [dept: string]: string | undefined } = {};
    db.departments.forEach(d => {
      const deptAtts = db.attendances.filter(a => a.department === d.name && !a.deleted);
      const sorted = [...deptAtts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      lastAttendanceByDept[d.name] = sorted[0]?.id;
    });

    const fallbackDate = getLocalDateISO();
    return db.people
      .filter(p => p.status !== 'Arquivado' && p.status !== 'Inativo' && p.status !== 'Visitante' && (!deptFilter || personInDepartment(p, deptFilter)) && !p.deleted)
      .filter(person => {
        const targetDept = deptFilter || person.department;
        const lastAttId = lastAttendanceByDept[targetDept];
        if (!lastAttId) return false;
        const lastAttRecord = db.attendances.find(a => a.id === lastAttId);
        if (!lastAttRecord) return false;
        return !lastAttRecord.presentIds.includes(person.id);
      })
      .map(person => {
        const targetDept = deptFilter || person.department;
        const absences = calculateConsecutiveAbsences(person.id, targetDept, person.startDate || fallbackDate, db.attendances);
        return { id: person.id, name: person.name, phone: person.phone, department: targetDept, absences };
      })
      .sort((a, b) => b.absences - a.absences || compareByName(a, b));
  };

  const fallbackDate = getLocalDateISO();
  const radarData = db.people
    .filter(p => p.status !== 'Arquivado' && p.status !== 'Inativo' && p.status !== 'Visitante' && (!deptFilter || personInDepartment(p, deptFilter)) && !p.deleted)
    .map(person => {
      const targetDept = deptFilter || person.department;
      const absences = calculateConsecutiveAbsences(person.id, targetDept, person.startDate || fallbackDate, db.attendances);

      const deptAttendances = db.attendances.filter(a => a.department === targetDept && !a.deleted);
      const sorted = [...deptAttendances].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let lastPresence = 'Nenhuma chamada';
      for (const rec of sorted) {
        if (rec.presentIds.includes(person.id)) {
          const parts = rec.date.split('-');
          lastPresence = `${parts[2]}/${parts[1]}/${parts[0]}`;
          break;
        }
      }

      let severity: 'yellow' | 'orange' | 'red' | 'none' = 'none';
      let action = '';
      if (absences === 1) { severity = 'yellow'; action = 'Enviar mensagem'; }
      else if (absences === 2) { severity = 'orange'; action = 'Ligar'; }
      else if (absences >= 3) { severity = 'red'; action = 'Visitar'; }

      return { person, absences, lastPresence, severity, action };
    })
    .filter(item => item.absences >= 1 && (searchTerm === '' || item.person.name.toLowerCase().includes(searchTerm.toLowerCase())))
    .filter(item => {
      if (alertFilter === '1') return item.absences === 1;
      if (alertFilter === '2') return item.absences === 2;
      if (alertFilter === '3') return item.absences === 3;
      if (alertFilter === '4_plus') return item.absences >= 4;
      return item.absences >= 1;
    })
    .sort((a, b) => b.absences - a.absences || compareByName(a.person, b.person));

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'yellow': return '#d97706';
      case 'orange': return '#ea580c';
      case 'red': return '#dc2626';
      default: return 'var(--power-muted)';
    }
  };

  const getAlertBgColor = (severity: string) => {
    switch (severity) {
      case 'yellow': return 'rgba(217, 119, 6, 0.12)';
      case 'orange': return 'rgba(255, 97, 1, 0.12)';
      case 'red': return '#fef2f2';
      default: return 'var(--power-muted)';
    }
  };

  const getAlertBorderColor = (severity: string) => {
    switch (severity) {
      case 'yellow': return 'rgba(217, 119, 6, 0.28)';
      case 'orange': return 'rgba(255, 97, 1, 0.28)';
      case 'red': return '#fee2e2';
      default: return 'var(--power-line)';
    }
  };

  const handleToggleContacted = (id: string) => {
    if (contactedIds.includes(id)) {
      setContactedIds(contactedIds.filter(cid => cid !== id));
    } else {
      setContactedIds([...contactedIds, id]);
    }
  };

  const closeBatch = () => {
    setIsBatchOpen(false);
    setBatchStep('select');
  };

  return (
    <div className="animate-fade">
      <div className="view-header">
        <div>
          <h2>Radar Inteligente</h2>
          <p className="subtitle">Identificação automatizada de ausências e sugestões de resgate pastoral</p>
        </div>
      </div>

      {/* Last Service Summary Widget */}
      {(() => {
        // Find the last actual service for this dept scope
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const scopedAtts = db.attendances.filter(
          a => (!deptFilter || a.department === deptFilter) && a.date <= todayStr && a.presentIds && a.presentIds.length > 0
        );
        if (scopedAtts.length === 0) return null;
        const lastAtt = [...scopedAtts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const lastDateParts = lastAtt.date.split('-');
        const lastDateFormatted = `${lastDateParts[2]}/${lastDateParts[1]}/${lastDateParts[0]}`;
        const absenteesOfLast = getLastServiceAbsentees();
        return (
          <div className="glass-card radar-service-summary" style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem', borderLeft: '4px solid #f59e0b', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(249, 115, 22, 0.03) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Resumo — Último Culto Registrado</p>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={18} style={{ color: '#f59e0b' }} />
                  {lastDateFormatted} &nbsp;<span style={{ fontSize: '0.85rem', color: 'var(--power-muted)', fontWeight: 500 }}>({lastAtt.type} &mdash; {lastAtt.department.split(' ')[0]})</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600, marginTop: '0.25rem' }}>
                  🚨 {absenteesOfLast.length} {absenteesOfLast.length === 1 ? 'membro faltou' : 'membros faltaram'} neste culto
                </p>
              </div>
              {(session.role === 'Pastor Admin' || session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Líder') && absenteesOfLast.length > 0 && (
                <button
                  className="btn btn-primary btn-small"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)', border: 'none', boxShadow: '0 4px 12px rgba(249,115,22,0.3)', width: 'auto' }}
                  onClick={() => {
                    setBatchQueue(absenteesOfLast.map(a => ({ ...a, selected: true })));
                    setBatchIndex(0);
                    setBatchStep('select');
                    setBatchDefaultMessage(`Olá, {NOME}! A paz do Senhor. 🙏 Como você está? Estou à disposição para conversar e orar com você. Deus abençoe. ✨`);
                    setIsBatchOpen(true);
                  }}
                >
                  <Send size={14} style={{ marginRight: '0.3rem' }} />
                  Contatar Faltosos do Último Culto
                </button>
              )}
            </div>
            {absenteesOfLast.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {absenteesOfLast.slice(0, 10).map(a => (
                  <span key={a.id} style={{ background: 'rgba(255, 97, 1, 0.12)', border: '1px solid #fde68a', borderRadius: '50px', padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, color: '#fcd34d' }}>
                    {a.name.split(' ')[0]}
                  </span>
                ))}
                {absenteesOfLast.length > 10 && (
                  <span style={{ color: 'var(--power-muted)', fontSize: '0.75rem', alignSelf: 'center' }}>+ {absenteesOfLast.length - 10} mais</span>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Regras de Resgate Widget (Fixo no Topo) */}
      <div className="glass-card radar-rescue-rules" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-text-main)' }}>
          <Sparkles size={18} style={{ color: '#f59e0b' }} />
          Regras de Resgate
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.12)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(217, 119, 6, 0.28)', borderLeft: '4px solid #d97706' }}>
            <p style={{ fontWeight: 700, color: '#b45309', marginBottom: '0.2rem', fontSize: '0.88rem' }}>🟡 Falta Amarela (1 Semana)</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--power-muted)', margin: 0 }}>Recomendado: <strong style={{ color: '#fcd34d' }}>Enviar Mensagem</strong>. Contato informal para acolhimento.</p>
          </div>

          <div style={{ background: 'rgba(255, 97, 1, 0.12)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255, 97, 1, 0.28)', borderLeft: '4px solid #ea580c' }}>
            <p style={{ fontWeight: 700, color: '#ff9a5f', marginBottom: '0.2rem', fontSize: '0.88rem' }}>🟠 Falta Laranja (2 Semanas)</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--power-muted)', margin: 0 }}>Recomendado: <strong style={{ color: '#9a3412' }}>Ligar</strong>. Ligação rápida demonstrando atenção pastoral.</p>
          </div>

          <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #fee2e2', borderLeft: '4px solid #dc2626' }}>
            <p style={{ fontWeight: 700, color: '#b91c1c', marginBottom: '0.2rem', fontSize: '0.88rem' }}>🔴 Falta Vermelha (3+ Semanas)</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--power-muted)', margin: 0 }}>Recomendado: <strong style={{ color: '#991b1b' }}>Visitar</strong>. Visita de acompanhamento para apoio fraterno.</p>
          </div>
        </div>
      </div>

      {/* Radar Alert List */}
      <div className="glass-card radar-list-panel">
          <div className="search-bar-container">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="form-control"
                placeholder="Pesquisar membro no radar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="search-icon-inside" size={18} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--power-muted)', fontWeight: 600 }}>Grau:</span>
              <select
                className="form-control"
                style={{ padding: '0.5rem 1rem', width: 'auto', fontSize: '0.85rem' }}
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value)}
              >
                <option value="Todos">Todas as Semanas (1+)</option>
                <option value="1">🟡 Apenas 1 Semana de Falta</option>
                <option value="2">🟠 Apenas 2 Semanas de Falta</option>
                <option value="3">🔴 Apenas 3 Semanas de Falta</option>
                <option value="4_plus">🚨 4+ Semanas (Crítico)</option>
              </select>
            </div>

            {(session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Líder' || session.role === 'Pastor Admin') && (
              <button
                className="btn btn-primary btn-small animate-fade"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: 'none', marginLeft: 'auto', width: 'auto' }}
                disabled={criticalAbsentees.length === 0}
                onClick={() => {
                  const absentees = criticalAbsentees;
                  setBatchQueue(absentees.map(a => ({ ...a, selected: true, absences: calculateConsecutiveAbsences(a.id, a.department, a.startDate || '2026-01-01', db.attendances) })));
                  setBatchIndex(0);
                  setBatchStep('select');
                  setBatchDefaultMessage(`Olá, {NOME}! A paz do Senhor. 🙏 Como você está? Estou aqui para orar com você. Deus te abençoe.`);
                  setIsBatchOpen(true);
                }}
              >
                <Send size={14} style={{ marginRight: '0.25rem' }} />
                Disparo em Lote Crítico ({criticalAbsentees.length})
              </button>
            )}

            <button
              className="btn btn-secondary btn-small animate-fade"
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(15, 23, 42, 0.6)', marginLeft: (session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Líder' || session.role === 'Pastor Admin') ? '0.5rem' : 'auto' }}
              onClick={() => {
                const list = radarData.map(item => item.person);
                const title = `Ausentes no Radar - ${deptFilter || 'Geral'}`;
                const lines = [
                  `📢 *${title}* 📢`,
                  `Total: ${list.length} ausentes`,
                  ''
                ];
                list.forEach(p => {
                  const cleanPhone = p.phone.replace(/\D/g, '');
                  const phoneLink = cleanPhone ? `wa.me/55${cleanPhone}` : 'Sem telefone';
                  const item = radarData.find(i => i.person.id === p.id);
                  const absencesText = item ? `(${item.absences} ${item.absences === 1 ? 'semana de falta' : 'semanas de falta'})` : '';
                  lines.push(`• *${p.name}* ${absencesText} - ${phoneLink}`);
                });
                
                navigator.clipboard.writeText(lines.join('\n'))
                  .then(() => alert("Lista de ausentes copiada com sucesso! Cole no seu grupo do WhatsApp."))
                  .catch(err => {
                    console.error(err);
                    alert("Não foi possível copiar automaticamente.");
                  });
              }}
            >
              <MessageSquare size={14} style={{ color: 'var(--power-orange)' }} />
              Copiar Ausentes p/ WhatsApp
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
            {radarData.map(({ person, absences, lastPresence, severity, action }) => {
              const isContacted = contactedIds.includes(person.id);
              const alertColor = getAlertColor(severity);
              const alertBg = getAlertBgColor(severity);
              const alertBorder = getAlertBorderColor(severity);
              const isDetailsExpanded = expandedDetails.includes(person.id);

              return (
                <div
                  key={person.id}
                  className="radar-alert-card"
                  style={{
                    borderLeftColor: alertColor,
                    background: isContacted ? 'rgba(22, 163, 74, 0.13)' : alertBg,
                    borderColor: isContacted ? 'rgba(34, 197, 94, 0.34)' : alertBorder,
                    opacity: isContacted ? 0.8 : 1,
                    padding: '0.75rem 1rem',
                    borderRadius: '14px',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Linha Principal Compacta */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                      <h4 style={{ fontSize: '0.95rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>{person.name}</h4>
                      <span
                        className="badge"
                        style={{ background: alertColor, color: 'white', fontSize: '0.62rem', padding: '0.12rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}
                      >
                        {absences === 1 ? '1 Semana' : `${absences} Semanas`}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)', fontWeight: 600 }}>
                        Depto: <strong style={{ color: 'var(--power-muted)' }}>{person.department}</strong>
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: alertColor, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        • Ação: {action}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: 'max-content' }}>
                      <button
                        className="btn btn-primary btn-small"
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: 'none', fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderRadius: '8px', flex: 1, whiteSpace: 'nowrap' }}
                        onClick={() => {
                          const initialText = `A paz do Senhor, ${person.name.split(' ')[0]}! Como você está? Tudo bem com você?`;
                          setWaModal({ open: true, person: { id: person.id, name: person.name, phone: person.phone, absences, department: person.department }, messageText: initialText });
                        }}
                      >
                        <MessageSquare size={13} />
                        Contatar WhatsApp
                      </button>

                      <button
                        onClick={() => {
                          if (isDetailsExpanded) {
                            setExpandedDetails(expandedDetails.filter(id => id !== person.id));
                          } else {
                            setExpandedDetails([...expandedDetails, person.id]);
                          }
                        }}
                        className="btn btn-secondary btn-small"
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--power-muted)', fontWeight: 600, color: 'var(--power-muted)', whiteSpace: 'nowrap' }}
                      >
                        {isDetailsExpanded ? '▲ Ocultar' : '▼ + Detalhes'}
                      </button>
                    </div>
                  </div>

                  {/* Área Expansível de Detalhes */}
                  {isDetailsExpanded && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--power-muted)', marginBottom: '0.5rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Calendar size={13} style={{ color: 'var(--power-orange)' }} />
                          Última Presença: {lastPresence}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Phone size={13} style={{ color: person.phone && person.phone !== '999999999' && person.phone !== '69999999999' ? 'var(--power-orange)' : '#ef4444' }} />
                          Telefone: {person.phone && person.phone !== '999999999' && person.phone !== '69999999999' ? (
                            person.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>Falta Telefone!</span>
                          )}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontWeight: 600 }}>Endereço:</span> {person.address && person.address.trim() !== '' ? (
                            person.address
                          ) : (
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>Falta Endereço!</span>
                          )}
                        </span>
                        <button
                          onClick={() => handleToggleContacted(person.id)}
                          className={`btn btn-small ${isContacted ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: isContacted ? 'var(--color-success)' : 'white', marginLeft: 'auto' }}
                        >
                          {isContacted ? '✓ Contatado' : 'Marcar Contato'}
                        </button>
                      </div>

                      {person.observations && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem', background: 'var(--power-raised)', padding: '0.5rem', borderRadius: '6px', borderLeft: '3px solid var(--power-orange)', fontSize: '0.8rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--power-muted)' }}>Observações:</span>
                          <span style={{ color: 'var(--power-muted)' }}>{person.observations}</span>
                        </div>
                      )}

                      {/* Histórico Pastoral */}
                      {(() => {
                        const logs = db.pastoralLogs ? db.pastoralLogs.filter(l => l.personId === person.id) : [];
                        const isLogsExpanded = expandedLogs.includes(person.id);

                        return (
                          <div style={{ borderTop: '1px dashed rgba(0,0,0,0.06)', paddingTop: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <button
                                onClick={() => {
                                  if (isLogsExpanded) {
                                    setExpandedLogs(expandedLogs.filter(id => id !== person.id));
                                  } else {
                                    setExpandedLogs([...expandedLogs, person.id]);
                                  }
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--power-orange)', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                              >
                                <Clock size={12} />
                                Acompanhamento ({logs.length}) {isLogsExpanded ? '▲' : '▼'}
                              </button>

                              <button
                                onClick={() => setLogModal({ open: true, person: { id: person.id, name: person.name, department: person.department }, type: 'Mensagem', notes: '' })}
                                style={{ background: 'none', border: 'none', color: 'var(--power-orange)', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                              >
                                <PlusCircle size={12} />
                                Registrar Contato/Visita
                              </button>
                            </div>

                            {isLogsExpanded && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                {logs.length === 0 ? (
                                  <p style={{ fontSize: '0.75rem', color: 'var(--power-muted)', fontStyle: 'italic' }}>Nenhum acompanhamento registrado ainda.</p>
                                ) : (
                                  logs.map(log => (
                                    <div key={log.id} style={{ background: 'var(--power-raised)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--power-line)', fontSize: '0.75rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                                        <span style={{ color: log.type === 'Visita' ? '#dc2626' : log.type === 'Ligação' ? '#ea580c' : 'var(--power-orange)' }}>
                                          {log.type} por {log.recordedBy}
                                        </span>
                                        <span style={{ color: 'var(--power-muted)' }}>{log.date.split('-').reverse().join('/')}</span>
                                      </div>
                                      <p style={{ color: 'var(--power-muted)', lineHeight: 1.3 }}>{log.notes}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}

            {radarData.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--power-muted)' }}>
                <Sparkles size={44} style={{ color: '#10b981', opacity: 0.5, marginBottom: '1rem' }} />
                <h4 style={{ color: 'var(--color-text-main)' }}>Excelente! Radar Limpo!</h4>
                <p style={{ fontSize: '0.85rem' }}>Todos os membros ativos estão frequentes ou não há registros de faltas.</p>
              </div>
            )}
          </div>
      </div>

      {/* 1. Modal WhatsApp Individual */}
      {waModal.open && waModal.person && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Personalizar Mensagem de Resgate</h3>
              <button className="modal-close" onClick={() => setWaModal({ open: false, person: null, messageText: '' })}>×</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)' }}>
                Destinatário: <strong>{waModal.person.name}</strong> ({waModal.person.absences} {waModal.person.absences === 1 ? 'semana de falta' : 'semanas de falta'} no departamento <strong>{waModal.person.department.split(' ')[0]}</strong>)
              </p>
            </div>

            <div className="form-group">
              <label>Corpo da Mensagem (Você pode editar)</label>
              <textarea
                className="form-control"
                style={{ minHeight: '120px', resize: 'vertical', fontSize: '0.9rem', lineHeight: '1.4' }}
                value={waModal.messageText}
                onChange={(e) => setWaModal({ ...waModal, messageText: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setWaModal({ open: false, person: null, messageText: '' })}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: 'none', width: 'auto' }}
                onClick={() => {
                  const cleanPhone = waModal.person!.phone.replace(/\D/g, '');
                  const waLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(waModal.messageText)}`;
                  window.open(waLink, '_blank');

                  const autoLog: PastoralLog = {
                    id: 'log_' + generateUUID(),
                    personId: waModal.person!.id,
                    date: getLocalDateISO(),
                    type: 'Mensagem',
                    notes: `Mensagem de WhatsApp enviada pelo Radar: "${waModal.messageText}"`,
                    recordedBy: session.name
                  };
                  onUpdatePastoralLogs([...(db.pastoralLogs || []), autoLog]);

                  if (!contactedIds.includes(waModal.person!.id)) {
                    setContactedIds([...contactedIds, waModal.person!.id]);
                  }

                  setWaModal({ open: false, person: null, messageText: '' });
                }}
              >
                <Send size={16} />
                Enviar WhatsApp e Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal de Registro de Acompanhamento Pastoral */}
      {logModal.open && logModal.person && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar Acompanhamento Pastoral</h3>
              <button className="modal-close" onClick={() => setLogModal({ open: false, person: null, type: 'Mensagem', notes: '' })}>×</button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!logModal.notes.trim()) return;

              const newLog: PastoralLog = {
                id: 'log_' + generateUUID(),
                personId: logModal.person!.id,
                date: getLocalDateISO(),
                type: logModal.type,
                notes: logModal.notes.trim(),
                recordedBy: session.name
              };

              onUpdatePastoralLogs([...(db.pastoralLogs || []), newLog]);

              if (!contactedIds.includes(logModal.person!.id)) {
                setContactedIds([...contactedIds, logModal.person!.id]);
              }

              setLogModal({ open: false, person: null, type: 'Mensagem', notes: '' });
            }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)' }}>
                  Acompanhamento para: <strong>{logModal.person.name}</strong> ({logModal.person.department})
                </p>
              </div>

              <div className="form-group">
                <label>Tipo de Contato</label>
                <select
                  className="form-control"
                  value={logModal.type}
                  onChange={(e) => setLogModal({ ...logModal, type: e.target.value as any })}
                >
                  <option value="Mensagem">Mensagem (SMS / Telegram / Redes)</option>
                  <option value="Ligação">Ligação Telefônica</option>
                  <option value="Visita">Visita de Acompanhamento</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notas / Anotações Pastorais</label>
                <textarea
                  className="form-control"
                  style={{ minHeight: '100px', resize: 'vertical' }}
                  placeholder="Descreva brevemente o resultado deste acompanhamento..."
                  value={logModal.notes}
                  onChange={(e) => setLogModal({ ...logModal, notes: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setLogModal({ open: false, person: null, type: 'Mensagem', notes: '' })}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
                  <FileText size={16} />
                  Salvar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Disparo em Lote — 3 etapas */}
      {isBatchOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Assistente de Disparo em Lote</h3>
              <button className="modal-close" onClick={closeBatch}>×</button>
            </div>

            {/* ETAPA 1: SELEÇÃO DE MEMBROS */}
            {batchStep === 'select' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginBottom: '1rem' }}>
                  Selecione os membros que faltaram no último culto:
                </p>

                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--power-line)', borderRadius: '12px', padding: '0.5rem', marginBottom: '1.5rem', background: 'var(--power-raised)' }}>
                  {batchQueue.length === 0 ? (
                    <p style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--power-muted)' }}>
                      Nenhum faltoso identificado no último culto.
                    </p>
                  ) : (
                    batchQueue.map((item, idx) => (
                      <label
                        key={item.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', borderBottom: idx < batchQueue.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none' }}
                      >
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => {
                            const updated = [...batchQueue];
                            updated[idx].selected = !updated[idx].selected;
                            setBatchQueue(updated);
                          }}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <div style={{ fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-text-main)' }}>{item.name}</span>
                          <span style={{ color: 'var(--power-muted)', marginLeft: '0.5rem' }}>
                             ({item.absences} {item.absences === 1 ? 'semana de falta' : 'semanas de falta'} - {item.department.split(' ')[0]})
                          </span>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={closeBatch}>Cancelar</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: 'none', width: 'auto', marginLeft: 'auto' }}
                    disabled={!batchQueue.some(q => q.selected)}
                    onClick={() => {
                      setBatchQueue(batchQueue.filter(q => q.selected));
                      setBatchStep('template');
                    }}
                  >
                    Próximo: Editar Mensagem ({batchQueue.filter(q => q.selected).length})
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 2: EDIÇÃO DA MENSAGEM PADRÃO */}
            {batchStep === 'template' && (
              <div>
                <div style={{ background: 'rgba(255, 97, 1, 0.10)', border: '1px solid rgba(255, 97, 1, 0.28)', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#ff9a5f' }}>
                  <strong>Dica:</strong> Esta mensagem será enviada para todos os {batchQueue.length} membros selecionados.
                  Use <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: '4px' }}>{'{NOME}'}</code> para inserir o nome automaticamente.
                </div>

                <div className="form-group">
                  <label>Mensagem Padrão (Personalize antes de disparar)</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '140px', resize: 'vertical', fontSize: '0.9rem', lineHeight: '1.5' }}
                    value={batchDefaultMessage}
                    onChange={(e) => setBatchDefaultMessage(e.target.value)}
                  />
                </div>

                {batchQueue[0] && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--power-muted)', background: 'var(--power-raised)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                    <strong>Prévia para {batchQueue[0].name}:</strong><br />
                    <span style={{ fontStyle: 'italic', color: 'var(--power-muted)' }}>
                      {batchDefaultMessage.replace(/\{NOME\}/g, batchQueue[0].name)}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setBatchStep('select')}>Voltar</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: 'none', width: 'auto', marginLeft: 'auto' }}
                    onClick={() => {
                      setBatchIndex(0);
                      const currentPerson = batchQueue[0];
                      const defaultWasChanged = batchDefaultMessage !== `Olá, {NOME}! A paz do Senhor! 🙏 Sentimos sua falta no culto. Está tudo bem com você? Qualquer coisa estou aqui para conversar e orar junto. Deus te abençoe! ✨`;
                      setBatchMessageText(defaultWasChanged 
                        ? batchDefaultMessage.replace(/\{NOME\}/g, currentPerson?.name || '')
                        : (currentPerson ? getDynamicHumanMessage(session.name, currentPerson.name, currentPerson.id) : '')
                      );
                      setBatchStep('send');
                    }}
                  >
                    <Send size={14} style={{ marginRight: '0.25rem' }} />
                    Iniciar Disparos ({batchQueue.length})
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3: DISPARO PASSO A PASSO */}
            {batchStep === 'send' && (
              <div>
                {batchIndex < batchQueue.length ? (
                  (() => {
                    const currentPerson = batchQueue[batchIndex];

                    const sendWhatsApp = () => {
                      const cleanPhone = currentPerson.phone.replace(/\D/g, '');
                      const waLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(batchMessageText)}`;
                      window.open(waLink, '_blank');

                      const autoLog: PastoralLog = {
                        id: 'log_' + generateUUID(),
                        personId: currentPerson.id,
                        date: getLocalDateISO(),
                        type: 'Mensagem',
                        notes: `Mensagem enviada via lote de WhatsApp: "${batchMessageText}"`,
                        recordedBy: session.name
                      };
                      onUpdatePastoralLogs([...(db.pastoralLogs || []), autoLog]);

                      if (!contactedIds.includes(currentPerson.id)) {
                        setContactedIds([...contactedIds, currentPerson.id]);
                      }

                      const nextIdx = batchIndex + 1;
                      setBatchIndex(nextIdx);
                      if (nextIdx < batchQueue.length) {
                        const nextPerson = batchQueue[nextIdx];
                        const defaultWasChanged = batchDefaultMessage !== `Olá, {NOME}! A paz do Senhor! 🙏 Sentimos sua falta no culto. Está tudo bem com você? Qualquer coisa estou aqui para conversar e orar junto. Deus te abençoe! ✨`;
                        setBatchMessageText(defaultWasChanged 
                          ? batchDefaultMessage.replace(/\{NOME\}/g, nextPerson.name)
                          : getDynamicHumanMessage(session.name, nextPerson.name, nextPerson.id)
                        );
                      }
                    };

                    const skipPerson = () => {
                      const nextIdx = batchIndex + 1;
                      setBatchIndex(nextIdx);
                      if (nextIdx < batchQueue.length) {
                        const nextPerson = batchQueue[nextIdx];
                        const defaultWasChanged = batchDefaultMessage !== `Olá, {NOME}! A paz do Senhor! 🙏 Sentimos sua falta no culto. Está tudo bem com você? Qualquer coisa estou aqui para conversar e orar junto. Deus te abençoe! ✨`;
                        setBatchMessageText(defaultWasChanged 
                          ? batchDefaultMessage.replace(/\{NOME\}/g, nextPerson.name)
                          : getDynamicHumanMessage(session.name, nextPerson.name, nextPerson.id)
                        );
                      }
                    };

                    return (
                      <div>
                        <div style={{ background: 'var(--power-raised)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--power-line)', marginBottom: '1.25rem' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--power-orange)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Progresso: {batchIndex + 1} de {batchQueue.length}
                          </p>
                          <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', marginTop: '0.25rem' }}>{currentPerson.name}</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--power-muted)', marginTop: '0.15rem' }}>
                             Telefone: {currentPerson.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')} | Semanas de Falta: {currentPerson.absences}
                          </p>
                        </div>

                        <div className="form-group">
                          <label>Mensagem Personalizada</label>
                          <textarea
                            className="form-control"
                            style={{ minHeight: '120px', resize: 'vertical', fontSize: '0.9rem', lineHeight: '1.4' }}
                            value={batchMessageText}
                            onChange={(e) => setBatchMessageText(e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
                          <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={closeBatch}>Cancelar</button>
                          <button type="button" className="btn btn-secondary" style={{ width: 'auto', marginLeft: 'auto' }} onClick={skipPerson}>Pular</button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: 'none', width: 'auto' }}
                            onClick={sendWhatsApp}
                          >
                            <Send size={16} />
                            Enviar e Próximo
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <Sparkles size={48} style={{ color: '#10b981', marginBottom: '1rem' }} />
                    <h4 style={{ fontSize: '1.25rem', color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Disparo Concluído!</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginBottom: '1.5rem' }}>
                      Todas as mensagens foram enviadas e registradas no histórico pastoral.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={closeBatch}>
                      Fechar Assistente
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
