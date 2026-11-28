// src/views/InicioView.tsx
// Tela inicial premium com navegação rápida — Multiplica PLUS v6.7.0
// Migrado para TypeUI Design System (tokens CSS)

import { getLocalDateISO } from '../utils/localDate';
import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Cake,
  ChartNoAxesCombined,
  ClipboardCheck,
  Crosshair,
  Download,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppDatabase, UserSession, ChurchEvent } from '../services/db';
import { personInDepartment, isSameDepartment } from '../services/db';

interface InicioViewProps {
  db: AppDatabase;
  session: UserSession;
  onNavigate: (view: string) => void;
  onUpdateDatabase?: (newDB: AppDatabase) => void;
  onChangeDepartment?: (newDept: string | undefined) => void;
}

const VERSICULOS = [
  { ref: "Hebreus 10:24", text: "Consideremos uns aos outros para nos estimularmos ao amor e às boas obras." },
  { ref: "Lema Multiplica PLUS", text: "Líderes e cooperadores, vocês são a ponte entre o céu e as pessoas. Cuidar de vidas, alcançar corações e multiplicar o Reino." },
  { ref: "Josué 1:9", text: "Não fui eu que ordenei a você? Seja forte e corajoso! Não se apavore nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar." },
  { ref: "Isaías 41:10", text: "Não tema, pois estou com você; não tenha medo, pois sou o seu Deus. Eu o fortalecerei e o ajudarei; eu o segurarei com a minha mão direita vitoriosa." },
  { ref: "Jeremias 29:11", text: "Porque sou eu que conheço os planos que tenho para vocês, diz o Senhor, planos de prosperar vocês e não de causar dano, planos de dar esperança e um futuro." },
  { ref: "Filipenses 4:13", text: "Tudo posso naquele que me fortalece." },
  { ref: "Salmo 23:1", text: "O Senhor é o meu pastor; de nada terei falta." },
  { ref: "Provérbios 3:5-6", text: "Confie no Senhor de todo o seu coração e não se apóie em seu próprio entendimento; reconheça o Senhor em todos os seus caminhos, e ele endireitará as suas veredas." },
  { ref: "Romanos 8:28", text: "Sabemos que Deus age em todas as coisas para o bem daqueles que o amam, dos que foram chamados de acordo com o seu propósito." },
  { ref: "Gálatas 6:9", text: "E não nos cansemos de fazer o bem, pois no tempo próprio colheremos, se não desanimarmos." },
  { ref: "Salmo 121:1-2", text: "Elevo os meus olhos para os montes: de onde me virá o socorro? O meu socorro vem do Senhor, que fez os céus e a terra." },
  { ref: "1 Coríntios 15:58", text: "Portanto, meus amados irmãos, mantenham-se firmes, inabaláveis, sempre abundantes na obra do Senhor, sabendo que o seu trabalho no Senhor não é em vão." },
  { ref: "Hebreus 10:24-25", text: "Consideremos uns aos outros para nos incentivarmos ao amor e às boas obras. Não deixemos de nos reunir como igreja, mas encorajemo-nos uns aos outros." },
  { ref: "Salmo 37:5", text: "Entregue o seu caminho ao Senhor; confie nele, e ele agirá." },
  { ref: "2 Crônicas 15:7", text: "Mas vocês, sejam fortes e não desanimem, pois o trabalho de vocês será recompensado." },
  { ref: "Romanos 12:11-12", text: "Nunca lhes falte o zelo; sejam fervorosos no espírito, servindo ao Senhor. Alegrem-se na esperança, sejam pacientes na tribulação, perseverem na oração." },
  { ref: "Salmo 46:1", text: "Deus é o nosso refúgio e a nossa força, socorro bem presente na hora da angústia." },
  { ref: "Provérbios 16:3", text: "Consagre ao Senhor tudo o que você faz, e os seus planos serão bem-sucedidos." },
  { ref: "Efésios 2:10", text: "Porque somos criação de Deus, realizados em Cristo Jesus para fazermos boas obras, as quais Deus preparou de antemão para que nós as praticássemos." },
  { ref: "Isaías 40:31", text: "Mas aqueles que esperam no Senhor renovam as suas forças. Voam alto como águias; correm e não se cansam, caminham e não se fatigam." },
  { ref: "Filipenses 2:3-4", text: "Nada façam por ambição egoísta ou por vaidade, mas humildemente considerem os outros superiores a si mesmos. Cada um cuide, não somente dos seus interesses, mas também dos interesses dos outros." },
  { ref: "1 Tessalonicenses 5:11", text: "Por isso, edifiquem-se e encorajem-se uns aos outros, como de fato vocês estão fazendo." }
];

