// src/services/db.ts

import { APP_VERSION, DATA_GENERATION, DATA_GENERATION_KEY, PENDING_GENERATION_KEY, getOrCreateDeviceId, isCurrentDataGenerationActive } from './release';

export interface Syncable {
  updatedAt?: string;
  version?: number;
  updatedBy?: string;
  deleted?: boolean | number;
}

export interface Person extends Syncable {
  id: string;
  name: string;
  phone: string;
  department: string; // Primary department
  role: 'Pastor Admin' | 'Pastor' | 'Secretaria Geral' | 'Líder' | 'Multiplicador' | 'Membro';
  departments?: DepartmentRole[]; // Full list of department+role assignments (primary first)
  startDate: string;  // YYYY-MM-DD
  status: 'Ativo' | 'Visitante' | 'Arquivado' | 'Inativo';
  createdAt: string;
  birthDate?: string; // YYYY-MM-DD
  username?: string;
  password?: string;
  passwordChanged?: boolean;
  address?: string;
  observations?: string;
  deleted?: boolean;
  loginCount?: number;
  timeOnlineSeconds?: number;
  interactionCount?: number;
  lastActive?: string;
  baptized?: boolean | null;
  baptismIntention?: number | boolean;
  gender?: 'M' | 'F' | 'U';
  motherId?: string; // ID da mãe (vínculo para Departamento Infantil)
  motherName?: string; // Nome da mãe extraído das observações (Departamento Infantil)
}

export interface DepartmentRole {
  department: string;
  role: 'Pastor Admin' | 'Pastor' | 'Secretaria Geral' | 'Líder' | 'Multiplicador' | 'Membro';
  /** Subgrupo dentro do departamento (ex.: 'Huperetes' após a fusão com Gideões). */
  subGroup?: string;
}

export interface ActivityLog extends Syncable {
  id: string;
  recordedBy: string;
  recordedByName: string;
  recordedByRole?: string;
  action: string;
  details?: string;
  timestamp: string; // YYYY-MM-DD HH:MM:SS or ISO
}

export interface MessageHistory extends Syncable {
  id: string;
  senderId: string;
  receiverId: string;
  sentAt: string; // ISO
  weekKey: string;
  message: string;
}

export interface WeeklyMission extends Syncable {
  id: string;
  assignedTo: string; // multiplicador personId
  department: string;
  weekKey: string;
  targetCount: number;
  recipientIds: string[];
  sentIds: string[];
  assignedAt: string;
  completedAt?: string;
  title: string;
  description: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  messageTemplate?: string;
  useFirstName?: boolean;
}

export interface SpecialMissionAssignment {
  multiplierId: string;
  recipientIds: string[];
  sentIds: string[];
}

export interface SpecialMission extends Syncable {
  id: string;
  title: string;
  description: string;
  department: string;
  targetDepartment: string; // 'todos' | specific department name
  assignedTo?: string; // optional personId
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdBy: string; // personId
  createdAt: string;
  active: boolean;
  weekKey?: string;
  messageTemplate?: string;
  useFirstName?: boolean;
  targetPerMultiplier?: number; // quantos membros cada multiplicador recebe (default 15)
  assignments?: SpecialMissionAssignment[]; // distribuição de membros por multiplicador
}

export interface Department extends Syncable {
  id: string;
  name: string;
  description: string;
  missionsEnabled?: boolean;
  deleted?: boolean;
}

export interface ChurchEvent extends Syncable {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  description: string;
  department?: string; // Optional: if provided, event is for this department only
  createdBy: string; // User/Person ID
}

export interface AttendanceRecord extends Syncable {
  id: string;
  date: string;         // YYYY-MM-DD
  type: 'Domingo' | 'EBD' | 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Manual';
  department: string;
  presentIds: string[]; // List of person IDs present
  deleted?: boolean;
}

export interface MonthlyGoal extends Syncable {
  month: string;        // YYYY-MM
  targetMembers: number;
  targetAttendanceRate: number; // percentage (e.g. 85)
}

export interface PastoralLog extends Syncable {
  id: string;
  personId: string;
  date: string;         // YYYY-MM-DD
  type: 'Mensagem' | 'Ligação' | 'Visita';
  notes: string;
  recordedBy: string;
}

export interface UserSession {
  code: string;
  role: 'Pastor Admin' | 'Pastor' | 'Secretaria Geral' | 'Líder' | 'Multiplicador' | 'Membro';
  name: string;
  department?: string; // Locked department (undefined for Pastor and Secretary)
  personId?: string;   // Link to Person record
  sessionToken?: string; // Sessão segura emitida pelo PostgreSQL/Supabase
}

export interface AppDatabase {
  people: Person[];
  departments: Department[];
  attendances: AttendanceRecord[];
  goals: MonthlyGoal[];
  pastoralLogs: PastoralLog[];
  activityLogs?: ActivityLog[];
  activityLogCount?: number;
  weeklyMissions?: WeeklyMission[];
  specialMissions?: SpecialMission[];
  messageHistory?: MessageHistory[];
  events?: ChurchEvent[];
}

const STORAGE_KEY = 'multiplica_plus_db';
const LAST_VERSION_KEY = 'pm_last_app_version';

import { INITIAL_PEOPLE } from './initial_people';
// gender logic no longer needs this import

const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Integração / Discipulado (Geral IEAD-JK)', description: 'Acompanhamento geral de novos convertidos e discipulado.' },
  { id: 'd2', name: 'Novo Alvorecer (Jovens)', description: 'Departamento de jovens da congregação.' },
  { id: 'd3', name: 'Geração de Davi (Adolescentes)', description: 'Departamento de adolescentes da congregação.' },
  { id: 'd4', name: 'Atalaias de Cristo (Irmãs)', description: 'Círculo de Oração e departamento de irmãs.' },
  { id: 'd6', name: 'GIDEÕES (VARÕES IEADJOTA)', description: 'Círculo de oração e departamento de homens (Gideões + Huperetes unificados).' },
  { id: 'd7', name: 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE', description: 'Departamento unificado de crianças e adolescentes.' }
];


