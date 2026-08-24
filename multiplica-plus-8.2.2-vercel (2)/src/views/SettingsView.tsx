import { getLocalDateISO } from '../utils/localDate';
import { generateUUID, hashPassword } from '../services/db';
// src/views/SettingsView.tsx
import { useState, useEffect } from 'react';
import type { AppDatabase, MonthlyGoal, UserSession } from '../services/db';
import { apiDownloadServerBackup } from '../services/api';
import { Target, AlertTriangle, Key, ShieldAlert, Download, Upload, Database, RefreshCw, Play, FileText, Moon, Sun, CloudDownload } from 'lucide-react';

interface SettingsViewProps {
  db: AppDatabase;
  session: UserSession;
  onResetData: () => void;
  onUpdateGoals: (newGoals: MonthlyGoal[]) => void;
  onUpdateDatabase?: (newDB: AppDatabase) => void;
  onForcePull?: () => void;
  onForcePush?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  db, 
  session, 
  onResetData, 
  onUpdateGoals,
  onUpdateDatabase,
  onForcePull,
  onForcePush
}) => {
  const isPastor = session.role === 'Pastor' || session.role === 'Pastor Admin';
  const [targetMembers, setTargetMembers] = useState(db.goals[db.goals.length - 1]?.targetMembers || 20);
  const [targetRate, setTargetRate] = useState(db.goals[db.goals.length - 1]?.targetAttendanceRate || 85);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Database Optimizer States
  const [optimizeLog, setOptimizeLog] = useState<string[]>([]);
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [serverBackupLoading, setServerBackupLoading] = useState(false);

  const handleDownloadServerBackup = async () => {
    if (serverBackupLoading) return;
    setServerBackupLoading(true);
    try {
      await apiDownloadServerBackup();
      setSuccessMsg('Backup do servidor (Supabase) baixado com sucesso!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Erro ao baixar backup do servidor: ' + (e?.message || e));
    } finally {
      setServerBackupLoading(false);
    }
  };

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Aplica o tema salvo ao carregar a página (persistência do modo dia/noite)
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const handleToggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleUpdateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPastor) return;

    const currentMonth = '2026-06';
    const existingIndex = db.goals.findIndex(g => g.month === currentMonth);
    let updated = [...db.goals];

    const newGoal: MonthlyGoal = {
      month: currentMonth,
      targetMembers,
      targetAttendanceRate: targetRate
    };

    if (existingIndex >= 0) {
      updated[existingIndex] = newGoal;
    } else {
      updated.push(newGoal);
    }

    onUpdateGoals(updated);
    setSuccessMsg('Metas de Junho atualizadas com sucesso!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `multiplica_plus_backup_${getLocalDateISO()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("Atenção: Isso irá substituir COMPLETAMENTE todos os seus dados locais pelo arquivo de backup selecionado. Deseja continuar?")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.people && parsed.departments && parsed.attendances) {
          if (onUpdateDatabase) {
            onUpdateDatabase(parsed);
            alert("Backup restaurado com sucesso localmente!");
          }
        } else {
          alert("Arquivo inválido. Formato de backup incorreto.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo de backup.");
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleExportAuditDoc = () => {
    if (!db.activityLogs || db.activityLogs.length === 0) {
      alert('Não há registros de auditoria para exportar.');
      return;
    }

    const fileName = `relatorio_auditoria_multiplica_plus_${getLocalDateISO()}.doc`;
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório de Auditoria - Multiplica PLUS</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { color: #1f2937; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #d1d5db; padding: 8px 10px; }
    th { background: #f3f4f6; text-align: left; }
    tr:nth-child(even) { background: #f9fafb; }
  </style>
</head>
<body>
  <h1>Relatório de Auditoria - Multiplica PLUS</h1>
  <p>Geração: ${new Date().toLocaleString('pt-BR')}</p>
  <p>Total de registros: ${db.activityLogs.length}</p>
  <table>
    <thead>
      <tr>
        <th>Data / Hora</th>
        <th>Usuário</th>
        <th>Ação</th>
      </tr>
    </thead>
    <tbody>
      ${db.activityLogs.map(log => `
        <tr>
          <td>${new Date(log.timestamp).toLocaleString('pt-BR')}</td>
          <td>${log.recordedByName} (${log.recordedBy})</td>
          <td>${log.action}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOptimizeDatabase = async () => {
    if (!onUpdateDatabase) return;
    const log: string[] = [];
    log.push("Iniciando otimização e reparo do banco de dados...");
    let fixedDepts = 0;
    let fixedPasswords = 0;
    let cleanedNames = 0;
    let cleanedPhones = 0;

    // Valid departments list
    const deptNames = db.departments.map(d => d.name);

    const hashedDefaultPassword = await hashPassword('mudar123');

    const optimizedPeople = await Promise.all(db.people.map(async (p) => {
      let updated = { ...p };
      
      // 1. Clean phone number
      const originalPhone = p.phone || '';
      const cleanPhone = originalPhone.replace(/\D/g, '');
      if (cleanPhone !== originalPhone) {
        updated.phone = cleanPhone;
        cleanedPhones++;
      }

      // 2. Normalize name
      const originalName = p.name || '';
      const cleanName = originalName.trim().replace(/\s+/g, ' ');
      if (cleanName !== originalName) {
        updated.name = cleanName;
        cleanedNames++;
      }

      // 3. Move members in invalid/deleted departments to default department
      if (!deptNames.includes(p.department)) {
        updated.department = db.departments[0]?.name || 'Integração / Discipulado (Geral IEAD-JK)';
        fixedDepts++;
      }

      // 4. Clean provisory passwords for leaders/multipliers if blank
      if (p.role !== 'Membro' && !p.password) {
        updated.password = hashedDefaultPassword;
        updated.passwordChanged = false;
        fixedPasswords++;
      }

      return updated;
    }));

    log.push(`✓ Telefones corrigidos/higienizados: ${cleanedPhones}`);
    log.push(`✓ Nomes com espaçamentos corrigidos: ${cleanedNames}`);
    log.push(`✓ Membros com departamento inválido realocados: ${fixedDepts}`);
    log.push(`✓ Senhas provisórias de líderes corrigidas: ${fixedPasswords}`);
    log.push("✓ Varredura e otimização de banco local concluída.");
    log.push("Otimização gravada localmente com sucesso! Pronto para sincronizar.");

    onUpdateDatabase({ ...db, people: optimizedPeople });
    setOptimizeLog(log);
    setShowOptimizeModal(true);
  };

  const handleRestoreAttendance = (id: string) => {
    if (!onUpdateDatabase) return;
    
    const record = db.attendances.find(a => a.id === id);
    if (!record) return;
    
    if (confirm(`Deseja restaurar a chamada de ${record.department} do dia ${record.date.split('-').reverse().join('/')}?`)) {
      const updated = db.attendances.map(a =>
        a.id === id ? { ...a, deleted: false } : a
      );
      
      const parts = record.date.split('-');
      const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      const logMsg = `Restaurou chamada de ${record.department.split(' ')[0]} no dia ${formattedDate}`;
      
      let updatedLogs = db.activityLogs || [];
      if (session) {
        const newLog = {
          id: 'log_' + generateUUID(),
          recordedBy: session.code,
          recordedByName: session.name,
          recordedByRole: session.role,
          action: logMsg,
          timestamp: new Date().toISOString()
        };
        updatedLogs = [newLog, ...updatedLogs];
      }
      
      onUpdateDatabase({
        ...db,
        attendances: updated,
        activityLogs: updatedLogs
      });
      
      localStorage.setItem('pm_pending_sync', 'true');
      alert('Chamada restaurada com sucesso!');
    }
  };

  return (
    <div className="animate-fade">
      <div className="view-header">
        <div>
          <h2>Configurações do Sistema</h2>
          <p className="subtitle">Configurações administrativas, metas de crescimento e controle de dados</p>
        </div>
      </div>

      <div className="responsive-split">
        {/* Metas configurator (Only Pastor) */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={20} style={{ color: 'var(--power-orange)' }} />
            Definir Metas do Mês (Junho)
          </h3>

          {isPastor ? (
            <form onSubmit={handleUpdateGoal}>
              <div className="form-group">
                <label htmlFor="goal-members">Meta de Membros Ativos</label>
                <input
                  id="goal-members"
                  type="number"
                  className="form-control"
                  value={targetMembers}
                  onChange={(e) => setTargetMembers(parseInt(e.target.value) || 0)}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="goal-rate">Meta de Frequência Média (%)</label>
                <input
                  id="goal-rate"
                  type="number"
                  className="form-control"
                  value={targetRate}
                  onChange={(e) => setTargetRate(parseInt(e.target.value) || 0)}
                  min="1"
                  max="100"
                  required
                />
              </div>

              {successMsg && (
                <div style={{ color: '#10b981', background: '#ecfdf5', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                  {successMsg}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ fontSize: '0.9rem', padding: '0.75rem' }}>
                Atualizar Metas
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--power-raised)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--power-muted)' }}>
              <ShieldAlert size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span>Apenas os pastores da congregação possuem permissão para redefinir as metas de crescimento mensal.</span>
            </div>
          )}
        </div>

        {/* Administrar dados e logins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Credentials lookup */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={18} style={{ color: 'var(--power-orange)' }} />
              Controle de Credenciais
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginBottom: '1rem' }}>
              Códigos de acesso locais da congregação IEAD-JK:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', background: 'var(--power-raised)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div><strong>PASTOR_WAGNER</strong>: Pr. Wagner (Dirigente Local)</div>
              <div><strong>PASTOR_DIRCEU</strong>: Pr. Dirceu (Segundo Dirigente)</div>
              <div><strong>SEC_LUANA</strong>: Luana (Secretária Geral)</div>
              <div><strong>LIDER_THIAGO</strong>: Pb. Thiago (Líder Jovens)</div>
              <div><strong>LIDER_REGINALDO</strong>: Dc. Reginaldo (Líder Adol.)</div>
              <div><strong>LIDER_LEIDIANE</strong>: Leidiane (Líder Irmãs)</div>
              <div><strong>MULT_JHONATAN</strong>: Jovem Jhonatan (Multiplicador Jovens)</div>
            </div>

            {isPastor && (
              <div className="glass-card" style={{ marginTop: '1.5rem', border: '1px solid #fed7aa', background: 'rgba(255, 237, 213, 0.4)' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ff9a5f' }}>
                  <ShieldAlert size={20} />
                  Zona de Risco Administrativo
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#9a3412', marginBottom: '1rem' }}>
                  Ações críticas que podem afetar o funcionamento do sistema e a sincronização.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%), 1fr))', gap: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onForcePull}
                    style={{ background: '#f97316', borderColor: '#ea580c', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
                    title="Baixar a versão mais recente do banco de dados na nuvem e sobrescrever o local"
                  >
                    <Download size={16} />
                    Forçar Download (Pull)
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onForcePush}
                    style={{ background: '#ea580c', borderColor: '#ff9a5f', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
                    title="Enviar somente operações identificadas na fila offline; o Supabase continua sendo a fonte oficial"
                  >
                    <Upload size={16} />
                    Sincronizar Pendências
                  </button>
                </div>
              </div>
            )}
            {isPastor && (
              <div className="glass-card" style={{ marginTop: '1.5rem', borderLeft: '4px solid #10b981' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                  <RefreshCw size={20} />
                  Recuperar Chamadas Excluídas
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#047857', marginBottom: '1rem' }}>
                  Abaixo estão listadas as chamadas do departamento que foram excluídas recentemente. Você pode restaurá-las de volta para o sistema.
                </p>

                {(() => {
                  const deletedAtts = db.attendances.filter(a => a.deleted);
                  if (deletedAtts.length === 0) {
                    return (
                      <div style={{ fontSize: '0.85rem', color: 'var(--power-muted)', background: 'var(--power-raised)', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                        Nenhuma chamada excluída na lixeira.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
                      {deletedAtts.map(att => {
                        const parts = att.date.split('-');
                        const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                        return (
                          <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--power-raised)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-main)' }}>{att.department}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)' }}>Data: {formattedDate} | {att.presentIds?.length || 0} presentes</span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => handleRestoreAttendance(att.id)}
                              style={{ color: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem' }}
                            >
                              <RefreshCw size={14} />
                              Restaurar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Theme Toggle (For everyone) */}
            <div className="glass-card" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-main)' }}>
                {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                Aparência do Sistema
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                Alterne entre o modo claro e o modo escuro para melhor conforto visual.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleToggleTheme}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: theme === 'dark' ? 'var(--power-muted)' : 'white' }}
              >
                {theme === 'dark' ? (
                  <>
                    <Sun size={16} /> Mudar para Modo Claro
                  </>
                ) : (
                  <>
                    <Moon size={16} /> Mudar para Modo Escuro
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="glass-card" style={{ borderTop: '4px solid var(--color-danger)' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
              <AlertTriangle size={18} />
              Zona de Perigo
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginBottom: '1.25rem' }}>
              Apaga todos os dados e histórico salvos, retornando ao estado inicial do aplicativo.
            </p>

            {/* Botão de reset local (disponível para todos - útil para testes) */}
            <button
              onClick={() => {
                if (window.confirm('⚠️ ATENÇÃO: Isso vai apagar TODOS os dados locais (membros, chamadas, configurações) e recarregar o app com os dados iniciais da v7.5.\n\nDeseja continuar?')) {
                  localStorage.removeItem('multiplica_plus_db');
                  localStorage.removeItem('pm_last_app_version');
                  localStorage.removeItem('pm_sync_queue');
                  localStorage.removeItem('pm_people_sync_queue');
                  localStorage.removeItem('pm_pending_sync');
                  localStorage.removeItem('pm_server_revision');
                  localStorage.removeItem('pm_last_synced_at');
                  localStorage.removeItem('pm_last_migrated_version');
                  localStorage.removeItem('pm_schema_version');
                  localStorage.removeItem('pm_version_migration_report');
                  localStorage.removeItem('pm_pre_update_checkpoint');
                  localStorage.removeItem('pm_update_target_version');
                  alert('Dados locais limpos! Recarregando...');
                  window.location.reload();
                }
              }}
              className="btn btn-danger"
              style={{ fontSize: '0.9rem', padding: '0.75rem', marginBottom: '1rem', background: '#f97316', borderColor: '#ea580c' }}
            >
              <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
              Resetar Dados Locais (Teste v7.5)
            </button>

            {/* Botão específico para carregar REDENÇÃO completo */}
            <button
              onClick={() => {
                if (window.confirm('📋 Carregar TODOS os 97 membros da REDENÇÃO + 4 chamadas (13/06, 27/06, 02/08, 15/08)?\n\nIsso vai:\n1. Limpar dados locais\n2. Carregar 97 membros (Reginaldo + 96)\n3. Carregar 4 chamadas com presença total\n4. Recarregar o app\n\nDeseja continuar?')) {
                  // Limpar tudo
                  localStorage.removeItem('multiplica_plus_db');
                  localStorage.removeItem('pm_last_app_version');
                  localStorage.removeItem('pm_sync_queue');
                  localStorage.removeItem('pm_people_sync_queue');
                  localStorage.removeItem('pm_pending_sync');
                  localStorage.removeItem('pm_server_revision');
                  localStorage.removeItem('pm_last_synced_at');
                  localStorage.removeItem('pm_last_migrated_version');
                  localStorage.removeItem('pm_schema_version');
                  localStorage.removeItem('pm_version_migration_report');
                  localStorage.removeItem('pm_pre_update_checkpoint');
                  localStorage.removeItem('pm_update_target_version');
                  localStorage.removeItem('pm_data_generation');
                  localStorage.removeItem('pm_pending_data_generation');
                  localStorage.removeItem('pm_generation_reset_at');
                  localStorage.removeItem('pm_generation_activated_at');
                  
                  alert('✅ Dados limpos! Recarregando com 97 membros REDENÇÃO + 4 chamadas...');
                  window.location.reload();
                }
              }}
              className="btn btn-primary"
              style={{ fontSize: '0.9rem', padding: '0.75rem', marginBottom: '1rem', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderColor: '#d97706' }}
            >
              <Download size={16} style={{ marginRight: '0.5rem' }} />
              Carregar REDENÇÃO Completo (97 membros + 4 chamadas)
            </button>

            {isPastor ? (
              <button onClick={onResetData} className="btn btn-danger" style={{ fontSize: '0.9rem', padding: '0.75rem' }}>
                Redefinir Banco de Dados (Completo)
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', padding: '1rem', borderRadius: '12px', border: '1px solid #fee2e2', fontSize: '0.85rem', color: '#ef4444' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                <span>Esta operação é altamente destrutiva e é restrita aos Pastores Titulares da igreja.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Panel (Only for Pastor Wagner) */}
      {isPastor && (
        <div className="glass-card" style={{ marginTop: '2rem', borderLeft: '4px solid var(--power-orange)' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--power-orange)' }}>
            <ShieldAlert size={20} />
            Painel do Administrador Geral (Pr. Wagner)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginBottom: '1.5rem' }}>
            Ferramentas avançadas para o Pastor Wagner Camargos gerenciar backups, sincronizar em lote e auditar integridade de dados.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%), 1fr))', gap: '1rem' }}>
            {/* Backup Actions */}
            <div style={{ background: 'var(--power-raised)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Database size={16} style={{ color: 'var(--power-orange)' }} />
                Backups JSON
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-small" onClick={handleExportBackup} style={{ display: 'flex', width: '100%', justifyContent: 'center', gap: '0.35rem', background: 'rgba(15, 23, 42, 0.6)' }}>
                  <Download size={14} />
                  Exportar Backup JSON
                </button>
                <label className="btn btn-secondary btn-small" style={{ display: 'flex', width: '100%', justifyContent: 'center', gap: '0.35rem', background: 'rgba(15, 23, 42, 0.6)', cursor: 'pointer', margin: 0 }}>
                  <Upload size={14} />
                  Importar Backup JSON
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportBackup} />
                </label>
                <button className="btn btn-secondary btn-small" onClick={handleDownloadServerBackup} disabled={serverBackupLoading} style={{ display: 'flex', width: '100%', justifyContent: 'center', gap: '0.35rem', background: 'rgba(255, 97, 1, 0.10)', borderColor: '#bfdbfe', color: '#d94f00', fontWeight: 700 }}>
                  <CloudDownload size={14} />
                  {serverBackupLoading ? 'Gerando backup...' : 'Baixar Backup do Servidor (Supabase)'}
                </button>
              </div>
            </div>
            <div style={{ background: 'var(--power-raised)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FileText size={16} style={{ color: 'var(--power-orange)' }} />
                Relatório de Auditoria
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--power-muted)', marginBottom: '1rem' }}>
                Gere um arquivo Word com o histórico das alterações feitas por login.
              </p>
              <button className="btn btn-secondary btn-small" onClick={handleExportAuditDoc} style={{ display: 'flex', width: '100%', justifyContent: 'center', gap: '0.35rem', background: 'rgba(15, 23, 42, 0.6)' }}>
                <FileText size={14} />
                Exportar Documento DOC
              </button>
            </div>

            {/* Sync Actions */}
            <div style={{ background: 'var(--power-raised)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <RefreshCw size={16} style={{ color: 'var(--power-orange)' }} />
                Sincronizações Forçadas
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {onForcePush && (
                  <button className="btn btn-secondary btn-small" onClick={onForcePush} style={{ display: 'flex', width: '100%', justifyContent: 'center', gap: '0.35rem', background: 'rgba(15, 23, 42, 0.6)' }}>
                    <Upload size={14} style={{ color: 'var(--power-orange)' }} />
                    Sincronizar Pendências (Fila → Supabase)
                  </button>
                )}
                {onForcePull && (
                  <button className="btn btn-secondary btn-small" onClick={onForcePull} style={{ display: 'flex', width: '100%', justifyContent: 'center', gap: '0.35rem', background: 'rgba(15, 23, 42, 0.6)' }}>
                    <Download size={14} style={{ color: '#10b981' }} />
                    Reconstruir Cache (Supabase → Local)
                  </button>
                )}
              </div>
            </div>

            {/* Optimizer Action */}
            <div style={{ background: 'var(--power-raised)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Play size={16} style={{ color: '#eab308' }} />
                  Higienizar & Otimizar Banco
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--power-muted)', marginBottom: '1rem' }}>
                  Formata números, corrige nomes e realoca departamentos inconsistentes de forma automática.
                </p>
              </div>
              <button className="btn btn-primary btn-small" onClick={handleOptimizeDatabase} style={{ width: '100%', background: 'linear-gradient(135deg, var(--power-orange) 0%, var(--power-orange) 100%)', border: 'none' }}>
                <Database size={14} />
                Executar Otimização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optimize Modal Log */}
      {showOptimizeModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Relatório de Otimização</h3>
              <button className="modal-close" onClick={() => setShowOptimizeModal(false)}>&times;</button>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.5)', color: '#38bdf8', padding: '1rem', borderRadius: '12px', fontFamily: 'monospace', fontSize: '0.8rem', minHeight: '150px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {optimizeLog.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-small" onClick={() => setShowOptimizeModal(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
