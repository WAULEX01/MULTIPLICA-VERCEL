import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Heart,
  HeartHandshake,
  Plus,
  Sparkles,
  Users,
  UserRoundPlus,
} from "lucide-react";
import { useStore } from "../store";
import {
  departments,
  deptName,
  formatDate,
  localDate,
  type Route,
} from "../types";
import { Avatar, Metric, SectionTitle, TextLink } from "../ui";
export default function Dashboard({ go }: { go: (r: Route) => void }) {
  const { members, attendance, contacts, role, allowedDepartments } =
    useStore();
  const active = members.filter((m) => m.status !== "Arquivado"),
    care = active.filter(
      (m) => m.needsCare && !contacts.some((c) => c.personId === m.id),
    ),
    integration = active.filter((m) => m.status === "Em integração");
  const recent = [...attendance]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const date = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Boa_Vista",
  });
  const birthday = active.filter(
    (m) => m.birth.slice(5, 7) === localDate().slice(5, 7),
  );
  return (
    <>
      <div className="greeting">
        <div>
          <p className="eyebrow">PAZ DO SENHOR, PR. WAGNER</p>
          <h1>
            Bom ter você por aqui<span className="orange-text">.</span>
          </h1>
          <p className="subtitle">
            Uma visão do cuidado com a nossa comunidade.
          </p>
        </div>
        <span className="date-chip">
          <CalendarDays size={16} />
          {date}
        </span>
      </div>
      <section className="welcome-banner">
        <div>
          <span className="micro-label">
            <span />
            PESSOAS NO CENTRO
          </span>
          <h2>
            Cada pessoa importa.
            <br />
            Cada cuidado faz diferença.
          </h2>
          <p>Transforme informação em presença, acolhimento e conexão.</p>
          <button className="button dark" onClick={() => go("cuidado")}>
            Ver pessoas para acompanhar <ArrowRight size={17} />
          </button>
        </div>
        <div className="community-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="art-avatar art-one">AM</span>
          <span className="art-avatar art-two">BR</span>
          <span className="art-avatar art-three">CA</span>
          <span className="art-avatar art-four">DC</span>
          <span className="art-core">
            <Heart size={35} />
          </span>
          <span className="art-label">
            <span />
            Conectados pelo cuidado
          </span>
          <span className="art-spark">
            <Sparkles size={19} />
          </span>
        </div>
      </section>
      <section className="metrics-grid" aria-label="Indicadores da prévia">
        <Metric
          label="Pessoas cadastradas"
          value={active.length}
          detail="No seu alcance de acesso"
          icon={Users}
        />
        <Metric
          label="Em integração"
          value={integration.length}
          detail="Para acolher e acompanhar"
          icon={UserRoundPlus}
          tone="blue"
        />
        <Metric
          label="Precisam de cuidado"
          value={care.length}
          detail="Ainda sem contato registrado"
          icon={HeartHandshake}
          tone="purple"
        />
        <Metric
          label="Chamadas registradas"
          value={attendance.length}
          detail="Nesta prévia interativa"
          icon={ClipboardCheck}
          tone="green"
        />
      </section>
      <div className="dashboard-columns">
        <section className="panel care-panel">
          <SectionTitle
            title="Um contato pode fazer a diferença"
            description="Pessoas sinalizadas para acompanhamento"
            action={
              <TextLink onClick={() => go("cuidado")}>Ver todos</TextLink>
            }
          />
          {care.length ? (
            care.slice(0, 3).map((m, i) => (
              <div className="person-row" key={m.id}>
                <Avatar name={m.name} tone={i} />
                <div className="person-copy">
                  <strong>{m.name}</strong>
                  <small>{m.departments.map(deptName).join(" · ")}</small>
                </div>
                <button className="small-button" onClick={() => go("cuidado")}>
                  Acompanhar <ArrowUpRight size={15} />
                </button>
              </div>
            ))
          ) : (
            <div className="mini-empty">
              <Check size={24} />
              <strong>Cuidado em dia por aqui</strong>
              <span>Os contatos registrados aparecem na tela Cuidado.</span>
            </div>
          )}
          <div className="panel-footnote">
            <span className="small-dot amber" />
            Sinalizações de demonstração; não são faltas reais da igreja.
          </div>
        </section>
        <section className="panel recent-panel">
          <SectionTitle
            title="Presença e comunhão"
            description="Suas chamadas mais recentes"
            action={
              <span className="icon-soft">
                <ClipboardCheck size={20} />
              </span>
            }
          />
          {recent.length ? (
            <div className="recent-calls">
              {recent.map((a) => (
                <div className="call-row" key={a.id}>
                  <span className="calendar-square">
                    <small>{formatDate(a.date).split(" ")[1]}</small>
                    <strong>{a.date.slice(-2)}</strong>
                  </span>
                  <div>
                    <strong>{deptName(a.department)}</strong>
                    <small>
                      {a.type} · {a.present.length} de {a.roster.length}{" "}
                      presentes
                    </small>
                  </div>
                  <span className="call-rate">
                    {a.roster.length
                      ? Math.round((a.present.length / a.roster.length) * 100)
                      : 0}
                    %
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="first-call">
              <span className="call-illustration">
                <ClipboardCheck size={34} />
                <i>
                  <Plus size={13} />
                </i>
              </span>
              <h3>O próximo encontro começa aqui</h3>
              <p>
                Faça a primeira chamada e acompanhe a participação do seu
                departamento.
              </p>
            </div>
          )}
          {role !== "multiplicador" && (
            <button
              className="button outline full"
              onClick={() => go("chamada")}
            >
              Abrir chamada <ArrowRight size={17} />
            </button>
          )}
        </section>
      </div>
      <div className="dashboard-columns lower">
        <section>
          <SectionTitle
            title="Uma igreja, muitos caminhos"
            description="Departamentos conectados pelo mesmo propósito"
            action={
              role !== "multiplicador" ? (
                <TextLink onClick={() => go("departamentos")}>
                  Explorar
                </TextLink>
              ) : undefined
            }
          />
          <div className="department-tiles">
            {departments
              .filter((d) => allowedDepartments.includes(d.id))
              .slice(0, 4)
              .map((d) => (
                <button
                  className="dept-tile"
                  key={d.id}
                  onClick={() =>
                    go(role === "multiplicador" ? "membros" : "departamentos")
                  }
                >
                  <span
                    className="dept-symbol"
                    style={{ color: d.color, background: d.color + "13" }}
                  >
                    {d.initial}
                  </span>
                  <span>
                    <strong>{d.name}</strong>
                    <small>
                      {
                        active.filter((m) => m.departments.includes(d.id))
                          .length
                      }{" "}
                      pessoas
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
          </div>
        </section>
        <section className="birthday-card">
          <span className="icon-soft rose">
            <CalendarDays size={21} />
          </span>
          <div>
            <span className="eyebrow">CELEBRAR TAMBÉM É CUIDAR</span>
            <h3>
              {birthday.length}{" "}
              {birthday.length === 1 ? "aniversariante" : "aniversariantes"}{" "}
              neste mês
            </h3>
            <p>
              {birthday
                .slice(0, 2)
                .map((m) => m.name)
                .join(" e ") || "Nenhum aniversário nos cadastros visíveis."}
            </p>
            <button className="text-link" onClick={() => go("membros")}>
              Consultar pessoas <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