// Let's refine the attendance data:
// Meeting 1 (2026-05-31):
// Present: Ana (p_j1), Mateus (p_j2), Bruno (p_j3), Carla (p_j4), Vitor (p_j5), Sara (p_j6) -> Everyone present except none.
// Meeting 2 (2026-06-07):
// Present: Ana (p_j1), Bruno (p_j3), Carla (p_j4), Sara (p_j6) -> Absent: Mateus (p_j2) [1st], Vitor (p_j5) [1st]
// Meeting 3 (2026-06-14):
// Present: Ana (p_j1), Carla (p_j4) -> Absent: Mateus (p_j2) [2nd], Vitor (p_j5) [2nd], Bruno (p_j3) [1st], Sara (p_j6) [1st]
// Meeting 4 (2026-06-21) - Let's say it's manual or we just use 3 meetings:
// If we have 3 meetings:
// - 31/05: presentIds = ['p_j1', 'p_j3', 'p_j4', 'p_j5', 'p_j6'] (Mateus absent)
// - 07/06: presentIds = ['p_j1', 'p_j3', 'p_j4', 'p_j6'] (Mateus absent, Vitor absent)
// - 14/06: presentIds = ['p_j1', 'p_j4', 'p_j3'] (Mateus absent [3 consecutive], Vitor absent [2 consecutive], Sara absent [1 consecutive])
// This is perfect!
// Let's construct this exactly:
const CALIBRATED_ATTENDANCES: AttendanceRecord[] = [
  {
    id: 'att_1',
    date: '2026-05-31',
    type: 'Domingo',
    department: 'Novo Alvorecer (Jovens)',
    presentIds: ['p_j1', 'p_j3', 'p_j4', 'p_j5', 'p_j6'] // Mateus (p_j2) absent
  },
  {
    id: 'att_2',
    date: '2026-06-07',
    type: 'Domingo',
    department: 'Novo Alvorecer (Jovens)',
    presentIds: ['p_j1', 'p_j3', 'p_j4', 'p_j6'] // Mateus (p_j2) absent (2nd), Vitor (p_j5) absent (1st)
  },
  {
    id: 'att_3',
    date: '2026-06-14',
    type: 'Domingo',
    department: 'Novo Alvorecer (Jovens)',
    presentIds: ['p_j1', 'p_j3', 'p_j4'] // Mateus (p_j2) absent (3rd -> RED), Vitor (p_j5) absent (2nd -> ORANGE), Sara (p_j6) absent (1st -> YELLOW), Bruno (p_j3) present
  },
  // Chamadas REDENÇÃO - 13/06/2026
  {
    id: 'att_red_1',
    date: '2026-06-13',
    type: 'Sábado',
    department: 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE',
    presentIds: ['p_red_reginaldo', 'p_red_1', 'p_red_2', 'p_red_3', 'p_red_4', 'p_red_5', 'p_red_6', 'p_red_7', 'p_red_8', 'p_red_9', 'p_red_10', 'p_red_11', 'p_red_12', 'p_red_13', 'p_red_14', 'p_red_15', 'p_red_16', 'p_red_17', 'p_red_18', 'p_red_19', 'p_red_20', 'p_red_21', 'p_red_22', 'p_red_23', 'p_red_24', 'p_red_25', 'p_red_26', 'p_red_27', 'p_red_28', 'p_red_29', 'p_red_30', 'p_red_31', 'p_red_32', 'p_red_33', 'p_red_34', 'p_red_35', 'p_red_36', 'p_red_37', 'p_red_38', 'p_red_39', 'p_red_40', 'p_red_41', 'p_red_42', 'p_red_43', 'p_red_44', 'p_red_45', 'p_red_46', 'p_red_47', 'p_red_48', 'p_red_49', 'p_red_50', 'p_red_51', 'p_red_52', 'p_red_53', 'p_red_54', 'p_red_55', 'p_red_56', 'p_red_57', 'p_red_58', 'p_red_59', 'p_red_60', 'p_red_61', 'p_red_62', 'p_red_63', 'p_red_64', 'p_red_65', 'p_red_66', 'p_red_67', 'p_red_68', 'p_red_69', 'p_red_70', 'p_red_71', 'p_red_72', 'p_red_73', 'p_red_74', 'p_red_75', 'p_red_76', 'p_red_77', 'p_red_78', 'p_red_79', 'p_red_80', 'p_red_81', 'p_red_82', 'p_red_83', 'p_red_84']
  },
  // Chamadas REDENÇÃO - 27/06/2026
  {
    id: 'att_red_2',
    date: '2026-06-27',
    type: 'Sábado',
    department: 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE',
    presentIds: ['p_red_reginaldo', 'p_red_1', 'p_red_2', 'p_red_3', 'p_red_4', 'p_red_5', 'p_red_6', 'p_red_7', 'p_red_8', 'p_red_9', 'p_red_10', 'p_red_11', 'p_red_12', 'p_red_13', 'p_red_14', 'p_red_15', 'p_red_16', 'p_red_17', 'p_red_18', 'p_red_19', 'p_red_20', 'p_red_21', 'p_red_22', 'p_red_23', 'p_red_24', 'p_red_25', 'p_red_26', 'p_red_27', 'p_red_28', 'p_red_29', 'p_red_30', 'p_red_31', 'p_red_32', 'p_red_33', 'p_red_34', 'p_red_35', 'p_red_36', 'p_red_37', 'p_red_38', 'p_red_39', 'p_red_40', 'p_red_41', 'p_red_42', 'p_red_43', 'p_red_44', 'p_red_45', 'p_red_46', 'p_red_47', 'p_red_48', 'p_red_49', 'p_red_50', 'p_red_51', 'p_red_52', 'p_red_53', 'p_red_54', 'p_red_55', 'p_red_56', 'p_red_57', 'p_red_58', 'p_red_59', 'p_red_60', 'p_red_61', 'p_red_62', 'p_red_63', 'p_red_64', 'p_red_65', 'p_red_66', 'p_red_67', 'p_red_68', 'p_red_69', 'p_red_70', 'p_red_71', 'p_red_72', 'p_red_73', 'p_red_74', 'p_red_75', 'p_red_76', 'p_red_77', 'p_red_78', 'p_red_79', 'p_red_80', 'p_red_81', 'p_red_82', 'p_red_83', 'p_red_84']
  },
  // Chamadas REDENÇÃO - 02/08/2026
  {
    id: 'att_red_3',
    date: '2026-08-02',
    type: 'Domingo',
    department: 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE',
    presentIds: ['p_red_reginaldo', 'p_red_1', 'p_red_2', 'p_red_3', 'p_red_4', 'p_red_5', 'p_red_6', 'p_red_7', 'p_red_8', 'p_red_9', 'p_red_10', 'p_red_11', 'p_red_12', 'p_red_13', 'p_red_14', 'p_red_15', 'p_red_16', 'p_red_17', 'p_red_18', 'p_red_19', 'p_red_20', 'p_red_21', 'p_red_22', 'p_red_23', 'p_red_24', 'p_red_25', 'p_red_26', 'p_red_27', 'p_red_28', 'p_red_29', 'p_red_30', 'p_red_31', 'p_red_32', 'p_red_33', 'p_red_34', 'p_red_35', 'p_red_36', 'p_red_37', 'p_red_38', 'p_red_39', 'p_red_40', 'p_red_41', 'p_red_42', 'p_red_43', 'p_red_44', 'p_red_45', 'p_red_46', 'p_red_47', 'p_red_48', 'p_red_49', 'p_red_50', 'p_red_51', 'p_red_52', 'p_red_53', 'p_red_54', 'p_red_55', 'p_red_56', 'p_red_57', 'p_red_58', 'p_red_59', 'p_red_60', 'p_red_61', 'p_red_62', 'p_red_63', 'p_red_64', 'p_red_65', 'p_red_66', 'p_red_67', 'p_red_68', 'p_red_69', 'p_red_70', 'p_red_71', 'p_red_72', 'p_red_73', 'p_red_74', 'p_red_75', 'p_red_76', 'p_red_77', 'p_red_78', 'p_red_79', 'p_red_80', 'p_red_81', 'p_red_82', 'p_red_83', 'p_red_84']
  },
  // Chamadas REDENÇÃO - 15/08/2026
  {
    id: 'att_red_4',
    date: '2026-08-15',
    type: 'Sábado',
    department: 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE',
    presentIds: ['p_red_reginaldo', 'p_red_1', 'p_red_2', 'p_red_3', 'p_red_4', 'p_red_5', 'p_red_6', 'p_red_7', 'p_red_8', 'p_red_9', 'p_red_10', 'p_red_11', 'p_red_12', 'p_red_13', 'p_red_14', 'p_red_15', 'p_red_16', 'p_red_17', 'p_red_18', 'p_red_19', 'p_red_20', 'p_red_21', 'p_red_22', 'p_red_23', 'p_red_24', 'p_red_25', 'p_red_26', 'p_red_27', 'p_red_28', 'p_red_29', 'p_red_30', 'p_red_31', 'p_red_32', 'p_red_33', 'p_red_34', 'p_red_35', 'p_red_36', 'p_red_37', 'p_red_38', 'p_red_39', 'p_red_40', 'p_red_41', 'p_red_42', 'p_red_43', 'p_red_44', 'p_red_45', 'p_red_46', 'p_red_47', 'p_red_48', 'p_red_49', 'p_red_50', 'p_red_51', 'p_red_52', 'p_red_53', 'p_red_54', 'p_red_55', 'p_red_56', 'p_red_57', 'p_red_58', 'p_red_59', 'p_red_60', 'p_red_61', 'p_red_62', 'p_red_63', 'p_red_64', 'p_red_65', 'p_red_66', 'p_red_67', 'p_red_68', 'p_red_69', 'p_red_70', 'p_red_71', 'p_red_72', 'p_red_73', 'p_red_74', 'p_red_75', 'p_red_76', 'p_red_77', 'p_red_78', 'p_red_79', 'p_red_80', 'p_red_81', 'p_red_82', 'p_red_83', 'p_red_84']
  }
];

const INITIAL_GOALS: MonthlyGoal[] = [
  { month: '2026-05', targetMembers: 12, targetAttendanceRate: 80 },
  { month: '2026-06', targetMembers: 20, targetAttendanceRate: 85 }
];

export const YOUTH_DEPARTMENTS = new Set(['Novo Alvorecer (Jovens)', 'Geração de Davi (Adolescentes)']);

