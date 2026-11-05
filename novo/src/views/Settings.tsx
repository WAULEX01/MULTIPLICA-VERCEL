import {
  Check,
  FlaskConical,
  HardDrive,
  LockKeyhole,
  ShieldCheck,
  Users,
  UserRound,
} from "lucide-react";
import { useStore } from "../store";
import { roles, type Role } from "../types";
import { PageHeading } from "../ui";
const descriptions: Record<Role, string> = {
  pastor: "Visão completa dos sete departamentos e das funções da prévia.",
  secretario: "Cadastro, chamada e acompanhamento em todos os departamentos.",
  lider: "Acesso de demonstração a Jovens e Adolescentes.",
  multiplicador:
    "Somente três pessoas atribuídas e o registro dos seus contatos.",
};
export default function Settings() {
  const { role, setRole, notify } = useStore();
  return (
    <>
      <PageHeading
        eyebrow="DO SEU JEITO"
        title="Explore a nova experiência"
        subtitle="Veja como a navegação muda para cada perfil da igreja."
      />
      <div className="settings-layout">
        <section className="panel settings-panel">
          <div className="section-title">
            <div>
              <h2>Perfis de acesso</h2>
              <p>Escolha um perfil para simular o que ele verá.</p>
            </div>
            <ShieldCheck size={23} />
          </div>
          <div className="role-options">
            {(Object.keys(roles) as Role[]).map((r) => (
              <button
                className={`role-option ${role === r ? "selected" : ""}`}
                key={r}
                onClick={() => {
                  setRole(r);
                  notify(`Visualização de ${roles[r].toLowerCase()} ativada.`);
                }}
              >
                <span className="icon-soft">
                  {r === "pastor" ? (
                    <ShieldCheck size={22} />
                  ) : r === "secretario" ? (
                    <Users size={22} />
                  ) : (
                    <UserRound size={22} />
                  )}
                </span>
                <span>
                  <strong>{roles[r]}</strong>
                  <small>{descriptions[r]}</small>
                </span>
                <span className="radio-circle">
                  {role === r && <Check size={14} />}
                </span>
              </button>
            ))}
          </div>
          <p className="form-hint">
            Esta troca serve para avaliar o produto. A autenticação e a proteção
            de dados no servidor serão implementadas na conexão com o Supabase.
          </p>
        </section>
        <aside className="panel preview-info">
          <span className="icon-soft orange">
            <FlaskConical size={24} />
          </span>
          <h2>Prévia 0.1</h2>
          <p>Um primeiro passo para uma gestão mais simples e próxima.</p>
          <div>
            <HardDrive size={19} />
            <span>
              <strong>Dados neste aparelho</strong>
              <small>
                Os cadastros de demonstração ficam no armazenamento do
                navegador.
              </small>
            </span>
          </div>
          <div>
            <LockKeyhole size={19} />
            <span>
              <strong>Banco da igreja preservado</strong>
              <small>
                Esta prévia não se conecta nem envia registros para a base
                atual.
              </small>
            </span>
          </div>
          <div>
            <Users size={19} />
            <span>
              <strong>Pessoas fictícias</strong>
              <small>
                Use somente informações de teste enquanto avalia as telas.
              </small>
            </span>
          </div>
          <p className="version-note">
            O ícone usado nesta prévia é uma proposta visual para o novo
            aplicativo.
          </p>
        </aside>
      </div>
    </>
  );
}
