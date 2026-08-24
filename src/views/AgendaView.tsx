import { getLocalDateISO } from '../utils/localDate';
import { generateUUID, isSameDepartment, isVirtualDepartment } from '../services/db';
import { apiGetCalendarSettings, apiSaveCalendarSettings, apiProxyIcs } from '../services/api';
import React, { useState, useRef } from 'react';
import type { AppDatabase, UserSession, ChurchEvent } from '../services/db';
import { Calendar as CalendarIcon, Plus, Edit2, Trash2, Upload, ChevronLeft, ChevronRight, Settings, RefreshCw, Copy } from 'lucide-react';
import { parseICSText } from '../utils/icsParser';

interface AgendaViewProps {
  db: AppDatabase;
  session: UserSession;
  onUpdateDatabase: (newDb: AppDatabase) => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({ db, session, onUpdateDatabase }) => {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ChurchEvent | null>(null);
  
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDept, setFormDept] = useState('');
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<ChurchEvent | null>(null);

  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('');
  const [calendarExportUrl, setCalendarExportUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasFetchedUrl, setHasFetchedUrl] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthorized = session.role === 'Pastor Admin' || session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Líder';
  const isPastor = session.role === 'Pastor Admin' || session.role === 'Pastor';

  const getEventStyle = (dept?: string) => {
    const d = dept?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || '';
    if (d.includes('joven') || d.includes('alvorecer')) {
      return { bg: 'rgba(255, 97, 1, 0.10)', fg: '#7e22ce', border: '#a855f7' };
    }
    if (d.includes('adolescente') || d.includes('davi')) {
      return { bg: '#e0e7ff', fg: '#3730a3', border: '#6366f1' };
    }
    if (d.includes('irma') || d.includes('atalaia')) {
      return { bg: 'rgba(255, 97, 1, 0.10)', fg: '#be185d', border: '#ec4899' };
    }
    if (d.includes('homen') || d.includes('gideo')) {
      return { bg: 'rgba(255, 97, 1, 0.28)', fg: '#ff9a5f', border: '#f97316' };
    }
    if (d.includes('obreiro') || d.includes('huperete')) {
      return { bg: '#ccfbf1', fg: '#0f766e', border: '#14b8a6' };
    }
    if (d.includes('integrac') || d.includes('discipul')) {
      return { bg: '#dcfce7', fg: '#15803d', border: '#22c55e' };
    }
    return { bg: '#e8f0fe', fg: '#1a73e8', border: '#1a73e8' };
  };

  const events = db.events || [];