export function getWeekKey(date: Date = new Date()) {
  const year = date.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + oneJan.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getPreviousWeekKey(weekKey: string) {
  const [yearStr, weekStr] = weekKey.split('-W');
  let year = parseInt(yearStr, 10);
  let week = parseInt(weekStr, 10);
  if (week > 1) {
    return `${year}-W${String(week - 1).padStart(2, '0')}`;
  }
  const december31 = new Date(year - 1, 11, 31);
  return getWeekKey(december31);
}

export function isSameDepartment(deptA?: string, deptB?: string): boolean {
  if (!deptA || !deptB) return false;
  
  const a = deptA.toLowerCase();
  const b = deptB.toLowerCase();

  if (a === b) return true;

  // Regras de equivalência específicas (não genéricas para evitar falsos positivos)
  if (a.includes('joven') && b.includes('joven')) return true;
  if ((a.includes('irma') || a.includes('atalaia')) && (b.includes('irma') || b.includes('atalaia'))) return true;
  if ((a.includes('homen') || a.includes('gideo')) && (b.includes('homen') || b.includes('gideo'))) return true;
  if ((a.includes('obreiro') || a.includes('huperete')) && (b.includes('obreiro') || b.includes('huperete'))) return true;
  if ((a.includes('integrac') || a.includes('discipul')) && (b.includes('integrac') || b.includes('discipul'))) return true;
  
  // Caso especial: REDENÇÃO e Geração de Davi NÃO são o mesmo departamento
  // (ambos podem ter "adolescente" no nome, mas são departamentos distintos)
  const aIsRedencao = a.includes('redenção') || a.includes('redencao');
  const bIsRedencao = b.includes('redenção') || b.includes('redencao');
  const aIsGeracaoDavi = a.includes('geracao') && a.includes('davi');
  const bIsGeracaoDavi = b.includes('geracao') && b.includes('davi');
  
  if ((aIsRedencao && bIsGeracaoDavi) || (aIsGeracaoDavi && bIsRedencao)) {
    return false;
  }

  // Fallback to basic normalization match
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  return norm(a) === norm(b);
}

export function isYouthOrTeenDepartment(department: string) {
  const dept = (department || '').toLowerCase();
  return dept.includes('jovem') || dept.includes('adolescente') || dept.includes('davi') || dept.includes('alvorecer');
}

// Ordenação determinística de nomes: normaliza (remove acentos/caixa) e compara
// pelos code points — garante a MESMA ordem em qualquer dispositivo/navegador.
export const normalizeForSort = (s: string = '') =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const compareByName = (a: { name?: string }, b: { name?: string }) => {
  const na = normalizeForSort(a.name || '');
  const nb = normalizeForSort(b.name || '');
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
};

export function getCriticalAbsenteesForDepartment(db: AppDatabase, department?: string, limit = 8): Person[] {
  const candidates = db.people.filter(p =>
    p.role === 'Membro' &&
    p.status !== 'Arquivado' &&
    p.status !== 'Inativo' &&
    p.status !== 'Visitante' &&
    !p.deleted &&
    p.phone &&
    p.phone.trim().length >= 10 &&
    (!department || personInDepartment(p, department))
  );

  return candidates
    .map(person => ({
      person,
      absences: calculateConsecutiveAbsences(person.id, person.department, person.startDate || '2026-01-01', db.attendances)
    }))
    .filter(entry => entry.absences > 0)
    .sort((a, b) => {
      if (b.absences !== a.absences) {
        return b.absences - a.absences;
      }
      return compareByName(a.person, b.person);
    })
    .slice(0, limit)
    .map(entry => entry.person);
}

export function getPersonGender(person: Person) {
  return person.gender === 'F' ? 'female' : (person.gender === 'M' ? 'male' : 'unknown');
}

// --- Multi-department helpers ---

export function getPersonDepartments(person: Person): DepartmentRole[] {
  if (person.departments && person.departments.length > 0) {
    return person.departments;
  }
  return [{ department: person.department, role: person.role }];
}

/** Retorna o subgrupo (ex.: 'Huperetes') da pessoa dentro de um departamento, se houver. */
export function getPersonSubGroup(person: Person, department: string): string | undefined {
  return getPersonDepartments(person).find(
    dr => dr.department === department || isSameDepartment(dr.department, department)
  )?.subGroup;
}

export function personHasRoleInDepartment(person: Person, role: string, department: string): boolean {
  return getPersonDepartments(person).some(
    dr => dr.role === role && (dr.department === department || isSameDepartment(dr.department, department))
  );
}

export function personInDepartment(person: Person, department: string): boolean {
  if (!department || department === 'Todos') return true;
  return getPersonDepartments(person).some(
    dr => dr.department === department || isSameDepartment(dr.department, department)
  );
}

export function personHasRole(person: Person, role: string): boolean {
  return getPersonDepartments(person).some(dr => dr.role === role);
}

export interface DepartmentTheme {
  primary: string;
  glow: string;
  bgLight: string;
  quote: string;
  badgeText: string;
}

export function getDepartmentTheme(deptName: string): DepartmentTheme {
  const nameLower = (deptName || '').toLowerCase();
  const nameNorm = nameLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (nameLower.includes('criança') || nameLower.includes('crianca') || nameLower.includes('infantil')) {
    return {
      primary: '#22c55e',
      glow: 'rgba(34, 197, 94, 0.4)',
      bgLight: 'rgba(34, 197, 94, 0.12)',
      quote: 'Formando hoje, disciplinando para o amanhã!',
      badgeText: '#15803d'
    };
  }
  if (nameLower.includes('adolesc') || nameLower.includes('teen') || nameLower.includes('alvorecer')) {
    return {
      primary: '#3b82f6',
      glow: 'rgba(59, 130, 246, 0.4)',
      bgLight: 'rgba(59, 130, 246, 0.12)',
      quote: 'Apoiando escolhas, formando caminhos, transformando gerações!',
      badgeText: '#1d4ed8'
    };
  }
  if (nameLower.includes('joven') || nameLower.includes('jovem') || nameLower.includes('umad') || nameLower.includes('atalaia')) {
    return {
      primary: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.4)',
      bgLight: 'rgba(168, 85, 247, 0.12)',
      quote: 'Inspirando propósito, gerando impacto, fazendo a diferença!',
      badgeText: '#7e22ce'
    };
  }
  if (nameLower.includes('irma') || nameLower.includes('irma') || nameLower.includes('mulher') || nameLower.includes('circulo') || nameLower.includes('círculo') || nameLower.includes('ufad')) {
    return {
      primary: '#ec4899',
      glow: 'rgba(236, 72, 153, 0.4)',
      bgLight: 'rgba(236, 72, 153, 0.12)',
      quote: 'Fortalecendo laços, edificando o lar, servindo com amor!',
      badgeText: '#be185d'
    };
  }
  if (nameLower.includes('irmão') || nameLower.includes('irmao') || nameLower.includes('homem') || nameLower.includes('homens') || nameLower.includes('varão') || nameLower.includes('varao') || nameNorm.includes('gideoes') || nameNorm.includes('varoes')) {
    return {
      primary: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.4)',
      bgLight: 'rgba(245, 158, 11, 0.12)',
      quote: 'Caminhando juntos, crescendo na fé, servindo!',
      badgeText: '#b45309'
    };
  }
  if (nameLower.includes('huperete') || nameLower.includes('obreiro') || nameLower.includes('diácono') || nameLower.includes('diacono') || nameLower.includes('liderança') || nameLower.includes('lideranca')) {
    return {
      primary: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.4)',
      bgLight: 'rgba(6, 182, 212, 0.12)',
      quote: 'Servindo com excelência, sendo exemplo de fé e liderança!',
      badgeText: '#0e7490'
    };
  }
  if (nameLower.includes('integra') || nameLower.includes('recep') || nameLower.includes('acolhi') || nameLower.includes('novo')) {
    return {
      primary: '#f97316',
      glow: 'rgba(249, 115, 22, 0.4)',
      bgLight: 'rgba(249, 115, 22, 0.12)',
      quote: 'Acolhendo com amor, integrando com propósito!',
      badgeText: '#c2410c'
    };
  }
  return {
    primary: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.4)',
    bgLight: 'rgba(99, 102, 241, 0.12)',
    quote: 'Líderes e cooperadores, vocês são a ponte entre o céu e as pessoas!',
    badgeText: '#4338ca'
  };
}

/** Verifica se um departamento é "virtual" (pseudo-departamento que não deve aparecer em seletores) */
export function isVirtualDepartment(name?: string): boolean {
  if (!name) return false;
  const n = name.trim().toUpperCase();
  return n === 'ARQUIVADOS E VISITAS' || n.startsWith('ARQUIVADOS');
}

/** Retorna os departamentos reais (exclui pseudo-departamentos como "ARQUIVADOS E VISITAS") */
export function getVisibleDepartments(db: AppDatabase): Department[] {
  return db.departments.filter(d => !d.deleted && !isVirtualDepartment(d.name));
}

