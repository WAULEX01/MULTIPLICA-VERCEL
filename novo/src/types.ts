export type Role = "pastor" | "secretario" | "lider" | "multiplicador";
export type Route =
  | "painel"
  | "membros"
  | "chamada"
  | "cuidado"
  | "departamentos"
  | "ajustes";
export interface Member {
  id: string;
  name: string;
  phone: string;
  birth: string;
  address: string;
  departments: string[];
  status: "Ativo" | "Visitante" | "Em integração" | "Arquivado";
  note: string;
  needsCare: boolean;
  updatedAt: string;
}
export interface Attendance {
  id: string;
  date: string;
  department: string;
  type: string;
  present: string[];
  roster: string[];
  updatedAt: string;
}
export interface Contact {
  id: string;
  personId: string;
  type: string;
  note: string;
  date: string;
}
export const roles: Record<Role, string> = {
  pastor: "Pastor administrador",
  secretario: "Secretário",
  lider: "Líder",
  multiplicador: "Multiplicador",
};
export const departments = [
  {
    id: "infantil",
    name: "Infantil",
    subtitle: "Pequenos passos, grandes descobertas",
    color: "#df9237",
    initial: "IN",
  },
  {
    id: "adolescentes",
    name: "Adolescentes",
    subtitle: "Uma geração com propósito",
    color: "#8a68ce",
    initial: "AD",
  },
  {
    id: "jovens",
    name: "Jovens",
    subtitle: "Conexões que transformam",
    color: "#537bd7",
    initial: "JO",
  },
  {
    id: "irmas",
    name: "Irmãs",
    subtitle: "Cuidado e comunhão",
    color: "#c66d96",
    initial: "IR",
  },
  {
    id: "irmaos",
    name: "Irmãos",
    subtitle: "Caminhando juntos na fé",
    color: "#408e7b",
    initial: "IM",
  },
  {
    id: "obreiros",
    name: "Obreiros",
    subtitle: "Servir com amor e dedicação",
    color: "#617086",
    initial: "OB",
  },
  {
    id: "convertidos",
    name: "Novos convertidos",
    subtitle: "Acolher, acompanhar e discipular",
    color: "#c8793a",
    initial: "NC",
  },
];
export const localDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Boa_Vista" });
export const deptName = (id: string) =>
  departments.find((d) => d.id === id)?.name || id;
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
export const formatDate = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
