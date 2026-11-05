import { useEffect, useState } from "react";
import { Check, ClipboardCheck, Save, Search } from "lucide-react";
import { useStore } from "../store";
import { departments, localDate } from "../types";
import { Avatar, Empty, PageHeading } from "../ui";
export default function Attendance() {
  const { members, attendance, saveAttendance, allowedDepartments } =
    useStore();
  const [department, setDepartment] = useState(allowedDepartments[0]),
    [date, setDate] = useState(localDate()),
    [type, setType] = useState("Culto"),
    [present, setPresent] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const id = `${date}:${department}:${type}`;
  const existing = attendance.find((a) => a.id === id);
  const roster = members
    .filter(
      (m) => m.status !== "Arquivado" && m.departments.includes(department),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const filtered = roster.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()),
  );
  useEffect(() => {
    setPresent(existing?.present || []);
    setDirty(false);
    setError("");
  }, [id, existing?.updatedAt]);
  function changeSession(fn: () => void) {
    if (
      dirty &&
      !confirm(
        "Há marcações não salvas. Deseja descartá-las e trocar a chamada?",
      )
    )
      return;
    fn();
  }
  async function save() {
    if (!date) return;
    setSaving(true);
    setError("");
    try {
      await saveAttendance({
        id,
        date,
        department,
        type,
        present: present.filter((p) => roster.some((m) => m.id === p)),
        roster: roster.map((m) => m.id),
        updatedAt: new Date().toISOString(),
      });
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    document.documentElement.dataset.unsaved = String(dirty);
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => {
      window.removeEventListener("beforeunload", guard);
      delete document.documentElement.dataset.unsaved;
    };
  }, [dirty]);
  const selected = present.filter((id) =>
    roster.some((m) => m.id === id),
  ).length;
  return (
    <>
      <PageHeading
        eyebrow="PRESENÇA QUE APROXIMA"
        title="Vamos fazer a chamada?"
        subtitle="Escolha o encontro e toque nas pessoas presentes."
      />
      <div className="panel attendance-controls">
        <label>
          Departamento
          <select
            value={department}
            onChange={(e) => changeSession(() => setDepartment(e.target.value))}
          >
            {departments
              .filter((d) => allowedDepartments.includes(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Data do encontro
          <input
            required
            type="date"
            value={date}
            max={localDate()}
            onChange={(e) => {
              if (e.target.value) changeSession(() => setDate(e.target.value));
            }}
          />
        </label>
        <label>
          Tipo de encontro
          <select
            value={type}
            onChange={(e) => changeSession(() => setType(e.target.value))}
          >
            <option>Culto</option>
            <option>EBD</option>
            <option>Ensaio</option>
            <option>Discipulado</option>
            <option>Outro encontro</option>
          </select>
        </label>
      </div>
      <div className="attendance-layout">
        <section className="panel">
          <div className="attendance-list-top">
            <label className="search-input">
              <Search size={18} />
              <span className="sr-only">Buscar na chamada</span>
              <input
                placeholder="Buscar pessoa na chamada…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <span className="tag neutral">{roster.length} pessoas</span>
          </div>
          {roster.length ? (
            <>
              <div className="attendance-hint">
                <span>Toque para marcar ou desmarcar</span>
                <button
                  className="text-link"
                  onClick={() => {
                    setPresent(
                      selected === roster.length ? [] : roster.map((m) => m.id),
                    );
                    setDirty(true);
                  }}
                >
                  {selected === roster.length
                    ? "Desmarcar todos"
                    : "Marcar todos"}
                </button>
              </div>
              <div className="attendance-list">
                {filtered.length ? (
                  filtered.map((m, i) => (
                    <button
                      className={`attendance-person ${present.includes(m.id) ? "present" : ""}`}
                      key={m.id}
                      aria-pressed={present.includes(m.id)}
                      onClick={() => {
                        setPresent((p) =>
                          p.includes(m.id)
                            ? p.filter((x) => x !== m.id)
                            : [...p, m.id],
                        );
                        setDirty(true);
                      }}
                    >
                      <Avatar name={m.name} tone={i} />
                      <span>
                        <strong>{m.name}</strong>
                        <small>{m.status}</small>
                      </span>
                      <span className="presence-check">
                        {present.includes(m.id) && <Check size={19} />}
                      </span>
                    </button>
                  ))
                ) : (
                  <Empty
                    title="Nenhuma pessoa com esse nome"
                    body="Tente outra busca dentro deste departamento."
                  />
                )}
              </div>
            </>
          ) : (
            <Empty
              title="O departamento ainda está vazio"
              body="Cadastre uma pessoa neste departamento para iniciar a chamada."
              action={
                <a className="button primary" href="#membros">
                  Ir para pessoas
                </a>
              }
            />
          )}
        </section>
        <aside className="attendance-summary panel">
          <span className="icon-soft green">
            <ClipboardCheck size={25} />
          </span>
          <h2>Resumo do encontro</h2>
          <p>Confira antes de salvar.</p>
          <div
            className="attendance-ring"
            style={{
              background: `conic-gradient(#438c76 ${roster.length ? (selected / roster.length) * 360 : 0}deg,#eef1ef 0deg)`,
            }}
          >
            <div>
              <strong>{selected}</strong>
              <span>presentes</span>
            </div>
          </div>
          <div className="summary-line">
            <span>Na lista</span>
            <strong>{roster.length}</strong>
          </div>
          <div className="summary-line">
            <span>Ainda não marcados</span>
            <strong>{roster.length - selected}</strong>
          </div>
          <div className="summary-status">
            <span className={`small-dot ${dirty ? "amber" : "green"}`} />
            {dirty
              ? "Alterações ainda não salvas"
              : existing
                ? "Chamada salva neste aparelho"
                : "Chamada ainda não registrada"}
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button primary full"
            disabled={!roster.length || saving || !date}
            onClick={save}
          >
            <Save size={18} />
            {saving ? "Salvando…" : "Salvar chamada"}
          </button>
          <small className="summary-disclaimer">
            A prévia não envia presenças para o banco da igreja.
          </small>
        </aside>
      </div>
    </>
  );
}