export function getUserAllowedDepartments(session: UserSession | null, db: AppDatabase): string[] {
  if (!session) return [];
  if (session.role === 'Pastor Admin' || session.role === 'Pastor' || session.role === 'Secretaria Geral') {
    return getVisibleDepartments(db).map(d => d.name);
  }
  // Líder e Multiplicador: retorna TODOS os departamentos da pessoa (suporta múltiplos)
  if (session.role === 'Líder' || session.role === 'Multiplicador') {
    const person = db.people.find(p => (session.personId && p.id === session.personId) || p.name === session.name);
    if (person) {
      const depts = getPersonDepartments(person);
      const names = depts.map(d => d.department).filter(Boolean);
      const unique = Array.from(new Set(names));
      if (unique.length > 0) return unique;
    }
    return session.department ? [session.department] : [];
  }
  const person = db.people.find(p => (session.personId && p.id === session.personId) || p.name === session.name);
  if (person) {
    const depts = getPersonDepartments(person);
    const names = depts.map(d => d.department).filter(Boolean);
    const unique = Array.from(new Set(names));
    if (unique.length > 0) return unique;
  }
  return session.department ? [session.department] : [];
}

export function canUserSelectDepartment(session: UserSession | null, db: AppDatabase): boolean {
  if (!session) return false;
  // Admins globais podem selecionar qualquer departamento
  if (session.role === 'Pastor Admin' || session.role === 'Pastor' || session.role === 'Secretaria Geral') {
    return true;
  }
  // Líder/Multiplicador: pode escolher entre seus departamentos apenas quando tem
  // 2 ou mais (com 1 só, o departamento é fixo). Limitado aos departamentos da própria pessoa.
  const allowedDepts = getUserAllowedDepartments(session, db);
  return allowedDepts.length > 1;
}

/** Retorna a pessoa mãe vinculada, se existir */
export function getPersonMother(db: AppDatabase, person: Person): Person | undefined {
  if (!person.motherId) return undefined;
  return db.people.find(p => p.id === person.motherId && !p.deleted);
}

