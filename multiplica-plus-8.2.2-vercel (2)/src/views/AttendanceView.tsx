// src/views/AttendanceView.tsx
import { getLocalDateISO } from '../utils/localDate';
import { useState, useEffect, useRef } from 'react';
import type { AppDatabase, AttendanceRecord, UserSession } from '../services/db';
import { personInDepartment, generateUUID, getUserAllowedDepartments, canUserSelectDepartment, getDepartmentTheme, getVisibleDepartments, getPersonSubGroup } from '../services/db';
import { Save, Clock, Trash2, ShieldAlert, Check, Edit, Users, ChevronDown, ChevronUp, CheckCircle, XCircle, Zap } from 'lucide-react';

// Ordenação determinística de nomes: remove acentos e caixa e compara pelos
// code points — garante a MESMA ordem em qualquer dispositivo/navegador.
const normalizeForSort = (s: string = '') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const compareByName = (a: { name: string }, b: { name: string }) => {
  const na = normalizeForSort(a.name);
  const nb = normalizeForSort(b.name);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
};

const getAttendanceTypeLabel = (t: string): string => {
  switch (t) {
    case 'Domingo': return 'Domingo (Celebração)';
    case 'EBD': return 'Domingo (EBD / Manhã)';
    case 'Segunda': return 'Segunda (Culto no Lar)';
    case 'Terça': return 'Terça (Círculo de Oração)';
    case 'Quarta': return 'Quarta (Culto de Ensino)';
    case 'Quinta': return 'Quinta (Vitória)';
    case 'Sexta': return 'Sexta (Culto no Lar)';
    case 'Sábado': return 'Sábado (Culto de Sábado)';
    default: return 'Outra Data (Manual)';
  }
};

const getAttendanceTypeShortLabel = (t: string): string => {
  switch (t) {
    case 'Domingo': return 'Dom ⛪';
    case 'EBD': return 'EBD ☀️';
    case 'Segunda': return 'Seg 🏠';
    case 'Terça': return 'Ter 🙏';
    case 'Quarta': return 'Qua 📖';
    case 'Quinta': return 'Qui 🏆';
    case 'Sexta': return 'Sex 🏠';
    case 'Sábado': return 'Sáb 🎉';
    default: return 'Man 📝';
  }
};

const getAttendanceTypeBadgeStyle = (t: string): { bg: string, color: string } => {
  switch (t) {
    case 'Domingo': return { bg: '#dbeafe', color: 'var(--power-orange)' };
    case 'EBD': return { bg: 'rgba(217, 119, 6, 0.20)', color: '#d97706' };
    case 'Segunda': return { bg: 'rgba(255, 97, 1, 0.10)', color: 'var(--power-orange)' };
    case 'Terça': return { bg: '#ecfdf5', color: '#059669' };
    case 'Quarta': return { bg: '#e0f2fe', color: '#ff9a5f' };
    case 'Quinta': return { bg: 'rgba(255, 97, 1, 0.28)', color: '#ea580c' };
    case 'Sexta': return { bg: 'rgba(255, 97, 1, 0.10)', color: 'var(--power-orange)' };
    case 'Sábado': return { bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--power-muted)' };
    default: return { bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--power-muted)' };
  }
};

