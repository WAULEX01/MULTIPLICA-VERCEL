import React, { useState, useMemo } from 'react';
import { getLocalDateISO } from '../utils/localDate';
import type { AppDatabase, UserSession, Person } from '../services/db';
import { getStats, getWeekKey, getMissionForMultiplicador, recordWeeklyMissionMessage, isYouthOrTeenDepartment, calculateConsecutiveAbsences, getPersonGender, isSameDepartment, personInDepartment, getSpecialMissionForMultiplicador, recordSpecialMissionMessage, canUserSelectDepartment, getUserAllowedDepartments, getDepartmentTheme, getPersonMother, compareByName } from '../services/db';
import { Users, CheckCircle, AlertTriangle, TrendingUp, Calendar, AlertCircle, Plus, Gift, Cake, MessageSquare, BookOpen, Activity, Trophy, Award, Sparkles, Copy, Edit2, Send, Target, ChevronDown } from 'lucide-react';
import { apiGetActivityLogs } from '../services/api';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import type { ChartOptions } from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardViewProps {
  db: AppDatabase;
  session: UserSession;
  onNavigate: (view: string) => void;
  onOpenQuickAdd: () => void;
  onUpdateDatabase?: (newDB: AppDatabase) => void;
  onChangeDepartment?: (department: string | undefined) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ db, session, onNavigate, onOpenQuickAdd, onUpdateDatabase, onChangeDepartment }) => {
  const isMultiplicador = session.role === 'Multiplicador';
  const isAdmin = session.role === 'Pastor Admin' || session.role === 'Pastor' || session.role === 'Secretaria Geral';
  const isRestricted = session.role === 'Líder' || isMultiplicador;
  const deptFilter = session.department || undefined; // undefined = Geral (mostra tudo)
  const isMobileViewport = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  // Paginação da auditoria: logs carregados sob demanda (além dos 200 do payload)
  const [loadedLogs, setLoadedLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showFullAudit, setShowFullAudit] = useState(false);
  const [attendanceWeeks, setAttendanceWeeks] = useState<number>(2); // F1: período do gráfico (1/2/3/4 semanas)
  const combinedLogs = useMemo(() => {
    const map = new Map<string, any>();
    (db.activityLogs || []).forEach((l: any) => { if (l && l.id) map.set(l.id, l); });
    loadedLogs.forEach((l: any) => { if (l && l.id) map.set(l.id, l); });
    return Array.from(map.values());
  }, [db.activityLogs, loadedLogs]);

  // v8.2: o Dashboard não processa milhares de auditorias na abertura.
  // Por padrão mostra apenas os últimos 3 dias (máx. 60 itens); o restante
  // é carregado/mostrado somente quando o usuário pedir.
  const visibleAuditLogs = useMemo(() => {
    const now = Date.now();
    const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);
    const sorted = [...combinedLogs].sort((a: any, b: any) => {
      const ta = new Date(a?.timestamp || 0).getTime() || 0;
      const tb = new Date(b?.timestamp || 0).getTime() || 0;
      return tb - ta;
    });
    if (showFullAudit) return sorted;
    return sorted.filter((l: any) => {
      const ts = new Date(l?.timestamp || 0).getTime();
      return Number.isFinite(ts) && ts >= threeDaysAgo;
    }).slice(0, isMobileViewport ? 30 : 60);
  }, [combinedLogs, showFullAudit, isMobileViewport]);

  const loadMoreLogs = async () => {
    if (loadingLogs) return;
    setLoadingLogs(true);
    try {
      const data = await apiGetActivityLogs(combinedLogs.length, 200);
      const fetched: any[] = data.activityLogs || [];
      if (fetched.length > 0) {
        setLoadedLogs(prev => {
          const map = new Map<string, any>();
          (db.activityLogs || []).forEach((l: any) => { if (l && l.id) map.set(l.id, l); });
          prev.forEach((l: any) => { if (l && l.id) map.set(l.id, l); });
          fetched.forEach((l: any) => { if (l && l.id) map.set(l.id, l); });
          return Array.from(map.values());
        });
      }
    } catch (e) { console.warn('[API] Falha ao Carregar mais registros:', e); }
    finally { setLoadingLogs(false); }
  };

  const stats = getStats(db, deptFilter);
  const hasMissionsEnabled = isAdmin || isYouthOrTeenDepartment(session.department || '') || (db.departments.find(d => isSameDepartment(d.name, session.department || ''))?.missionsEnabled ?? false);

  // --- PAINEL DE Engajamento E acessos ---
  // Todos os Usuários administrativos / obreiros cadastrados (que nío sejam apenas membros e nío excluídos)
  const staffAndLeaders = db.people.filter(p => p.role !== 'Membro' && !p.deleted && (!deptFilter || personInDepartment(p, deptFilter)));

  // 1. Ativaçíogins (Líderes e Multiplicadores)
  const activationStaff = staffAndLeaders.filter(p => p.role === 'Líder' || p.role === 'Multiplicador');
  const activatedCount = activationStaff.filter(p => p.passwordChanged || (p.loginCount && p.loginCount > 0)).length;
  
  // Calculate total activity score: Minutes Online * 2 + Interactions * 5
  const getLeaderScore = (p: Person) => {
    const minutes = Math.floor((p.timeOnlineSeconds || 0) / 60);
    const interactions = p.interactionCount || 0;
    return (minutes * 2) + (interactions * 5);
  };

  // 2. Ranking de Atividade geral (todos os obreiros, líderes, pastores, secretários)
  const rankedStaff = [...staffAndLeaders].sort((a, b) => {
    const scoreA = getLeaderScore(a);
    const scoreB = getLeaderScore(b);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return (b.timeOnlineSeconds || 0) - (a.timeOnlineSeconds || 0);
  });

  // 3. Últimos adicionados (todos os membros / líderes adicionados recentemente)
  const latEstadded = [...db.people]
    .filter(p => !p.deleted && (!deptFilter || personInDepartment(p, deptFilter)))
    .sort((a, b) => {
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      return b.id.localeCompare(a.id);
    })
    .slice(0, isMobileViewport ? 15 : 30);

  const formatTimeOnline = (seconds: number | undefined) => {
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  const onlineThresholdMs = 5 * 60 * 1000; // 5 minutos
  const onlineProfiles = staffAndLeaders
    .filter(p => p.lastActive)
    .map(p => ({ ...p, lastActiveDate: new Date(p.lastActive!) }))
    .filter(p => Date.now() - p.lastActiveDate.getTime() <= onlineThresholdMs)
    .sort((a, b) => b.lastActiveDate.getTime() - a.lastActiveDate.getTime());

  const VERSICULOS = [
    { ref: "Josué 1:9", text: "Nío fui eu que ordenei a você? Seja forte e corajoso! Nío se apavore nem desanime, pois o Senhor, o seu Deus, Estará com você por onde você andar." },
    { ref: "Isaías 41:10", text: "Nío tema, pois estou com você; nío tenha medo, pois sou o seu Deus. Eu o fortalecerei e o ajudarei; eu o segurarei com a minha mío direita vitoriosa." },
    { ref: "Jeremias 29:11", text: "Porque sou eu que conheço os planos que tenho para vocês', diz o Senhor, 'planos de prosperar vocês e nío de causar dano, planos de dar a vocês esperança e um futuro." },
    { ref: "Filipenses 4:13", text: "Tudo posso naquele que me fortalece." },
    { ref: "Salmo 23:1", text: "O Senhor é o meu pastor; de nada terei falta." },
    { ref: "Provérbios 3:5-6", text: "Confie no Senhor de todo o seu coraçío e nío se apóie em seu próprio entendimento; reconheça o Senhor em todos os seus caminhos, e ele endireitará as suas veredas." },
    { ref: "Romanos 8:28", text: "Sabemos que Deus age em todas as coisas para o bem daqueles que o amam, dos que foram chamados de acordo com o seu propósito." },
    { ref: "Gálatas 6:9", text: "E nío nos cansemos de fazer o bem, pois no tempo próprio colheremos, se nío desanimarmos." },
    { ref: "Salmo 121:1-2", text: "Elevo os meus olhos para os montes: de onde me virá o socorro? O meu socorro vem do Senhor, que fez os céus e a terra." }
  ];

  const dayOfMonth = new Date().getDate();
  const verse = VERSICULOS[dayOfMonth % VERSICULOS.length];

  const getGreetingMessage = () => {
    const greetings = [
      { text: "Alguém espera por você! ðŸ’–", subtext: "Bem-vindo de volta! Cada chamada, abraço ou palavra sua faz toda a diferença para o Reino. Vamos cuidar das vidas juntos!" },
      { text: "Você é essencial no Reino! ðŸ‘‘", subtext: "Que bom ver você de novo! Esta ferramenta ajuda no controle, mas é o Senhor Deus quem garante a vitória no seu ministério! ðŸ™" },
      { text: "Nío desanime na caminhada! ðŸ’ª", subtext: "O seu trabalho e dedicaçío ao pastorear e multiplicar têm valor eterno. Deus é a sua força e a vitória é garantida!" },
      { text: "A paz do Senhor Jesus! ðŸ•Šï¸", subtext: "Seja muito bem-vindo! Uma palavra de carinho ou oraçío sua hoje pode mudar o dia de alguém. O Reino precisa de você!" },
      { text: "Guerreiro(a) do Reino! ðŸ›¡ï¸", subtext: "Pronto para mais um dia de serviço e cuidado? Faça o seu melhor hoje, pois o Senhor Deus proverá a vitória!" },
      { text: "A colheita é grande! ðŸŒ±", subtext: "Que o Senhor Deus abençoe rica e abundantemente o seu ministério neste dia. Prossiga cuidando de cada ovelha com amor!" },
      { text: "Bem-vindo de volta!", subtext: "Que alegria ver você aqui! Lembre-se: o pastoreio é uma missão sublime e Deus guiará seus passos para o sucesso!" },
      { text: "Deus está na direção!", subtext: "Mais um dia para fazer a diferença. Esta ferramenta facilita a gestão, mas a unção e a garantia de vitória vêm do Senhor!" },
      { text: "Sua dedicaçío gera frutos! ðŸ‡", subtext: "Obrigado por se doar ao pastoreio das vidas. Alguém hoje precisa do seu cuidado e atençío!" },
      { text: "Força e í¢nimo novo! ðŸ”¥", subtext: "Que o Senhor te dê renovo e sabedoria hoje para liderar e abençoar cada participante do seu departamento!" }
    ];
    return greetings[dayOfMonth % greetings.length];
  };

  const greeting = getGreetingMessage();

  const weekKey = getWeekKey();
  const currentMission = (isMultiplicador || session.role === 'Líder' || isAdmin) && session.personId ? getMissionForMultiplicador(db, session.personId, weekKey, session.department) : undefined;
  const missionRecipientPeople = currentMission
    ? (currentMission.recipientIds || [])
        .map(id => db.people.find(p => p.id === id))
        .filter((p): p is Person => Boolean(p))
    : [];
  const missionPendingPeople = currentMission
    ? missionRecipientPeople.filter(p => !currentMission.sentIds.includes(p.id))
    : [];
  const missionCompleted = currentMission ? (currentMission.sentIds.length >= currentMission.targetCount) : false;
  const missionProgress = currentMission ? Math.min(100, Math.round((currentMission.sentIds.length / currentMission.targetCount) * 100)) : 0;
  const missionStatus = currentMission ? (missionCompleted ? 'Concluída' : 'Em andamento') : 'Nenhuma missão ativa';

  const dashboardMultiplicadores = db.people.filter(p => {
    if ((p.role !== 'Multiplicador' && p.role !== 'Líder' && p.role !== 'Pastor' && p.role !== 'Pastor Admin' && p.role !== 'Secretaria Geral') || p.deleted || p.status === 'Arquivado' || p.status === 'Inativo' || p.status === 'Visitante') return false;
    
    if (isAdmin) {
      return true;
    }
    if (session.role === 'Líder') {
      return personInDepartment(p, session.department || '');
    }
    if (session.role === 'Multiplicador') {
      return p.id === session.personId;
    }
    return false;
  });

  const dashboardMissionOverview = dashboardMultiplicadores.map(person => ({
    person,
    mission: getMissionForMultiplicador(db, person.id, weekKey, person.department)
  }));
  const assignedMissionsThisWeek = dashboardMissionOverview.filter(item => item.mission);
  const completedMissionsThisWeek = assignedMissionsThisWeek.filter(item => item.mission && item.mission.sentIds.length >= item.mission.targetCount);
  const pendingMissionsThisWeek = assignedMissionsThisWeek.length - completedMissionsThisWeek.length;

  const [selectedMissionDetails, setSelectedMissionDetails] = useState<any>(null);
  const [roleTabFilters, setRoleTabFilters] = useState<Record<string, 'none' | 'all' | 'Líder' | 'Multiplicador'>>({});

  const getRoleTabForDept = (dept: string): 'none' | 'all' | 'Líder' | 'Multiplicador' => roleTabFilters[dept] || 'none';
  const setRoleTabForDept = (dept: string, tab: 'none' | 'all' | 'Líder' | 'Multiplicador') => {
    setRoleTabFilters((prev: Record<string, 'none' | 'all' | 'Líder' | 'Multiplicador'>) => ({ ...prev, [dept]: tab }));
  };

  const handleWhatsAppClick = (e: React.MouseEvent, person: Person) => {
    e.stopPropagation();
    const phone = person.phone ? person.phone.replace(/\D/g, '') : '';
    if (!phone) {
      alert('Telefone do líder/multiplicador nío está disponível.');
      return;
    }
    const formattedPhone = phone.startsWith('55') ? phone : '55' + phone;
    const firstName = person.name.split(' ')[0];
    const senderName = session.name || 'Pastor';
    
    let text = '';
    if (session.role === 'Pastor Admin') {
      text = encodeURIComponent(`Olá, ${firstName}! Aqui é o Pr. ${senderName.split(' ')[0]}. Passando para saber como você está e como está o andamento do trabalho.`);
    } else {
      text = encodeURIComponent(`Olá, ${firstName}! Aqui é o líder ${senderName.split(' ')[0]}. Passando para conversarmos sobre o andamento das nossas Atividades.`);
    }
    
    window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${text}`, '_blank');
  };

  const handleMissionSend = (recipient: Person) => {
    if (!currentMission || !session.personId || !onUpdateDatabase) return;
    const sender = db.people.find(p => p.id === session.personId);
    if (!sender) return;
    const phone = recipient.phone ? recipient.phone.replace(/\D/g, '') : '';
    if (!phone) {
      alert('Telefone do destinatário nío está disponível para envio de mensagem.');
      return;
    }

    const recipientFirstName = recipient.name.split(' ')[0];
    const useFirstName = currentMission.useFirstName ?? true;
    const nameToUse = useFirstName ? recipientFirstName : recipient.name;
    let message = '';
    if (currentMission.messageTemplate) {
      message = currentMission.messageTemplate
        .replace(/\{nome\}/g, nameToUse)
        .replace(/\{mensagem\}/g, currentMission.description);
    } else {
      message = `A paz do Senhor, ${nameToUse}! Como está? Tudo bem com você?`;
    }
    if (currentMission.mediaUrl) {
      message += `\n\nðŸ“Ž Confira o cartaz: ${currentMission.mediaUrl}`;
    }

    const updatedDb = recordWeeklyMissionMessage(db, currentMission.id, sender, recipient, message);
    onUpdateDatabase(updatedDb);
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');

    // Mother-child: if recipient has a mother, also send to the mother
    if (recipient.motherId) {
      const mother = getPersonMother(db, recipient);
      if (mother && mother.phone) {
        const motherPhone = mother.phone.replace(/\D/g, '');
        const motherName = mother.name.split(' ')[0];
        const childName = recipient.name.split(' ')[0];
        const motherMsg = `A paz do Senhor, ${motherName}! ðŸ’™\n\nEsta mensagem é também para o(a) seu(sua) filho(a) *${recipient.name}*:\n\n${message}`;
        window.open(`https://wa.me/55${motherPhone}?text=${encodeURIComponent(motherMsg)}`, '_blank');
      }
    }
  };

  const handleRequestExtraMission = () => {
    if (!currentMission || !session.personId || !onUpdateDatabase) return;
    
    const multiplicador = db.people.find(p => p.id === session.personId);
    if (!multiplicador) return;
    
    const senderGender = getPersonGender(multiplicador);
    if (senderGender === 'unknown' && !session.code.startsWith('PASTOR')) {
      alert('Por favor, defina seu sexo (Masculino/Feminino) no seu perfil para solicitar novas missões!');
      return;
    }

    // Filter members of same department and same gender (or unknown)
    const sameDeptMembers = db.people.filter(p =>
      p.role === 'Membro' &&
      p.status !== 'Arquivado' &&
      p.status !== 'Inativo' &&
      p.status !== 'Visitante' &&
      !p.deleted &&
      personInDepartment(p, multiplicador.department) &&
      p.id !== multiplicador.id &&
      (senderGender === 'unknown' || getPersonGender(p) === senderGender || getPersonGender(p) === 'unknown')
    );

    // Get members with absences first, then others
    const withAbsences = sameDeptMembers.map(person => ({
      person,
      absences: calculateConsecutiveAbsences(person.id, person.department, person.startDate || '2026-01-01', db.attendances)
    })).filter(entry => entry.absences > 0).sort((a, b) => b.absences - a.absences).map(entry => entry.person);

    const otherMembers = sameDeptMembers.filter(p => !withAbsences.some(a => a.id === p.id));
    const allCandidates = [...withAbsences, ...otherMembers];

    // Filter out people who are ALREADY in the current mission recipients
    const currentRecipients = new Set(currentMission.recipientIds);
    const newCandidates = allCandidates.filter(p => !currentRecipients.has(p.id));

    if (newCandidates.length === 0) {
      alert("Todos os membros ativos e qualificados do seu departamento já foram atribuídos í  sua Missão desta semana!");
      return;
    }

    // Take up to 5 new targets
    const extraCount = Math.min(5, newCandidates.length);
    const extraIds = newCandidates.slice(0, extraCount).map(p => p.id);

    // Update the mission
    const updatedMissions = (db.weeklyMissions || []).map(m => {
      if (m.id === currentMission.id) {
        return {
          ...m,
          targetCount: m.targetCount + extraCount,
          recipientIds: [...m.recipientIds, ...extraIds],
          completedAt: undefined, // Reset completedAt
          version: (m.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: session?.personId || 'unknown'
        };
      }
      return m;
    });

    onUpdateDatabase({
      ...db,
      weeklyMissions: updatedMissions
    });
  };

  // Filter members in scope (ignoring deleted)
  const activeMembers = db.people.filter(
    p => p.status !== 'Arquivado' && p.status !== 'Inativo' && p.status !== 'Visitante' && (!deptFilter || personInDepartment(p, deptFilter)) && !p.deleted
  );

  // Get most recent attendance to count today's check-ins (filtering out future or empty ones)
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const depts = Array.from(new Set(activeMembers.flatMap(m =>
    [m.department, ...(m.departments || []).map(d => d.department)]
  )));
  
  // Build a map of the latest attendance record per department
  const latestRecordByDept: { [dept: string]: { presentIds: string[]; date: string } | undefined } = {};
  let hasAnyRecord = false;
  depts.forEach(deptName => {
    const deptAtts = db.attendances.filter(a => !a.deleted && a.department === deptName);
    const validDeptAtts = deptAtts.filter(
      a => a.date <= todayStr && a.presentIds && a.presentIds.length > 0
    );
    const sorted = [...validDeptAtts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    latestRecordByDept[deptName] = sorted[0] ? { presentIds: sorted[0].presentIds, date: sorted[0].date } : undefined;
    if (sorted[0]) hasAnyRecord = true;
  });

  // Count unique members: present if found in ANY department's latest record
  let presentToday = 0;
  let absentToday = 0;
  activeMembers.forEach(member => {
    const memberDepts = [member.department, ...(member.departments || []).map(d => d.department)];
    const isPresent = memberDepts.some(deptName => {
      const latest = latestRecordByDept[deptName];
      return latest && latest.presentIds.includes(member.id);
    });
    if (isPresent) presentToday++;
    else absentToday++;
  });

  // Count unique members present in any call in the last 7 days (deduplicated â€” no double counting)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = getLocalDateISO(sevenDaysAgo);
  const weekPresentIds = new Set<string>();
  db.attendances
    .filter(a => !a.deleted && a.date >= sevenDaysAgoStr && a.date <= todayStr && (!deptFilter || isSameDepartment(a.department, deptFilter)))
    .forEach(a => (a.presentIds || []).forEach(id => weekPresentIds.add(id)));
  const uniquePresentThisWeek = activeMembers.filter(m => weekPresentIds.has(m.id)).length;

  // F2 â€” Participação por semana (últimas 4 semanas, domâ€“sáb): Membros únicos presentes em cada semana
  const startOfWeek = (base: Date) => {
    const d = new Date(base);
    const dow = (d.getDay() + 6) % 7; // 0 = segunda
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const toISO = (dt: Date) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  const weekParticipation = Array.from({ length: 4 }, (_, i) => {
    const weekStart = startOfWeek(new Date());
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startStr = toISO(weekStart);
    const endStr = toISO(weekEnd);
    const ids = new Set<string>();
    db.attendances
      .filter(a => !a.deleted && a.date >= startStr && a.date <= endStr && a.date <= todayStr && (!deptFilter || isSameDepartment(a.department, deptFilter)))
      .forEach(a => (a.presentIds || []).forEach((id: string) => ids.add(id)));
    const count = activeMembers.filter(m => ids.has(m.id)).length;
    const total = activeMembers.length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const fmt = (dt: Date) => `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}`;
    return { startStr, endStr, label: `${fmt(weekStart)} – ${fmt(weekEnd)}`, count, total, pct, ids };
  });


  // 1. Growth chart (total members registered monthly - dynamic last 6 months)
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  // Generate last 6 months dynamically (e.g. ['2026-02', '2026-03', ..., '2026-07'])
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-11
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonthIdx - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  
  const firstMonthStr = months[0] + '-01';
  let runningCount = db.people.filter(
    p => p.status !== 'Arquivado' && p.status !== 'Inativo' && p.status !== 'Visitante' && p.startDate < firstMonthStr && (!deptFilter || personInDepartment(p, deptFilter)) && !p.deleted
  ).length;

  const monthlyCumulative: number[] = [];
  months.forEach(m => {
    const newInMonth = db.people.filter(
      p => p.status !== 'Arquivado' && p.status !== 'Inativo' && p.status !== 'Visitante' && p.startDate.startsWith(m) && (!deptFilter || personInDepartment(p, deptFilter)) && !p.deleted
    ).length;
    runningCount += newInMonth;
    monthlyCumulative.push(runningCount);
  });

  const maxGrowthVal = monthlyCumulative.length > 0 ? Math.max(...monthlyCumulative, 10) : 10;
  const growthChartMax = Math.ceil(maxGrowthVal * 1.15);

  const growthData = {
    labels: months.map(m => {
      const monthIdx = parseInt(m.split('-')[1], 10) - 1;
      const yearSuffix = m.split('-')[0].substring(2);
      return `${monthNames[monthIdx]}/${yearSuffix}`;
    }),
    datasets: [
      {
        label: 'Membros',
        data: monthlyCumulative,
        fill: true,
        backgroundColor: 'rgba(255, 97, 1, 0.10)',
        borderColor: 'var(--power-orange)',
        borderWidth: 3,
        pointBackgroundColor: 'var(--power-orange)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.35,
      },
    ],
  };

  // 2. Attendance history chart (last N weeks, summing all departments per date)
  const allAttendances = db.attendances.filter(a => !a.deleted && (!deptFilter || isSameDepartment(a.department, deptFilter)));
  
  // Group attendances by date+type and sum unique presentIds across departments
  const groupedByDate = new Map<string, { date: string; type: string; presentIds: Set<string> }>();
  allAttendances.forEach(att => {
    const key = `${att.date}_${att.type}`;
    if (!groupedByDate.has(key)) {
      groupedByDate.set(key, { date: att.date, type: att.type, presentIds: new Set() });
    }
    const group = groupedByDate.get(key)!;
    att.presentIds.forEach((id: string) => group.presentIds.add(id));
  });

  // F1: período selecionado (Esta/2/3/4 semanas) â€” substitui o antigo slice(-5)
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - (attendanceWeeks * 7 - 1));
  const periodStartStr = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}-${String(periodStart.getDate()).padStart(2, '0')}`;

  const groupedRecords = Array.from(groupedByDate.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .filter(r => r.date >= periodStartStr);

  const attendanceChartData = {
    labels: groupedRecords.map(r => {
      const dateParts = r.date.split('-');
      return `${dateParts[2]}/${dateParts[1]} (${r.type})`;
    }),
    datasets: [
      {
        label: 'Presentes',
        data: groupedRecords.map(r => r.presentIds.size),
        backgroundColor: 'rgba(255, 97, 1, 0.75)',
        borderColor: 'var(--power-orange)',
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: Math.max(8, Math.min(44, Math.floor(260 / Math.max(groupedRecords.length, 1)))),
        hoverBackgroundColor: 'var(--power-orange)',
      },
    ],
  };

  const growthDatalabelsPlugin = {
    id: 'growthDatalabels',
    afterDatasetsDraw(chart: any) {
      const { ctx, data } = chart;
      ctx.save();
      ctx.font = 'bold 11px IBM Plex Mono, monospace';
      ctx.fillStyle = '#aaa6b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      const datasetMeta = chart.getDatasetMeta(0);
      datasetMeta.data.forEach((point: any, index: number) => {
        const value = data.datasets[0].data[index];
        if (value > 0) {
          ctx.fillText(value, point.x, point.y - 8);
        }
      });
      ctx.restore();
    }
  };

  const lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#111019',
        titleColor: '#faf8f3',
        bodyColor: '#aaa6b8',
        titleFont: { family: 'IBM Plex Mono', size: 13, weight: 'bold' },
        bodyFont: { family: 'IBM Plex Mono', size: 12 },
        borderColor: 'rgba(250,248,243,.22)',
        borderWidth: 1,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#aaa6b8', font: { family: 'IBM Plex Mono', size: 11, weight: 500 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#aaa6b8', font: { family: 'IBM Plex Mono', size: 11 } },
        min: 0,
        max: growthChartMax,
      },
    },
  };

  const barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#111019',
        titleColor: '#faf8f3',
        bodyColor: '#aaa6b8',
        titleFont: { family: 'IBM Plex Mono', size: 13, weight: 'bold' },
        bodyFont: { family: 'IBM Plex Mono', size: 12 },
        borderColor: 'rgba(250,248,243,.22)',
        borderWidth: 1,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#aaa6b8', font: { family: 'IBM Plex Mono', size: 11, weight: 500 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#aaa6b8', font: { family: 'IBM Plex Mono', size: 11 } },
        min: 0,
        max: Math.max(...groupedRecords.map(r => r.presentIds.size), 10) * 1.2,
      },
    },
  };

  return (
    <div className="page-container animate-fade">
      {/* TypeUI: improved heading hierarchy */}
      <div className="view-header mb-8">
        <div>
          <h1 className="page-title">Olá, {session.name}!
          </h1>
          <p className="subtitle">Gestão do Departamento: <strong>{deptFilter || 'Geral IEAD-JK'}</strong></p>
        </div>
        {(session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin') && (
          <button className="btn btn-primary btn-sm" onClick={onOpenQuickAdd} style={{ flexShrink: 0 }}>
            <Plus size={16} />
            Cadastro Rápido
          </button>
        )}
      </div>

      {/* TypeUI: stats cards with consistent spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Total de Membros */}
        <div className="card card-elevated flex items-center gap-5 p-6">
          <div className="avatar avatar-lg bg-primary/10 text-primary flex items-center justify-center">
            <Users size={26} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Total de Membros</p>
            <h3 className="text-2xl font-bold mt-0.5">{stats.totalMembers}</h3>
          </div>
        </div>

        {/* Presentes Hoje */}
        <div className="card card-elevated flex items-center gap-5 p-6">
          <div className="avatar avatar-lg bg-success/10 text-success flex items-center justify-center">
            <CheckCircle size={26} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Presentes no último culto</p>
            <h3 className="text-2xl font-bold mt-0.5 text-success">
              {hasAnyRecord ? presentToday : "-"}
            </h3>
          </div>
        </div>

        {/* Faltosos */}
        <div className="card card-elevated flex items-center gap-5 p-6">
          <div className="avatar avatar-lg bg-danger/10 text-danger flex items-center justify-center">
            <AlertCircle size={26} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Ausentes no último culto</p>
            <h3 className="text-2xl font-bold mt-0.5 text-danger">
              {hasAnyRecord ? absentToday : "-"}
            </h3>
          </div>
        </div>

        {/* Radar Resumido */}
        <div 
          className="card card-elevated flex items-center gap-5 p-6 cursor-pointer"
          style={{ borderLeft: stats.needingFollowUp > 0 ? "4px solid var(--color-danger)" : "1px solid var(--border-color)" }}
          onClick={() => onNavigate("radar")}
        >
          <div className="avatar avatar-lg flex items-center justify-center" style={{
            background: stats.needingFollowUp > 0 ? "rgba(245, 158, 11, 0.08)" : "rgba(100, 116, 139, 0.08)",
            color: stats.needingFollowUp > 0 ? "#f59e0b" : "var(--power-muted)"
          }}>
            <AlertTriangle size={26} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Faltosos no Radar</p>
            <h3 className="text-2xl font-bold mt-0.5" style={{ color: stats.needingFollowUp > 0 ? "#f59e0b" : "inherit" }}>
              {stats.needingFollowUp}
            </h3>
          </div>
        </div>

        {/* Presentes na semana â€” membros Ãºnicos em qualquer chamada dos Ãºltimos 7 dias */}
        <div className="card card-elevated flex items-center gap-5 p-6">
          <div className="avatar avatar-lg bg-success/10 text-success flex items-center justify-center">
            <CheckCircle size={26} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Presentes na semana</p>
            <h3 className="text-2xl font-bold mt-0.5 text-success">
              {uniquePresentThisWeek}
            </h3>
            <p className="text-xs text-muted mt-0.5">Únicos (últimos 7 dias)</p>
          </div>
        </div>
      </div>

      {/* TypeUI: charts section with proper heading */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Crescimento e Participação</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Crescimento */}
          <div className="card card-elevated flex flex-col" style={{ height: "380px" }}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp size={18} className="text-primary" />
                  Crescimento de Membros
                </h3>
                <p className="subtitle">Membros registrados ao longo do semestre</p>
              </div>
            </div>
            <div className="flex-1 relative">
              <Line data={growthData} options={lineChartOptions as any} plugins={[growthDatalabelsPlugin as any]} />
            </div>
          </div>

          {/* Radar Resumido Cards */}
          <div className="card card-elevated flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-0.5 flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                Alertas do Radar
              </h3>
              <p className="subtitle mb-6">Grau de ausências no departamento</p>
            </div>

            <div className="flex flex-col gap-5 flex-1 justify-center">
              {/* Vermelho (3+ faltas) */}
              <div className="flex justify-between items-center p-4 rounded-xl border" style={{ background: "rgba(239, 68, 68, 0.15)", borderColor: "#fee2e2" }}>
                <span className="text-sm font-semibold text-danger flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-danger"></span>
                  Falta Vermelha (3+)
                </span>
                <span className="text-lg font-bold text-danger">{stats.redCount}</span>
              </div>

              {/* Laranja (2 faltas) */}
              <div className="flex justify-between items-center p-4 rounded-xl border" style={{ background: "rgba(255, 97, 1, 0.12)", borderColor: "rgba(255, 97, 1, 0.28)" }}>
                <span className="text-sm font-semibold text-orange flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: "#f97316" }}></span>
                  Falta Laranja (2)
                </span>
                <span className="text-lg font-bold" style={{ color: "#f97316" }}>{stats.orangeCount}</span>
              </div>

              {/* Amarelo (1 falta) */}
              <div className="flex justify-between items-center p-4 rounded-xl border" style={{ background: "rgba(217, 119, 6, 0.12)", borderColor: "rgba(217, 119, 6, 0.28)" }}>
                <span className="text-sm font-semibold text-warning flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning"></span>
                  Falta Amarela (1)
                </span>
                <span className="text-lg font-bold text-warning">{stats.yellowCount}</span>
              </div>
            </div>

            <button 
              className="btn btn-secondary btn-sm mt-5" 
              onClick={() => onNavigate("radar")}
            >
              Abrir Radar Completo
            </button>
          </div>
        </div>
      </div>

      {/* Gráficos Secundários e Aniversários */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* F2 — Novo quadro: Participação por semana */}
        {!isMultiplicador && (
          <div className="card card-elevated flex flex-col" style={{ height: "420px" }}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold mb-0.5 flex items-center gap-2">
                  <Users size={18} className="text-purple-600" />
                  Participação por semana
                </h3>
                <p className="subtitle" style={{ margin: 0 }}>Membros únicos presentes em cada semana (≥1 participação)</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-3.5 pr-1">
              {activeMembers.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted">
                  Nenhum membro ativo neste departamento.
                </div>
              ) : (
                weekParticipation.map(w => (

                  <div key={w.startStr}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-muted">{w.label}</span>
                      <span className="text-xs font-bold" style={{ color: w.count > 0 ? "var(--power-orange)" : "var(--power-muted)" }}>
                        {w.count} de {w.total} ({w.pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(15, 23, 42, 0.5)" }}>
                      <div className="h-full rounded-full" style={{ width: `${w.pct}%`, background: "linear-gradient(90deg, var(--power-orange) 0%, var(--power-orange) 100%)", transition: "width 0.4s" }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Gráfico de Presença semanal - Não mostra para Multiplicador */}
        {!isMultiplicador && (
          <div className="card card-elevated flex flex-col" style={{ height: "420px" }}>
            <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-semibold mb-0.5 flex items-center gap-2">
                  <Calendar size={18} className="text-purple-600" />
                  Presenças por Culto / Reunião
                </h3>
                <p className="subtitle" style={{ margin: 0 }}>Total de presentes por data (todos os departamentos)</p>
              </div>
              {/* F1: seletor de período */}
              <div className="flex gap-1.5 items-center">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setAttendanceWeeks(n)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={{
                      color: attendanceWeeks === n ? "#fff" : "var(--power-muted)",
                      background: attendanceWeeks === n ? "var(--power-orange)" : "rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    {n === 1 ? "Esta" : `${n} sem`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 relative">
              {groupedRecords.length > 0 ? (
                <Bar data={attendanceChartData} options={barChartOptions as any} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted">
                  Nenhuma chamada registrada neste período.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aniversariantes do Mês */}
        <div className="card card-elevated flex flex-col" style={{ height: "420px" }}>
          <div>
            <h3 className="text-lg font-semibold mb-0.5 flex items-center gap-2">
              <Gift size={18} className="text-orange-600" />
              Aniversariantes de {(() => {
                const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                return meses[new Date().getMonth()];
              })()}
            </h3>
            <p className="subtitle mb-4">Membros e líderes aniversariantes</p>
          </div>

          <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
            {(() => {
              const currentMonth = new Date().getMonth() + 1;
              const birthdays = db.people
                .filter(p => p.status !== "Arquivado" && p.status !== "Inativo" && p.status !== "Visitante" && !p.deleted && (!deptFilter || personInDepartment(p, deptFilter)))
                .filter(p => p.birthDate && parseInt(p.birthDate.split("-")[1]) === currentMonth)
                .sort((a, b) => parseInt(a.birthDate!.split("-")[2]) - parseInt(b.birthDate!.split("-")[2]));

              if (birthdays.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-full text-muted text-center p-4">
                    <Cake size={28} className="text-muted mb-2" />
                    <span className="text-sm">Nenhum aniversariante neste mês</span>
                  </div>
                );
              }

              const isWagner = session.code === "PASTOR_WAGNER" && (session.role === "Pastor" || session.role === "Pastor Admin");

              return birthdays.map(p => {
                const parts = p.birthDate!.split("-");
                const bYear = parseInt(parts[0], 10);
                const bMonth = parseInt(parts[1], 10);
                const bDay = parseInt(parts[2], 10);
                const isYearUnknown = bYear === 1900;
                
                const today = new Date();
                const tYear = today.getFullYear();
                const tMonth = today.getMonth() + 1;
                const tDay = today.getDate();
                
                let age = tYear - bYear;
                if (tMonth < bMonth || (tMonth === bMonth && tDay < bDay)) {
                  age--;
                }
                const ageText = isYearUnknown ? "" : ` (${age} anos)`;
                const birthdayMsg = `Olá, ${p.name}! Feliz aniversário! Que Deus te abençoe rica e abundantemente neste dia tão especial. A congregação IEAD-JK celebra a sua vida e somos muito gratos por ter você conosco! Abraços!`;
                const cleanPhone = p.phone.replace(/\D/g, "");
                const waLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(birthdayMsg)}`;

                return (
                  <div 
                    key={p.id} 
                    className="birthday-card-hover animate-fade card card-elevated flex items-center justify-between p-4" style={{ background: "linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(255, 97, 1, 0.12) 100%)", border: "1px solid #fde68a", boxShadow: "0 4px 6px -1px rgba(251, 191, 36, 0.05), 0 2px 4px -1px rgba(251, 191, 36, 0.03)", transition: "transform 0.2s, box-shadow 0.2s" }} >
                    <div className="flex items-center gap-3" style={{ minWidth: 0, width: '100%' }}>
                      <Cake size={24} style={{ color: 'var(--power-orange)', flexShrink: 0 }} aria-hidden="true" />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--color-text-main)', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25 }}>{p.name}</p>
                        <p className="text-xs font-medium" style={{ marginTop: '0.25rem', marginBottom: 0, color: 'var(--power-muted)', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>Dia {pad2(bDay)}/{pad2(bMonth)}{ageText} • {p.role}</p>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* --- SEÇÃO DE Atividade & Engajamento da Liderança --- */}
      {(session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin') && (
        <>
          <div style={{ marginTop: '3.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '2.5rem' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Activity size={22} style={{ color: 'var(--color-primary)' }} />
              Atividade & Engajamento da Liderança
            </h3>
            <p className="subtitle" style={{ marginBottom: '1.75rem' }}>
              Acompanhamento de ativações e novos membros cadastrados no sistema
            </p>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
          {/* Painel 1: Ativaçíontas */}
          <div className="glass-card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', height: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-main)' }}>
                <Award size={18} style={{ color: 'var(--power-orange)' }} />
                Contas pendentes de ativação
              </h4>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.25rem 0.5rem', background: '#ecfdf5', color: '#10b981', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                {activatedCount} de {activationStaff.length} Ativas
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
              {activationStaff.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--power-muted)', fontSize: '0.85rem' }}>
                  Nenhum líder cadastrado.
                </div>
              ) : (
                activationStaff.map(p => {
                  const isActivated = p.passwordChanged || (p.loginCount && p.loginCount > 0);
                  return (
                    <div key={p.id} className="p-4 rounded-xl border flex flex-col gap-2" style={{ background: "var(--power-raised)", borderColor: "var(--border-color)" }}>
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-main)" }}>{p.name}</p>
                          <p className="text-xs text-muted mt-0.5 truncate">{p.role} • {p.department.split(' ')[0]}</p>
                        </div>
                        <div>
                          {isActivated ? (
                            <span className="text-xs font-semibold px-1.5 py-0.5 bg-success/10 text-success rounded-full whitespace-nowrap">
                              Ativação
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-1.5 py-0.5 bg-warning/10 text-warning rounded-full whitespace-nowrap">
                              Pendente
                            </span>
                          )}
                        </div>
                      </div>
                      {(session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin') && p.username && (
                        <div className="flex flex-col gap-1.5 p-3 rounded-lg border text-xs" style={{ background: "rgba(15, 23, 42, 0.6)", borderColor: "rgba(255, 255, 255, 0.05)" }}>
                          <div className="flex justify-between items-center flex-wrap gap-1">
                            <span><strong>User:</strong> <code className="px-1 py-0.5 bg-white/10 rounded">{p.username}</code></span>
                            <span><strong>Senha:</strong> {p.passwordChanged ? <span className="text-success font-semibold">Pessoal</span> : <code className="px-1 py-0.5 bg-white/10 rounded">mudar123</code>}</span>
                          </div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: "0.4rem", fontSize: "0.7rem", flex: "1 1 45%", margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }} onClick={() => { const text = p.passwordChanged ? `Usuário: ${p.username}\nSenha: (Pessoal definida pelo Usuário)` : `Usuário: ${p.username}\nSenha: mudar123`; navigator.clipboard.writeText(text); alert(p.passwordChanged ? 'Este Usuário já definiu uma senha pessoal (não é possível exibi-la).' : 'Credenciais copiadas com sucesso!'); }} >
                              <Copy size={12} /> Copiar
                            </button>
                            {p.phone && (
                              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: "0.4rem", fontSize: "0.7rem", flex: "1 1 45%", margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", borderColor: "#10b981", color: "#10b981", background: "rgba(16,185,129,0.02)" }} onClick={() => { const message = p.passwordChanged ? `Olá, *${p.name}*!\n\nSeja bem-vindo ao *Multiplica PLUS*!\n\n🌐 *Acesse o app:* https://multiplica-plus-ieadjota.vercel.app\n👤 *Usuário:* \`${p.username}\`\n\n_Obs: Sua senha Pessoal já foi definida por você. Se você a esqueceu, procure o Pastor para resetá-la._` : `Olá, *${p.name}*!\n\nSeja bem-vindo ao *Multiplica PLUS*!\n\n🌐 *Acesse o app:* https://multiplica-plus-ieadjota.vercel.app\n👤 *Usuário:* \`${p.username}\`\n🔑 *Senha Temporária:* \`mudar123\`\n\n_Obs: No primeiro acesso, altere para sua senha pessoal._\n\nContamos com você! 🙏✨`; const encoded = encodeURIComponent(message); window.open(`https://api.whatsapp.com/send?phone=55${p.phone}&text=${encoded}`, '_blank'); }} >
                                <MessageSquare size={12} /> WhatsApp
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Painel 2: Ranking de acessos */}
          <div className="glass-card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', height: '380px' }}>
              <div style={{ marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-main)' }}>
                  <Trophy size={18} style={{ color: '#ea580c' }} />
                  Top Multiplicadores & Liderança
                </h4>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
                {rankedStaff.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--power-muted)', fontSize: '0.85rem' }}>
                    Nenhuma atividade registrada.
                  </div>
                ) : (
                  rankedStaff.map((p, index) => {
                    const rankColor = index === 0 ? '#fbbf24' : index === 1 ? 'var(--power-muted)' : index === 2 ? '#b45309' : 'var(--power-muted)';
                    const rankBg = index === 0 ? 'rgba(251, 191, 36, 0.1)' : index === 1 ? 'rgba(148, 163, 184, 0.1)' : index === 2 ? 'rgba(180, 83, 9, 0.1)' : 'rgba(100, 116, 139, 0.05)';
                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--power-raised)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', maxWidth: '65%' }}>
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            fontSize: '0.75rem', 
                            fontWeight: 700,
                            color: rankColor,
                            background: rankBg
                          }}>
                            {index + 1}º
                          </span>
                          <div style={{ overflow: 'hidden' }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-main)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.name}</p>
                            <p style={{ fontSize: '0.725rem', color: 'var(--power-muted)', margin: '0.1rem 0 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.role}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--power-orange)', background: 'rgba(139, 92, 246, 0.08)', padding: '0.15rem 0.45rem', borderRadius: '50px' }} title="Pontuação Geral = (Minutos Online × 2) + (Ações/Interações × 5)">
                            {getLeaderScore(p)} pts
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.625rem', color: 'var(--power-muted)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }} title="Tempo ativo online">
                              ⏱️ {formatTimeOnline(p.timeOnlineSeconds)}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }} title="Ações/Interações com o sistema (cadastros, chamadas, etc)">
                              ⚡ {p.interactionCount || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>



        </div>

        {/* PAINEL DE AUDITORIA DE AtividadeS (Apenas Administradores) */}
        {(session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin') && (
          <div className="glass-card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-main)' }}>
                  <Activity size={18} style={{ color: 'var(--color-primary)' }} />
                  Registro de Auditoria de Líderes
                </h4>
                <p className="subtitle" style={{ fontSize: '0.8rem', margin: 0 }}>Últimos 3 dias por padrão • histórico completo sob demanda</p>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--power-muted)', background: 'rgba(15, 23, 42, 0.5)', padding: '0.25rem 0.6rem', borderRadius: '50px' }}>
                {(() => { const totalLogs = db.activityLogCount ?? (db.activityLogs || []).length; const rankSum = (db.people || []).reduce((acc: number, p: any) => acc + (p.interactionCount || 0), 0); return Math.max(totalLogs, rankSum); })()} registros
              </span>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column' }}>
              {(!visibleAuditLogs || visibleAuditLogs.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--power-muted)', fontSize: '0.875rem' }}>
                  <Activity size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  Nenhuma ação registrada no histórico ainda.
                </div>
              ) : (() => {
                const getActionColor = (act: string) => {
                  const a = String(act || '').toLowerCase();
                  if (a.includes('cadastr') || a.includes('adicion') || a.includes('inseri') || a.includes('restaur')) return { bg: '#ecfdf5', text: '#059669', border: 'rgba(16,185,129,0.25)' };
                  if (a.includes('exclu') || a.includes('apag') || a.includes('remov')) return { bg: '#fef2f2', text: '#dc2626', border: 'rgba(239,68,68,0.25)' };
                  if (a.includes('realizou login')) return { bg: 'rgba(255, 97, 1, 0.10)', text: 'var(--power-orange)', border: 'rgba(124,58,237,0.2)' };
                  return { bg: 'rgba(255, 97, 1, 0.10)', text: 'var(--power-orange)', border: 'rgba(37,99,235,0.2)' };
                };
                const auditTimeZone = 'America/Porto_Velho';
                const parseAuditDate = (iso: string) => {
                  const date = new Date(iso);
                  return Number.isNaN(date.getTime()) ? null : date;
                };
                const dayKey = (date: Date) => {
                  const parts = new Intl.DateTimeFormat('pt-BR', {
                    timeZone: auditTimeZone,
                    year: 'numeric', month: '2-digit', day: '2-digit'
                  }).formatToParts(date);
                  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
                  return `${values.year}-${values.month}-${values.day}`;
                };
                const formatTs = (iso: string) => {
                  const date = parseAuditDate(iso);
                  return date
                    ? date.toLocaleTimeString('pt-BR', { timeZone: auditTimeZone, hour: '2-digit', minute: '2-digit' })
                    : 'Horário indisponível';
                };
                const getDayLabel = (iso: string) => {
                  const date = parseAuditDate(iso);
                  if (!date) return 'Data não informada';
                  const today = new Date();
                  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
                  const beforeYesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
                  const key = dayKey(date);
                  if (key === dayKey(today)) return 'Hoje';
                  if (key === dayKey(yesterday)) return 'Ontem';
                  if (key === dayKey(beforeYesterday)) return 'Anteontem';
                  return date.toLocaleDateString('pt-BR', {
                    timeZone: auditTimeZone,
                    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
                  });
                };
                // Correção v6.9.5: o campo real é timestamp (não "timEstamp").
                const sorted = [...visibleAuditLogs].sort((a: any, b: any) => {
                  const timeA = parseAuditDate(a.timestamp)?.getTime() || 0;
                  const timeB = parseAuditDate(b.timestamp)?.getTime() || 0;
                  return timeB - timeA;
                });
                const groups: { key: string; label: string; items: any[] }[] = [];
                sorted.forEach((l: any) => {
                  const parsed = parseAuditDate(l.timestamp);
                  const key = parsed ? dayKey(parsed) : 'unknown';
                  const label = getDayLabel(l.timestamp);
                  const g = groups.find(x => x.key === key);
                  if (g) g.items.push(l);
                  else groups.push({ key, label, items: [l] });
                });
                return (
                  <>
                    {groups.map(group => (
                      <div key={group.key} className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: 'var(--power-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(15, 23, 42, 0.5)' }}>
                            {group.label}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {group.items.map((l: any) => {
                            const c = getActionColor(l.action);
                            return (
                              <div key={l.id} className="flex justify-between items-start gap-3 p-3 rounded-lg border" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold m-0 leading-snug">{l.action}</p>
                                  {l.details && l.details !== l.action && (
                                    <p className="text-xs opacity-75 mt-0.5 italic leading-snug">{l.details}</p>
                                  )}
                                  <p className="text-xs opacity-75 mt-1 font-medium"> por <strong>{l.recordedByName || 'Usuário'}</strong>{(() => { const role = l.recordedByRole || db.people.find((p: any) => p.id === l.recordedBy)?.role; return role ? ` • ${role}` : ''; })()} </p>
                                </div>
                                <div className="text-xs opacity-80 font-semibold whitespace-nowrap flex-shrink-0 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.6)' }}>
                                  {formatTs(l.timestamp)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {!showFullAudit ? (
                      <button onClick={() => setShowFullAudit(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', marginTop: '0.5rem', padding: '0.65rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--power-orange)', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '10px', cursor: 'pointer' }}>
                        <ChevronDown size={14} /> Ver auditoria completa
                      </button>
                    ) : (db.activityLogCount ?? combinedLogs.length) > combinedLogs.length ? (
                      <button onClick={loadMoreLogs} disabled={loadingLogs} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', marginTop: '0.5rem', padding: '0.55rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--power-orange)', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '10px', cursor: loadingLogs ? 'wait' : 'pointer' }}>
                        <ChevronDown size={14} /> {loadingLogs ? 'Carregando...' : 'Carregar mais registros'}
                      </button>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '3rem', borderTop: '1px dashed var(--border-color)', paddingTop: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text-main)' }}>Acesso Rápido</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          
          {/* Card 1: Fazer Chamada */}
          <div 
            className="glass-card" 
            onClick={() => onNavigate('presenca')}
            style={{ 
              padding: '2rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1.5rem',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              border: '1px solid var(--border-color)',
              borderRadius: '16px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              background: 'rgba(124, 58, 237, 0.08)',
              padding: '1rem',
              borderRadius: '16px',
              color: 'var(--power-orange)',
              display: 'flex'
            }}>
              <Calendar size={32} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-text-main)' }}>Fazer Chamada</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginTop: '0.25rem', marginBottom: 0 }}>
                Registre a presença dos membros do seu departamento.
              </p>
            </div>
          </div>

          {/* Card 2: Cadastrar Membro */}
          <div 
            className="glass-card" 
            onClick={onOpenQuickAdd}
            style={{ 
              padding: '2rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1.5rem',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              border: '1px solid var(--border-color)',
              borderRadius: '16px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              padding: '1rem',
              borderRadius: '16px',
              color: '#10b981',
              display: 'flex'
            }}>
              <Plus size={32} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-text-main)' }}>Cadastrar Membro</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginTop: '0.25rem', marginBottom: 0 }}>
                Adicione um novo participante ao seu departamento.
              </p>
            </div>
          </div>

        </div>
      </div>
        </>
      )}

      {/* Modal de Detalhes da Missão do Multiplicador */}
      {selectedMissionDetails && (
        <div className="modal-overlay" onClick={() => setSelectedMissionDetails(null)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedMissionDetails(null)} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-none" style={{ background: 'rgba(15, 23, 42, 0.5)', color: 'var(--power-muted)' }}>
              ✕
            </button>
            <h2 className="text-2xl font-extrabold m-0 mb-2" style={{ color: 'var(--power-white)' }}> Missão de {selectedMissionDetails.person.name} </h2>
            <p className="text-sm text-muted m-0 mb-6"> Departamento: {selectedMissionDetails.person.department} </p>
            {selectedMissionDetails.mission ? (
              <>
                <div className="p-5 rounded-2xl border mb-6" style={{ background: 'var(--power-raised)', borderColor: 'var(--power-line)' }}>
                  <h3 className="text-lg font-bold m-0 mb-2" style={{ color: 'rgba(255, 255, 255, 0.05)' }}>{selectedMissionDetails.mission.title}</h3>
                  <p className="text-sm text-muted m-0 mb-4">{selectedMissionDetails.mission.description}</p>
                  <div className="flex gap-4">
                    <div className="flex-1 p-3 rounded-xl border text-center" style={{ background: 'rgba(15, 23, 42, 0.6)', borderColor: 'var(--power-line)' }}>
                      <p className="m-0 text-xs text-muted">Meta</p>
                      <p className="m-0 text-xl font-bold text-muted">{selectedMissionDetails.mission.targetCount}</p>
                    </div>
                    <div className="flex-1 p-3 rounded-xl border text-center" style={{ background: 'rgba(15, 23, 42, 0.6)', borderColor: 'var(--power-line)' }}>
                      <p className="m-0 text-xs text-muted">Enviadas</p>
                      <p className="m-0 text-xl font-bold text-success">{selectedMissionDetails.mission.sentIds.length}</p>
                    </div>
                  </div>
                </div>
                <div className="mb-6">
                  <h4 className="text-base font-bold text-muted mb-3 flex items-center gap-2">
                    <CheckCircle size={16} style={{ color: '#10b981' }} /> Já receberam a mensagem
                  </h4>
                  <div className="flex flex-col gap-2">
                    {selectedMissionDetails.mission.sentIds.length === 0 ? (
                      <p className="m-0 text-sm text-muted italic">Nenhuma mensagem enviada ainda.</p>
                    ) : (
                      selectedMissionDetails.mission.sentIds.map((id: string) => {
                        const person = db.people.find((p: Person) => p.id === id);
                        return (
                          <div key={id} className="p-3 rounded-lg text-sm border" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                            {person ? person.name : 'Membro desconhecido'}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-base font-bold text-muted mb-3 flex items-center gap-2">
                    <AlertCircle size={16} style={{ color: '#f59e0b' }} /> Faltam receber
                  </h4>
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const pending = (selectedMissionDetails.mission.recipientIds || []).filter((id: string) => !selectedMissionDetails.mission.sentIds.includes(id));
                      return pending.length === 0 ? (
                        <p className="m-0 text-sm text-muted italic">Todos os contatos foram concluídos!</p>
                      ) : (
                        pending.map((id: string) => {
                          const person = db.people.find((p: Person) => p.id === id);
                          return (
                            <div key={id} className="p-3 rounded-lg text-sm border" style={{ background: 'rgba(217, 119, 6, 0.12)', color: '#fcd34d', borderColor: '#fde68a' }}>
                              {person ? person.name : 'Membro desconhecido'}
                            </div>
                          );
                        })
                      );
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center rounded-2xl border border-dashed" style={{ background: 'var(--power-raised)', borderColor: 'var(--power-muted)' }}>
                <p className="m-0 text-muted">Este multiplicador não possui nenhuma missão Ativação.</p>
              </div>
            )}
          </div>
        </div>
      )}
    ) : (
      <div style={{ marginTop: '2.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text-main)' }}>Acesso Rápido</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          
          {/* Card 1: Fazer Chamada */}
          <div 
            className="glass-card" 
            onClick={() => onNavigate('presenca')}
            style={{ 
              padding: '2rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1.5rem',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              border: '1px solid var(--border-color)',
              borderRadius: '16px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              background: 'rgba(124, 58, 237, 0.08)',
              padding: '1rem',
              borderRadius: '16px',
              color: 'var(--power-orange)',
              display: 'flex'
            }}>
              <Calendar size={32} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-text-main)' }}>Fazer Chamada</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginTop: '0.25rem', marginBottom: 0 }}>
                Registre a presença dos membros do seu departamento.
              </p>
            </div>
          </div>

          {/* Card 2: Cadastrar Membro */}
          <div 
            className="glass-card" 
            onClick={onOpenQuickAdd}
            style={{ 
              padding: '2rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1.5rem',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              border: '1px solid var(--border-color)',
              borderRadius: '16px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              padding: '1rem',
              borderRadius: '16px',
              color: '#10b981',
              display: 'flex'
            }}>
              <Plus size={32} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-text-main)' }}>Cadastrar Membro</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginTop: '0.25rem', marginBottom: 0 }}>
                Adicione um novo participante ao seu departamento.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
























