import { useState, type FormEvent } from "react";
import { Check, HeartHandshake, MessageCircle, Plus } from "lucide-react";
import { useStore } from "../store";
import { deptName, formatDate, localDate, type Member } from "../types";
import { Avatar, Empty, Modal, PageHeading } from "../ui";
export default function Care() {
  const { members, contacts, saveContact, role } = useStore();
  const [tab, setTab] = useState("pendentes"),
    [selected, setSelected] = useState<Member | null>(null),
    [type, setType] = useState("Mensagem"),
    [note, setNote] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const pending = members.filter(
    (m) => m.needsCare && !contacts.some((c) => c.personId === m.id),
  );
  const people =
    tab === "pendentes"
      ? pending
      : members.filter((m) => m.status !== "Arquivado");
  function open(m: Member) {
    setSelected(m);
    setType("Mensagem");
    setNote("");
    setError("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await saveContact({
        id: crypto.randomUUID(),
        personId: selected.id,
        type,
        note: note.trim(),
        date: localDate(),
      });
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar contato.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="PROXIMIDADE QUE TRANSFORMA"
        title={
          role === "multiplicador"
            ? "Meu cuidado"
            : "Cuidar começa com um contato"
        }
        subtitle="Registre mensagens, ligações e visitas. Acompanhe cada passo."
      />
      <div className="care-banner">
        <span>
          <HeartHandshake size={28} />
        </span>
        <div>
          <strong>
            {pending.length}{" "}
            {pending.length === 1 ? "pessoa aguardando" : "pessoas aguardando"}{" "}
            acompanhamento
          </strong>
          <p>Um “como você está?” pode mudar o dia de alguém.</p>
        </div>
        <span className="tag neutral">Demonstração</span>
      </div>
      <div className="tabs" role="tablist" aria-label="Lista de acompanhamento">
        {[
          ["pendentes", "Para acompanhar"],
          ["todos", "Todas as pessoas"],
          ["historico", "Contatos registrados"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "pendentes" && <span>{pending.length}</span>}
          </button>
        ))}
      </div>
      {tab === "historico" ? (
        <div className="panel">
          {contacts.length ? (
            <div className="contact-timeline">
              {[...contacts]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((c) => (
                  <div className="timeline-row" key={c.id}>
                    <span className="icon-soft green">
                      <Check size={18} />
                    </span>
                    <div>
                      <strong>
                        {members.find((m) => m.id === c.personId)?.name ||
                          "Pessoa"}
                      </strong>
                      <small>
                        {c.type} · {formatDate(c.date)}
                      </small>
                      <p>{c.note || "Contato registrado sem observação."}</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <Empty
              title="O primeiro contato fica na memória"
              body="Registre um acompanhamento para começar este histórico."
            />
          )}
        </div>
      ) : (
        <div className="care-grid">
          {people.length ? (
            people.map((m, i) => (
              <article className="panel care-person-card" key={m.id}>
                <div className="care-card-head">
                  <Avatar name={m.name} tone={i} />
                  <span
                    className={`tag ${contacts.some((c) => c.personId === m.id) ? "status-active" : "status-new"}`}
                  >
                    {contacts.some((c) => c.personId === m.id)
                      ? "Contato registrado"
                      : "Para acompanhar"}
                  </span>
                </div>
                <h2>{m.name}</h2>
                <p>{m.departments.map(deptName).join(" · ")}</p>
                <div className="care-context">
                  <MessageCircle size={17} />
                  <span>
                    {m.status === "Em integração"
                      ? "Acolher e acompanhar a integração."
                      : m.needsCare
                        ? "Sinalizada para acompanhamento nesta prévia."
                        : "Manter os laços e a comunhão."}
                  </span>
                </div>
                <button className="button outline full" onClick={() => open(m)}>
                  <Plus size={17} />
                  Registrar contato
                </button>
              </article>
            ))
          ) : (
            <div className="panel empty-wide">
              <Empty
                title="Os contatos estão em dia"
                body="Você pode continuar acompanhando as outras pessoas ou consultar o histórico."
                action={
                  <button
                    className="button outline"
                    onClick={() => setTab("todos")}
                  >
                    Ver todas as pessoas
                  </button>
                }
              />
            </div>
          )}
        </div>
      )}
      {selected && (
        <Modal
          title={`Acompanhar ${selected.name.split(" ")[0]}`}
          onClose={() => {
            if (!saving) setSelected(null);
          }}
        >
          <form onSubmit={submit}>
            <div className="modal-body">
              <p className="form-hint">
                Registre um contato fictício para explorar o fluxo da prévia.
              </p>
              <label>
                Como foi o contato?
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option>Mensagem</option>
                  <option>Ligação</option>
                  <option>Visita</option>
                  <option>Conversa pessoal</option>
                </select>
              </label>
              <label>
                O que gostaria de registrar?
                <textarea
                  autoFocus
                  rows={4}
                  placeholder="Como a pessoa está? Qual o próximo passo?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              {error && (
                <div role="alert" className="form-error">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button outline"
                disabled={saving}
                onClick={() => setSelected(null)}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={saving}>
                <Check size={17} />
                {saving ? "Registrando…" : "Registrar contato"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