interface ButtonConfig {
  id: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
}

const BUTTONS: ButtonConfig[] = [
  { id: 'presenca',           label: 'Acompanhamento', subtitle: 'Chamada e presença',       icon: ClipboardCheck,       accent: 'var(--power-orange)' },
  { id: 'membros',            label: 'Membros',        subtitle: 'Cadastro e perfil',        icon: Users,                accent: 'var(--power-orange)' },
  { id: 'aniversariantes',    label: 'Aniversariantes', subtitle: 'Aniversários do mês',     icon: Cake,                 accent: 'var(--power-orange)' },
  { id: 'departamentos',      label: 'Departamentos',  subtitle: 'Ministérios e funções',    icon: ChartNoAxesCombined, accent: 'var(--power-orange)' },
  { id: 'agenda',             label: 'Agenda',         subtitle: 'Eventos e programação',   icon: CalendarDays,         accent: '#059669' },
  { id: 'radar',              label: 'Radar',          subtitle: 'Métricas e crescimento',  icon: Crosshair,            accent: '#d97706' },
  { id: 'relatorios',         label: 'Relatórios',     subtitle: 'Dados e análises',        icon: BarChart3,            accent: '#dc2626' },
  { id: 'missoes-especiais',  label: 'Missões especiais', subtitle: 'Campanhas e metas',    icon: Sparkles,             accent: 'var(--power-orange)' },
  { id: 'configuracoes',      label: 'Configurações',  subtitle: 'Ajustes do sistema',      icon: Settings,             accent: '#475569' },
  { id: 'dashboard',          label: 'Dashboard',      subtitle: 'Visão geral da igreja',   icon: ChartNoAxesCombined, accent: '#d94f00' },
];

const VIEW_PERMISSIONS: Record<string, string[]> = {
  'presenca':          ['Pastor Admin', 'Pastor', 'Secretaria Geral', 'Líder', 'Multiplicador'],
  'membros':           ['Pastor Admin', 'Pastor', 'Secretaria Geral', 'Líder', 'Multiplicador'],
  'aniversariantes':   ['Pastor Admin', 'Pastor', 'Secretaria Geral', 'Líder', 'Multiplicador'],
  'departamentos':     ['Pastor Admin', 'Pastor', 'Secretaria Geral'],
  'agenda':            ['Pastor Admin', 'Pastor', 'Secretaria Geral', 'Líder', 'Multiplicador'],
  'radar':             ['Pastor Admin', 'Pastor', 'Secretaria Geral', 'Líder'],
  'relatorios':        ['Pastor Admin', 'Pastor', 'Secretaria Geral', 'Líder'],
  'missoes-especiais': ['Pastor Admin', 'Pastor', 'Secretaria Geral', 'Líder'],
  'configuracoes':     ['Pastor Admin', 'Pastor', 'Secretaria Geral'],
  'dashboard':         ['Pastor Admin', 'Pastor', 'Secretaria Geral', 'Líder', 'Multiplicador'],
};

function isRoleAllowed(role: string, viewId: string): boolean {
  const allowed = VIEW_PERMISSIONS[viewId];
  if (!allowed) return true;
  return allowed.includes(role);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getNextEvent(events: ChurchEvent[], department?: string): ChurchEvent | null {
  const today = getLocalDateISO();
  const upcoming = events
    .filter(e => !e.deleted && e.date >= today && (!department || !e.department || isSameDepartment(e.department, department)))
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] || null;
}

function getTodayBirthdays(db: AppDatabase, department?: string): number {
  const today = new Date();
  const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return db.people.filter(p => {
    if (!p.birthDate || p.deleted) return false;
    if (department && !personInDepartment(p, department)) return false;
    const bd = p.birthDate.substring(5);
    return bd === md;
  }).length;
}

