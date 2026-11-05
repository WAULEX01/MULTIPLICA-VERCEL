import { useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Filter, Plus, Search, Users } from "lucide-react";
import { blankMember, useStore } from "../store";
import { departments, deptName, type Member } from "../types";
import { Avatar, Empty, Modal, PageHeading } from "../ui";
export default function Members() {
  const { members, role, saveMember, allowedDepartments } = useStore();
  const [search, setSearch] = useState(""),
    [dept, setDept] = useState("todos"),
    [status, setStatus] = useState("todos"),
    [editing, setEditing] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const canEdit = role !== "multiplicador";
  const filtered = useMemo(
    () =>
      members
        .filter(
          (m) =>
            m.name
              .toLocaleLowerCase("pt-BR")
              .normalize("NFD")
              .replace(/\p{Diacritic}/gu, "")
              .includes(
                search
                  .toLocaleLowerCase("pt-BR")
                  .normalize("NFD")
                  .replace(/\p{Diacritic}/gu, ""),
              ) &&
            (dept === "todos" || m.departments.includes(dept)) &&
            (status === "todos" || m.status === status),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [members, search, dept, status],
  );
  const open = (m: Member) => {
    setEditing({ ...m, departments: [...m.departments] });
    setError("");
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (editing.name.trim().length < 3) {
      setError("Informe o nome com pelo menos 3 letras.");
      return;
    }
    if (!editing.departments.length) {
      setError("Escolha pelo menos um departamento.");
      return;
    }
    setSaving(true);
    try {
      await saveMember({
        ...editing,
        name: editing.name.trim(),
        updatedAt: new Date().toISOString(),
      });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="CONHECER PARA CUIDAR"
        title="Pessoas"
        subtitle={
          role === "multiplicador"
            ? "Somente as pessoas atribuídas a você nesta simulação."
            : "Uma história, um nome, um lugar na nossa comunidade."
        }
        action={
          canEdit ? (
            <button
              className="button primary"
              onClick={() => open(blankMember())}
            >
              <Plus size={19} />
              Cadastrar pessoa
            </button>
          ) : undefined
        }
      />
      <div className="people-summary">
        <span className="icon-soft">
          <Users size={22} />
        </span>
        <div>
          <strong>
            {members.filter((m) => m.status !== "Arquivado").length} pessoas
          </strong>
          <span> no seu alcance de acesso</span>
        </div>
        <span className="tag neutral">Dados fictícios</span>
      </div>
      <div className="filterbar">
        <label className="search-input">
          <Search size={19} />
          <span className="sr-only">Buscar pessoas pelo nome</span>
          <input
            placeholder="Quem você está procurando?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="select-wrap">
          <Filter size={16} />
          <label className="sr-only" htmlFor="dept-filter">
            Departamento
          </label>
          <select
            id="dept-filter"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            <option value="todos">Todos os departamentos</option>
            {departments
              .filter((d) => allowedDepartments.includes(d.id))
              .map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>
        <label>
          <span className="sr-only">Situação</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="todos">Todas as situações</option>
            {["Ativo", "Visitante", "Em integração", "Arquivado"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="panel people-panel">
        <div className="list-caption">
          <strong>
            {filtered.length}{" "}
            {filtered.length === 1
              ? "pessoa encontrada"
              : "pessoas encontradas"}
          </strong>
          <span>Organizado por nome</span>
        </div>
        {filtered.length ? (
          <div className="people-list">
            <div className="people-table-head">
              <span>PESSOA</span>
              <span>DEPARTAMENTOS</span>
              <span>SITUAÇÃO</span>
              <span />
            </div>
            {filtered.map((m, i) => (
              <button
                className="people-table-row"
                key={m.id}
                onClick={() => open(m)}
              >
                <span className="person-cell">
                  <Avatar name={m.name} tone={i} />
                  <span>
                    <strong>{m.name}</strong>
                    <small>{m.phone || "Telefone não informado"}</small>
                  </span>
                </span>
                <span className="dept-tags">
                  {m.departments.map((d) => (
                    <span className="tag neutral" key={d}>
                      {deptName(d)}
                    </span>
                  ))}
                </span>
                <span>
                  <span
                    className={`tag status-${m.status === "Ativo" ? "active" : m.status === "Visitante" ? "visitor" : m.status === "Arquivado" ? "archived" : "new"}`}
                  >
                    <i />
                    {m.status}
                  </span>
                </span>
                <ArrowUpRight className="row-arrow" size={18} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title="Nenhuma pessoa encontrada"
            body="Tente outro nome ou altere os filtros."
            action={
              <button
                className="button outline"
                onClick={() => {
                  setSearch("");
                  setDept("todos");
                  setStatus("todos");
                }}
              >
                Limpar filtros
              </button>
            }
          />
        )}
      </div>
      {editing && (
        <Modal
          title={
            canEdit
              ? members.some((m) => m.id === editing.id)
                ? "Detalhes da pessoa"
                : "Cadastrar pessoa"
              : "Pessoa atribuída"
          }
          onClose={() => {
            if (!saving) setEditing(null);
          }}
        >
          <form onSubmit={submit}>
            <div className="modal-body">
              <p className="form-hint">
                Prévia: os dados são salvos somente neste aparelho. Use
                informações fictícias.
              </p>
              <label>
                Nome completo
                <input
                  autoFocus
                  required
                  minLength={3}
                  value={editing.name}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Telefone
                  <input
                    type="tel"
                    placeholder="(69) 99999-9999"
                    disabled={!canEdit}
                    value={editing.phone}
                    onChange={(e) =>
                      setEditing({ ...editing, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  Data de nascimento
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    disabled={!canEdit}
                    value={editing.birth}
                    onChange={(e) =>
                      setEditing({ ...editing, birth: e.target.value })
                    }
                  />
                </label>
              </div>
              {canEdit && (
                <>
                  <label>
                    Situação
                    <select
                      value={editing.status}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          status: e.target.value as Member["status"],
                        })
                      }
                    >
                      {["Ativo", "Visitante", "Em integração", "Arquivado"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <fieldset>
                    <legend>
                      Departamentos <span>Selecione um ou mais</span>
                    </legend>
                    <div className="department-checks">
                      {departments
                        .filter((d) => allowedDepartments.includes(d.id))
                        .map((d) => (
                          <label
                            key={d.id}
                            className={
                              editing.departments.includes(d.id)
                                ? "checked"
                                : ""
                            }
                          >
                            <input
                              type="checkbox"
                              checked={editing.departments.includes(d.id)}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  departments: e.target.checked
                                    ? [...editing.departments, d.id]
                                    : editing.departments.filter(
                                        (id) => id !== d.id,
                                      ),
                                })
                              }
                            />
                            {d.name}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                  <label>
                    Endereço
                    <input
                      value={editing.address}
                      onChange={(e) =>
                        setEditing({ ...editing, address: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Observações
                    <textarea
                      rows={3}
                      value={editing.note}
                      onChange={(e) =>
                        setEditing({ ...editing, note: e.target.value })
                      }
                    />
                  </label>
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={editing.needsCare}
                      onChange={(e) =>
                        setEditing({ ...editing, needsCare: e.target.checked })
                      }
                    />
                    Sinalizar para acompanhamento
                  </label>
                </>
              )}
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button outline"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                {canEdit ? "Cancelar" : "Fechar"}
              </button>
              {canEdit && (
                <button
                  type="submit"
                  className="button primary"
                  disabled={saving}
                >
                  <Check size={17} />
                  {saving ? "Salvando…" : "Salvar cadastro"}
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
