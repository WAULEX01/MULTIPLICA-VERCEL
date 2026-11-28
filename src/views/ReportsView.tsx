// src/views/ReportsView.tsx
import { getLocalDateISO } from '../utils/localDate';
import { useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import type { AppDatabase, UserSession } from '../services/db';
import { personInDepartment, canUserSelectDepartment, getUserAllowedDepartments, getDepartmentTheme, compareByName } from '../services/db';
import { getCachedRadarAttendanceIndex } from '../utils/radarAttendanceIndex';
import { buildReportAttendanceSummary } from '../utils/reportAttendanceSummary';
import { FileSpreadsheet, Download, Eye, Award, Printer, MessageSquare, AlertTriangle } from 'lucide-react';
import { getDynamicHumanMessage, getNeutralWhatsAppMessage } from '../services/genderMsg';

interface ReportsViewProps {
  db: AppDatabase;
  session: UserSession;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ db, session }) => {
  const isRestricted = session.role === 'Líder' || session.role === 'Multiplicador';
  const [selectedDept, setSelectedDept] = useState(session.department || 'Todos');
  const [showRedemptionReport, setShowRedemptionReport] = useState(false);
  const [absenceWeeksFilter, setAbsenceWeeksFilter] = useState<string>('all');
  const [previewLimit, setPreviewLimit] = useState(60);
  const [printAllRows, setPrintAllRows] = useState(false);

  useEffect(() => {
    if (session.department) {
      setSelectedDept(session.department);
    }
  }, [session.department]);

  useEffect(() => { setPreviewLimit(60); }, [selectedDept]);

  // Índice único por snapshot: uma chamada é lida uma vez, independentemente
  // da quantidade de membros. Mantém a comparação exata de departamento usada
  // antes para "Presenças" e "Reuniões"; faltas seguem a regra pastoral do Radar.
  const attendanceTotals = useMemo(
    () => buildReportAttendanceSummary(db.attendances),
    [db.attendances],
  );

  const today = getLocalDateISO();
  const attendanceIndex = useMemo(
    () => getCachedRadarAttendanceIndex(db.attendances, today),
    [db.attendances, today],
  );

  const scopedPeople = useMemo(() => db.people.filter(
    p => p.status !== 'Arquivado' && p.status !== 'Inativo' && p.status !== 'Visitante' &&
      (selectedDept === 'Todos' || personInDepartment(p, selectedDept)) && !p.deleted
  ), [db.people, selectedDept]);

  const reportData = useMemo(() => scopedPeople.map(p => {
    const effectiveDept = selectedDept !== 'Todos' ? selectedDept : (p.department || '');
    const totalMeetings = effectiveDept
      ? (attendanceTotals.meetingsByDept.get(effectiveDept) || 0)
      : attendanceTotals.allMeetings;
    const totalAttendances = effectiveDept
      ? (attendanceTotals.presenceByDept.get(effectiveDept)?.get(p.id) || 0)
      : (attendanceTotals.allPresence.get(p.id) || 0);
    const consecutiveAbsences = attendanceIndex.calculateAbsences(
      p.id, effectiveDept, p.startDate || '2026-01-01'
    );

    let alertStatus = 'Frequente';
    if (consecutiveAbsences === 1) alertStatus = 'Atenção (1 Falta)';
    else if (consecutiveAbsences === 2) alertStatus = 'Importante (2 Faltas)';
    else if (consecutiveAbsences >= 3) alertStatus = 'Urgente (3+ Faltas)';

    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      department: p.department,
      totalMeetings,
      totalAttendances,
      consecutiveAbsences,
      alertStatus
    };
  }).sort((a, b) => compareByName(a, b)),
  [scopedPeople, selectedDept, attendanceTotals, attendanceIndex]);

  const portalReportOverview = useMemo(() => {
    const noConsecutiveAbsences = reportData.filter(row => row.consecutiveAbsences === 0).length;
    const oneWeek = reportData.filter(row => row.consecutiveAbsences === 1).length;
    const twoWeeks = reportData.filter(row => row.consecutiveAbsences === 2).length;
    const threePlus = reportData.filter(row => row.consecutiveAbsences >= 3).length;
    const noPhone = reportData.filter(row => !row.phone?.trim()).length;
    return {
      total: reportData.length,
      threePlus,
      withAbsences: oneWeek + twoWeeks + threePlus,
      noPhone,
      distribution: [
        { label: 'Sem falta consecutiva', count: noConsecutiveAbsences, tone: 'green' },
        { label: '1 semana', count: oneWeek, tone: 'gold' },
        { label: '2 semanas', count: twoWeeks, tone: 'orange' },
        { label: '3 ou mais semanas', count: threePlus, tone: 'red' },
      ],
    };
  }, [reportData]);

  const portalRedemptionSummary = useMemo(() => {
    const department = 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE';
    const people = db.people.filter(p => !p.deleted && p.department === department);
    const calls = db.attendances.filter(a => !a.deleted && a.department === department);
    const leaders = people.filter(p => p.role === 'Líder').map(p => p.name).join(', ');
    return { people: people.length, calls: calls.length, leaders };
  }, [db.people, db.attendances]);

  // CSV sempre inclui todos os membros. Só a tabela de pré-visualização
  // renderiza progressivamente para evitar centenas de <tr> no Android.
  const visibleReportData = useMemo(
    () => printAllRows ? reportData : reportData.slice(0, previewLimit),
    [reportData, previewLimit, printAllRows],
  );

  const handlePrint = () => {
    // A impressão/PDF preserva a lista completa, mesmo com prévia paginada.
    flushSync(() => setPrintAllRows(true));
    window.addEventListener('afterprint', () => setPrintAllRows(false), { once: true });
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Nome Completo',
      'Telefone',
      'Departamento',
      'Reuniões Totais',
      'Presenças Registradas',
      'Ausências Consecutivas',
      'Status de Alerta'
    ];

    const rows = reportData.map(row => [
      row.name,
      row.phone ? row.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : 'Sem telefone',
      row.department,
      row.totalMeetings.toString(),
      row.totalAttendances.toString(),
      row.consecutiveAbsences.toString(),
      row.alertStatus
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const fileSuffix = selectedDept === 'Todos' ? 'geral' : selectedDept.split(' ')[0].toLowerCase();
    
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_multiplica_plus_${fileSuffix}_${getLocalDateISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getAlertBadgeClass = (status: string) => {
    if (status.includes('Atenção')) return 'badge-warning';
    if (status.includes('Importante')) return 'badge-warning'; // Orange/Yellow warn style
    if (status.includes('Urgente')) return 'badge-danger';
    return 'badge-active';
  };

  // Filter absentees for the custom report based on adjustable consecutive absences threshold
  const filteredAbsentees = reportData.filter(r => {
    if (absenceWeeksFilter === '1') return r.consecutiveAbsences === 1;
    if (absenceWeeksFilter === '2') return r.consecutiveAbsences === 2;
    if (absenceWeeksFilter === '3') return r.consecutiveAbsences === 3;
    if (absenceWeeksFilter === '4_plus') return r.consecutiveAbsences >= 4;
    return r.consecutiveAbsences >= 1;
  });

  const handleCopyAbsenteesToWhatsApp = () => {
    const filterLabel = absenceWeeksFilter === '1' ? '1 Semana Exata' : absenceWeeksFilter === '2' ? '2 Semanas Exatas' : absenceWeeksFilter === '3' ? '3 Semanas Exatas' : absenceWeeksFilter === '4_plus' ? '4+ Semanas Críticas' : 'Todas as Faltas';
    const title = `Relatório de Ausentes (${filterLabel}) - ${selectedDept === 'Todos' ? 'Geral' : selectedDept}`;
    const header = `*${title}*\n\n*Nome | Link WhatsApp*\n`;
    
    const body = filteredAbsentees.map(r => {
      const cleanPhone = r.phone ? r.phone.replace(/\D/g, '') : '';
      const link = cleanPhone ? `wa.me/55${cleanPhone}` : 'Sem telefone';
      const absencesText = `(${r.consecutiveAbsences} ${r.consecutiveAbsences === 1 ? 'semana' : 'semanas'} de falta)`;
      return `${r.name} | ${link} ${absencesText}`;
    }).join('\n');

    const text = header + body;
    // Robust copy: try modern Clipboard API first, fall back to textarea for mobile
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text)
        .then(() => alert(`Lista de ${filteredAbsentees.length} faltosos copiada com sucesso!`))
        .catch(() => {
          fallbackCopy(text, filteredAbsentees.length);
        });
    } else {
      fallbackCopy(text, filteredAbsentees.length);
    }
  };

  const fallbackCopy = (text: string, count: number) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      const success = document.execCommand('copy');
      if (success) alert(`Lista de ${count} faltosos copiada com sucesso!`);
      else alert('Não foi possível copiar. Selecione o texto manualmente.');
    } catch {
      alert('Não foi possível copiar. Selecione o texto manualmente.');
    }
    document.body.removeChild(ta);
  };

  return (
    <div className="animate-fade ebd-reports-page">
      <div className="view-header ebd-reports-heading">
        <div>
          <span className="ebd-page-eyebrow">ANÁLISE E PRESTAÇÃO DE CONTAS</span>
          <h2>Relatórios ministeriais</h2>
          <p className="subtitle">Consulte indicadores, acompanhe a frequência e exporte dados conforme seu departamento.</p>
        </div>
      </div>

      <section className="ebd-reports-overview" aria-label="Indicadores do relatório">
        <article className="ebd-reports-metric">
          <span>Pessoas no relatório</span><strong>{portalReportOverview.total}</strong>
          <small>Escopo: {selectedDept === 'Todos' ? 'todos os departamentos' : selectedDept}</small>
        </article>
        <article className="ebd-reports-metric">
          <span>Com ausências seguidas</span><strong>{portalReportOverview.withAbsences}</strong>
          <small>Uma ou mais semanas</small>
        </article>
        <article className="ebd-reports-metric">
          <span>Prioridade pastoral</span><strong>{portalReportOverview.threePlus}</strong>
          <small>Três ou mais semanas</small>
        </article>
        <article className="ebd-reports-metric">
          <span>Sem telefone informado</span><strong>{portalReportOverview.noPhone}</strong>
          <small>Cadastros para conferir</small>
        </article>
      </section>

      <section className="ebd-reports-distribution" aria-label="Distribuição de ausências consecutivas">
        <div className="ebd-reports-distribution-heading">
          <div><span className="ebd-page-eyebrow">LEITURA DOS DADOS</span><h3>Distribuição das ausências</h3></div>
          <span>Base: {portalReportOverview.total} pessoas</span>
        </div>
        <div className="ebd-reports-bars">
          {portalReportOverview.distribution.map(group => (
            <div className="ebd-reports-bar-row" key={group.label}>
              <div className="ebd-reports-bar-meta"><span>{group.label}</span><strong>{group.count}</strong></div>
              <div className="ebd-reports-bar-track" role="img" aria-label={`${group.label}: ${group.count} pessoas`}>
                <div className={`ebd-reports-bar-fill ${group.tone}`} style={{ width: `${portalReportOverview.total ? Math.round(100 * group.count / portalReportOverview.total) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="responsive-split split-14-06 ebd-reports-layout">
        {/* Visualização Prévia */}
        <div className="glass-card ebd-reports-preview">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={18} style={{ color: 'var(--power-orange)' }} />
              Pré-visualização da Planilha Geral
            </h3>

            {(canUserSelectDepartment(session, db) || !isRestricted) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--power-muted)', fontWeight: 600 }}>Filtrar Dept:</span>
                <select
                  className="form-control"
                  style={{ 
                    padding: '0.4rem 1.75rem 0.4rem 0.85rem', 
                    width: 'auto', 
                    maxWidth: '100%',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderColor: getDepartmentTheme(selectedDept).primary,
                    color: getDepartmentTheme(selectedDept).badgeText,
                    background: getDepartmentTheme(selectedDept).bgLight
                  }}
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  {!isRestricted && <option value="Todos">Todos os departamentos</option>}
                  {getUserAllowedDepartments(session, db).map(dName => (
                    <option key={dName} value={dName}>{dName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <p className="ebd-reports-scroll-hint">No celular, deslize a tabela para os lados para visualizar todas as colunas.</p>
          <div className="ebd-reports-table-scroll" style={{ overflowX: 'auto', maxHeight: '350px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {reportData.length > 0 ? (
              <table className="custom-table ebd-reports-table" style={{ fontSize: '0.85rem', minWidth: '580px' }}>
                <caption className="ebd-visually-hidden">Relatório de presença e ausências dos membros selecionados</caption>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Departamento</th>
                    <th style={{ textAlign: 'center' }}>Presenças</th>
                    <th style={{ textAlign: 'center' }}>Faltas Seguidas</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReportData.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>{row.name}</td>
                      <td>{row.phone ? row.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : <span style={{ color: '#ef4444' }}>Sem telefone</span>}</td>
                      <td>{row.department.split(' ')[0]}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.totalAttendances} / {row.totalMeetings}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: row.consecutiveAbsences > 0 ? 'var(--color-danger)' : 'inherit' }}>
                        {row.consecutiveAbsences}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${getAlertBadgeClass(row.alertStatus)}`} style={{ fontSize: '0.65rem' }}>
                          {row.alertStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--power-muted)' }}>
                Nenhum registro encontrado para exportar.
              </p>
            )}
          </div>
          {visibleReportData.length < reportData.length && (
            <button type="button" className="btn btn-secondary btn-sm reports-hide-print"
              style={{ marginTop: '0.75rem', width: '100%' }}
              onClick={() => setPreviewLimit(limit => Math.min(limit + 60, reportData.length))}>
              Carregar mais membros ({visibleReportData.length} de {reportData.length})
            </button>
          )}
        </div>

        {/* Informações de Exportação */}
        <div className="glass-card ebd-reports-export" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet size={18} style={{ color: '#10b981' }} />
              Exportar dados (CSV)
            </h3>
            <p className="subtitle">Gere o arquivo CSV formatado</p>
          </div>

          <div className="reports-hide-print" style={{ background: 'var(--power-raised)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--power-muted)' }}>
            <p style={{ fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Award size={14} style={{ color: 'var(--power-orange)' }} />
              Resumo do Relatório:
            </p>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>Total de membros em escopo: <strong>{scopedPeople.length}</strong></li>
              <li>Departamento: <strong>{selectedDept}</strong></li>
              <li>Chamadas computadas: <strong>{db.attendances.filter(a => !a.deleted && (selectedDept === 'Todos' || a.department === selectedDept)).length} registros</strong></li>
            </ul>
          </div>

          <button
            onClick={handleExportCSV}
            className="btn btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)'
            }}
            disabled={reportData.length === 0}
          >
            <Download size={18} />
            Baixar Relatório CSV
          </button>

          <button
            onClick={handlePrint}
            className="btn btn-secondary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'rgba(15, 23, 42, 0.6)'
            }}
            disabled={reportData.length === 0}
          >
            <Printer size={18} />
            Imprimir Relatório (PDF)
          </button>

          <p className="reports-hide-print" style={{ fontSize: '0.75rem', color: 'var(--power-muted)', textAlign: 'center', lineHeight: 1.4 }}>
            O arquivo gerado é compatível com o Microsoft Excel brasileiro, utilizando codificação com assinatura de BOM para não quebrar a acentuação dos nomes.
          </p>
        </div>
      </div>

      {/* Relatório Específico REDENÇÃO */}
      <div className="glass-card ebd-reports-special" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
              <Award size={20} style={{ color: 'var(--power-orange)' }} />
              Relatório de Frequência - REDENÇÃO DA CRIANÇA E DO ADOLESCENTE
            </h3>
            <p className="subtitle">Acompanhamento específico com {portalRedemptionSummary.people} pessoas cadastradas</p>
          </div>

          <button
            onClick={() => setShowRedemptionReport(!showRedemptionReport)}
            className="btn btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              background: showRedemptionReport ? 'rgba(15, 23, 42, 0.6)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              boxShadow: showRedemptionReport ? 'none' : '0 4px 15px rgba(245, 158, 11, 0.3)'
            }}
          >
            <Eye size={18} />
            {showRedemptionReport ? 'Ocultar Relatório' : 'Visualizar Relatório REDENÇÃO'}
          </button>
        </div>

        {showRedemptionReport && (
          <div className="ebd-reports-table-scroll" style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {(() => {
              const redemptionPeople = db.people.filter(
                p => !p.deleted && p.department === 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE'
              ).sort((a, b) => compareByName(a, b));

              const redemptionAttendances = db.attendances.filter(
                a => !a.deleted && a.department === 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE'
              ).sort((a, b) => a.date.localeCompare(b.date));

              return redemptionPeople.length > 0 ? (
                <table className="custom-table ebd-reports-table" style={{ fontSize: '0.85rem', minWidth: '700px' }}>
                  <caption className="ebd-visually-hidden">Frequência de participantes do departamento Redenção</caption>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Telefone</th>
                      <th>Função</th>
                      <th style={{ textAlign: 'center' }}>Total Chamadas</th>
                      <th style={{ textAlign: 'center' }}>Presenças</th>
                      <th style={{ textAlign: 'center' }}>Faltas</th>
                      <th style={{ textAlign: 'center' }}>% Frequência</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redemptionPeople.map(p => {
                      const presentCount = redemptionAttendances.filter(a => a.presentIds.includes(p.id)).length;
                      const totalMeetings = redemptionAttendances.length;
                      const absences = totalMeetings - presentCount;
                      const frequency = totalMeetings > 0 ? Math.round((presentCount / totalMeetings) * 100) : 0;
                      
                      let statusBadge = 'badge-active';
                      let statusText = 'Regular';
                      if (frequency >= 80) {
                        statusBadge = 'badge-active';
                        statusText = 'Excelente';
                      } else if (frequency >= 60) {
                        statusBadge = 'badge-warning';
                        statusText = 'Atenção';
                      } else if (frequency > 0) {
                        statusBadge = 'badge-danger';
                        statusText = 'Crítico';
                      } else {
                        statusBadge = 'badge-muted';
                        statusText = 'Sem registro';
                      }

                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>{p.name}</td>
                          <td>{p.phone ? p.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : <span style={{ color: '#ef4444' }}>Sem telefone</span>}</td>
                          <td>{p.role || 'Membro'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalMeetings}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{presentCount}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>{absences}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{frequency}%</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${statusBadge}`} style={{ fontSize: '0.65rem' }}>
                              {statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--power-muted)' }}>
                  Nenhum membro encontrado no departamento REDENÇÃO.
                </p>
              );
            })()}
          </div>
        )}

        {!showRedemptionReport && (
          <div style={{ 
            background: 'var(--power-raised)', 
            padding: '2rem', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <Award size={48} style={{ color: 'var(--power-orange)', marginBottom: '1rem' }} />
            <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-text-main)' }}>Relatório de Frequência REDENÇÃO</h4>
            <p style={{ color: 'var(--power-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Abra o relatório para consultar o histórico de chamadas e a frequência a partir dos registros existentes.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <strong style={{ color: '#10b981' }}>{portalRedemptionSummary.people} Pessoas</strong>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <strong style={{ color: '#f59e0b' }}>{portalRedemptionSummary.calls} Chamadas</strong>
              </div>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <strong style={{ color: '#3b82f6' }}>Liderança: {portalRedemptionSummary.leaders || 'Não cadastrada'}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Relatório Dinâmico de Faltosos (Novo Recurso) */}
      <div className="glass-card ebd-reports-absentees" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
              <AlertTriangle size={20} style={{ color: '#ef4444' }} />
              Relatório Dinâmico de Faltosos (Resgate por WhatsApp)
            </h3>
            <p className="subtitle">Filtre membros com ausências seguidas e copie a lista estruturada para o WhatsApp</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {(canUserSelectDepartment(session, db) || !isRestricted) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--power-muted)', fontWeight: 600 }}>Depto:</span>
                <select
                  className="form-control"
                  style={{ 
                    padding: '0.4rem 1.75rem 0.4rem 0.85rem', 
                    width: 'auto', 
                    maxWidth: '100%',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderColor: getDepartmentTheme(selectedDept).primary,
                    color: getDepartmentTheme(selectedDept).badgeText,
                    background: getDepartmentTheme(selectedDept).bgLight
                  }}
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  {!isRestricted && <option value="Todos">Todos os Departamentos</option>}
                  {getUserAllowedDepartments(session, db).map(dName => (
                    <option key={dName} value={dName}>{dName}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--power-muted)', fontWeight: 600 }}>Semanas:</span>
              <select
                value={absenceWeeksFilter}
                onChange={(e) => setAbsenceWeeksFilter(e.target.value)}
                className="form-control"
                style={{ width: 'auto', maxWidth: '100%', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              >
                <option value="all">Todas as Semanas (1+)</option>
                <option value="1">🟡 Apenas 1 Semana de Falta</option>
                <option value="2">🟠 Apenas 2 Semanas de Falta</option>
                <option value="3">🔴 Apenas 3 Semanas de Falta</option>
                <option value="4_plus">🚨 4+ Semanas (Crítico)</option>
              </select>
            </div>

            <button
              onClick={handleCopyAbsenteesToWhatsApp}
              className="btn btn-secondary"
              style={{ width: 'auto', maxWidth: '100%', padding: '0.45rem 1rem', fontSize: '0.85rem', background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              disabled={filteredAbsentees.length === 0}
            >
              <MessageSquare size={14} style={{ color: 'var(--power-orange)' }} />
              Copiar Ausentes (WhatsApp)
            </button>
          </div>
        </div>

        <div className="ebd-reports-table-scroll" style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {filteredAbsentees.length > 0 ? (
            <table className="custom-table ebd-reports-table" style={{ fontSize: '0.85rem', minWidth: '520px' }}>
              <caption className="ebd-visually-hidden">Relatório de pessoas com ausências consecutivas</caption>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Departamento</th>
                  <th style={{ textAlign: 'center' }}>Faltas Consecutivas</th>
                  <th style={{ textAlign: 'center' }}>Mensagem Individual</th>
                </tr>
              </thead>
              <tbody>
                {filteredAbsentees.map(r => {
                  const cleanPhone = r.phone ? r.phone.replace(/\D/g, '') : '';
                  const rawMsg = getNeutralWhatsAppMessage(r.name);
                  const waText = encodeURIComponent(rawMsg);
                  const waLink = cleanPhone ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${waText}` : null;
                  
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>{r.name}</td>
                      <td>{r.phone ? r.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : <span style={{ color: '#ef4444' }}>Sem telefone</span>}</td>
                      <td>{r.department}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                        {r.consecutiveAbsences} {r.consecutiveAbsences === 1 ? 'semana' : 'semanas'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-small"
                            style={{ display: 'inline-flex', padding: '0.3rem 0.6rem', fontSize: '0.75rem', gap: '0.25rem', borderColor: '#10b981', color: '#10b981', background: 'rgba(15, 23, 42, 0.6)' }}
                          >
                            <MessageSquare size={12} />
                            Enviar
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)', fontStyle: 'italic' }}>Falta telefone</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--power-muted)', fontStyle: 'italic' }}>
              Nenhum membro encontrado sob os filtros selecionados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