export const InicioView: React.FC<InicioViewProps> = ({ db, session, onNavigate, onChangeDepartment }) => {
  const isRestricted = session.role === 'Líder' || session.role === 'Multiplicador';
  const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const verse = VERSICULOS[dayOfYear % VERSICULOS.length];
  const allowedButtons = BUTTONS.filter(btn => isRoleAllowed(session.role, btn.id));

  const stats = useMemo(() => {
    const deptFilter = session.department;
    const members = db.people.filter(p => {
      // O cartão diz "Membros ativos": visitantes não entram nesta contagem.
      // Mantém o mesmo critério usado no Dashboard e em todos os aparelhos.
      if (p.deleted || p.status !== 'Ativo') return false;
      if (deptFilter) {
        return personInDepartment(p, deptFilter);
      }
      return true;
    });

    return {
      totalMembers: members.length,
      archivedMembers: db.people.filter(p => !p.deleted && p.status === 'Arquivado').length,
      deletedMembers: db.people.filter(p => p.deleted).length,
      todayBirthdays: getTodayBirthdays(db, deptFilter),
      nextEvent: getNextEvent(db.events || [], deptFilter),
      departmentsCount: db.departments.filter(d => !d.deleted).length,
    };
  }, [db, session.role, session.department, isRestricted]);

  const getGreetingMessage = () => {
    const greetings = [
      { text: "Alguém espera por você!", subtext: "Bem-vindo de volta! Cada chamada, abraço ou palavra sua faz toda a diferença para o Reino. Vamos cuidar das vidas juntos!" },
      { text: "Você é essencial no Reino!", subtext: "Que bom ver você de novo! Esta ferramenta ajuda no controle, mas é o Senhor Deus quem garante a vitória no seu ministério!" },
      { text: "Não desanime na caminhada!", subtext: "O seu trabalho e dedicação ao pastorear e multiplicar têm valor eterno. Deus é a sua força e a vitória é garantida!" },
      { text: "A paz do Senhor Jesus!", subtext: "Seja muito bem-vindo! Uma palavra de carinho ou oração sua hoje pode mudar o dia de alguém. O Reino precisa de você!" },
      { text: "Guerreiro do Reino!", subtext: "Pronto para mais um dia de serviço e cuidado? Faça o seu melhor hoje, pois o Senhor Deus proverá a vitória!" },
      { text: "A colheita é grande!", subtext: "Que o Senhor Deus abençoe rica e abundantemente o seu ministério neste dia. Prossiga cuidando de cada ovelha com amor!" },
      { text: "Bem-vindo de volta!", subtext: "Que alegria ver você aqui! Lembre-se: o pastoreio é uma missão sublime e Deus guiará seus passos para o sucesso!" },
      { text: "Deus está na direção!", subtext: "Mais um dia para fazer a diferença. Esta ferramenta facilita a gestão, mas a unção e a garantia de vitória vêm do Senhor!" },
      { text: "Sua dedicação gera frutos!", subtext: "Obrigado por se doar ao pastoreio das vidas. Alguém hoje precisa do seu cuidado e atenção!" },
      { text: "Força e ânimo novo!", subtext: "Que o Senhor te dê renovo e sabedoria hoje para liderar e abençoar cada participante do seu departamento!" },
      { text: "Juntos somos mais fortes!", subtext: "A cooperação e o amor fraternal edificam a igreja. Continue liderando com fé, dedicação e alegria no coração!" },
      { text: "Renovo ministerial!", subtext: "Que o Espírito Santo derrame unção fresca sobre sua vida hoje para pastorear, ensinar e acolher com sabedoria!" },
      { text: "Sua fé inspira a igreja!", subtext: "Continue firme no propósito! Cada vida resgatada é um motivo de grande festa no céu e vitória aqui na terra!" },
      { text: "Perseverança vitoriosa!", subtext: "Nenhum esforço no Senhor é em vão. Mantenha o foco nas ovelhas e na unidade da igreja para grandes colheitas!" },
      { text: "Graça e paz multiplicadas!", subtext: "Que o amor de Cristo constranja nosso coração a buscar cada membro com compaixão, cuidado e dedicação total!" }
    ];
    return greetings[dayOfYear % greetings.length];
  };

  const greeting = getGreetingMessage();

  // ═══ INSTALAÇÃO COMO APP (PWA) ═══
  // Captura o evento beforeinstallprompt (disparado pelo navegador quando o
  // site pode ser instalado como app no celular/PC) e mostra um botão.
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    // Se o app já está instalado (standalone), não mostra o botão
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  const portalData = useMemo(() => {
    const department = session.department;
    const visibleAttendance = (db.attendances || [])
      .filter(a => !a.deleted && (!department || isSameDepartment(a.department, department)))
      .sort((a, b) => b.date.localeCompare(a.date));
    const latest = visibleAttendance[0] || null;
    const members = (db.people || []).filter(p =>
      !p.deleted && p.status === 'Ativo' && (!department || personInDepartment(p, department))
    );
    const visitorCount = (db.people || []).filter(p =>
      !p.deleted && p.status === 'Visitante' && (!department || personInDepartment(p, department))
    ).length;
    const recentAttendance = visibleAttendance.slice(0, 4).map(record => ({
      id: record.id,
      date: record.date,
      type: record.type,
      department: record.department,
      count: (record.presentIds || []).length,
    }));
    return { latest, members, visitorCount, recentAttendance, totalCalls: visibleAttendance.length };
  }, [db, session.department]);

  const firstName = session.name.split(' ')[0] || session.name;
  const primaryButtons = allowedButtons.filter(btn =>
    ['presenca', 'membros', 'dashboard', 'radar'].includes(btn.id)
  );
  const secondaryButtons = allowedButtons.filter(btn =>
    !['presenca', 'membros', 'dashboard', 'radar'].includes(btn.id)
  );

  return (
    <main className="page-container power-home ebd-portal-home">
      <header className="ebd-portal-welcome" aria-labelledby="inicio-title">
        <div className="ebd-portal-welcome-main">
          <span className="ebd-portal-eyebrow">IEAD-JOTA · CENTRAL MINISTERIAL</span>
          <h1 id="inicio-title">A paz do Senhor, {firstName}!</h1>
          <p>Bem-vindo ao seu espaço de acompanhamento. Tudo que importa para cuidar das vidas, em um só lugar.</p>
          <div className="ebd-portal-persona">
            <span className="ebd-portal-avatar" aria-hidden="true">{getInitials(session.name)}</span>
            <span><strong>{session.role}</strong>{session.department ? ` · ${session.department}` : ' · Visão geral'}</span>
          </div>
        </div>
        <div className="ebd-portal-welcome-actions">
          {primaryButtons.some(btn => btn.id === 'presenca') && (
            <button className="ebd-portal-hero-action" onClick={() => onNavigate('presenca')}>
              <ClipboardCheck size={18} aria-hidden="true" /> Fazer chamada
            </button>
          )}
          <button className="ebd-portal-hero-secondary" onClick={() => onNavigate('tutorial')}>
            <BookOpen size={17} aria-hidden="true" /> Orientações
          </button>
          {installPrompt && !isInstalled && (
            <button className="ebd-portal-hero-secondary" onClick={handleInstallApp}>
              <Download size={17} aria-hidden="true" /> Instalar aplicativo
            </button>
          )}
        </div>
      </header>

      <section className="ebd-portal-stats" aria-label="Resumo do ministério">
        <article className="ebd-portal-metric">
          <div className="ebd-portal-metric-icon violet"><Users size={22} aria-hidden="true" /></div>
          <div><span>Membros ativos</span><strong>{stats.totalMembers}</strong><small>Cadastros em acompanhamento</small></div>
        </article>
        <article className="ebd-portal-metric">
          <div className="ebd-portal-metric-icon teal"><ClipboardCheck size={22} aria-hidden="true" /></div>
          <div><span>Última chamada</span><strong>{portalData.latest ? (portalData.latest.presentIds || []).length : '—'}</strong><small>{portalData.latest ? `Presentes · ${portalData.latest.date.split('-').reverse().join('/')}` : 'Nenhuma chamada encontrada'}</small></div>
        </article>
        <article className="ebd-portal-metric">
          <div className="ebd-portal-metric-icon orange"><ChartNoAxesCombined size={22} aria-hidden="true" /></div>
          <div><span>Chamadas registradas</span><strong>{portalData.totalCalls}</strong><small>Histórico disponível</small></div>
        </article>
        <article className="ebd-portal-metric">
          <div className="ebd-portal-metric-icon magenta"><Cake size={22} aria-hidden="true" /></div>
          <div><span>Aniversariantes hoje</span><strong>{stats.todayBirthdays}</strong><small>Celebrar e acolher</small></div>
        </article>
        {session.role === 'Pastor Admin' && (
          <article className="ebd-portal-metric ebd-portal-metric-archive">
            <div className="ebd-portal-metric-icon violet"><Settings size={20} aria-hidden="true" /></div>
            <div><span>Arquivados / Excluídos</span><strong>{stats.archivedMembers} / {stats.deletedMembers}</strong><small>Visível apenas ao administrador</small></div>
          </article>
        )}
      </section>

      <div className="ebd-portal-columns">
        <div className="ebd-portal-main-column">
          <section className="ebd-portal-section" aria-labelledby="ebd-actions-title">
            <div className="ebd-portal-section-head">
              <div><span className="ebd-portal-eyebrow">AÇÃO RÁPIDA</span><h2 id="ebd-actions-title">O que você precisa fazer?</h2></div>
            </div>
            <div className="ebd-portal-primary-actions">
              {primaryButtons.map(btn => (
                <button key={btn.id} className="ebd-portal-action" onClick={() => onNavigate(btn.id)}>
                  <span className="ebd-portal-action-symbol">{React.createElement(btn.icon, { size: 24, 'aria-hidden': true })}</span>
                  <strong>{btn.id === 'presenca' ? 'Chamadas' : btn.label}</strong>
                  <small>{btn.subtitle}</small>
                  <span className="ebd-portal-action-chevron" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </section>

          <section className="ebd-portal-section" aria-labelledby="ebd-calls-title">
            <div className="ebd-portal-section-head">
              <div><span className="ebd-portal-eyebrow">ACOMPANHAMENTO</span><h2 id="ebd-calls-title">Chamadas recentes</h2></div>
              {allowedButtons.some(btn => btn.id === 'presenca') && (
                <button className="ebd-portal-inline-action" onClick={() => onNavigate('presenca')}>Ver chamadas →</button>
              )}
            </div>
            {portalData.recentAttendance.length === 0 ? (
              <p className="ebd-portal-empty">Ainda não existem chamadas disponíveis para seu departamento.</p>
            ) : (
              <div className="ebd-portal-calls">
                {portalData.recentAttendance.map(item => (
                  <div className="ebd-portal-call" key={item.id}>
                    <span className="ebd-portal-call-icon"><ClipboardCheck size={18} aria-hidden="true" /></span>
                    <div className="ebd-portal-call-main">
                      <strong>{item.type || 'Chamada'}</strong>
                      <small>{item.department || 'Geral'} · {item.date.split('-').reverse().join('/')}</small>
                    </div>
                    <strong className="ebd-portal-call-count">{item.count} <small>presentes</small></strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="ebd-portal-side-column" aria-label="Programação e atalhos">
          <section className="ebd-portal-section ebd-portal-next" aria-labelledby="ebd-next-title">
            <span className="ebd-portal-eyebrow">PROGRAMAÇÃO</span>
            <h2 id="ebd-next-title">Próximo evento</h2>
            {stats.nextEvent ? (
              <>
                <strong className="ebd-portal-event-title">{stats.nextEvent.title}</strong>
                <time dateTime={stats.nextEvent.date}>{stats.nextEvent.date.split('-').reverse().join('/')}</time>
                {allowedButtons.some(btn => btn.id === 'agenda') && (
                  <button className="ebd-portal-inline-action" onClick={() => onNavigate('agenda')}>Abrir agenda →</button>
                )}
              </>
            ) : (
              <p className="ebd-portal-empty">Nenhum evento futuro cadastrado.</p>
            )}
          </section>
          <section className="ebd-portal-section" aria-labelledby="ebd-other-title">
            <div className="ebd-portal-section-head">
              <div><span className="ebd-portal-eyebrow">SERVIÇOS</span><h2 id="ebd-other-title">Outras áreas</h2></div>
            </div>
            <div className="ebd-portal-service-list">
              {secondaryButtons.map(btn => (
                <button className="ebd-portal-service" key={btn.id} onClick={() => onNavigate(btn.id)}>
                  {React.createElement(btn.icon, { size: 19, 'aria-hidden': true })}
                  <span>{btn.label}</span><span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
          <section className="ebd-portal-verse" aria-label="Mensagem do dia">
            <span className="ebd-portal-eyebrow">PALAVRA PARA HOJE</span>
            <blockquote>“{verse.text}”</blockquote>
            <cite>{verse.ref}</cite>
            <strong>{greeting.text}</strong>
          </section>
        </aside>
      </div>
    </main>
  );
};
