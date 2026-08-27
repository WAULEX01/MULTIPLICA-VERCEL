import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  MessageSquare,
  Phone,
  Search,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';
import type { AppDatabase, PastoralLog, UserSession } from '../services/db';
import {
  calculateConsecutiveAbsences,
  compareByName,
  generateUUID,
  personInDepartment,
} from '../services/db';
import { getLocalDateISO } from '../utils/localDate';

interface RadarViewProps {
  db: AppDatabase;
  session: UserSession;
  onUpdatePastoralLogs: (newLogs: PastoralLog[]) => void;
}

type AlertLevel = 'yellow' | 'orange' | 'red';
type PastoralAction = 'Mensagem' | 'Ligação' | 'Visita';

interface AttentionItem {
  person: AppDatabase['people'][number];
  department: string;
  absences: number;
  lastPresence: string;
  level: AlertLevel;
  action: PastoralAction;
  lastContact?: PastoralLog;
}

const levelMeta: Record<AlertLevel, { label: string; color: string; bg: string; border: string }> = {
  yellow: {
    label: 'Atenção',
    color: '#d97706',
    bg: 'rgba(217,119,6,.10)',
    border: 'rgba(217,119,6,.28)',
  },
  orange: {
    label: 'Prioridade',
    color: '#ea580c',
    bg: 'rgba(234,88,12,.10)',
    border: 'rgba(234,88,12,.28)',
  },
  red: {
    label: 'Urgente',
    color: '#dc2626',
    bg: 'rgba(220,38,38,.10)',
    border: 'rgba(220,38,38,.28)',
  },
};

