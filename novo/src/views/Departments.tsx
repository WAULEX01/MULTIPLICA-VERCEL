import { ArrowUpRight, ClipboardCheck, Users } from "lucide-react";
import { useStore } from "../store";
import { departments, type Route } from "../types";
import { PageHeading } from "../ui";
export default function Departments({ go }: { go: (r: Route) => void }) {
  const { members, allowedDepartments, attendance, role } = useStore();
  return (
    <>
      <PageHeading
        eyebrow="SERVIR EM COMUNIDADE"
        title="Departamentos"
        subtitle={
          role === "lider"
            ? "Seus departamentos, reunidos em um só lugar."
            : "Diferentes gerações, um mesmo propósito."
        }
      />
      <div className="info-note">
        Uma pessoa pode participar de vários departamentos e aparece uma única
        vez no cadastro geral.
      </div>
      <div className="departments-grid">
        {departments
          .filter((d) => allowedDepartments.includes(d.id))
          .map((d) => (
            <article className="panel department-card" key={d.id}>
              <span
                className="department-line"
                style={{ background: d.color }}
              />
              <div className="department-card-top">
                <span
                  className="dept-symbol large"
                  style={{ color: d.color, background: d.color + "14" }}
                >
                  {d.initial}
                </span>
                <ArrowUpRight size={21} color={d.color} />
              </div>
              <h2>{d.name}</h2>
              <p>{d.subtitle}</p>
              <div className="department-numbers">
                <span>
                  <Users size={16} />
                  <strong>
                    {
                      members.filter(
                        (m) =>
                          m.departments.includes(d.id) &&
                          m.status !== "Arquivado",
                      ).length
                    }
                  </strong>{" "}
                  pessoas
                </span>
                <span>
                  <ClipboardCheck size={16} />
                  {attendance.filter((a) => a.department === d.id).length}{" "}
                  chamadas
                </span>
              </div>
              <button
                className="button outline full"
                onClick={() => go("membros")}
              >
                Consultar pessoas <ArrowUpRight size={16} />
              </button>
            </article>
          ))}
      </div>
    </>
  );
}
