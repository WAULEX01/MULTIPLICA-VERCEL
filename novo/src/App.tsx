import {
  lazy,
  Suspense,
  useEffect,
  useState,
  Component,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  HeartHandshake,
  Network,
  Settings2,
  ChevronDown,
  ArrowUpRight,
  Check,
  Menu,
  X,
  FlaskConical,
  HardDrive,
  WifiOff,
} from "lucide-react";
import type { Route } from "./types";
import { roles } from "./types";
import { useStore } from "./store";
import { useAppUpdate } from "./useAppUpdate";
const Dashboard = lazy(() => import("./views/Dashboard"));
const Members = lazy(() => import("./views/Members"));
const Attendance = lazy(() => import("./views/Attendance"));
const Care = lazy(() => import("./views/Care"));
const Departments = lazy(() => import("./views/Departments"));
const Settings = lazy(() => import("./views/Settings"));
const nav = [
  { id: "painel", label: "Visão geral", icon: LayoutDashboard },
  { id: "membros", label: "Pessoas", icon: Users },
  { id: "chamada", label: "Chamada", icon: ClipboardCheck },
  { id: "cuidado", label: "Cuidado", icon: HeartHandshake },
  { id: "departamentos", label: "Departamentos", icon: Network },
] as const;
const valid: Route[] = [
  "painel",
  "membros",
  "chamada",
  "cuidado",
  "departamentos",
  "ajustes",
];
function getRoute(): Route {
  const value = location.hash.slice(1) as Route;
  return valid.includes(value) ? value : "painel";
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty">
        <h2>Não foi possível abrir esta tela</h2>
        <p>Confira a conexão e tente novamente.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Tentar novamente
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [route, setRoute] = useState<Route>(getRoute),
    [menu, setMenu] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const { role, loading, error, notice } = useStore();
  const updatePending = useAppUpdate();
  useEffect(() => {
    const listener = () => {
      setRoute(getRoute());
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", listener);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("hashchange", listener);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  const canLeave = () =>
    document.documentElement.dataset.unsaved !== "true" ||
    confirm("Há marcações não salvas. Deseja sair desta chamada?");
  const go = (r: Route) => {
    if (r !== route && !canLeave()) return;
    location.hash = r;
    setMenu(false);
  };
  const title = nav.find((n) => n.id === route)?.label || "Preferências";
  return (
    <div
      className="app"
      onClickCapture={(event) => {
        const link = (event.target as Element).closest('a[href^="#"]');
        const hash = link?.getAttribute("href");
        if (
          hash &&
          hash !== "#conteudo" &&
          hash !== `#${route}` &&
          !canLeave()
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="#painel">
          <img src="/brand.svg" width="42" height="42" alt="" />
          <div>
            multiplica
            <span>
              PLUS <small>GESTÃO & CUIDADO</small>
            </span>
          </div>
        </a>
        <button
          className="icon-button sidebar-close"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <div className="church-switch">
          <span className="church-monogram">AD</span>
          <div>
            <strong>IEAD · Templo JK</strong>
            <small>Ji-Paraná, Rondônia</small>
          </div>
        </div>
        <p className="nav-caption">ESPAÇO DA IGREJA</p>
        <nav aria-label="Navegação principal">
          {nav
            .filter(
              (n) =>
                role !== "multiplicador" ||
                ["painel", "membros", "cuidado"].includes(n.id),
            )
            .map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={`nav-item ${route === n.id ? "active" : ""}`}
                aria-current={route === n.id ? "page" : undefined}
              >
                <n.icon size={20} />
                {n.label}
                {n.id === "cuidado" && <span className="nav-dot" />}
              </a>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="purpose-card">
            <span className="purpose-icon">
              <HeartHandshake size={23} />
            </span>
            <strong>Cuidar é multiplicar.</strong>
            <p>
              Mais perto das pessoas.
              <br />
              Mais juntos no propósito.
            </p>
          </div>
          <a
            href="#ajustes"
            className={`nav-item ${route === "ajustes" ? "active" : ""}`}
          >
            <Settings2 size={20} />
            Preferências
          </a>
          <div className="sidebar-version">
            <span>Nova experiência</span>
            <span>0.1</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="Abrir menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={23} />
            </button>
            <span className="desktop-only">Meu espaço</span>
            <span className="breadcrumb-sep desktop-only">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-status">
              <HardDrive size={14} />
              <span>Prévia local</span>
            </span>
            <button
              className="profile-button"
              onClick={() => go("ajustes")}
              aria-label="Alterar perfil da prévia"
            >
              <span className="profile-avatar">WC</span>
              <span className="profile-text">
                <strong>Pr. Wagner</strong>
                <small>{roles[role]}</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <div className="demo-ribbon">
          <FlaskConical size={15} />
          <span>
            Prévia interativa{" "}
            <span className="ribbon-detail">
              · dados fictícios, salvos somente neste aparelho
            </span>
          </span>
          <button onClick={() => go("ajustes")}>
            Explorar perfis <ArrowUpRight size={14} />
          </button>
        </div>
        {!online && (
          <div className="offline-banner">
            <WifiOff size={17} />
            Sem conexão. Os registros de demonstração continuam disponíveis
            neste aparelho.
          </div>
        )}
        {updatePending && (
          <div className="offline-banner" role="status">
            Nova versão pronta. Ela será aplicada automaticamente após você
            concluir a ação atual e fazer uma pausa.
          </div>
        )}
        <main id="conteudo" tabIndex={-1}>
          <Boundary>
            {error ? (
              <div className="error-state">
                <h1>O armazenamento não está disponível</h1>
                <p>{error}</p>
                <p>
                  Abra em uma janela normal e permita o armazenamento de sites.
                </p>
                <button
                  className="button primary"
                  onClick={() => location.reload()}
                >
                  Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <div className="skeleton-grid" aria-label="Carregando a prévia">
                <div />
                <div />
                <div />
                <div />
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="screen-loading" role="status">
                    Abrindo tela…
                  </div>
                }
              >
                {route === "painel" ? (
                  <Dashboard go={go} />
                ) : route === "membros" ? (
                  <Members />
                ) : route === "chamada" ? (
                  role === "multiplicador" ? (
                    <Care />
                  ) : (
                    <Attendance />
                  )
                ) : route === "cuidado" ? (
                  <Care />
                ) : route === "departamentos" ? (
                  role === "multiplicador" ? (
                    <Care />
                  ) : (
                    <Departments go={go} />
                  )
                ) : (
                  <Settings />
                )}
              </Suspense>
            )}
          </Boundary>
        </main>
        <footer className="workspace-footer">
          <span>IEAD · JOTA</span>
          <span>Uma igreja que ama, cuida e discipula.</span>
        </footer>
        <nav className="bottom-nav" aria-label="Navegação móvel">
          {nav
            .filter(
              (n) =>
                role !== "multiplicador" ||
                ["painel", "membros", "cuidado"].includes(n.id),
            )
            .map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={route === n.id ? "active" : ""}
                aria-current={route === n.id ? "page" : undefined}
              >
                <n.icon size={21} />
                <span>
                  {n.id === "painel"
                    ? "Início"
                    : n.id === "departamentos"
                      ? "Grupos"
                      : n.label}
                </span>
              </a>
            ))}
        </nav>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>
            <Check size={17} />
          </span>
          {notice}
        </div>
      )}
    </div>
  );
}