interface AttendanceViewProps {
  db: AppDatabase;
  session: UserSession;
  onUpdateAttendances: (newAttendances: AttendanceRecord[]) => void;
  initialDepartmentFilter?: string;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ db, session, onUpdateAttendances, initialDepartmentFilter }) => {
  const isRestricted = session.role === 'Líder' || session.role === 'Multiplicador';
  const canSelectDept = canUserSelectDepartment(session, db);
  const allowedDepts = getUserAllowedDepartments(session, db);
  const [selectedDept, setSelectedDept] = useState(
    initialDepartmentFilter || (allowedDepts.includes(session.department || '') ? session.department || '' : allowedDepts[0] || getVisibleDepartments(db)[0]?.name || '')
  );

  // Líder/Multiplicador: começa no próprio departamento da sessão quando ele é um dos seus.
  // Como agora o seletor fica disponível (como o Pastor), ele pode trocar para outro
  // departamento seu a qualquer momento sem ser forçado de volta.
  useEffect(() => {
    if (isRestricted && session.department) {
      const myDepts = getUserAllowedDepartments(session, db);
      if (myDepts.includes(session.department)) {
        setSelectedDept(session.department);
        setPresentIds([]);
        setExpandedRecordId(null);
      }
    }
  }, [isRestricted, session.department]);

  // Tab State: 'register' for creating/updating a call, 'history' for list of past calls
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  
  // View Mode for History: 'grid' (spreadsheet with green/red dots) or 'cards' (list with details)
  const [viewMode, setViewMode] = useState<'cards' | 'grid'>('grid');

  // Time Range Filter: 'all', 'this-month', '3-months', '6-months'
  const [timeRange, setTimeRange] = useState<'this-month' | '3-months' | '6-months' | 'all'>('all');

  // Form State helpers
  const getMostRecentDateForDayOfWeek = (targetDayOfWeek: number) => {
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    let diff = currentDayOfWeek - targetDayOfWeek;
    if (diff < 0) diff += 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - diff);
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getTodayType = (): 'Domingo' | 'EBD' | 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Manual' => {
    const day = new Date().getDay();
    switch (day) {
      case 0: return 'Domingo';
      case 1: return 'Segunda';
      case 2: return 'Terça';
      case 3: return 'Quarta';
      case 4: return 'Quinta';
      case 5: return 'Sexta';
      case 6: return 'Sábado';
      default: return 'Domingo';
    }
  };

  const getTodayStr = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const initialDate = getTodayStr();
  const initialType = getTodayType();

  // Form State
  const [type, setType] = useState<'Domingo' | 'EBD' | 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Manual'>(initialType);
  const [date, setDate] = useState(initialDate);
  
  // Track check-in IDs
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  // Grupo A/B tabs — only for Atalaias de Cristo department
  const [groupTab, setGroupTab] = useState<'grupoA' | 'grupoB' | 'outros'>('grupoA');

  // Standard Membros/Outros filter — for all other departments
  const [roleFilter, setRoleFilter] = useState<'membros' | 'outros'>('membros');

  // Subgrupo (ex.: 'Huperetes') — filtro extra para departamentos unificados
  const [subGroupFilter, setSubGroupFilter] = useState<string>('todos');

  // Track expanded record details in history tab
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const activeDeptPeople = db.people.filter(
    p => p.status === 'Ativo' && !p.deleted && personInDepartment(p, selectedDept)
  );

  // Subgrupos disponíveis no departamento selecionado (ex.: 'Huperetes' após fusão)
  const availableSubGroups = Array.from(new Set(
    activeDeptPeople.map(p => getPersonSubGroup(p, selectedDept)).filter(Boolean) as string[]
  ));

  // Flag: is this the Atalaias de Cristo department?
  const isAtalaias = selectedDept.toLowerCase().includes('atalaia');

  // --- Atalaias: alphabetical split into Grupo A and Grupo B ---
  const sortedMembers = activeDeptPeople
    .filter(p => p.role === 'Membro')
    .sort(compareByName);
  const midPoint = Math.ceil(sortedMembers.length / 2);
  const groupAMembers = sortedMembers.slice(0, midPoint);
  const groupBMembers = sortedMembers.slice(midPoint);
  const otherProfiles = activeDeptPeople
    .filter(p => p.role !== 'Membro')
    .sort(compareByName);
  const currentGroupList =
    groupTab === 'grupoA' ? groupAMembers
    : groupTab === 'grupoB' ? groupBMembers
    : otherProfiles;

  // --- Standard departments: Membros or Outros ---
  const filteredDeptPeople = activeDeptPeople.filter(p =>
    roleFilter === 'membros' ? p.role === 'Membro' : p.role !== 'Membro'
  );

  // Aplica o filtro de subgrupo (ex.: separar Huperetes) sobre o filtro de perfil
  const subgroupFiltered = subGroupFilter === 'todos'
    ? filteredDeptPeople
    : filteredDeptPeople.filter(p => getPersonSubGroup(p, selectedDept) === subGroupFilter);

  // The active list for select-all depends on which mode we're in
  const activeList = isAtalaias ? currentGroupList : subgroupFiltered;

  // Total exibido no cabeçalho da lista (respeita o filtro de subgrupo)
  const headerTotal = isAtalaias ? activeDeptPeople.length : (subGroupFilter === 'todos' ? activeDeptPeople.length : subgroupFiltered.length);

  // Ref sempre atualizada com o db mais recente (incluindo dados do último poll).
  // Usa-se esta ref em vez do prop `db` no saveAttendance para evitar que um
  // polling recente que ainda não causou re-render faça o patch excluir
  // presenças de outro aparelho (por comparar snapshots defasados).
  const latestDbRef = useRef(db);
  latestDbRef.current = db;

  // v8.2: agrupa cliques muito rápidos da chamada em um único push. A marcação
  // visual continua instantânea; o Supabase recebe o lote final após 180 ms.
  // Isso reduz conflitos/rajadas sem perder a sensação de tempo real.
  const attendanceSaveTimerRef = useRef<number | null>(null);
  const pendingAttendancesRef = useRef<AttendanceRecord[] | null>(null);

  // ═══════════ SALVAMENTO AUTOMÁTICO + CHAMADA COLABORATIVA AO VIVO ═══════════
  // ID determinístico: dois aparelhos abrindo uma chamada NOVA para a mesma
  // data + departamento precisam apontar para o MESMO registro no Supabase.
  // Sem isso cada aparelho gerava um UUID diferente e criava duas chamadas.
  const getCanonicalAttendanceId = (attendanceDate: string, department: string, attendanceType: string) => {
    const key = `${attendanceDate}|${department.trim().toLocaleLowerCase('pt-BR')}|${attendanceType.trim().toLocaleLowerCase('pt-BR')}`;
    let hash = 2166136261; // FNV-1a 32-bit
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `att_${attendanceDate.replace(/-/g, '')}_${(hash >>> 0).toString(36)}`;
  };

  // Persiste imediatamente a lista de presentes no banco e no servidor a cada clique,
  // para que outra pessoa que esteja editando a mesma chamada veja as mudanças em tempo real.
  const saveAttendance = (ids: string[], immediate = false) => {
    if (activeDeptPeople.length === 0) return;
    const todayStr = getLocalDateISO();
    if (date > todayStr) return;

    // O patch de presença é calculado como ADD/REMOVE e o servidor faz merge
    // atômico. Não fazemos união manual aqui: isso impediria que uma remoção
    // feita em outro aparelho desaparecesse corretamente desta tela.
    const snapDb = latestDbRef.current;
    const mergedIds = Array.from(new Set(ids));

    const existingIndex = snapDb.attendances.findIndex(
      a => a.date === date && a.department === selectedDept && a.type === type
    );

    let updated = [...snapDb.attendances];
    // Remove quaisquer duplicatas existentes (mesma data+departamento) para limpar registros fantasmas
    updated = updated.filter(a => !(a.date === date && a.department === selectedDept && a.type === type && a.id !== snapDb.attendances[existingIndex]?.id));

    const newRecord: AttendanceRecord = {
      id: existingIndex >= 0 ? snapDb.attendances[existingIndex].id : getCanonicalAttendanceId(date, selectedDept, type),
      date,
      type,
      department: selectedDept,
      presentIds: mergedIds,
      // v8.2: salvar novamente uma chamada excluída restaura o mesmo registro
      // lógico, em vez de mantê-lo invisível como tombstone.
      deleted: false
    };

    if (existingIndex >= 0) {
      // Recalcular índice após o filtro
      const newIndex = updated.findIndex(a => a.id === newRecord.id);
      if (newIndex >= 0) {
        updated[newIndex] = newRecord;
      } else {
        updated.push(newRecord);
      }
    } else {
      updated.push(newRecord);
    }

    pendingAttendancesRef.current = updated;
    if (attendanceSaveTimerRef.current) window.clearTimeout(attendanceSaveTimerRef.current);
    const flush = () => {
      const pending = pendingAttendancesRef.current;
      pendingAttendancesRef.current = null;
      attendanceSaveTimerRef.current = null;
      if (pending) onUpdateAttendances(pending);
    };
    if (immediate) flush();
    else attendanceSaveTimerRef.current = window.setTimeout(flush, 180);
  };

  // IDs que este aparelho desmarcou explicitamente nesta sessão.
  // Evita que o merge remoto re-adicione alguém que foi desmarcado por aqui.
  const localRemovedRef = useRef<Set<string>>(new Set());

  // Sinal visual de que OUTRO aparelho está editando a mesma chamada agora.
  const [liveEditSignal, setLiveEditSignal] = useState<string | null>(null);

  const handleTogglePerson = (personId: string) => {
    let nextIds: string[];
    if (presentIds.includes(personId)) {
      localRemovedRef.current.add(personId);
      nextIds = presentIds.filter(id => id !== personId);
    } else {
      localRemovedRef.current.delete(personId);
      nextIds = [...presentIds, personId];
    }
    setPresentIds(nextIds);
    saveAttendance(nextIds);
  };

  const handleSelectAll = () => {
    const ids = activeList.map(p => p.id);
    ids.forEach(id => localRemovedRef.current.delete(id));
    const nextIds = Array.from(new Set([...presentIds, ...ids]));
    setPresentIds(nextIds);
    saveAttendance(nextIds);
  };

  const handleDeselectAll = () => {
    const ids = activeList.map(p => p.id);
    ids.forEach(id => localRemovedRef.current.add(id));
    const nextIds = presentIds.filter(id => !ids.includes(id));
    setPresentIds(nextIds);
    saveAttendance(nextIds);
  };

  // Colaboração em tempo real: o DB recebido já contém o estado canônico do
  // Supabase + overlay da Outbox local. Por isso podemos substituir a lista local
  // diretamente e refletir tanto ADIÇÕES quanto REMOÇÕES de outro aparelho.
  useEffect(() => {
    const existing = db.attendances.find(a => !a.deleted && a.date === date && a.department === selectedDept && a.type === type);
    if (!existing) {
      // v8.2: se outro aparelho excluir a chamada que está aberta aqui,
      // limpe imediatamente a presença local. Antes a tela mantinha a chamada
      // fantasma até um refresh manual.
      setPresentIds(prev => {
        if (prev.length === 0) return prev;
        setLiveEditSignal('Esta chamada foi removida em outro aparelho.');
        setTimeout(() => setLiveEditSignal(null), 4000);
        return [];
      });
      return;
    }
    const canonicalIds = Array.from(new Set(existing.presentIds || []));
    setPresentIds(prev => {
      const prevSet = new Set(prev);
      const changed = canonicalIds.length !== prev.length || canonicalIds.some(id => !prevSet.has(id));
      if (changed) {
        setLiveEditSignal('Outra pessoa atualizou esta chamada...');
        setTimeout(() => setLiveEditSignal(null), 4000);
        return canonicalIds;
      }
      return prev;
    });
  }, [db.attendances, date, selectedDept, type]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeDeptPeople.length === 0) return;

    const todayStr = getLocalDateISO();
    if (date > todayStr) {
      alert('Não é possível registrar presenças para cultos futuros.');
      return;
    }

    // v8.2: o botão confirma sem tirar o usuário da chamada. Assim é possível
    // corrigir/editar e salvar novamente quantas vezes forem necessárias.
    saveAttendance(presentIds, true);
    setSuccessMessage('Chamada salva. Você pode continuar editando e salvar novamente.');
    setTimeout(() => setSuccessMessage(''), 1800);
  };

  // Load attendance if it exists for the selected date and department.
  // Mesclagem de Frequência: se o membro recebeu presença em OUTRO departamento na mesma data,
  // ele já vale como presente neste departamento ("se colocou em um, já vale para os dois").
  const handleLoadExistingForDateAndDept = (dateVal: string, deptVal: string, typeVal: string) => {
    const existing = db.attendances.find(
      a => !a.deleted && a.date === dateVal && a.department === deptVal && a.type === typeVal
    );

    // IDs de pessoas presentes em qualquer outro departamento na mesma data
    const presentInOtherDepts = new Set<string>(
      db.attendances
        .filter(a => !a.deleted && a.date === dateVal && a.type === typeVal && a.department !== deptVal && a.presentIds)
        .flatMap(a => a.presentIds)
    );

    // Apenas IDs de membros que pertencem a este departamento (evita marcar quem não é do dept)
    const deptMemberIds = activeDeptPeople.map(p => p.id);
    const mergedFromOtherDepts = deptMemberIds.filter(id => presentInOtherDepts.has(id));

    if (existing) {
      const mergedIds = Array.from(new Set([...existing.presentIds, ...mergedFromOtherDepts]));
      setPresentIds(mergedIds);
      setType(existing.type);
    } else {
      const mergedIds = Array.from(new Set(mergedFromOtherDepts));
      setPresentIds(mergedIds);
    }
  };

  useEffect(() => {
    // Cada nova chamada (nova data ou departamento) começa sem desmarcações locais pendentes
    localRemovedRef.current.clear();
    setSubGroupFilter('todos');
    handleLoadExistingForDateAndDept(date, selectedDept, type);
  }, [date, selectedDept, type]);

  const handleTypeChange = (newType: 'Domingo' | 'EBD' | 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Manual') => {
    setType(newType);
    setGroupTab('grupoA');
    setRoleFilter('membros');
    setSubGroupFilter('todos');
    if (newType !== 'Manual') {
      let targetDay = 0; // Sunday
      if (newType === 'Segunda') targetDay = 1;
      else if (newType === 'Terça') targetDay = 2;
      else if (newType === 'Quarta') targetDay = 3;
      else if (newType === 'Quinta') targetDay = 4;
      else if (newType === 'Sexta') targetDay = 5;
      else if (newType === 'Sábado') targetDay = 6;
      else if (newType === 'EBD') targetDay = 0; // Sunday
      
      const newDate = getMostRecentDateForDayOfWeek(targetDay);
      setDate(newDate);
    }
  };

  const handleStartTodayCall = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    setDate(todayStr);
    
    const dayOfWeek = now.getDay();
    
    if (dayOfWeek === 0) { // Sunday
      const confirmEbd = window.confirm("Hoje é Domingo!\n\nClique em [OK] para criar chamada da EBD (Manhã)\nou [Cancelar] para criar chamada do Culto de Celebração (Noite).");
      if (confirmEbd) {
        handleTypeChange('EBD');
      } else {
        handleTypeChange('Domingo');
      }
    } else {
      const typeMap: { [day: number]: typeof type } = {
        1: 'Segunda',
        2: 'Terça',
        3: 'Quarta',
        4: 'Quinta',
        5: 'Sexta',
        6: 'Sábado'
      };
      const autoType = typeMap[dayOfWeek];
      if (autoType) {
        handleTypeChange(autoType);
      }
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja apagar esta lista de chamada?')) {
      const updated = db.attendances.map(a => a.id === id ? { ...a, deleted: true } : a);
      onUpdateAttendances(updated);
      if (expandedRecordId === id) {
        setExpandedRecordId(null);
      }
    }
  };

  // Switch to register tab and load the selected record for editing
  const handleEditRecord = (record: AttendanceRecord) => {
    setSelectedDept(record.department);
    setDate(record.date);
    setType(record.type);
    setPresentIds(record.presentIds);
    setGroupTab('grupoA');
    setRoleFilter('membros');
    setActiveTab('register');
  };

  // Filter history by time range helper
  const filterByTimeRange = (records: AttendanceRecord[]) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    return records.filter(r => {
      // Parse YYYY-MM-DD in local time
      const parts = r.date.split('-');
      if (parts.length !== 3) return true;
      const rYear = parseInt(parts[0], 10);
      const rMonth = parseInt(parts[1], 10) - 1; // 0-11
      const rDay = parseInt(parts[2], 10);
      
      const rDate = new Date(rYear, rMonth, rDay);
      if (isNaN(rDate.getTime())) return true;

      if (timeRange === 'this-month') {
        // Services within the current calendar month
        return rYear === currentYear && rMonth === currentMonth;
      }
      if (timeRange === '3-months') {
        // Services within the last 3 calendar months (from the 1st day of month 3 months ago)
        const start = new Date(currentYear, currentMonth - 3, 1);
        return rDate >= start;
      }
      if (timeRange === '6-months') {
        // Services within the last 6 calendar months (from the 1st day of month 6 months ago)
        const start = new Date(currentYear, currentMonth - 6, 1);
        return rDate >= start;
      }
      return true; // 'all' - desde o início
    });
  };

  // v8.2: histórico lógico estável. Registros legados duplicados com a mesma
  // data + departamento + tipo aparecem como uma única chamada, preservando a
  // união das presenças. O banco original não é apagado por esta visualização.
  const deptHistory = Array.from(
    db.attendances
      .filter(a => !a.deleted && a.department === selectedDept)
      .reduce((map, a) => {
        const key = `${a.date}|${a.department}|${a.type}`;
        const previous = map.get(key);
        if (!previous) {
          map.set(key, { ...a, presentIds: Array.from(new Set(a.presentIds || [])) });
        } else {
          const previousTs = new Date(previous.updatedAt || 0).getTime() || 0;
          const currentTs = new Date(a.updatedAt || 0).getTime() || 0;
          const preferred = currentTs >= previousTs ? a : previous;
          map.set(key, {
            ...preferred,
            presentIds: Array.from(new Set([...(previous.presentIds || []), ...(a.presentIds || [])]))
          });
        }
        return map;
      }, new Map<string, AttendanceRecord>())
      .values()
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 2. Filtered history based on chosen time range
  const filteredHistory = filterByTimeRange(deptHistory);

  // 3. For the grid view, we show them chronologically (oldest first)
  const gridHistory = [...filteredHistory].reverse();

  return (
    <div className="animate-fade">
      <div className="view-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2>Frequência & Chamadas</h2>
          <p className="subtitle">Gerencie a presença dos membros e consulte o histórico de cultos anteriores</p>
        </div>
      </div>

      {/* Department Selector at the Top */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Users size={18} style={{ color: 'var(--power-orange)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
            Departamento Selecionado:
          </span>
        </div>
        
        {canSelectDept ? (
          <select
            className="form-control"
            style={{
              padding: '0.45rem 1rem',
              width: 'auto',
              minWidth: '240px',
              fontSize: '0.85rem',
              fontWeight: 700,
              border: `2px solid ${getDepartmentTheme(selectedDept).primary}`,
              color: getDepartmentTheme(selectedDept).badgeText,
              background: getDepartmentTheme(selectedDept).bgLight
            }}
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPresentIds([]);
              setExpandedRecordId(null);
              setGroupTab('grupoA');
              setRoleFilter('membros');
            }}
          >
            {allowedDepts.map(dName => (
              <option key={dName} value={dName}>{dName}</option>
            ))}
          </select>
        ) : (
          <span style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: getDepartmentTheme(selectedDept).badgeText,
            background: getDepartmentTheme(selectedDept).bgLight,
            padding: '0.4rem 0.85rem',
            borderRadius: '8px',
            border: `2px solid ${getDepartmentTheme(selectedDept).primary}`
          }}>
            {selectedDept}
          </span>
        )}
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--power-line)', marginBottom: '1.5rem', gap: '1rem' }}>
        <button
          onClick={() => {
            setActiveTab('register');
            handleStartTodayCall();
          }}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'register' ? '3px solid var(--power-orange)' : '3px solid transparent',
            color: activeTab === 'register' ? 'var(--power-orange)' : 'var(--power-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s'
          }}
        >
          <Save size={16} />
          Registrar Chamada
        </button>

        {session.role !== 'Multiplicador' && (
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid var(--power-orange)' : '3px solid transparent',
              color: activeTab === 'history' ? 'var(--power-orange)' : 'var(--power-muted)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <Clock size={16} />
            Cultos Anteriores ({deptHistory.length})
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'register' ? (
        <div className="glass-card animate-fade">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px dashed var(--power-line)', paddingBottom: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--power-muted)', fontWeight: 600 }}>Parâmetros da Chamada</span>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              style={{
                background: 'linear-gradient(135deg, var(--power-orange) 0%, #d94f00 100%)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)'
              }}
              onClick={handleStartTodayCall}
            >
              <Zap size={14} /> Fazer Chamada Hoje
            </button>
          </div>
          <form onSubmit={handleSave}>
            {/* Indicador de salvamento automático + colaboração ao vivo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#059669', background: '#ecfdf5', border: '1px solid rgba(5, 150, 105, 0.25)', padding: '0.35rem 0.75rem', borderRadius: '50px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Zap size={13} /> Salvamento automático a cada clique
              </span>
              {liveEditSignal && (
                <span style={{ fontSize: '0.8rem', color: 'var(--power-orange)', background: 'rgba(255, 97, 1, 0.10)', border: '1px solid rgba(124, 58, 237, 0.25)', padding: '0.35rem 0.75rem', borderRadius: '50px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', animation: 'pulse 1.5s ease-in-out infinite' }}>
                  <Users size={13} /> {liveEditSignal}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="att-date">Data da Chamada</label>
                <input
                  id="att-date"
                  type="date"
                  className="form-control"
                  value={date}
                  disabled={type !== 'Manual'}
                  max={getLocalDateISO()}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="att-type">Tipo de Culto</label>
                <select
                  id="att-type"
                  className="form-control"
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value as any)}
                >
                  <option value="Domingo">Domingo (Celebração)</option>
                  <option value="EBD">Domingo (EBD / Manhã)</option>
                  <option value="Segunda">Segunda (Culto no Lar)</option>
                  <option value="Terça">Terça (Círculo de Oração)</option>
                  <option value="Quarta">Quarta (Culto de Ensino)</option>
                  <option value="Quinta">Quinta (Vitória)</option>
                  <option value="Sexta">Sexta (Culto no Lar)</option>
                  <option value="Sábado">Sábado (Culto de Sábado)</option>
                  <option value="Manual">Outra Data (Manual)</option>
                </select>
              </div>
            </div>

            {/* Chamada Rápida */}
            {activeDeptPeople.length > 0 && (
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={handleSelectAll}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(15, 23, 42, 0.6)' }}
                >
                  Marcar Todos Presentes
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={handleDeselectAll}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', background: 'rgba(15, 23, 42, 0.6)' }}
                >
                  Marcar Todos Faltaram
                </button>
              </div>
            )}

            {/* Checklist */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h4 style={{ marginBottom: '1.25rem', color: 'var(--power-orange)', fontSize: '1rem', fontWeight: 700 }}>
                Lista de Frequência ({presentIds.length} presentes de {headerTotal} no total)
              </h4>

              {/* ── ATALAIAS DE CRISTO: Grupo A / Grupo B / Outros Perfis ── */}
              {isAtalaias && activeDeptPeople.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', padding: '0.25rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', width: 'fit-content', flexWrap: 'wrap' }}>
                    {([
                      { key: 'grupoA', label: `Grupo A (${groupAMembers.length})`, color: 'var(--power-orange)' },
                      { key: 'grupoB', label: `Grupo B (${groupBMembers.length})`, color: 'var(--power-orange)' },
                      { key: 'outros', label: `Outros Perfis (${otherProfiles.length})`, color: 'var(--power-orange)' },
                    ] as const).map(({ key, label, color }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setGroupTab(key)}
                        style={{
                          padding: '0.5rem 1.1rem',
                          borderRadius: '10px',
                          border: 'none',
                          fontSize: '0.83rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: groupTab === key ? 'white' : 'transparent',
                          color: groupTab === key ? color : 'var(--power-muted)',
                          boxShadow: groupTab === key ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {groupTab !== 'outros' && sortedMembers.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        color: groupTab === 'grupoA' ? 'var(--power-orange)' : 'var(--power-orange)',
                        background: groupTab === 'grupoA' ? 'rgba(255, 97, 1, 0.10)' : 'rgba(255, 97, 1, 0.10)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '8px',
                        fontWeight: 700
                      }}>
                        {groupTab === 'grupoA'
                          ? `A – ${groupAMembers[groupAMembers.length - 1]?.name.charAt(0).toUpperCase() ?? 'M'}`
                          : `${groupBMembers[0]?.name.charAt(0).toUpperCase() ?? 'N'} – Z`}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--power-muted)' }}>Membros em ordem alfabética</span>
                    </div>
                  )}
                </>
              )}

              {/* ── OUTROS DEPARTAMENTOS: Membros / Outros Perfis ── */}
              {!isAtalaias && activeDeptPeople.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.25rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', width: 'fit-content' }}>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('membros')}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: roleFilter === 'membros' ? 'white' : 'transparent',
                      color: roleFilter === 'membros' ? 'var(--power-orange)' : 'var(--power-muted)',
                      boxShadow: roleFilter === 'membros' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Membros ({activeDeptPeople.filter(p => p.role === 'Membro').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('outros')}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: roleFilter === 'outros' ? 'white' : 'transparent',
                      color: roleFilter === 'outros' ? 'var(--power-orange)' : 'var(--power-muted)',
                      boxShadow: roleFilter === 'outros' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Outros Perfis ({activeDeptPeople.filter(p => p.role !== 'Membro').length})
                  </button>
                </div>
              )}

              {/* ── SUBGRUPOS (ex.: separar Huperetes em departamento unificado) ── */}
              {!isAtalaias && availableSubGroups.length > 0 && activeDeptPeople.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.25rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', width: 'fit-content', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setSubGroupFilter('todos')}
                    style={{
                      padding: '0.5rem 1.1rem',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '0.83rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: subGroupFilter === 'todos' ? 'white' : 'transparent',
                      color: subGroupFilter === 'todos' ? 'var(--power-orange)' : 'var(--power-muted)',
                      boxShadow: subGroupFilter === 'todos' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Todos ({activeDeptPeople.length})
                  </button>
                  {availableSubGroups.map(sg => (
                    <button
                      key={sg}
                      type="button"
                      onClick={() => setSubGroupFilter(sg)}
                      style={{
                        padding: '0.5rem 1.1rem',
                        borderRadius: '10px',
                        border: 'none',
                        fontSize: '0.83rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: subGroupFilter === sg ? 'white' : 'transparent',
                        color: subGroupFilter === sg ? 'var(--power-orange)' : 'var(--power-muted)',
                        boxShadow: subGroupFilter === sg ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {sg} ({activeDeptPeople.filter(p => getPersonSubGroup(p, selectedDept) === sg).length})
                    </button>
                  ))}
                </div>
              )}

              {/* ── Member list ── */}
              {activeList.length > 0 ? (
                <div className="attendance-grid">
                  {activeList.map(p => {
                    const isPresent = presentIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        className="attendance-card"
                        onClick={() => handleTogglePerson(p.id)}
                        style={{
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderLeft: isPresent
                            ? '5px solid var(--color-success)'
                            : '5px solid var(--color-danger)'
                        }}
                      >
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
                            {p.name}
                            {(roleFilter === 'outros' || (isAtalaias && groupTab === 'outros')) && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#4f46e5', marginLeft: '0.35rem', background: '#eef2ff', padding: '0.1rem 0.35rem', borderRadius: '6px' }}>
                                {p.role}
                              </span>
                            )}
                            {subGroupFilter !== 'todos' && getPersonSubGroup(p, selectedDept) && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#0e7490', marginLeft: '0.35rem', background: '#ecfeff', padding: '0.1rem 0.35rem', borderRadius: '6px' }}>
                                {getPersonSubGroup(p, selectedDept)}
                              </span>
                            )}
                          </p>
                          {p.observations && (
                            <p className="subtitle" style={{ fontSize: '0.75rem' }}>
                              {p.observations}
                            </p>
                          )}
                        </div>
                        <label className="switch-container" style={{ pointerEvents: 'none' }}>
                          <input type="checkbox" className="switch-input" checked={isPresent} readOnly />
                          <div className="switch-label"></div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : activeDeptPeople.length > 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--power-muted)' }}>
                  <p>Nenhum membro nesta categoria.</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--power-muted)' }}>
                  <ShieldAlert size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                  <p>Adicione membros ao departamento antes de registrar chamadas.</p>
                </div>
              )}
            </div>

            {successMessage && (
              <div style={{
                color: '#10b981',
                background: '#ecfdf5',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                padding: '0.85rem',
                borderRadius: '10px',
                marginTop: '1.5rem',
                fontSize: '0.9rem',
                textAlign: 'center',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <Check size={16} />
                {successMessage}
              </div>
            )}

            {activeDeptPeople.length > 0 && (
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}
              >
                <Save size={18} />
                Salvar / Atualizar Chamada
              </button>
            )}
          </form>
        </div>
      ) : activeTab === 'history' && session.role !== 'Multiplicador' ? (
        /* History of previous services tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* History Mode Selector Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: '1rem', 
            background: 'var(--power-raised)', 
            padding: '0.75rem 1.25rem', 
            borderRadius: '12px', 
            border: '1px solid var(--power-line)',
            marginBottom: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} style={{ color: 'var(--power-orange)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
                Histórico de Chamadas
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {/* Período Selector as Segmented Control / Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)', fontWeight: 600 }}>Período:</span>
                <div style={{ display: 'flex', background: 'var(--power-line)', padding: '0.2rem', borderRadius: '8px', gap: '0.15rem', flexWrap: 'wrap' }}>
                  {(['this-month', '3-months', '6-months', 'all'] as const).map((range) => {
                    const labels = {
                      'this-month': 'Este Mês',
                      '3-months': '3 Meses',
                      '6-months': '6 Meses',
                      'all': 'Tudo'
                    };
                    const isActive = timeRange === range;
                    return (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setTimeRange(range)}
                        style={{
                          background: isActive ? '#ffffff' : 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: isActive ? 'var(--power-orange)' : 'var(--power-muted)',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        {labels[range]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* View Switcher */}
              {deptHistory.length > 0 && (
                <div style={{ display: 'flex', background: 'var(--power-line)', padding: '0.2rem', borderRadius: '8px', gap: '0.15rem' }}>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    style={{
                      background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: viewMode === 'grid' ? 'var(--power-orange)' : 'var(--power-muted)',
                      cursor: 'pointer',
                      boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    Visualizar Planilha 📊
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    style={{
                      background: viewMode === 'cards' ? '#ffffff' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: viewMode === 'cards' ? 'var(--power-orange)' : 'var(--power-muted)',
                      cursor: 'pointer',
                      boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    Visualizar Cartões
                  </button>
                </div>
              )}
            </div>
          </div>

          {filteredHistory.length > 0 ? (
            viewMode === 'grid' ? (
              /* 1. SPREADSHEET MATRIX VIEW MODE */
              <div className="glass-card animate-fade" style={{ padding: '1.25rem' }}>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.8rem', background: 'var(--power-raised)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--power-line)', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'var(--power-muted)' }}>Legenda:</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontWeight: 600 }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)' }}></span> Presente
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#dc2626', fontWeight: 600 }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px rgba(239, 68, 68, 0.4)' }}></span> Falta
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)', marginLeft: 'auto' }}>
                    *Exibindo {gridHistory.length} cultos no período selecionado (esquerda para direita: mais antigos para mais recentes)
                  </span>
                </div>

                {/* Horizontal Scroll Table Wrapper */}
                <div style={{ overflowX: 'auto', border: '1px solid var(--power-line)', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.6)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--power-raised)', borderBottom: '2px solid var(--power-line)' }}>
                        <th style={{ padding: '0.85rem 1rem', position: 'sticky', left: 0, background: 'var(--power-raised)', zIndex: 10, minWidth: '180px', fontWeight: 700, borderRight: '1px solid var(--power-line)', boxShadow: '2px 0 5px rgba(0,0,0,0.03)' }}>
                          Membro
                        </th>
                        {gridHistory.map(att => {
                          const parts = att.date.split('-');
                          const shortDate = `${parts[2]}/${parts[1]}`;
                          return (
                            <th key={att.id} style={{ padding: '0.85rem 0.5rem', textAlign: 'center', minWidth: '75px', fontWeight: 700 }} title={att.date}>
                              <div>{shortDate}</div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--power-muted)', marginTop: '0.1rem' }}>
                                {getAttendanceTypeShortLabel(att.type)}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDeptPeople.length > 0 ? (
                        activeDeptPeople.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} className="table-row-hover">
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, position: 'sticky', left: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 5, borderRight: '1px solid var(--power-line)', color: 'var(--color-text-main)', boxShadow: '2px 0 5px rgba(0,0,0,0.02)' }}>
                              {p.name}
                            </td>
                            {gridHistory.map(att => {
                              const isPresent = att.presentIds.includes(p.id);
                              return (
                                <td key={att.id} style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                  <div 
                                    style={{
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      background: isPresent ? '#10b981' : '#ef4444',
                                      margin: 'auto',
                                      boxShadow: isPresent ? '0 0 8px rgba(16, 185, 129, 0.5)' : '0 0 8px rgba(239, 68, 68, 0.5)'
                                    }}
                                    title={isPresent ? `${p.name}: Presente em ${att.date}` : `${p.name}: Falta em ${att.date}`}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={gridHistory.length + 1} style={{ padding: '2rem', textAlign: 'center', color: 'var(--power-muted)' }}>
                            Nenhum membro ativo cadastrado no departamento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* 2. CARDS LIST VIEW MODE */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredHistory.map(record => {
                  const dateParts = record.date.split('-');
                  const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

                  const deptActivePeople = db.people.filter(
                    p => p.status === 'Ativo' && !p.deleted && personInDepartment(p, selectedDept)
                  );
                  
                  const presentPeople = deptActivePeople.filter(p => record.presentIds.includes(p.id));
                  const absentPeople = deptActivePeople.filter(p => !record.presentIds.includes(p.id));
                  const attendanceRate = deptActivePeople.length > 0 
                    ? Math.round((presentPeople.length / deptActivePeople.length) * 100) 
                    : 0;

                  const isExpanded = expandedRecordId === record.id;

                  return (
                    <div 
                      key={record.id} 
                      className="glass-card animate-fade"
                      style={{
                        padding: '1.25rem',
                        borderLeft: `5px solid ${attendanceRate >= 80 ? '#10b981' : attendanceRate >= 50 ? '#f59e0b' : '#ef4444'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: 700, margin: 0 }}>
                              {formattedDate}
                            </h4>
                            <span 
                              className="badge" 
                              style={{
                                background: getAttendanceTypeBadgeStyle(record.type).bg,
                                color: getAttendanceTypeBadgeStyle(record.type).color,
                                fontSize: '0.7rem',
                                padding: '0.2rem 0.5rem',
                                fontWeight: 600
                              }}
                            >
                              {getAttendanceTypeLabel(record.type)}
                            </span>
                          </div>
                          <p className="subtitle" style={{ fontSize: '0.8rem', marginTop: '0.25rem', marginBottom: 0 }}>
                            Frequência: <strong>{presentPeople.length}</strong> de <strong>{deptActivePeople.length}</strong> presentes ({attendanceRate}%)
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            className="btn btn-secondary btn-small"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? 'Ocultar Detalhes' : 'Ver Presentes'}
                          </button>

                          <button
                            className="btn btn-secondary btn-small"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--power-orange)', background: 'rgba(15, 23, 42, 0.6)', padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => handleEditRecord(record)}
                            title="Editar Chamada"
                          >
                            <Edit size={14} />
                            Editar
                          </button>
                          
                          {/* Delete button (Only for Pastor/Secretary) */}
                          {!isRestricted && (
                            <button
                              className="btn btn-secondary btn-small"
                              style={{ padding: '0.45rem', color: '#ef4444', background: 'rgba(15, 23, 42, 0.6)' }}
                              onClick={() => handleDelete(record.id)}
                              title="Apagar Chamada"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Present/Absent collapsible list */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px dashed var(--power-line)', paddingTop: '1rem', marginTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          {/* Present column */}
                          <div>
                            <h5 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                              <CheckCircle size={14} />
                              Presentes ({presentPeople.length})
                            </h5>
                            {presentPeople.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto' }}>
                                {presentPeople.map(p => (
                                  <span key={p.id} style={{ fontSize: '0.8rem', color: 'var(--power-muted)' }}>
                                    • {p.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--power-muted)', fontStyle: 'italic' }}>Nenhum presente</span>
                            )}
                          </div>

                          {/* Absent column */}
                          <div>
                            <h5 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#dc2626', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                              <XCircle size={14} />
                              Ausentes ({absentPeople.length})
                            </h5>
                            {absentPeople.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto' }}>
                                {absentPeople.map(p => (
                                  <span key={p.id} style={{ fontSize: '0.8rem', color: 'var(--power-muted)' }}>
                                    • {p.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--power-muted)', fontStyle: 'italic' }}>Nenhum ausente</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--power-muted)' }}>
              <ShieldAlert size={44} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <h4>Nenhum Culto Encontrado</h4>
              <p style={{ fontSize: '0.85rem' }}>Não há registros de chamadas gravadas no período selecionado.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