  React.useEffect(() => {
    if (isPastor && !hasFetchedUrl) {
      setHasFetchedUrl(true);
      apiGetCalendarSettings()
        .then(async (data) => {
          if (data.status === 'success') {
            if (data.settings?.exportUrl) setCalendarExportUrl(data.settings.exportUrl);
            if (data.settings?.googleCalendarUrl) {
            const savedUrl = data.settings.googleCalendarUrl;
            setGoogleUrl(savedUrl);
            if (data.settings?.exportUrl) setCalendarExportUrl(data.settings.exportUrl);
            
            // Auto-sync
            setIsSyncing(true);
            try {
              const text = await apiProxyIcs();
              if (text) {
                 const { importedEvents } = parseICSText(text, db.events || [], session.personId || 'admin');
                 if (importedEvents.length > 0) {
                   onUpdateDatabase({ ...db, events: [...(db.events || []), ...importedEvents] });
                 }
              }
            } catch (e) {
               console.error('Auto-sync failed', e);
            } finally {
               setIsSyncing(false);
            }
            }
          }
        })
        .catch(err => console.error(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPastor]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  
  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    setViewDate(new Date());
  };

  const openAddModal = () => {
    if (!isAuthorized) return;
    setEditingEvent(null);
    setFormTitle('');
    setFormDate(getLocalDateISO());
    setFormEndDate('');
    setFormDesc('');
    setFormDept(session.department || '');
    setIsModalOpen(true);
  };

  const openEditModal = (ev: ChurchEvent) => {
    if (!isAuthorized) return;
    if (session.role === 'Líder' && ev.department !== session.department) {
      alert('Você não tem permissão para editar eventos deste departamento.');
      return;
    }
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormDate(ev.date);
    setFormEndDate(ev.endDate || '');
    setFormDesc(ev.description || '');
    setFormDept(ev.department || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) return;

    const now = new Date().toISOString();
    let updatedEvents = [...events];

    if (editingEvent) {
      updatedEvents = updatedEvents.map(ev => {
        if (ev.id === editingEvent.id) {
          return {
            ...ev,
            title: formTitle.trim(),
            date: formDate,
            endDate: formEndDate ? formEndDate : undefined,
            description: formDesc.trim(),
            department: formDept || undefined,
            updatedAt: now,
            version: (ev.version || 1) + 1
          };
        }
        return ev;
      });
    } else {
      updatedEvents.push({
        id: 'ev_' + generateUUID(),
        title: formTitle.trim(),
        date: formDate,
        endDate: formEndDate ? formEndDate : undefined,
        description: formDesc.trim(),
        department: formDept || undefined,
        createdBy: session.personId || 'admin',
        updatedAt: now,
        version: 1
      });
    }

    onUpdateDatabase({ ...db, events: updatedEvents });
    setEditingEvent(null);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja apagar este evento?')) {
      const now = new Date().toISOString();
      const updatedEvents = events.map(ev =>
        ev.id === id
          ? { ...ev, deleted: true as const, updatedAt: now, version: (ev.version || 1) + 1 }
          : ev
      );
      onUpdateDatabase({ ...db, events: updatedEvents });
    }
  };

  const handleClearAll = () => {
    if (window.confirm('ATENÇÃO: Você tem certeza absoluta que deseja APAGAR TODOS os eventos da agenda? Essa ação não pode ser desfeita.')) {
      const now = new Date().toISOString();
      const updatedEvents = events.map(ev => ({
        ...ev,
        deleted: true as const,
        updatedAt: now,
        version: (ev.version || 1) + 1
      }));
      onUpdateDatabase({ ...db, events: updatedEvents });
    }
  };

  const handleImportICS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.zip')) {
      alert('Você selecionou um arquivo .zip. Por favor, extraia (descompacte) o arquivo primeiro e selecione o arquivo com final .ics que está dentro dele.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!file.name.toLowerCase().endsWith('.ics') && !file.name.toLowerCase().endsWith('.ical')) {
      alert('Por favor, selecione um arquivo de calendário válido (.ics ou .ical).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      
      const { importedEvents, eventsParsed, eventsIgnoredDuplicates } = parseICSText(text, db.events || [], session.personId || 'admin');

      if (importedEvents.length > 0) {
        onUpdateDatabase({ ...db, events: [...(db.events || []), ...importedEvents] });
        alert(`${importedEvents.length} eventos importados com sucesso!\n\nDetalhes:\n- Lidos no arquivo: ${eventsParsed}\n- Ignorados (já existiam): ${eventsIgnoredDuplicates}`);
      } else {
        alert(`Nenhum evento novo foi importado.\n\nDetalhes:\n- Eventos lidos no arquivo: ${eventsParsed}\n- Ignorados (já existiam no calendário): ${eventsIgnoredDuplicates}\n\nSe o número lido for 0, o arquivo não tem eventos no formato padrão ICS.`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const renderMonthView = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const blanks = Array.from({ length: firstDay }).map((_, i) => <div key={`blank-${i}`} className="calendar-day empty"></div>);
    const days = Array.from({ length: daysInMonth }).map((_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = isCurrentMonth && today.getDate() === day;
      // Multi-day support: include events where dateStr falls within [ev.date, ev.endDate]
      const dayEvents = events.filter(ev =>
        !ev.deleted &&
        dateStr >= ev.date &&
        dateStr <= (ev.endDate || ev.date) &&
        (!session.department || !ev.department || isSameDepartment(ev.department, session.department))
      );
      return (
        <div
          key={day}
          className={`calendar-day ${isToday ? 'today' : ''}`}
          onClick={() => setSelectedDate(new Date(year, month, day))}
          style={{ cursor: 'pointer' }}
        >
          <div className="day-number-wrapper">
            <span className="day-number">{day}</span>
          </div>
          <div className="day-events">
            {dayEvents.slice(0, 3).map(ev => {
              const style = getEventStyle(ev.department);
              return (
                <div
                  key={ev.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedDetailEvent(ev); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: style.bg,
                    borderLeft: `3px solid ${style.border}`,
                    color: style.fg,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    padding: '1px 4px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.5,
                    marginBottom: '1px'
                  }}
                  title={`${ev.title}${ev.department ? ` — ${ev.department}` : ''}`}
                >
                  {ev.title}
                </div>
              );
            })}
            {dayEvents.length > 3 && (
              <div style={{ fontSize: '0.55rem', color: 'var(--power-muted)', paddingLeft: '2px' }}>+{dayEvents.length - 3}</div>
            )}
          </div>
        </div>
      );
    });
    return (
      <div className="calendar-grid">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="calendar-header-day">{d}</div>
        ))}
        {blanks}
        {days}
      </div>
    );
  };

  const renderWeekView = () => {
    // Show upcoming events from today onwards
    const todayStr = getLocalDateISO();
    const upcoming = events
      .filter(ev => !ev.deleted && ev.date >= todayStr && (!session.department || !ev.department || isSameDepartment(ev.department, session.department)))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (upcoming.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--power-muted)' }}>
          <CalendarIcon size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
          <p>Nenhum evento programado para os próximos dias.</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {upcoming.map(ev => {
          const dateObj = new Date(ev.date + 'T12:00:00');
          const dateFmt = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
          const style = getEventStyle(ev.department);
          return (
            <div key={ev.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem', borderLeft: `6px solid ${style.border}` }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--power-white)', fontSize: '1.2rem' }}>{ev.title}</h3>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--power-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CalendarIcon size={14} /> {dateFmt}
                </p>
                {ev.department && (
                  <span className="badge badge-inactive" style={{ fontSize: '0.75rem', marginBottom: '0.5rem', display: 'inline-block' }}>
                    Apenas para {ev.department}
                  </span>
                )}
                {ev.description && (
                  <p style={{ margin: 0, color: 'var(--power-muted)', fontSize: '0.95rem' }}>{ev.description}</p>
                )}
              </div>
              {isAuthorized && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-small" onClick={() => openEditModal(ev)}>
                    <Edit2 size={14} />
                  </button>
                  <button className="btn btn-secondary btn-small" onClick={() => handleDelete(ev.id)} style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="view-container animate-fade">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CalendarIcon size={28} style={{ color: 'var(--color-primary)' }} />
            Agenda Compartilhada
          </h1>
          <p className="subtitle">Programação e eventos da congregação</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="view-toggle" style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.5)', padding: '0.25rem', borderRadius: '8px' }}>
            <button 
              onClick={() => setViewMode('month')} 
              style={{ padding: '0.5rem 1rem', border: 'none', background: viewMode === 'month' ? 'white' : 'transparent', borderRadius: '6px', fontWeight: viewMode === 'month' ? 600 : 400, boxShadow: viewMode === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
            >
              Mês
            </button>
            <button 
              onClick={() => setViewMode('week')} 
              style={{ padding: '0.5rem 1rem', border: 'none', background: viewMode === 'week' ? 'white' : 'transparent', borderRadius: '6px', fontWeight: viewMode === 'week' ? 600 : 400, boxShadow: viewMode === 'week' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
            >
              Próximos
            </button>
          </div>
          
          {isPastor && (
            <>
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsIntegrationModalOpen(true)}
                style={{ background: 'var(--power-raised)', border: '1px solid var(--power-muted)' }}
              >
                {isSyncing ? <RefreshCw size={18} className="spin" /> : <Settings size={18} />} Integração Google
              </button>
              
              <input 
                type="file" 
                accept=".ics" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleImportICS}
              />
              <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} /> Importar Google (.ics)
              </button>
              <button className="btn btn-secondary" onClick={handleClearAll} style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)' }}>
                <Trash2 size={18} /> Limpar Tudo
              </button>
            </>
          )}
          {isAuthorized && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} /> Novo Evento
            </button>
          )}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        {viewMode === 'month' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-small" style={{ padding: '0.4rem 0.5rem' }} onClick={handlePrevMonth}><ChevronLeft size={18}/></button>
              <button className="btn btn-secondary btn-small" onClick={handleGoToday} style={{ fontWeight: 600 }}>Hoje</button>
              <button className="btn btn-secondary btn-small" style={{ padding: '0.4rem 0.5rem' }} onClick={handleNextMonth}><ChevronRight size={18}/></button>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--power-white)', fontWeight: 500 }}>
              {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </h2>
          </div>
        )}

        {viewMode === 'month' ? renderMonthView() : renderWeekView()}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingEvent ? 'Editar Evento' : 'Novo Evento'}</h2>
              <button className="modal-close" onClick={() => { setEditingEvent(null); setIsModalOpen(false); }}>&times;</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Título do Evento</label>
                <input
                  type="text"
                  className="form-control"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ex: Culto de Missões"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Data de Início</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Data de Término <span style={{ fontWeight: 400, color: 'var(--power-muted)' }}>(Opcional)</span></label>
                  <input
                    type="date"
                    className="form-control"
                    value={formEndDate}
                    min={formDate}
                    onChange={e => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Público Alvo (Opcional)</label>
                <select
                  className="form-control"
                  value={formDept}
                  onChange={e => setFormDept(e.target.value)}
                >
                  <option value="">Geral (Igreja Toda)</option>
                  {db.departments
                    .filter(d => !d.deleted && !isVirtualDepartment(d.name) && (!session.department || isSameDepartment(d.name, session.department)))
                    .map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))
                  }
                </select>
              </div>