/** Extrai o primeiro nome da mãe a partir da observação (ex: "filha da Maria" / "filho da Ana Paula") */
export function extractMotherNameFromObservation(obs?: string): string | undefined {
  if (!obs) return undefined;
  const m = obs.match(/filh[oa]\s+d[ae]\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s'-]*)/i);
  if (!m) return undefined;
  const full = m[1].trim().replace(/[.,;:!?)\]]+$/, '').replace(/\s+/g, ' ');
  if (!full) return undefined;
  const first = full.split(' ')[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Preenche motherName a partir das observações das crianças do Departamento Infantil */
export function applyMotherNameMigration(db: AppDatabase): AppDatabase {
  let changed = false;
  const people = db.people.map(p => {
    if (p.motherName || !p.observations) return p;
    const deptLower = (p.department || '').toLowerCase();
    const isChildDept = deptLower.includes('infantil') || deptLower.includes('criança') || deptLower.includes('crianca');
    if (!isChildDept) return p;
    const motherFirst = extractMotherNameFromObservation(p.observations);
    if (!motherFirst) return p;
    changed = true;
    return { ...p, motherName: motherFirst, version: (p.version || 0) + 1, updatedAt: new Date().toISOString() };
  });
  return changed ? { ...db, people } : db;
}

// --- End multi-department helpers ---

export function createMissionRecipients(
  multiplicador: Person,
  db: AppDatabase,
  targetCount = 8,
  extraCount = 0,
  department?: string,
  excludeIds: string[] = []
) {
  const targetDept = department || multiplicador.department;
  const senderGender = getPersonGender(multiplicador);
  const sameDeptMembers = db.people.filter(
    p =>
      p.role === 'Membro' &&
      p.status !== 'Arquivado' &&
      p.status !== 'Inativo' &&
      p.status !== 'Visitante' &&
      !p.deleted &&
      personInDepartment(p, targetDept) &&
      p.id !== multiplicador.id &&
      !excludeIds.includes(p.id) &&
      (senderGender === 'unknown' ||
        getPersonGender(p) === senderGender ||
        getPersonGender(p) === 'unknown')
  );

  // Get historical frequency of messages successfully sent to each member by this multiplicador
  const frequencyMap: Record<string, number> = {};
  sameDeptMembers.forEach(p => (frequencyMap[p.id] = 0));
  const pastMissions = (db.weeklyMissions || []).filter(
    m => m.assignedTo === multiplicador.id
  );
  pastMissions.forEach(m => {
    (m.sentIds || []).forEach(id => {
      if (frequencyMap[id] !== undefined) {
        frequencyMap[id]++;
      }
    });
  });

  // Calculate absences to break ties
  const absenteesMap: Record<string, number> = {};
  sameDeptMembers.forEach(p => {
    absenteesMap[p.id] = calculateConsecutiveAbsences(
      p.id,
      p.department,
      p.startDate || '2026-01-01',
      db.attendances
    );
  });

  // Sort members: first by frequency (ascending), then by absences (descending)
  const sortedMembers = [...sameDeptMembers].sort((a, b) => {
    const freqA = frequencyMap[a.id];
    const freqB = frequencyMap[b.id];
    if (freqA !== freqB) {
      return freqA - freqB; // Less frequent first (strict rotation/rodízio)
    }
    const absA = absenteesMap[a.id];
    const absB = absenteesMap[b.id];
    return absB - absA; // More absences first
  });

  const totalTarget = targetCount + extraCount;
  const chosen = sortedMembers.slice(0, totalTarget);
  return chosen.map(p => p.id);
}

export function getMissionForMultiplicador(db: AppDatabase, multiplicadorId: string, weekKey: string, department?: string) {
  return (db.weeklyMissions || []).find(m => 
    m.assignedTo === multiplicadorId && 
    m.weekKey === weekKey && 
    (!department || isSameDepartment(m.department, department))
  );
}

export function createWeeklyMissionIfMissing(
  db: AppDatabase,
  multiplicador: Person,
  weekKey: string,
  extraCount = 0,
  department?: string
): AppDatabase {
  // F3 — v6.7.0: além de Multiplicador e Líder, liderança (Pastor/Admin/Secretaria) também recebe missão
  const isMissionRole =
    multiplicador.role === 'Multiplicador' ||
    multiplicador.role === 'Líder' ||
    multiplicador.role === 'Pastor' ||
    multiplicador.role === 'Pastor Admin' ||
    multiplicador.role === 'Secretaria Geral';

  if (
    !isMissionRole ||
    multiplicador.deleted ||
    multiplicador.status !== 'Ativo'
  ) {
    return db;
  }

  // F3 — alvo dinâmico: Multiplicador mantém 10; liderança recebe 15
  const targetCount = multiplicador.role === 'Multiplicador' ? 10 : 15;

  // Get all departments where this person is a Multiplicador or Líder
  const allDepts = getPersonDepartments(multiplicador);
  if (allDepts.length === 0) return db;

  // If a specific department is provided, only create for that one
  const deptsToProcess = department
    ? allDepts.filter(d => isSameDepartment(d.department, department))
    : allDepts;

  let updatedDb = db;

  for (const dept of deptsToProcess) {
    const existingIndex = updatedDb.weeklyMissions?.findIndex(m => 
      m.assignedTo === multiplicador.id && 
      m.weekKey === weekKey && 
      isSameDepartment(m.department, dept.department)
    ) ?? -1;

    if (existingIndex !== -1) {
      if (extraCount > 0) {
        const existingMission = updatedDb.weeklyMissions![existingIndex];
        const newRecipientIds = createMissionRecipients(
          multiplicador,
          updatedDb,
          targetCount,
          0,
          dept.department,
          existingMission.recipientIds
        );
        if (newRecipientIds.length > 0) {
          const updatedMission: WeeklyMission = {
            ...existingMission,
            targetCount: existingMission.targetCount + newRecipientIds.length,
            recipientIds: [...existingMission.recipientIds, ...newRecipientIds],
            title: `Missão semanal: enviar mensagem para ${existingMission.recipientIds.length + newRecipientIds.length} pessoas`,
            updatedAt: new Date().toISOString(),
            version: (existingMission.version || 0) + 1,
            updatedBy: multiplicador.id
          };
          const newMissions = [...updatedDb.weeklyMissions!];
          newMissions[existingIndex] = updatedMission;
          updatedDb = {
            ...updatedDb,
            weeklyMissions: newMissions
          };
        }
      }
      continue;
    }

    const recipientIds = createMissionRecipients(multiplicador, updatedDb, targetCount, extraCount, dept.department);
    const deptSlug = dept.department.replace(/[^a-zA-Z0-9]/g, '_');
    const newMission: WeeklyMission = {
      id: `mission_${multiplicador.id}_${deptSlug}_${weekKey}`,
      assignedTo: multiplicador.id,
      department: dept.department,
      weekKey,
      targetCount: targetCount + extraCount,
      recipientIds,
      sentIds: [],
      assignedAt: new Date().toISOString(),
      title: `Missão semanal: enviar mensagem para ${recipientIds.length} ${
        recipientIds.length === 1 ? 'pessoa' : 'pessoas'
      }`,
      description: `Envie mensagens de saudação para membros do departamento ${dept.department}. Homens para homens e mulheres para mulheres. Tente concluir até terça-feira.`,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: multiplicador.id
    };

    updatedDb = {
      ...updatedDb,
      weeklyMissions: [...(updatedDb.weeklyMissions || []), newMission]
    };
  }

  return updatedDb;
}

/**
 * Distribui membros para uma missão especial entre todos os multiplicadores do departamento,
 * sem repetir membros até que todos tenham sido atendidos.
 */
export function distributeSpecialMissionRecipients(
  db: AppDatabase,
  mission: SpecialMission,
  targetPerMultiplier = 15
): SpecialMission {
  // Determinar qual departamento alvo
  const targetDept = mission.targetDepartment === 'todos' ? undefined : mission.targetDepartment;

  // Buscar todos os multiplicadores/líderes ativos do departamento alvo
  const multipliers = db.people.filter(p => {
    if (p.deleted || p.status !== 'Ativo') return false;
    if (p.role !== 'Multiplicador' && p.role !== 'Líder') return false;
    if (targetDept) {
      return personInDepartment(p, targetDept);
    }
    return true; // 'todos' inclui todos
  });

  if (multipliers.length === 0) return mission;

  // Buscar todos os membros elegíveis do departamento alvo
  const allMembers = db.people.filter(p => {
    if (p.role !== 'Membro' || p.deleted) return false;
    if (p.status === 'Arquivado' || p.status === 'Inativo' || p.status === 'Visitante') return false;
    if (targetDept) {
      return personInDepartment(p, targetDept);
    }
    return true;
  });

  if (allMembers.length === 0) return mission;

  // Embaralhar membros para distribuição aleatória justa
  const shuffled = [...allMembers].sort(() => Math.random() - 0.5);
  const memberPool: string[] = shuffled.map(p => p.id);
  const assignedSet = new Set<string>();

  const assignments: SpecialMissionAssignment[] = [];

  // Distribuir round-robin: cada multiplicador recebe targetPerMultiplier membros,
  // sem repetir até que todos os membros tenham sido atribuídos
  for (let round = 0; round < targetPerMultiplier; round++) {
    for (const multiplier of multipliers) {
      // Encontrar um assignment existente para este multiplicador
      let assignment = assignments.find(a => a.multiplierId === multiplier.id);
      if (!assignment) {
        assignment = { multiplierId: multiplier.id, recipientIds: [], sentIds: [] };
        assignments.push(assignment);
      }

      // Se já atingiu o alvo, pular
      if (assignment.recipientIds.length >= targetPerMultiplier) continue;

      // Procurar um membro não atribuído
      let chosenId: string | undefined;

      // Primeiro, tentar membros nunca atribuídos
      for (const memberId of memberPool) {
        if (!assignedSet.has(memberId) && !assignment.recipientIds.includes(memberId)) {
          chosenId = memberId;
          break;
        }
      }

      // Se não encontrou, permitir repetir (todos já foram atendidos)
      if (!chosenId) {
        for (const memberId of memberPool) {
          if (!assignment.recipientIds.includes(memberId)) {
            chosenId = memberId;
            break;
          }
        }
      }

      // Se ainda não encontrou, usar qualquer membro (incluindo repetidos no mesmo assignment)
      if (!chosenId) {
        chosenId = memberPool[Math.floor(Math.random() * memberPool.length)];
      }

      if (chosenId) {
        assignment.recipientIds.push(chosenId);
        assignedSet.add(chosenId);
      }
    }
  }

  return {
    ...mission,
    targetPerMultiplier,
    assignments
  };
}

export function getSpecialMissionForMultiplicador(
  db: AppDatabase,
  multiplierId: string,
  department?: string
): (SpecialMission & { myAssignment?: SpecialMissionAssignment })[] {
  return (db.specialMissions || [])
    .filter(sm => {
      if (!sm.active || sm.deleted) return false;
      if (department) {
        return sm.targetDepartment === 'todos' || isSameDepartment(sm.targetDepartment, department);
      }
      return true;
    })
    .map(sm => {
      const myAssignment = (sm.assignments || []).find(a => a.multiplierId === multiplierId);
      return { ...sm, myAssignment };
    })
    .filter(sm => sm.myAssignment); // só retorna missões onde o multiplicador tem assign
}

export function recordSpecialMissionMessage(
  db: AppDatabase,
  missionId: string,
  multiplierId: string,
  recipientId: string,
  sender: Person,
  message: string
): AppDatabase {
  const now = new Date().toISOString();
  const sentEntry = {
    id: 'msg_' + generateUUID(),
    senderId: sender.id,
    receiverId: recipientId,
    sentAt: now,
    weekKey: '',
    message
  };

  const updatedMessageHistory = [...(db.messageHistory || []), sentEntry];
  const updatedMissions = (db.specialMissions || []).map(sm => {
    if (sm.id !== missionId) return sm;
    const assignments = (sm.assignments || []).map(a => {
      if (a.multiplierId !== multiplierId) return a;
      const alreadySent = a.sentIds.includes(recipientId);
      return {
        ...a,
        sentIds: alreadySent ? a.sentIds : [...a.sentIds, recipientId]
      };
    });
    return {
      ...sm,
      assignments,
      version: (sm.version || 0) + 1,
      updatedAt: now,
      updatedBy: multiplierId
    };
  });

  return {
    ...db,
    specialMissions: updatedMissions,
    messageHistory: updatedMessageHistory
  };
}

export function recordWeeklyMissionMessage(
  db: AppDatabase,
  missionId: string,
  sender: Person,
  recipient: Person,
  message: string
): AppDatabase {
  const now = new Date().toISOString();
  const mission = (db.weeklyMissions || []).find(m => m.id === missionId);
  if (!mission) {
    return db;
  }

  const sentEntry = {
    id: 'msg_' + generateUUID(),
    senderId: sender.id,
    receiverId: recipient.id,
    sentAt: now,
    weekKey: mission.weekKey,
    message
  };

  const updatedMessageHistory = [...(db.messageHistory || []), sentEntry];
  const updatedMissions = (db.weeklyMissions || []).map(m => {
    if (m.id !== missionId) return m;
    const safeSentIds = m.sentIds || [];
    const alreadySent = safeSentIds.includes(recipient.id);
    return {
      ...m,
      sentIds: alreadySent ? safeSentIds : [...safeSentIds, recipient.id],
      completedAt: alreadySent || safeSentIds.length + 1 < m.targetCount ? m.completedAt : now,
      version: (m.version || 0) + 1,
      updatedAt: now,
      updatedBy: sender.id
    };
  });

  const updatedPeople = db.people.map(p => {
    if (p.id === sender.id) {
      return {
        ...p,
        interactionCount: (p.interactionCount || 0) + 1,
        version: (p.version || 0) + 1,
        updatedAt: now,
        updatedBy: sender.id
      };
    }
    return p;
  });

  return {
    ...db,
    people: updatedPeople,
    weeklyMissions: updatedMissions,
    messageHistory: updatedMessageHistory
  };
}

// Heuristic gender guesser for Portuguese names
export function guessGenderByName(nameStr: string): 'M' | 'F' | 'U' {
  const name = nameStr.trim().toLowerCase();
  const parts = name.split(/\s+/);
  let firstPart = parts[0];

  // Common title prefix checks
  if (["pr", "pr.", "pastor", "pb", "pb.", "presb", "presb.", "dc", "dc.", "diac", "coop", "coop.", "ev", "ev."].includes(firstPart)) {
    return 'M';
  }
  if (["pra", "pra.", "pastora", "miss", "miss.", "irma", "irma", "ir", "ir."].includes(firstPart)) {
    return 'F';
  }

  const maleNames = new Set([
    "davi", "gabriel", "lucas", "matheus", "mateus", "pedro", "joao", "joão", "samuel", "guilherme", "arthur", "artur", "miguel", "felipe", "luiz", "luis", "marcos", "kaua", "kauã", "carlos", "rodrigo", "diego", "bruno", "thiago", "tiago", "rafael", "fernando", "eduardo", "marcelo", "paulo", "andre", "andré", "victor", "vitor", "leonardo", "daniel", "gustavo", "alexandre", "leandro", "julio", "júlio", "ricardo", "caio", "igor", "vinicius", "vinícius", "henrique", "renato", "renan", "william", "willian", "luciano", "roberto", "marcio", "márcio", "fabio", "fábio", "flavio", "flávio", "cleber", "cleiton", "elias", "osvaldo", "sebastiao", "sebastião", "jose", "josé", "antonio", "antônio", "francisco", "joaquim", "manoel", "emanuel", "david", "deivid", "deivisson", "caique", "kaio", "ryan", "wagner", "alecio", "celio", "pastor", "pb", "dc", "pr", "coop", "ev", "presb", "diac", "ismael", "isaac", "isac", "joilson", "jhonatan", "jonatas", "jonathan"
  ]);

  const femaleNames = new Set([
    "maria", "ana", "luana", "ester", "ruth", "rute", "raquel", "sarah", "sara", "rebeca", "rebecca", "isabel", "isabella", "isabelly", "izabelly", "julia", "júlia", "vitoria", "vitória", "leticia", "letícia", "beatriz", "laura", "larissa", "camila", "gabriela", "amanda", "bruna", "jessica", "jéssica", "carolina", "caroline", "fernanda", "aline", "juliana", "mariana", "marina", "thais", "thaís", "natalia", "natália", "bianca", "giovana", "luiza", "luíza", "milena", "lorena", "sophia", "sofia", "helena", "alice", "manuela", "yasmin", "yasmim", "eduarda", "clarice", "cecilia", "cecília", "valentina", "elisa", "eliza", "eloisa", "heloisa", "luciana", "renata", "patricia", "patrícia", "simone", "marcia", "márcia", "silvia", "sílvia", "angela", "ângela", "sandra", "rose", "rosangela", "rosângela", "rosana", "cleide", "marlene", "irmã", "irma", "miss", "pra", "pastora", "coop", "ketlyn", "lorrayne", "krislainy", "agatha", "kauane"
  ]);

  // First check if any full name matches
  for (const part of parts) {
    if (maleNames.has(part)) return 'M';
    if (femaleNames.has(part)) return 'F';
  }

  // Check ending of the first name
  let firstName = firstPart;
  if (firstName.length < 3 && parts.length > 1) {
    firstName = parts[1];
  }

  const lastChar = firstName.slice(-1);
  if (lastChar === 'a') {
    return 'F';
  } else if (['o', 'e', 'r', 's', 'l'].includes(lastChar)) {
    return 'M';
  }

  return 'U';
}

export function initializeDB(): AppDatabase {
  // v7.8.5 SAFE STARTUP:
  // Abrir/atualizar o app NUNCA modifica dados de negócio nem cria operações
  // de sincronização. O cache local é somente uma réplica do Supabase.
  localStorage.setItem(LAST_VERSION_KEY, APP_VERSION);

  const emptyDb: AppDatabase = {
    people: [], departments: [], attendances: [], goals: [], pastoralLogs: [],
    activityLogs: [], weeklyMissions: [], specialMissions: [], messageHistory: [], events: [],
  };

  if (!isCurrentDataGenerationActive()) return emptyDb;

  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return emptyDb; // nunca semear dados de demonstração em produção

  try {
    const parsed = JSON.parse(data);
    // Somente completa coleções técnicas ausentes; não altera pessoas,
    // status, sexo, departamentos, datas ou qualquer dado de negócio.
    parsed.people = Array.isArray(parsed.people) ? parsed.people : [];
    parsed.departments = Array.isArray(parsed.departments) ? parsed.departments : [];
    parsed.attendances = Array.isArray(parsed.attendances) ? parsed.attendances : [];
    parsed.goals = Array.isArray(parsed.goals) ? parsed.goals : [];
    parsed.pastoralLogs = Array.isArray(parsed.pastoralLogs) ? parsed.pastoralLogs : [];
    parsed.activityLogs = Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [];
    parsed.weeklyMissions = Array.isArray(parsed.weeklyMissions) ? parsed.weeklyMissions : [];
    parsed.specialMissions = Array.isArray(parsed.specialMissions) ? parsed.specialMissions : [];
    parsed.messageHistory = Array.isArray(parsed.messageHistory) ? parsed.messageHistory : [];
    parsed.events = Array.isArray(parsed.events) ? parsed.events : [];
    return parsed as AppDatabase;
  } catch (e) {
    console.error('[DB v7.8.5] Cache local inválido; aguardando snapshot oficial do Supabase.', e);
    return emptyDb;
  }
}

export function saveDB(db: AppDatabase) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// ==========================================
// HASH DE SENHAS (Web Crypto SHA-256 + salt)
// ==========================================
const PASSWORD_SALT = 'mp$2026$';
const HASH_PREFIX = 'sha256$';

// Gera o hash de uma senha em texto puro. Usado em TODA criação/reset de senha.
// As senhas nunca mais são armazenadas em texto puro no banco/localStorage.
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(PASSWORD_SALT + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  return HASH_PREFIX + hex;
}

export function isPasswordHashed(pw: string): boolean {
  return typeof pw === 'string' && pw.startsWith(HASH_PREFIX);
}

// Compara uma senha em texto puro com o valor armazenado.
// Aceita BOTH: hash novo (sha256$...) e senhas legadas em texto puro (até o 1º reset).
export async function verifyPassword(plain: string, stored: string | undefined | null): Promise<boolean> {
  if (!stored) return false;
  if (isPasswordHashed(stored)) {
    const h = await hashPassword(plain);
    return h === stored;
  }
  // Legado: senha antiga ainda em texto puro
  return stored === plain;
}

// Credentials Validation for IEAD-JK (async — usa hash)
export async function validateCredentials(db: AppDatabase, username: string, password?: string): Promise<UserSession | null> {
  const normalizedUser = username.trim().toUpperCase();
  const normalizedPass = password ? password.trim() : '';
  if (!normalizedPass) return null;

  // Find person with matching role (not Membro) and credentials
  for (const p of db.people) {
    if (
      p.role !== 'Membro' &&
      p.status === 'Ativo' &&
      !p.deleted &&
      p.username?.toUpperCase() === normalizedUser &&
      await verifyPassword(normalizedPass, p.password)
    ) {
      return {
        code: p.username || p.id,
        role: p.role as any,
        name: p.name,
        department: p.role === 'Pastor Admin' || p.role === 'Pastor' || p.role === 'Secretaria Geral' ? undefined : p.department,
        personId: p.id
      };
    }
  }

  // Fallback to initial people if local cache isn't fully loaded yet
  for (const p of INITIAL_PEOPLE) {
    if (
      p.role !== 'Membro' &&
      p.status === 'Ativo' &&
      !p.deleted &&
      p.username?.toUpperCase() === normalizedUser &&
      await verifyPassword(normalizedPass, p.password)
    ) {
      return {
        code: p.username || p.id,
        role: p.role as any,
        name: p.name,
        department: p.role === 'Pastor Admin' || p.role === 'Pastor' || p.role === 'Secretaria Geral' ? undefined : p.department,
        personId: p.id
      };
    }
  }

  // Allow legacy fallback code check (no password) ONLY for local development if needed, 
  // but strictly require passwords in production.
  return null;
}

// Logic to calculate consecutive absences in weeks (Sunday to Sunday).
// If a member attended AT LEAST 1 service in a week, they are considered FREQUENT for that week.
export function calculateConsecutiveAbsences(personId: string, department: string, startDate: string, attendances: AttendanceRecord[]): number {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const deptAttendances = attendances.filter(
    a => !a.deleted && 
         (department === 'Todos' || !department || isSameDepartment(a.department, department)) && 
         a.date <= todayStr && 
         a.date >= startDate && 
         a.presentIds && 
         a.presentIds.length > 0
  );

  if (deptAttendances.length === 0) {
    return 0;
  }

  // Get Sunday YYYY-MM-DD for any date
  const getSundayDateStr = (dateStr: string): string => {
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 3) return dateStr;
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday
    dateObj.setDate(dateObj.getDate() - dayOfWeek);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${dStr}`;
  };

  // Group attendance records by their Sunday week key
  const weekMap = new Map<string, AttendanceRecord[]>();
  deptAttendances.forEach(att => {
    const weekKey = getSundayDateStr(att.date);
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(att);
  });

  // Sort weeks descending (most recent week first)
  const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => b.localeCompare(a));

  let consecutiveAbsentWeeks = 0;

  for (const weekKey of sortedWeeks) {
    const weekRecords = weekMap.get(weekKey)!;
    // If the member attended AT LEAST 1 service in ANY department this week ("se colocou em um já vale para os dois"), they are considered frequent!
    const wasPresentInWeek = attendances.some(att =>
      !att.deleted &&
      att.date <= todayStr &&
      att.date >= startDate &&
      getSundayDateStr(att.date) === weekKey &&
      att.presentIds &&
      att.presentIds.includes(personId)
    );

    if (wasPresentInWeek) {
      break; // Stop counting consecutive absent weeks!
    } else {
      consecutiveAbsentWeeks++;
    }
  }

  return consecutiveAbsentWeeks;
}

// Stats helper
export function getStats(db: AppDatabase, departmentFilter?: string) {
  // If no departmentFilter is selected, we filter out duplicates by name to prevent double-counting members in global stats
  const rawMembers = db.people.filter(
    p => p.status !== 'Arquivado' && p.status !== 'Inativo' && p.status !== 'Visitante' && (!departmentFilter || personInDepartment(p, departmentFilter)) && !p.deleted
  );

  const activeMembers = rawMembers;
  
  const activeIds = new Set(activeMembers.map(p => p.id));
  
  if (activeMembers.length === 0) {
    return {
      totalMembers: 0,
      attendanceRate: 0,
      needingFollowUp: 0,
      totalDepartments: db.departments.length,
      yellowCount: 0,
      orangeCount: 0,
      redCount: 0
    };
  }

  // Filter attendance records to count only matching people and department
  const filteredAttendances = db.attendances.filter(a => !a.deleted && (!departmentFilter || isSameDepartment(a.department, departmentFilter)));
  
  const attendanceRates = filteredAttendances.map(record => {
    const totalMatch = record.presentIds.filter(id => activeIds.has(id)).length;
    return totalMatch / activeMembers.length;
  });

  const averageAttendanceRate = attendanceRates.length > 0 
    ? (attendanceRates.reduce((sum, rate) => sum + rate, 0) / attendanceRates.length) * 100 
    : 0;

  // Calculate radar warnings
  let yellowCount = 0;
  let orangeCount = 0;
  let redCount = 0;

  activeMembers.forEach(p => {
    const absences = calculateConsecutiveAbsences(p.id, p.department, p.startDate || '2026-01-01', db.attendances);
    if (absences === 1) yellowCount++;
    else if (absences === 2) orangeCount++;
    else if (absences >= 3) redCount++;
  });

  return {
    totalMembers: activeMembers.length,
    attendanceRate: Math.round(averageAttendanceRate),
    needingFollowUp: yellowCount + orangeCount + redCount,
    totalDepartments: db.departments.length,
    yellowCount,
    orangeCount,
    redCount
  };
}

// A v6.9.8 não converte filas antigas. A geração anterior é descartada antes
// da inicialização; somente operações criadas depois da ativação entram na fila.

export function mergeAppDatabase(_localDb: AppDatabase, currentDb: AppDatabase, incomingDb: AppDatabase, onConflict?: (existing: any, incoming: any, merged: any, field: string) => void): AppDatabase {
  if (!incomingDb) return currentDb;
  
  const mergeArrays = <T extends { id?: string; month?: string; version?: number; updatedAt?: string; deleted?: boolean | number }>(
    arrCurrent: T[],
    arrIncoming: T[],
    onConflict?: (existing: T, incoming: T, merged: T, field: string) => void
  ): T[] => {
    const valuesEqual = (a: any, b: any): boolean => {
      if (a === b) return true;
      if ((a === undefined || a === null) && (b === undefined || b === null)) return true;
      // O Supabase devolve alguns booleanos como 0/1. Eles representam o mesmo valor
      // usado pelo React e não devem criar uma falsa alteração de versão.
      if ((typeof a === 'boolean' || typeof a === 'number') &&
          (typeof b === 'boolean' || typeof b === 'number')) {
        return Number(a) === Number(b);
      }
      if (typeof a === 'object' && typeof b === 'object' && a && b) {
        return JSON.stringify(a) === JSON.stringify(b);
      }
      return false;
    };

    const hasBusinessDifference = (a: any, b: any): boolean => {
      const syncFields = new Set(['version', 'updatedAt', 'updatedBy']);
      const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
      for (const key of keys) {
        if (syncFields.has(key)) continue;
        if (!valuesEqual(a?.[key], b?.[key])) return true;
      }
      return false;
    };

    const map = new Map<string, T>();
    // Initialize map with current DB
    arrCurrent.forEach(item => {
      const key = item.id || item.month;
      if (key) map.set(key, item);
    });
    // Merge incoming
    arrIncoming.forEach(item => {
      const key = item.id || item.month;
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
      } else {
        const vExisting = existing.version || 1;
        const vIncoming = item.version || 1;
        
        // "Delete always wins" - if either existing or incoming is deleted, mark it deleted, regardless of versions!
        if (existing.deleted || item.deleted) {
          const merged = {
            ...(vIncoming >= vExisting ? item : existing),
            deleted: 1
          } as any;
          if (merged.status) merged.status = 'Excluído';
          merged.version = Math.max(vExisting, vIncoming);
          map.set(key, merged);
        } else if (vIncoming > vExisting) {
          const mergedItem = { ...(item as any) } as any;
          if (Array.isArray((existing as any).presentIds) && Array.isArray((item as any).presentIds)) {
            const mergedSet = new Set<string>();
            ((existing as any).presentIds || []).forEach((id: string) => mergedSet.add(id));
            ((item as any).presentIds || []).forEach((id: string) => mergedSet.add(id));
            mergedItem.presentIds = Array.from(mergedSet);
          }
          map.set(key, mergedItem);
        } else if (vIncoming === vExisting) {
          // Pull idempotente: receber novamente do Supabase o mesmo registro NÃO pode
          // aumentar a versão local. O comportamento anterior criava versões
          // artificiais a cada polling e fazia um aparelho rejeitar a atualização
          // verdadeira enviada por outro aparelho.
          if (!hasBusinessDifference(existing, item)) {
            const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            const incomingTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
            map.set(key, (incomingTime >= existingTime ? item : existing));
            return;
          }

          // Conflict: versions are equal. Perform field-level merge!
          const merged = { ...existing } as any;
          const tExisting = existing.updatedAt ? new Date(existing.updatedAt).getTime() : NaN;
          const tIncoming = item.updatedAt ? new Date(item.updatedAt).getTime() : NaN;
          // Fallback para dados legados sem updatedAt: usar createdAt ou 0
          const tExistingFallback = !isNaN(tExisting) ? tExisting
            : (existing as any).createdAt ? new Date((existing as any).createdAt).getTime() : 0;
          const tIncomingFallback = !isNaN(tIncoming) ? tIncoming
            : (item as any).createdAt ? new Date((item as any).createdAt).getTime() : 0;
          const isIncomingNewer = tIncomingFallback > tExistingFallback;
          const hasConflict = tIncomingFallback !== tExistingFallback; // Conflito se timestamps diferentes

          Object.keys(item).forEach(k => {
            const valExisting = (existing as any)[k];
            const valIncoming = (item as any)[k];

            if (valExisting === valIncoming) return;

            // Campos de lista de presença: UNIÃO deduplicada (aditivo — nunca perde presença).
            // Quando dois dispositivos marcam presença no mesmo evento ao mesmo tempo (versão igual),
            // a presença de ambos deve ser preservada em vez de uma sobrescrever a outra.
            if (k === 'presentIds' && Array.isArray((existing as any).presentIds) && Array.isArray((item as any).presentIds)) {
              const mergedSet = new Set<string>();
              ((existing as any).presentIds || []).forEach((id: string) => mergedSet.add(id));
              ((item as any).presentIds || []).forEach((id: string) => mergedSet.add(id));
              merged[k] = Array.from(mergedSet);
              return;
            }

            // Take non-empty values first. If both have values, LWW based on updatedAt
            if (valExisting === undefined || valExisting === null || valExisting === '') {
              merged[k] = valIncoming;
            } else if (valIncoming === undefined || valIncoming === null || valIncoming === '') {
              // keep existing
            } else {
              if (isIncomingNewer) {
                merged[k] = valIncoming;
              }
              // Notifica conflito se ambos têm valores e timestamps diferentes
              if (hasConflict && onConflict && isIncomingNewer === false && tIncomingFallback !== tExistingFallback) {
                onConflict(existing, item, merged, k);
              }
            }
          });

          // Conflict resolved, increment version to ensure it pushes back
          merged.version = Math.max(vExisting, vIncoming) + 1;
          merged.updatedAt = new Date().toISOString();

          map.set(key, merged);
        }
      }
    });
    return Array.from(map.values());
  };

  return {
    ...currentDb,
    departments: mergeArrays(currentDb.departments || [], incomingDb.departments || [], onConflict),
    people: mergeArrays(currentDb.people || [], incomingDb.people || [], onConflict),
    attendances: mergeArrays(currentDb.attendances || [], incomingDb.attendances || [], onConflict),
    goals: mergeArrays(currentDb.goals || [], incomingDb.goals || [], onConflict),
    pastoralLogs: mergeArrays(currentDb.pastoralLogs || [], incomingDb.pastoralLogs || [], onConflict),
    weeklyMissions: mergeArrays(currentDb.weeklyMissions || [], incomingDb.weeklyMissions || [], onConflict),
    specialMissions: mergeArrays(currentDb.specialMissions || [], incomingDb.specialMissions || [], onConflict),
    messageHistory: mergeArrays(currentDb.messageHistory || [], incomingDb.messageHistory || [], onConflict),
    events: mergeArrays(currentDb.events || [], incomingDb.events || [], onConflict),
    activityLogs: mergeArrays(currentDb.activityLogs || [], incomingDb.activityLogs || [], onConflict),
    activityLogCount: typeof incomingDb.activityLogCount === 'number' ? incomingDb.activityLogCount : currentDb.activityLogCount
  };
}

/**
 * Decide como aplicar um snapshot completo recebido do Supabase.
 *
 * Sem alterações locais pendentes, o servidor é a fonte de verdade. Isso também
 * corrige aparelhos antigos que ficaram com versões locais artificialmente altas
 * e, por isso, rejeitavam alterações válidas feitas em outro aparelho.
 *
 * Havendo uma alteração offline na fila, preservamos o merge por versão até que
 * o push termine, evitando apagar trabalho ainda não enviado ao servidor.
 */
export function reconcileServerSnapshot(
  currentDb: AppDatabase,
  incomingDb: AppDatabase,
  hasLocalPendingChanges: boolean,
  onConflict?: (existing: any, incoming: any, merged: any, field: string) => void
): AppDatabase {
  if (!hasLocalPendingChanges) return incomingDb;
  return mergeAppDatabase(currentDb, currentDb, incomingDb, onConflict);
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface SyncQueueItem {
  id: string;
  type: string;
  itemId: string;
  data: any;
  patch?: Record<string, any>;
  baseVersion?: number;
  operation?: 'CREATE' | 'UPDATE' | 'DELETE';
  retryCount?: number;
  inFlight?: boolean;
  timestamp: string;
  generation: string;
  clientVersion: string;
  deviceId: string;
}

export function collectSyncChanges<T extends Record<string, any>>(
  oldArr: T[] = [],
  newArr: T[] = [],
  pk: string = 'id'
): T[] {
  const oldMap = new Map(oldArr.map(item => [item[pk], item]));
  return newArr.filter(item => {
    const oldItem = oldMap.get(item[pk]);
    return !oldItem || JSON.stringify(oldItem) !== JSON.stringify(item);
  });
}

export function getSyncQueue(): SyncQueueItem[] {
  if (!isCurrentDataGenerationActive()) return [];
  try {
    const raw = localStorage.getItem('pm_sync_queue');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter(item => item?.generation === DATA_GENERATION && ['v7.8.5', APP_VERSION].includes(String(item?.clientVersion || '')))
          .map(item => ({
            ...item,
            // Compatibilidade com uma pendência criada pelo Hotfix R2: na
            // primeira sincronização da v6.9.10 o registro inteiro vira um
            // patch único, sem descartar a alteração offline do usuário.
            patch: item.patch && typeof item.patch === 'object' ? item.patch : (item.data || {}),
            baseVersion: Number.isFinite(Number(item.baseVersion))
              ? Number(item.baseVersion)
              : Math.max(0, Number(item?.data?.version || 1) - 1),
            operation: item.operation || (item?.data?.deleted ? 'DELETE' : 'UPDATE'),
            retryCount: Number(item.retryCount || 0),
          }))
      : [];
  } catch {
    return [];
  }
}

const mergeQueuePatches = (previous: Record<string, any>, incoming: Record<string, any>) => {
  const merged = { ...previous, ...incoming };
  if (
    'presentIdsAdd' in previous || 'presentIdsRemove' in previous ||
    'presentIdsAdd' in incoming || 'presentIdsRemove' in incoming
  ) {
    const add = new Set<string>(previous.presentIdsAdd || []);
    const remove = new Set<string>(previous.presentIdsRemove || []);
    for (const id of incoming.presentIdsAdd || []) {
      remove.delete(id);
      add.add(id);
    }
    for (const id of incoming.presentIdsRemove || []) {
      add.delete(id);
      remove.add(id);
    }
    merged.presentIdsAdd = [...add];
    merged.presentIdsRemove = [...remove];
  }
  return merged;
};

export function addToSyncQueue(
  type: string,
  itemId: string,
  data: any,
  options: {
    patch?: Record<string, any>;
    baseVersion?: number;
    operation?: 'CREATE' | 'UPDATE' | 'DELETE';
  } = {},
) {
  if (!isCurrentDataGenerationActive()) return;
  const queue = getSyncQueue();
  // Uma operação que já saiu pela rede é imutável: seu UUID pode ter sido
  // gravado no servidor mesmo se a resposta ainda não chegou. Uma nova edição
  // durante esse intervalo recebe outro UUID e nunca é confundida com retry.
  const existingIndex = queue.findIndex(q => q.type === type && q.itemId === itemId && !q.inFlight);
  const incomingPatch = options.patch || data || {};
  const incomingOperation = options.operation || (data?.deleted ? 'DELETE' : 'UPDATE');
  if (existingIndex >= 0) {
    // Mantém um item por entidade. O operation_id continua estável e o patch
    // acumula somente os campos realmente editados enquanto aguarda ACK.
    const existing = queue[existingIndex];
    queue[existingIndex] = {
      ...existing,
      data,
      patch: mergeQueuePatches(existing.patch || existing.data || {}, incomingPatch),
      baseVersion: Number(existing.baseVersion ?? options.baseVersion ?? 0),
      operation: existing.operation === 'CREATE' ? 'CREATE' : incomingOperation,
      timestamp: new Date().toISOString(),
      generation: DATA_GENERATION,
      clientVersion: APP_VERSION,
      deviceId: getOrCreateDeviceId(),
    };
    localStorage.setItem('pm_sync_queue', JSON.stringify(queue));
    return;
  }
  queue.push({
    id: generateUUID(),
    type,
    itemId,
    data,
    patch: incomingPatch,
    baseVersion: Number(options.baseVersion ?? 0),
    operation: incomingOperation,
    retryCount: 0,
    timestamp: new Date().toISOString(),
    generation: DATA_GENERATION,
    clientVersion: APP_VERSION,
    deviceId: getOrCreateDeviceId(),
  });
  localStorage.setItem('pm_sync_queue', JSON.stringify(queue));
}

export function clearSyncQueue() {
  localStorage.removeItem('pm_sync_queue');
}

export function markSyncQueueInFlight(items: SyncQueueItem[], inFlight: boolean) {
  if (!isCurrentDataGenerationActive() || items.length === 0) return;
  const ids = new Set(items.map(item => item.id));
  const queue = getSyncQueue().map(item => ids.has(item.id) ? { ...item, inFlight } : item);
  localStorage.setItem('pm_sync_queue', JSON.stringify(queue));
}


/**
 * Atualiza a versão-base de operações que colidiram com uma edição feita em
 * outro aparelho. O patch local permanece intacto e será reenviado sobre a
 * versão canônica mais recente após o pull. Nenhuma operação é descartada.
 */
export function rebaseSyncQueue(conflicts: Array<{ operation_id?: string; current_version?: number }>) {
  if (!isCurrentDataGenerationActive() || !Array.isArray(conflicts) || conflicts.length === 0) return;
  const versions = new Map(
    conflicts
      .filter(c => c?.operation_id && Number.isFinite(Number(c.current_version)))
      .map(c => [String(c.operation_id), Math.max(0, Number(c.current_version || 0))]),
  );
  if (versions.size === 0) return;
  const queue = getSyncQueue().map(item => versions.has(item.id)
    ? { ...item, baseVersion: versions.get(item.id)!, inFlight: false, retryCount: Number(item.retryCount || 0) + 1 }
    : item);
  localStorage.setItem('pm_sync_queue', JSON.stringify(queue));
}

/**
 * Remove somente as operações que receberam ACK e que não foram alteradas
 * novamente enquanto o envio estava em andamento. Uma edição mais nova do
 * mesmo registro permanece na Outbox para o próximo ciclo.
 */
export function acknowledgeSyncQueue(sentItems: SyncQueueItem[]) {
  if (!isCurrentDataGenerationActive()) return;
  const sent = new Map(sentItems.map(item => [item.id, item.timestamp]));
  const remaining = getSyncQueue().filter(item => sent.get(item.id) !== item.timestamp);
  if (remaining.length === 0) {
    localStorage.removeItem('pm_sync_queue');
  } else {
    localStorage.setItem('pm_sync_queue', JSON.stringify(remaining));
  }
}

