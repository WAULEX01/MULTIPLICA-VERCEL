// src/views/BirthdaysView.tsx
import React, { useState } from 'react';
import type { AppDatabase, UserSession } from '../services/db';
import { personInDepartment, compareByName } from '../services/db';
import { Gift, Calendar, MessageSquare, Search, Sparkles } from 'lucide-react';
import { getBirthdayWhatsAppMessage } from '../services/genderMsg';

interface BirthdaysViewProps {
  db: AppDatabase;
  session: UserSession;
}

export const BirthdaysView: React.FC<BirthdaysViewProps> = ({ db, session }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Get current date information
  const today = new Date();
  const currentYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const [selectedMonth, setSelectedMonth] = useState<number>(todayMonth);

  // Start & End of current calendar week (Sunday - Saturday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // 2. Filter people based on scope (dept scoping for Leaders/Multipliers or selected dept)
  const isScoped = session.role === 'Líder' || session.role === 'Multiplicador';
  const myDept = session.department;

  const peopleInScope = db.people.filter(p => {
    if (p.deleted || p.status !== 'Ativo') return false;
    if (myDept) {
      return personInDepartment(p, myDept);
    }
    return true;
  });

  // 3. Process dates & group birthdays
  const todayBirthdays: any[] = [];
  const weekBirthdays: any[] = [];
  const monthBirthdays: any[] = [];

  peopleInScope.forEach(p => {
    if (!p.birthDate) return;

    // Parse YYYY-MM-DD
    const parts = p.birthDate.split('-');
    if (parts.length < 3) return;

    const birthYear = parseInt(parts[0]);
    const birthMonth = parseInt(parts[1]);
    const birthDay = parseInt(parts[2]);

    const isYearUnknown = birthYear === 1900;
    
    // Calculate age
    let age = currentYear - birthYear;
    const hasHadBirthdayThisYear = (todayMonth > birthMonth) || (todayMonth === birthMonth && todayDay >= birthDay);
    if (!hasHadBirthdayThisYear) {
      age--;
    }
    const ageText = isYearUnknown ? 'Idade não informada' : `${age} anos`;

    const bdayThisYear = new Date(currentYear, birthMonth - 1, birthDay);

    const bdayInfo = {
      ...p,
      birthDay,
      birthMonth,
      birthYear,
      ageText,
      isYearUnknown
    };

    // Filter by search term
    if (searchTerm.trim() !== '') {
      const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = p.department.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchName && !matchDept) return;
    }

    // Categorize
    if (birthMonth === todayMonth && birthDay === todayDay) {
      todayBirthdays.push(bdayInfo);
    } else if (bdayThisYear >= startOfWeek && bdayThisYear <= endOfWeek) {
      weekBirthdays.push(bdayInfo);
    } else if (birthMonth === todayMonth) {
      monthBirthdays.push(bdayInfo);
    }
  });

  // Sort by day of month (tie-break: nome alfabético determinístico)
  const sortByDay = (a: any, b: any) => a.birthDay - b.birthDay || compareByName(a, b);
  todayBirthdays.sort(sortByDay);
  weekBirthdays.sort(sortByDay);
  monthBirthdays.sort(sortByDay);

  // Aniversariantes do mês selecionado (seletor de mês)
  const selectedMonthBirthdays: any[] = [];
  peopleInScope.forEach(p => {
    if (!p.birthDate) return;
    const parts = p.birthDate.split('-');
    if (parts.length < 3) return;
    const birthYear = parseInt(parts[0]);
    const birthMonth = parseInt(parts[1]);
    const birthDay = parseInt(parts[2]);
    if (birthMonth !== selectedMonth) return;
    const isYearUnknown = birthYear === 1900;
    let age = currentYear - birthYear;
    const hasHadBirthdayThisYear = (todayMonth > birthMonth) || (todayMonth === birthMonth && todayDay >= birthDay);
    if (!hasHadBirthdayThisYear) age--;
    const ageText = isYearUnknown ? 'Idade não informada' : `${age} anos`;
    if (searchTerm.trim() !== '') {
      const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = p.department.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchName && !matchDept) return;
    }
    selectedMonthBirthdays.push({ ...p, birthDay, birthMonth, birthYear, ageText, isYearUnknown });
  });
  selectedMonthBirthdays.sort(sortByDay);

  const getWhatsAppLink = (person: any) => {
    if (!person.phone) return '#';
    const message = getBirthdayWhatsAppMessage(session.name, person.name);
    const cleanPhone = person.phone.replace(/\D/g, '');
    return `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(message)}`;
  };

  const getMonthName = (monthNum: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[monthNum - 1] || '';
  };

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="view-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2>Aniversariantes</h2>
          <p className="subtitle">
            {isScoped 
              ? `Aniversariantes do seu departamento: ${myDept}`
              : 'Lista geral de aniversariantes da congregação'
            }
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0 0.6rem' }}>
            <Calendar size={16} style={{ color: 'var(--power-muted)', flexShrink: 0 }} />
            <select
              className="form-control"
              style={{ border: 'none', boxShadow: 'none', background: 'transparent', padding: '0.55rem 0.25rem', maxWidth: '100%', fontSize: '0.85rem', cursor: 'pointer' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              title="Selecionar mês"
            >
              <option value={todayMonth}>Mês Atual ({getMonthName(todayMonth)})</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{getMonthName(m)}</option>
              ))}
            </select>
          </div>
          <div className="search-input-wrapper" style={{ maxWidth: '300px', flex: '1 1 220px', minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--power-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Buscar por nome ou depto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {selectedMonth === todayMonth ? (
        <>
      {/* 1. ANIVERSARIANTES DO DIA (Golden Prominent Highlight) */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Sparkles size={20} style={{ color: '#fbbf24' }} />
          Hoje ({todayBirthdays.length})
        </h3>
        
        {todayBirthdays.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px,100%), 1fr))', gap: '1.25rem' }}>
            {todayBirthdays.map(p => (
              <div 
                key={p.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(217, 119, 6, 0.20) 100%)',
                  border: '2px solid #fbbf24',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 10px 15px -3px rgba(251, 191, 36, 0.1), 0 4px 6px -2px rgba(251, 191, 36, 0.05)',
                  animation: 'pulse 3s infinite'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Gift size={32} style={{ color: 'var(--power-orange)', flexShrink: 0 }} aria-hidden="true" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#78350f' }}>{p.name}</h4>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', fontWeight: 600, color: '#b45309' }}>
                      {p.role} • {!p.isYearUnknown && p.ageText}
                    </p>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.725rem', color: '#d97706' }}>
                      Depto: <strong>{p.department}</strong>
                    </p>
                  </div>
                </div>

                {p.phone && (
                  <a 
                    href={getWhatsAppLink(p)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      borderColor: '#10b981',
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      textDecoration: 'none',
                      width: 'auto',
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    <MessageSquare size={14} />
                    Parabéns
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--power-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum aniversariante hoje no escopo selecionado.</p>
          </div>
        )}
      </div>

      {/* 2. ANIVERSARIANTES DA SEMANA (Silver/Blue Highlight) */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--power-orange)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Gift size={20} style={{ color: 'var(--power-orange)' }} />
          Esta Semana ({weekBirthdays.length})
        </h3>

        {weekBirthdays.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px,100%), 1fr))', gap: '1rem' }}>
            {weekBirthdays.map(p => (
              <div 
                key={p.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 97, 1, 0.10) 0%, #dbeafe 100%)',
                  border: '1px solid #bfdbfe',
                  borderRadius: '14px',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Calendar size={26} style={{ color: 'var(--power-orange)', flexShrink: 0 }} aria-hidden="true" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e40af' }}>{p.name}</h4>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#d94f00' }}>
                      Dia {p.birthDay}/{p.birthMonth} • {!p.isYearUnknown && p.ageText}
                    </p>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', color: '#ff9a5f' }}>
                      {p.role} • {p.department.split(' ')[0]}
                    </p>
                  </div>
                </div>

                {p.phone && (
                  <a 
                    href={getWhatsAppLink(p)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary btn-small"
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      borderColor: 'var(--power-orange)',
                      color: 'var(--power-orange)',
                      padding: '0.4rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      textDecoration: 'none',
                      width: 'auto'
                    }}
                  >
                    <MessageSquare size={13} />
                    Felicitar
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--power-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum aniversariante esta semana.</p>
          </div>
        )}
      </div>

      {/* 3. ANIVERSARIANTES DO MÊS (Month List) */}
      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--power-white)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Calendar size={20} style={{ color: 'var(--power-muted)' }} />
          Restante do Mês de {getMonthName(todayMonth)} ({monthBirthdays.length})
        </h3>

        {monthBirthdays.length > 0 ? (
          <div className="attendance-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {monthBirthdays.map(p => (
              <div 
                key={p.id}
                className="attendance-card"
                style={{
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                  <Gift size={20} style={{ color: 'var(--power-orange)', flexShrink: 0 }} aria-hidden="true" />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)', marginLeft: '0.75rem' }}>
                      Dia {p.birthDay} • {!p.isYearUnknown && p.ageText} • Depto: {p.department}
                    </span>
                  </div>
                </div>

                {p.phone && (
                  <a 
                    href={getWhatsAppLink(p)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary btn-small"
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      padding: '0.35rem 0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      textDecoration: 'none',
                      width: 'auto'
                    }}
                  >
                    <MessageSquare size={12} />
                    Enviar Parabéns
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--power-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum outro aniversariante para o restante de {getMonthName(todayMonth)}.</p>
          </div>
        )}
      </div>
        </>
      ) : (
        /* 3b. ANIVERSARIANTES DO MÊS SELECIONADO (todos os dias, do início ao fim do mês) */
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--power-white)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calendar size={20} style={{ color: 'var(--power-muted)' }} />
            Aniversariantes de {getMonthName(selectedMonth)} ({selectedMonthBirthdays.length})
          </h3>
          {selectedMonthBirthdays.length > 0 ? (
            <div className="attendance-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedMonthBirthdays.map(p => (
                <div
                  key={p.id}
                  className="attendance-card"
                  style={{
                    padding: '0.75rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                    <Gift size={20} style={{ color: 'var(--power-orange)', flexShrink: 0 }} aria-hidden="true" />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)', marginLeft: '0.75rem' }}>
                        Dia {p.birthDay} • {!p.isYearUnknown && p.ageText} • Depto: {p.department}
                      </span>
                    </div>
                  </div>
                  {p.phone && (
                    <a
                      href={getWhatsAppLink(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-small"
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '0.35rem 0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        textDecoration: 'none',
                        width: 'auto'
                      }}
                    >
                      <MessageSquare size={12} />
                      Enviar Parabéns
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--power-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum aniversariante em {getMonthName(selectedMonth)} no escopo selecionado.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