              <div className="form-group">
                <label>Descrição / Detalhes</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Informações adicionais..."
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setEditingEvent(null); setIsModalOpen(false); }} style={{ flex: '1 1 120px' }}>
                  Cancelar
                </button>
                {editingEvent && (
                  <button type="button" className="btn btn-secondary" onClick={() => { handleDelete(editingEvent.id); setIsModalOpen(false); }} style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 120px', justifyContent: 'center' }}>
                    <Trash2 size={16} /> Excluir
                  </button>
                )}
                <button type="submit" className="btn btn-primary" style={{ flex: '1 1 100%' }}>
                  {editingEvent ? 'Salvar Alterações' : 'Criar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail modal — opens when clicking an event bar in the calendar */}
      {selectedDetailEvent && (
        <div className="modal-overlay" onClick={() => setSelectedDetailEvent(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CalendarIcon size={18} aria-hidden="true" /> Detalhes do Evento</h2>
              <button className="modal-close" onClick={() => setSelectedDetailEvent(null)}>&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '0.5rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--power-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Título</p>
                <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '1.05rem', color: 'var(--power-white)' }}>{selectedDetailEvent.title}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--power-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Data de Início</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--power-muted)' }}>
                    {new Date(selectedDetailEvent.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {selectedDetailEvent.endDate && (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--power-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Data de Término</p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--power-muted)' }}>
                      {new Date(selectedDetailEvent.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
              {selectedDetailEvent.department && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--power-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Departamento</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: 'var(--power-muted)' }}>{selectedDetailEvent.department}</p>
                </div>
              )}
              {selectedDetailEvent.description && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--power-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Descrição</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: 'var(--power-muted)', lineHeight: 1.5 }}>{selectedDetailEvent.description}</p>
                </div>
              )}
              {isAuthorized && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    onClick={() => { setSelectedDetailEvent(null); openEditModal(selectedDetailEvent); }}
                  >
                    <Edit2 size={14} /> Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #fca5a5' }}
                    onClick={() => { handleDelete(selectedDetailEvent.id); setSelectedDetailEvent(null); }}
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isIntegrationModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={22} style={{ color: 'var(--power-orange)' }} />
                Integração Google Agenda
              </h2>
              <button className="modal-close" onClick={() => setIsIntegrationModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ background: 'rgba(255, 97, 1, 0.10)', border: '1px solid rgba(255, 97, 1, 0.28)', padding: '1rem', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1rem', color: '#ff9a5f', margin: '0 0 0.5rem 0' }}>1. Google ➔ Multiplica PLUS</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--power-muted)', marginBottom: '1rem' }}>
                  Cole abaixo o <strong>Endereço secreto no formato iCal</strong> da sua Google Agenda. 
                  Sempre que alguém abrir esta tela, o sistema fará a sincronização automática.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    value={googleUrl} 
                    onChange={e => setGoogleUrl(e.target.value)}
                    placeholder="https://calendar.google.com/calendar/ical/..."
                    style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--power-muted)' }}
                  />
                  <button 
                    className="btn btn-primary"
                    disabled={isSyncing}
                    onClick={async () => {
                      setIsSyncing(true);
                      try {
                        // 1. Salvar no back-end (chave via header, nunca na URL/body)
                        const saved = await apiSaveCalendarSettings(googleUrl);
                        if (saved?.settings?.exportUrl) setCalendarExportUrl(saved.settings.exportUrl);
                        
                        // 2. Tentar Sincronizar Agora
                        if (googleUrl) {
                          const text = await apiProxyIcs();
                          if (text) {
                            const { importedEvents, eventsParsed } = parseICSText(text, db.events || [], session.personId || 'admin');
                            if (importedEvents.length > 0) {
                              onUpdateDatabase({ ...db, events: [...(db.events || []), ...importedEvents] });
                            }
                            alert(`Configuração salva com sucesso!\nSincronização imediata concluída.\nLidos do Google: ${eventsParsed}\nNovos inseridos: ${importedEvents.length}`);
                          } else {
                            alert('Configuração salva, mas falhou ao tentar puxar a agenda (verifique o link).');
                          }
                        } else {
                          alert('Integração desativada (Link apagado).');
                        }
                      } catch (e) {
                        alert('Erro ao salvar ou sincronizar.');
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                  >
                    {isSyncing ? 'Sincronizando...' : 'Salvar e Sincronizar'}
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--power-raised)', border: '1px solid var(--power-line)', padding: '1rem', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.05)', margin: '0 0 0.5rem 0' }}>2. Multiplica PLUS ➔ Google</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--power-muted)', marginBottom: '1rem' }}>
                  Para que os eventos criados no Multiplica apareçam na sua agenda Google, copie o link abaixo e cole no Google Agenda em <strong>Adicionar agenda a partir do URL</strong>.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    readOnly
                    value={calendarExportUrl}
                    style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--power-muted)', background: 'rgba(15, 23, 42, 0.5)', color: 'var(--power-muted)', fontSize: '0.85rem' }}
                  />
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(calendarExportUrl);
                      alert('Link copiado!');
                    }}
                  >
                    <Copy size={16} /> Copiar
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--power-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
                  Nota: O Google atualiza automaticamente as agendas por URL, porém, ele pode demorar entre 12 a 24 horas para exibir eventos recém-criados.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
