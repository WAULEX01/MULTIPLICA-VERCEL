import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Member, Attendance, Contact, Role } from "./types";
import { localDate } from "./types";

const names = [
  "Ana Martins",
  "Bruno Ribeiro",
  "Carolina Alves",
  "Daniel Costa",
  "Elisa Mendes",
  "Felipe Rocha",
  "Gabriela Lima",
  "Henrique Souza",
  "Isabela Dias",
  "João Monteiro",
  "Laura Nunes",
  "Lucas Pereira",
  "Mariana Castro",
  "Mateus Freitas",
  "Natália Ramos",
  "Pedro Almeida",
  "Rafaela Duarte",
  "Samuel Barros",
  "Sofia Azevedo",
  "Tiago Fernandes",
  "Valentina Moura",
  "Vinícius Melo",
  "Yasmin Teixeira",
  "André Carvalho",
];
const deptIds = [
  "infantil",
  "adolescentes",
  "jovens",
  "irmas",
  "irmaos",
  "obreiros",
  "convertidos",
];
const seed = (): Member[] =>
  names.map((name, i) => ({
    id: `demo-${i + 1}`,
    name,
    phone: "",
    birth: `${i < 2 ? "2017" : "1995"}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 25) + 1).padStart(2, "0")}`,
    address: "",
    departments: [
      ...new Set(i > 18 ? [deptIds[i % 7], "obreiros"] : [deptIds[i % 7]]),
    ],
    status: i % 8 === 0 ? "Em integração" : i % 9 === 0 ? "Visitante" : "Ativo",
    note: "Cadastro fictício para avaliação da nova experiência.",
    needsCare: [2, 5, 8, 12, 18].includes(i),
    updatedAt: new Date().toISOString(),
  }));
let dbPromise: Promise<IDBDatabase> | undefined;
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("multiplica-novo-demo")
    : null;
function db() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("multiplica-novo-demo-v1", 1);
      req.onupgradeneeded = () => {
        for (const name of ["members", "attendance", "contacts"])
          req.result.createObjectStore(name, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(
          new Error("Não foi possível abrir o armazenamento deste navegador."),
        );
    });
  return dbPromise;
}
async function all<T>(store: string): Promise<T[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function put<T>(store: string, value: T) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => {
      channel?.postMessage({ store });
      resolve();
    };
    tx.onerror = () =>
      reject(
        new Error("Não foi possível salvar neste aparelho. Tente novamente."),
      );
  });
}
interface AppStore {
  members: Member[];
  attendance: Attendance[];
  contacts: Contact[];
  role: Role;
  setRole: (r: Role) => void;
  loading: boolean;
  error: string;
  saveMember: (m: Member) => Promise<void>;
  saveAttendance: (a: Attendance) => Promise<void>;
  saveContact: (c: Contact) => Promise<void>;
  notice: string;
  notify: (s: string) => void;
  allowedDepartments: string[];
}
const Context = createContext<AppStore | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]),
    [attendance, setAttendance] = useState<Attendance[]>([]),
    [contacts, setContacts] = useState<Contact[]>([]),
    [role, setRole] = useState<Role>("pastor"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let records = await all<Member>("members");
        if (!records.length) {
          records = seed();
          for (const m of records) await put("members", m);
        }
        const [a, c] = await Promise.all([
          all<Attendance>("attendance"),
          all<Contact>("contacts"),
        ]);
        if (active) {
          setMembers(
            records.map((m) => ({
              ...m,
              departments: [...new Set(m.departments)],
            })),
          );
          setAttendance(a);
          setContacts(c);
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Falha ao carregar a prévia.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const refresh = async (event: MessageEvent) => {
      try {
        if (event.data.store === "members")
          setMembers(
            (await all<Member>("members")).map((m) => ({
              ...m,
              departments: [...new Set(m.departments)],
            })),
          );
        if (event.data.store === "attendance")
          setAttendance(await all<Attendance>("attendance"));
        if (event.data.store === "contacts")
          setContacts(await all<Contact>("contacts"));
      } catch {
        setError("Falha ao atualizar os dados locais.");
      }
    };
    channel?.addEventListener("message", refresh);
    return () => {
      active = false;
      channel?.removeEventListener("message", refresh);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  const allowedDepartments =
    role === "lider"
      ? ["jovens", "adolescentes"]
      : role === "multiplicador"
        ? ["jovens"]
        : deptIds;
  const visible = useMemo(
    () =>
      members.filter((m) =>
        role === "multiplicador"
          ? ["demo-3", "demo-10", "demo-17"].includes(m.id)
          : m.departments.some((d) => allowedDepartments.includes(d)),
      ),
    [members, role],
  );
  const saveMember = async (m: Member) => {
    await put("members", m);
    setMembers((old) => [...old.filter((x) => x.id !== m.id), m]);
    setNotice("Cadastro salvo neste aparelho.");
  };
  const saveAttendance = async (a: Attendance) => {
    await put("attendance", a);
    setAttendance((old) => [...old.filter((x) => x.id !== a.id), a]);
    setNotice("Chamada salva neste aparelho.");
  };
  const saveContact = async (c: Contact) => {
    await put("contacts", c);
    setContacts((old) => [c, ...old]);
    setNotice("Acompanhamento registrado neste aparelho.");
  };
  return (
    <Context.Provider
      value={{
        members: visible,
        attendance: attendance.filter((a) =>
          allowedDepartments.includes(a.department),
        ),
        contacts: contacts.filter((c) =>
          visible.some((m) => m.id === c.personId),
        ),
        role,
        setRole,
        loading,
        error,
        saveMember,
        saveAttendance,
        saveContact,
        notice,
        notify: setNotice,
        allowedDepartments,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("Store ausente");
  return value;
}
export const blankMember = (): Member => ({
  id: crypto.randomUUID(),
  name: "",
  phone: "",
  birth: "",
  address: "",
  departments: [],
  status: "Ativo",
  note: "",
  needsCare: false,
  updatedAt: localDate(),
});