const formatDate = (iso?: string) => {
  if (!iso) return 'Sem registro';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const buildWhatsAppUrl = (phone: string, name: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  const normalized = digits.startsWith('55') ? digits : `55${digits}`;
  const firstName = name.trim().split(/\s+/)[0] || name;
  const message = `Olá, ${firstName}! A paz do Senhor. 🙏 Sentimos sua falta e queremos saber como você está. Estamos à disposição para conversar e orar com você. Deus abençoe!`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
};

export const RadarView: React.FC<RadarViewProps> = ({ db, session, onUpdatePastoralLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'yellow' | 'orange' | 'red'>('all');
  const [selected, setSelected] = useState<AttentionItem | null>(null);
  const [logType, setLogType] = useState<PastoralAction>('Mensagem');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const deptFilter = session.department || undefined;
  const fallbackDate = getLocalDateISO();

  const attentionItems = useMemo<AttentionItem[]>(() => {
    return db.people
      .filter(
        (person) =>
          !person.deleted &&
          person.status !== 'Arquivado' &&
          person.status !== 'Inativo' &&
          person.status !== 'Visitante' &&
          (!deptFilter || personInDepartment(person, deptFilter)),
      )
      .map((person) => {
        const department = deptFilter || person.department;
        const absences = calculateConsecutiveAbsences(
          person.id,
          department,
          person.startDate || fallbackDate,
          db.attendances,
        );

        const attendanceHistory = db.attendances
          .filter((attendance) => attendance.department === department && !attendance.deleted)
          .sort((a, b) => b.date.localeCompare(a.date));

        const lastPresenceRecord = attendanceHistory.find((attendance) =>
          attendance.presentIds?.includes(person.id),
        );

        let level: AlertLevel = 'yellow';
        let action: PastoralAction = 'Mensagem';
        if (absences >= 3) {
          level = 'red';
          action = 'Visita';
        } else if (absences === 2) {
          level = 'orange';
          action = 'Ligação';
        }

        const lastContact = [...(db.pastoralLogs || [])]
          .filter((log) => log.personId === person.id && !log.deleted)
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        return {
          person,
          department,
          absences,
          lastPresence: lastPresenceRecord?.date || '',
          level,
          action,
          lastContact,
        };
      })
      .filter((item) => item.absences >= 1)
      .sort((a, b) => b.absences - a.absences || compareByName(a.person, b.person));
  }, [db.people, db.attendances, db.pastoralLogs, deptFilter, fallbackDate]);

  const filteredItems = attentionItems.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      item.person.name.toLowerCase().includes(term) ||
      item.department.toLowerCase().includes(term);
    const matchesFilter = filter === 'all' || item.level === filter;
    return matchesSearch && matchesFilter;
  });

  const summary = {
    total: attentionItems.length,
    yellow: attentionItems.filter((item) => item.level === 'yellow').length,
    orange: attentionItems.filter((item) => item.level === 'orange').length,
    red: attentionItems.filter((item) => item.level === 'red').length,
  };

  const registerAction = () => {
    if (!selected) return;

    const now = new Date().toISOString();
    const newLog: PastoralLog = {
      id: generateUUID(),
      personId: selected.person.id,
      date: getLocalDateISO(),
      type: logType,
      notes: notes.trim() || `${logType} registrada pelo Painel de Atenção Pastoral.`,
      recordedBy: session.personId || session.code || session.name,
      updatedAt: now,
      updatedBy: session.personId || session.code || session.name,
      version: 1,
      deleted: false,
    };

    onUpdatePastoralLogs([...(db.pastoralLogs || []), newLog]);
    setSelected(null);
    setNotes('');
  };

  const openAction = (item: AttentionItem, type: PastoralAction) => {
    if (type === 'Mensagem' && item.person.phone) {
      window.open(buildWhatsAppUrl(item.person.phone, item.person.name), '_blank', 'noopener,noreferrer');
    }
    setSelected(item);
    setLogType(type);
    setNotes('');
  };

  return (
    <div className="animate-fade">
      <div className="view-header">
        <div>
          <h2>Painel de Atenção Pastoral</h2>
          <p className="subtitle">
            Transforme ausências em ações: mensagem, ligação e visita no momento certo.
          </p>
        </div>
      </div>

      <div
        className="glass-card"
        style={{
          marginBottom: '1.25rem',
          padding: '1rem 1.15rem',
          borderLeft: '4px solid #7c3aed',
          background: 'linear-gradient(135deg, rgba(124,58,237,.10), rgba(59,130,246,.05))',
        }}
      >
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
          <Sparkles size={20} style={{ color: '#8b5cf6', marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '.2rem' }}>Acompanhamento inteligente</strong>
            <span style={{ fontSize: '.84rem', color: 'var(--power-muted)' }}>
              1 falta: mensagem • 2 faltas: ligação • 3 ou mais faltas: visita. O histórico pastoral fica associado à pessoa.
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
          gap: '.75rem',
          marginBottom: '1.25rem',
        }}
      >
        <SummaryCard icon={<ShieldAlert size={20} />} label="Precisam de atenção" value={summary.total} />
        <SummaryCard icon={<MessageSquare size={20} />} label="Mensagem" value={summary.yellow} color="#d97706" />
        <SummaryCard icon={<Phone size={20} />} label="Ligação" value={summary.orange} color="#ea580c" />
        <SummaryCard icon={<UserRoundCheck size={20} />} label="Visita" value={summary.red} color="#dc2626" />
      </div>

      <div
        className="glass-card"
        style={{
          padding: '.9rem',
          marginBottom: '1rem',
          display: 'flex',
          gap: '.65rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search
            size={17}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--power-muted)' }}
          />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar pessoa ou departamento..."
            style={{ width: '100%', paddingLeft: 38 }}
          />
        </div>

        <div style={{ display: 'flex', gap: '.4rem', overflowX: 'auto', paddingBottom: 2 }}>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label={`Todos (${summary.total})`} />
          <FilterButton active={filter === 'yellow'} onClick={() => setFilter('yellow')} label={`Mensagem (${summary.yellow})`} />
          <FilterButton active={filter === 'orange'} onClick={() => setFilter('orange')} label={`Ligação (${summary.orange})`} />
          <FilterButton active={filter === 'red'} onClick={() => setFilter('red')} label={`Visita (${summary.red})`} />
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
          <CheckCircle2 size={38} style={{ margin: '0 auto .7rem', color: '#16a34a' }} />
          <h3 style={{ marginBottom: '.25rem' }}>Nenhuma atenção pendente neste filtro</h3>
          <p style={{ color: 'var(--power-muted)', fontSize: '.86rem' }}>O acompanhamento está em dia.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '.75rem' }}>
          {filteredItems.map((item) => {
            const meta = levelMeta[item.level];
            const logs = (db.pastoralLogs || [])
              .filter((log) => log.personId === item.person.id && !log.deleted)
              .sort((a, b) => b.date.localeCompare(a.date));

            return (
              <div
                key={item.person.id}
                className="glass-card"
                style={{
                  padding: '1rem',
                  borderLeft: `4px solid ${meta.color}`,
                  background: meta.bg,
                  borderColor: meta.border,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 210px' }}>
                    <div style={{ display: 'flex', gap: '.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>{item.person.name}</h3>
                      <span
                        style={{
                          fontSize: '.68rem',
                          fontWeight: 800,
                          color: meta.color,
                          background: 'rgba(255,255,255,.55)',
                          border: `1px solid ${meta.border}`,
                          borderRadius: 999,
                          padding: '.12rem .45rem',
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p style={{ margin: '.18rem 0 0', fontSize: '.78rem', color: 'var(--power-muted)' }}>{item.department}</p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: meta.color, fontWeight: 800, fontSize: '1.05rem' }}>{item.absences} {item.absences === 1 ? 'falta' : 'faltas'}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--power-muted)' }}>Ação: {item.action}</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '.8rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '.55rem',
                  }}
                >
                  <InfoLine icon={<Calendar size={15} />} label="Última presença" value={formatDate(item.lastPresence)} />
                  <InfoLine
                    icon={<Clock3 size={15} />}
                    label="Último cuidado"
                    value={item.lastContact ? `${item.lastContact.type} • ${formatDate(item.lastContact.date)}` : 'Nenhum contato'}
                  />
                </div>

                <div style={{ display: 'flex', gap: '.45rem', marginTop: '.85rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-small" onClick={() => openAction(item, 'Mensagem')} disabled={!item.person.phone}>
                    <MessageSquare size={15} /> Mensagem
                  </button>
                  <button className="btn btn-small" onClick={() => openAction(item, 'Ligação')}>
                    <Phone size={15} /> Ligação
                  </button>
                  <button className="btn btn-small" onClick={() => openAction(item, 'Visita')}>
                    <UserRoundCheck size={15} /> Visita
                  </button>
                  <button className="btn btn-small" onClick={() => setShowHistory(showHistory === item.person.id ? null : item.person.id)}>
                    <Eye size={15} /> Histórico ({logs.length})
                  </button>
                </div>

                {showHistory === item.person.id && (
                  <div style={{ marginTop: '.8rem', borderTop: '1px solid var(--power-line)', paddingTop: '.7rem' }}>
                    {logs.length === 0 ? (
                      <p style={{ fontSize: '.8rem', color: 'var(--power-muted)' }}>Nenhum acompanhamento pastoral registrado.</p>
                    ) : (
                      logs.slice(0, 8).map((log) => (
                        <div key={log.id} style={{ padding: '.45rem 0', borderBottom: '1px solid var(--power-line)' }}>
                          <div style={{ fontSize: '.78rem', fontWeight: 700 }}>{log.type} • {formatDate(log.date)}</div>
                          <div style={{ fontSize: '.76rem', color: 'var(--power-muted)', marginTop: '.12rem' }}>{log.notes || 'Sem observação.'}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,.55)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
          onClick={() => setSelected(null)}
        >
          <div className="glass-card" style={{ width: 'min(480px, 100%)', padding: '1.1rem' }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', gap: '.55rem', alignItems: 'center', marginBottom: '.8rem' }}>
              <FileText size={19} style={{ color: levelMeta[selected.level].color }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Registrar acompanhamento</h3>
                <p style={{ margin: '.1rem 0 0', fontSize: '.78rem', color: 'var(--power-muted)' }}>{selected.person.name}</p>
              </div>
            </div>

            <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, marginBottom: '.3rem' }}>Tipo de cuidado</label>
            <select value={logType} onChange={(event) => setLogType(event.target.value as PastoralAction)} style={{ width: '100%', marginBottom: '.75rem' }}>
              <option value="Mensagem">Mensagem</option>
              <option value="Ligação">Ligação</option>
              <option value="Visita">Visita</option>
            </select>

            <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, marginBottom: '.3rem' }}>Observação</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Ex.: conversamos, está tudo bem; pediu oração; visita agendada..."
              style={{ width: '100%', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.9rem' }}>
              <button className="btn btn-small" onClick={() => setSelected(null)}>Cancelar</button>
              <button className="btn btn-primary btn-small" onClick={registerAction}>Salvar acompanhamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({
  icon,
  label,
  value,
  color = '#7c3aed',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) => (
  <div className="glass-card" style={{ padding: '.9rem' }}>
    <div style={{ color, marginBottom: '.45rem' }}>{icon}</div>
    <div style={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: '.72rem', color: 'var(--power-muted)', marginTop: '.3rem' }}>{label}</div>
  </div>
);

const InfoLine = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div style={{ display: 'flex', gap: '.45rem', alignItems: 'center', fontSize: '.76rem' }}>
    <span style={{ color: 'var(--power-muted)', display: 'flex' }}>{icon}</span>
    <div>
      <span style={{ color: 'var(--power-muted)' }}>{label}: </span>
      <strong>{value}</strong>
    </div>
  </div>
);

const FilterButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      border: active ? '1px solid #7c3aed' : '1px solid var(--power-line)',
      background: active ? 'rgba(124,58,237,.12)' : 'transparent',
      color: active ? '#8b5cf6' : 'var(--color-text-main)',
      borderRadius: 999,
      padding: '.48rem .68rem',
      fontSize: '.72rem',
      fontWeight: 700,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
    }}
  >
    {label}
  </button>
);
