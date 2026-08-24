// src/views/PeopleListView.tsx
import { getLocalDateISO } from '../utils/localDate';
import { useState, useEffect, useMemo } from 'react';
import type { AppDatabase, Person, UserSession } from '../services/db';
import { calculateConsecutiveAbsences, personInDepartment, personHasRole, generateUUID, canUserSelectDepartment, getUserAllowedDepartments, getDepartmentTheme, getVisibleDepartments, compareByName, hashPassword } from '../services/db';
import { Search, UserPlus, Phone, User, Trash2, Edit3, FileSpreadsheet, AlertTriangle, Network, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { CENSUS_DATA } from '../services/census_data';

interface PeopleListViewProps {
  db: AppDatabase;
  session: UserSession;
  onUpdatePeople: (newPeople: Person[]) => void;
  onResetPassword?: (personId: string, newPassword?: string) => void;
  initialDepartmentFilter?: string;
  onChangeDepartment?: (newDept: string | undefined) => void;
}

export const PeopleListView: React.FC<PeopleListViewProps> = ({ db, session, onUpdatePeople, onResetPassword, initialDepartmentFilter, onChangeDepartment }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryTab, setCategoryTab] = useState<'Ativo' | 'Visitante' | 'Arquivado'>('Ativo');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [profileTab, setProfileTab] = useState<'todos' | 'membros' | 'outros'>('todos');
  const [deptFilter, setDeptFilter] = useState(
    initialDepartmentFilter || session.department || 'Todos'
  );

  // CRUD Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // CSV Import Modals State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<Person[]>([]);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Google Sheets Census Simulator State
  const [isCensusSimulatorOpen, setIsCensusSimulatorOpen] = useState(false);
  const [simulatedPeople, setSimulatedPeople] = useState(() => [...CENSUS_DATA]);
  const [simulatorSearch, setSimulatorSearch] = useState('');
  const [activeChangeDeptId, setActiveChangeDeptId] = useState<string | null>(null);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDept, setFormDept] = useState(session.department || 'Novo Alvorecer (Jovens)');
  const [formRole, setFormRole] = useState<'Pastor Admin' | 'Pastor' | 'Secretaria Geral' | 'Líder' | 'Multiplicador' | 'Membro'>('Membro');
  const [formExtraDepts, setFormExtraDepts] = useState<{ department: string; role: 'Pastor Admin' | 'Pastor' | 'Secretaria Geral' | 'Líder' | 'Multiplicador' | 'Membro'; subGroup?: string }[]>([]);
  const [formStartDate, setFormStartDate] = useState(getLocalDateISO());
  const [formStatus, setFormStatus] = useState<'Ativo' | 'Visitante' | 'Arquivado'>('Ativo');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formObservations, setFormObservations] = useState('');
  const [formBaptized, setFormBaptized] = useState<boolean | null>(null);
  const [formBaptismIntention, setFormBaptismIntention] = useState<number | boolean>(0);
  const [formGender, setFormGender] = useState<'M' | 'F' | 'U'>('U');
  const [formMotherName, setFormMotherName] = useState('');
  const [missingContactFilter, setMissingContactFilter] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [isBaptismModalOpen, setIsBaptismModalOpen] = useState(false);

  // New Baptism & Profile Details States
  const [baptismFilter, setBaptismFilter] = useState('Todos');
  const [selectedPersonForDetailsSnapshot, setSelectedPersonForDetails] = useState<Person | null>(null);
  const [obsText, setObsText] = useState('');
  const [baptismReportTab, setBaptismReportTab] = useState<'baptized' | 'intention' | 'unable' | 'not_baptized' | 'uninformed'>('intention');
  // O perfil aberto deriva sempre do snapshot atual. Assim uma alteração de
  // batismo recebida de outro aparelho aparece sem reabrir o modal.
  const selectedPersonForDetails = useMemo(() => {
    if (!selectedPersonForDetailsSnapshot) return null;
    const live = db.people.find(p => p.id === selectedPersonForDetailsSnapshot.id);
    if (!live) return selectedPersonForDetailsSnapshot;
    const liveVersion = Number(live.version || 0);
    const snapshotVersion = Number(selectedPersonForDetailsSnapshot.version || 0);
    const liveUpdatedAt = String(live.updatedAt || '');
    const snapshotUpdatedAt = String(selectedPersonForDetailsSnapshot.updatedAt || '');
    return liveVersion > snapshotVersion || liveUpdatedAt > snapshotUpdatedAt
      ? live
      : selectedPersonForDetailsSnapshot;
  }, [db.people, selectedPersonForDetailsSnapshot]);

  const openDetailsModal = (person: Person) => {
    setSelectedPersonForDetails(person);
    setObsText(person.observations || '');
  };

  const handleUpdateBaptismStatus = (personId: string, type: 'baptized' | 'intention' | 'unable' | 'not_baptized' | 'uninformed') => {
    const updated = db.people.map(p => {
      if (p.id === personId) {
        const updatedPerson = {
          ...p,
          baptized: type === 'uninformed' ? null : (type === 'baptized' ? true : false),
          baptismIntention: type === 'intention' ? 1 : (type === 'unable' ? 2 : 0)
        };
        if (selectedPersonForDetails && selectedPersonForDetails.id === personId) {
          setSelectedPersonForDetails(updatedPerson);
        }
        return updatedPerson;
      }
      return p;
    });
    onUpdatePeople(updated);
  };

  const handleSaveObservations = () => {
    if (!selectedPersonForDetails) return;
    const updated = db.people.map(p => {
      if (p.id === selectedPersonForDetails.id) {
        return { ...p, observations: obsText.trim() };
      }
      return p;
    });
    onUpdatePeople(updated);
    setSelectedPersonForDetails(prev => prev ? { ...prev, observations: obsText.trim() } : null);
    alert("Observações salvas com sucesso!");
  };

  const departments = getVisibleDepartments(db);
  const isRestrictedDept = session.role === 'Líder' || session.role === 'Multiplicador';
  const canViewDeletedRecords = session.role === 'Pastor Admin' || session.role === 'Pastor' || session.role === 'Secretaria Geral';

  // O filtro de departamento acompanha o departamento definido na sessão (todos os perfis)
  useEffect(() => {
    if (session.department) {
      setDeptFilter(session.department);
      if (isRestrictedDept) {
        setFormDept(session.department);
        setCategoryTab('Ativo');
        setRoleFilter('Todos');
        setProfileTab('todos');
      }
    }
  }, [isRestrictedDept, session.department]);
  const isAuthorizedToDelete = session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Líder' || session.role === 'Pastor Admin';
  const canViewSystemAccess = session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Líder' || session.role === 'Pastor Admin';
  const canResetPasswords = session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin';

  const getMotherName = (personId: string | undefined): string => {
    if (!personId) return '';
    const mother = db.people.find(p => p.id === personId && !p.deleted);
    return mother ? mother.name : '';
  };

  // Specific role scope checks
  const canEditPerson = (personToEdit: Person) => {
    if (session.role === 'Pastor Admin' || session.role === 'Pastor') return true;
    if (session.role === 'Secretaria Geral') {
      return personToEdit.role !== 'Pastor' && personToEdit.role !== 'Secretaria Geral';
    }
    if (session.role === 'Líder') {
      return personInDepartment(personToEdit, session.department || '');
    }
    if (session.role === 'Multiplicador') {
      return personInDepartment(personToEdit, session.department || '') && personToEdit.role === 'Membro';
    }
    return false;
  };

  const canChangeDepartment = (p: Person) => {
    if (session.role === 'Pastor Admin' || session.role === 'Pastor' || session.role === 'Secretaria Geral') return true;
    if (session.role === 'Líder') {
      return personInDepartment(p, session.department || '');
    }
    return false;
  };

  const downloadCSVTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Nome,Telefone,Departamento,Funcao,Nascimento,Inicio\n"
      + "Jose da Silva,69992001122,Novo Alvorecer (Jovens),Membro,2001-05-15,2026-06-18\n"
      + "Maria Oliveira,69993004455,Atalaias de Cristo (Irmas),Lider,1985-11-20,2025-01-10\n"
      + "Pedro Santos,69994005566,Novo Alvorecer (Jovens),Multiplicador,2003-08-12,2026-03-01";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_cadastro_multiplica.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setCsvText(text);
        processCSV(text);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const processCSV = (text: string) => {
    try {
      setImportError('');
      setImportSuccess('');
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setImportError('Nenhuma linha válida encontrada no CSV. Verifique o cabeçalho e colunas.');
        setImportPreview([]);
        return;
      }
      setImportPreview(parsed);
    } catch (err: any) {
      setImportError('Erro ao processar CSV: ' + err.message);
      setImportPreview([]);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const header = lines[0];
    const delimiter = header.includes(';') ? ';' : ',';
    const headers = header.split(delimiter).map(h => h.trim().toLowerCase());

    const nameIdx = headers.findIndex(h => h.includes('nome'));
    const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('fone') || h.includes('celular'));
    const deptIdx = headers.findIndex(h => h.includes('dept') || h.includes('departamento'));
    const roleIdx = headers.findIndex(h => h.includes('cargo') || h.includes('func') || h.includes('função') || h.includes('funcao'));
    const birthIdx = headers.findIndex(h => h.includes('nasc'));
    const startIdx = headers.findIndex(h => h.includes('inici') || h.includes('inicio') || h.includes('data'));

    const parsedPeople: Person[] = [];

    const generateUsername = (r: string, n: string): string => {
      const clean = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
      const parts = clean.split(/\s+/);
      const first = parts[0] || '';
      const last = parts.length > 1 ? parts[parts.length - 1] : '';
      const prefix = r === 'Líder' ? 'LIDER' : r === 'Multiplicador' ? 'MULT' : r === 'Pastor' ? 'PASTOR' : r === 'Secretaria Geral' ? 'SEC' : 'USER';
      return last ? `${prefix}_${first}.${last}` : `${prefix}_${first}`;
    };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;

      const rawName = nameIdx !== -1 ? cols[nameIdx] : cols[0];
      const rawPhone = phoneIdx !== -1 ? cols[phoneIdx] : cols[1];
      if (!rawName || !rawPhone) continue;

      let rawRole = roleIdx !== -1 ? cols[roleIdx] : 'Membro';
      let role: Person['role'] = 'Membro';
      const lowerRole = rawRole.toLowerCase();
      if (lowerRole.includes('pastor admin') || lowerRole.includes('pastor administrador')) role = 'Pastor Admin';
      else if (lowerRole.includes('pastor')) role = 'Pastor';
      else if (lowerRole.includes('secret') || lowerRole.includes('sec')) role = 'Secretaria Geral';
      else if (lowerRole.includes('lider') || lowerRole.includes('líder')) role = 'Líder';
      else if (lowerRole.includes('mult')) role = 'Multiplicador';

      // Scoping role permissions
      if (session.role === 'Multiplicador') {
        role = 'Membro';
      } else if (session.role === 'Líder') {
        if (role !== 'Multiplicador') role = 'Membro';
      } else if (session.role === 'Secretaria Geral') {
        if (role === 'Pastor Admin' || role === 'Pastor') role = 'Líder';
      }

      let dept = deptIdx !== -1 ? cols[deptIdx] : '';
      if (isRestrictedDept) {
        dept = session.department || 'Novo Alvorecer (Jovens)';
      } else {
        const matchedDept = departments.find(d => 
          d.name.toLowerCase().includes(dept.toLowerCase()) || 
          dept.toLowerCase().includes(d.name.toLowerCase())
        );
        dept = matchedDept ? matchedDept.name : (dept || departments[0]?.name || 'Novo Alvorecer (Jovens)');
      }

      // Normalize birth date from Brazilian format DD/MM/YYYY or DD/MM to YYYY-MM-DD
      let birthDate = birthIdx !== -1 ? cols[birthIdx].trim() : '';
      if (birthDate) {
        const brDateMatch = birthDate.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
        if (brDateMatch) {
          const dd = brDateMatch[1].padStart(2, '0');
          const mm = brDateMatch[2].padStart(2, '0');
          const yy = brDateMatch[3] || '1900';
          birthDate = `${yy}-${mm}-${dd}`;
        }
      }

      // Map baptism status from a dedicated column if present
      const baptismIdx = headers.findIndex(h => h.includes('batiz') || h.includes('batismo'));
      let parsedBaptized: boolean | null = null;
      let parsedBaptismIntention = 0;
      if (baptismIdx !== -1) {
        const rawBaptism = cols[baptismIdx]?.trim().toLowerCase() || '';
        if (rawBaptism === 'sim' || rawBaptism === 's' || rawBaptism === 'true' || rawBaptism === '1') {
          parsedBaptized = true;
        } else if (rawBaptism === 'não' || rawBaptism === 'nao' || rawBaptism === 'n' || rawBaptism === 'false' || rawBaptism === '0') {
          parsedBaptized = false;
          if (rawBaptism.includes('inten')) parsedBaptismIntention = 1;
          else if (rawBaptism.includes('imposs') || rawBaptism.includes('imped')) parsedBaptismIntention = 2;
        }
      }

      const startDate = startIdx !== -1 ? cols[startIdx] : getLocalDateISO();

      const phone = rawPhone.replace(/\D/g, '');

      const newPerson: Person = {
        id: 'p_' + generateUUID(),
        name: rawName,
        phone,
        department: dept,
        role,
        departments: [{ department: dept, role }],
        startDate: startDate || getLocalDateISO(),
        status: 'Ativo',
        createdAt: getLocalDateISO(),
        birthDate: birthDate || undefined,
        baptized: parsedBaptized,
        baptismIntention: parsedBaptismIntention,
        gender: 'U'
      };

      if (role !== 'Membro') {
        newPerson.username = generateUsername(role, rawName);
        newPerson.password = 'mudar123';
        newPerson.passwordChanged = false;
      }

      parsedPeople.push(newPerson);
    }
    return parsedPeople;
  };

  const confirmImport = async () => {
    if (importPreview.length === 0) return;
    let duplicates = 0;
    const cleanNewPeople = importPreview.filter(imported => {
      const exists = db.people.some(existing => 
        !existing.deleted && (
          existing.name.toLowerCase() === imported.name.toLowerCase() ||
          existing.phone === imported.phone
        )
      );
      if (exists) {
        duplicates++;
        return false;
      }
      return true;
    });

    if (cleanNewPeople.length === 0) {
      setImportError('Todas as pessoas presentes no arquivo já constam cadastradas.');
      return;
    }

    // Re-hashear senhas padrão dos importados (parseCSV gera texto puro 'mudar123' no preview)
    const hashedPeople = await Promise.all(cleanNewPeople.map(async (p) => {
      if (p.password && !p.password.startsWith('sha256$')) {
        return { ...p, password: await hashPassword(p.password) };
      }
      return p;
    }));

    onUpdatePeople([...db.people, ...hashedPeople]);
    setImportSuccess(`Sucesso! ${hashedPeople.length} cadastros importados.${duplicates > 0 ? ` ${duplicates} duplicados ignorados.` : ''}`);
    setImportPreview([]);
    setCsvText('');
    setTimeout(() => {
      setIsImportModalOpen(false);
      setImportSuccess('');
    }, 2500);
  };

  // Filter list (ignoring deleted members and applying category tab)
  const filteredPeople = useMemo(() => db.people.filter(p => {
    const isNotDeleted = showTrash ? p.deleted : !p.deleted;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone.includes(searchTerm);
    // Apply the category tab filter
    const matchesCategory = showTrash || p.status === categoryTab || (categoryTab === 'Ativo' && !p.status);
    const matchesRole = roleFilter === 'Todos' || p.role === roleFilter;
    const matchesProfile = profileTab === 'todos' || (profileTab === 'membros' ? p.role === 'Membro' : p.role !== 'Membro');
    const globalDeletedView = showTrash && canViewDeletedRecords;
    const matchesDept = globalDeletedView || deptFilter === 'Todos' || personInDepartment(p, deptFilter);

    // Role scoping: follows chosen department when defined
    const matchesScope = globalDeletedView || !session.department || personInDepartment(p, session.department);

    const matchesMissingContact = !missingContactFilter || (!p.phone || p.phone.trim() === '' || p.phone === '999999999' || p.phone === '69999999999' || !p.address || p.address.trim() === '');

    const matchesBaptism = 
      baptismFilter === 'Todos' ||
      (baptismFilter === 'baptized' && p.baptized === true) ||
      (baptismFilter === 'intention' && p.baptized === false && (p.baptismIntention === 1 || p.baptismIntention === true)) ||
      (baptismFilter === 'unable' && p.baptized === false && p.baptismIntention === 2) ||
      (baptismFilter === 'not_baptized' && p.baptized === false && (p.baptismIntention === 0 || p.baptismIntention === false || !p.baptismIntention)) ||
      (baptismFilter === 'uninformed' && (p.baptized === null || p.baptized === undefined));

    return isNotDeleted && matchesSearch && matchesCategory && matchesRole && matchesProfile && matchesDept && matchesScope && matchesMissingContact && matchesBaptism;
  }).sort(compareByName), [db.people, searchTerm, categoryTab, roleFilter, profileTab, deptFilter, missingContactFilter, showTrash, session.department, baptismFilter, canViewDeletedRecords]);

  // Category counts (scoped to chosen department when defined)
  const scopedPeople = db.people.filter(p => !p.deleted && (!session.department || personInDepartment(p, session.department)));
  const activeCount = scopedPeople.filter(p => p.status === 'Ativo' || !p.status).length;
  const visitorCount = scopedPeople.filter(p => p.status === 'Visitante').length;
  const archivedCount = scopedPeople.filter(p => p.status === 'Arquivado').length;
  const deletedCount = canViewDeletedRecords
    ? db.people.filter(p => p.deleted).length
    : db.people.filter(p => p.deleted && (!session.department || personInDepartment(p, session.department))).length;

  // Memoized absences map (perf: evita recalcular O(N×M) a cada tecla de busca)
  const absencesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of db.people) {
      if (p.deleted) continue;
      map.set(p.id, calculateConsecutiveAbsences(p.id, p.department, p.startDate || '2026-01-01', db.attendances));
    }
    return map;
  }, [db.people, db.attendances]);

  const handleChangeStatus = (id: string, newStatus: 'Ativo' | 'Visitante' | 'Arquivado') => {
    const updated = db.people.map(p =>
      p.id === id ? { ...p, status: newStatus } : p
    );
    onUpdatePeople(updated);
  };

  const openAddModal = () => {
    setEditingPerson(null);
    setFormName('');
    setFormPhone('');
    setFormDept(session.department || 'Novo Alvorecer (Jovens)');
    setFormRole('Membro');
    setFormExtraDepts([]);
    setFormStartDate(getLocalDateISO());
    setFormStatus('Ativo');
    setFormBirthDate('');
    setFormAddress('');
    setFormObservations('');
    setFormBaptized(null as any); // null represents uninformed
    setFormBaptismIntention(0);
    setFormGender('U');
    setFormMotherName('');
    setIsModalOpen(true);
  };

  const openEditModal = (person: Person) => {
    setEditingPerson(person);
    setFormName(person.name);
    setFormPhone(person.phone);
    setFormDept(person.department);
    setFormRole(person.role);
    setFormExtraDepts(
      person.departments && person.departments.length > 1
        ? person.departments.slice(1).map(d => ({ department: d.department, role: d.role, ...(d.subGroup ? { subGroup: d.subGroup } : {}) }))
        : []
    );
    setFormStartDate(person.startDate);
    setFormStatus((person.status === 'Inativo' ? 'Arquivado' : person.status) as 'Ativo' | 'Visitante' | 'Arquivado');
    setFormBirthDate(person.birthDate || '');
    setFormAddress(person.address || '');
    setFormObservations(person.observations || '');
    setFormBaptized(person.baptized !== undefined ? person.baptized : null);
    setFormBaptismIntention(person.baptismIntention === true ? 1 : (person.baptismIntention || 0));
    setFormGender(person.gender || 'U');
    setFormMotherName(person.motherName || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const cleanPhone = formPhone.replace(/\D/g, '');

    const generateUsername = (r: string, n: string): string => {
      const clean = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
      const parts = clean.split(/\s+/);
      const first = parts[0] || '';
      const last = parts.length > 1 ? parts[parts.length - 1] : '';
      const prefix = r === 'Líder' ? 'LIDER' : r === 'Multiplicador' ? 'MULT' : r === 'Pastor' ? 'PASTOR' : r === 'Secretaria Geral' ? 'SEC' : 'USER';
      return last ? `${prefix}_${first}.${last}` : `${prefix}_${first}`;
    };

    if (editingPerson) {
      // Edit
      const finalDept = isRestrictedDept ? (session.department || formDept) : formDept;
      // Preserva o subgrupo (ex.: 'Huperetes') quando o departamento principal não muda
      const originalPrimary = editingPerson.departments?.[0];
      const primarySubGroup = originalPrimary && originalPrimary.department === finalDept
        ? originalPrimary.subGroup
        : undefined;
      const departments = [
        { department: finalDept, role: formRole, ...(primarySubGroup ? { subGroup: primarySubGroup } : {}) },
        ...formExtraDepts
      ];
      const hasCredentials = editingPerson.username && editingPerson.password;
      const needsCredentials = formRole !== 'Membro';
      const newPasswordHash = (!hasCredentials && needsCredentials) ? await hashPassword('mudar123') : undefined;
      const updated = db.people.map(p => {
        if (p.id === editingPerson.id) {
          const creds = (!hasCredentials && needsCredentials) ? {
            username: p.username || generateUsername(formRole, formName),
            password: newPasswordHash,
            passwordChanged: false
          } : {};

          return {
            ...p,
            name: formName.trim(),
            phone: cleanPhone,
            department: finalDept,
            role: formRole,
            departments,
            startDate: formStartDate,
            status: formStatus,
            birthDate: formBirthDate || undefined,
            address: formAddress.trim(),
            observations: formObservations.trim(),
            baptized: formBaptized,
            baptismIntention: formBaptized ? 0 : Number(formBaptismIntention),
            gender: formGender,
            motherName: formMotherName.trim() || undefined,
            ...creds
          };
        }
        return p;
      });
      onUpdatePeople(updated);
    } else {
      // Create
      const finalDept = isRestrictedDept ? (session.department || 'Novo Alvorecer (Jovens)') : formDept;
      const departments = [{ department: finalDept, role: formRole }, ...formExtraDepts];
      const newPerson: Person = {
        id: 'p_' + generateUUID(),
        name: formName.trim(),
        phone: cleanPhone,
        department: finalDept,
        role: formRole,
        departments,
        startDate: formStartDate,
        status: 'Ativo',
        createdAt: getLocalDateISO(),
        birthDate: formBirthDate || undefined,
        address: formAddress.trim(),
        observations: formObservations.trim(),
        baptized: formBaptized,
        baptismIntention: formBaptized ? 0 : Number(formBaptismIntention),
        gender: formGender,
        motherName: formMotherName.trim() || undefined,
        ...(formRole !== 'Membro' ? {
          username: generateUsername(formRole, formName),
          password: await hashPassword('mudar123'),
          passwordChanged: false
        } : {})
      };
      onUpdatePeople([...db.people, newPerson]);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja apagar este membro?')) {
      const updated = db.people.map(p =>
        p.id === id ? { ...p, deleted: true } : p
      );
      onUpdatePeople(updated);
    }
  };

  const handleRestore = (id: string) => {
    if (confirm('Tem certeza que deseja restaurar este membro?')) {
      const updated = db.people.map(p =>
        p.id === id ? { ...p, deleted: false } : p
      );
      onUpdatePeople(updated);
    }
  };

  const toggleDeletedRecords = () => {
    const next = !showTrash;
    setShowTrash(next);
    if (next) {
      setRoleFilter('Todos');
      setProfileTab('todos');
      setMissingContactFilter(false);
      setBaptismFilter('Todos');
      setDeptFilter('Todos');
    }
  };

  const transferPerson = (person: Person, newDepartment: string): Person => {
    const extraAssignments = (person.departments || [])
      .filter((assignment, index) => index > 0 || assignment.department !== person.department)
      .filter(assignment => assignment.department !== newDepartment && assignment.department !== person.department);
    return {
      ...person,
      department: newDepartment,
      departments: [{ department: newDepartment, role: person.role }, ...extraAssignments],
    };
  };

  // Helper to color code the avatar based on role
  const getAvatarBg = (role: string) => {
    switch (role) {
      case 'Pastor Admin': return 'linear-gradient(135deg, #7c2d12 0%, #d97706 100%)';
      case 'Pastor': return 'linear-gradient(135deg, var(--power-orange) 0%, var(--power-orange) 100%)';
      case 'Secretaria Geral': return 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)';
      case 'Líder': return 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)';
      case 'Multiplicador': return 'linear-gradient(135deg, var(--power-orange) 0%, #ff9a5f 100%)';
      default: return 'linear-gradient(135deg, var(--power-muted) 0%, #94a3b8 100%)';
    }
  };

  const handleCopyContacts = () => {
    const header = `*Nome | Link WhatsApp*\n`;
    const body = filteredPeople.map(p => {
      const cleanPhone = p.phone ? p.phone.replace(/\D/g, '') : '';
      const link = cleanPhone ? `wa.me/55${cleanPhone}` : 'Sem telefone';
      return `${p.name} | ${link}`;
    }).join('\n');

    navigator.clipboard.writeText(header + body)
      .then(() => alert("Contatos copiados no formato duas colunas para o WhatsApp!"))
      .catch(() => alert("Erro ao copiar contatos."));
  };

  const handleCopyBaptismList = () => {
    const list = filteredPeople.filter(p => {
      if (baptismReportTab === 'baptized') return p.baptized === true;
      if (baptismReportTab === 'intention') return p.baptized === false && (p.baptismIntention === 1 || p.baptismIntention === true);
      if (baptismReportTab === 'unable') return p.baptized === false && p.baptismIntention === 2;
      if (baptismReportTab === 'not_baptized') return p.baptized === false && (p.baptismIntention === 0 || p.baptismIntention === false || !p.baptismIntention);
      return p.baptized === null || p.baptized === undefined;
    });
    if (list.length === 0) {
      alert("Nenhum membro nesta categoria com os filtros atuais.");
      return;
    }
    const titleStr = baptismReportTab === 'baptized' 
      ? 'Batizados nas Águas 🌊' 
      : baptismReportTab === 'intention' 
        ? 'Com Intenção 🕊️' 
        : baptismReportTab === 'unable' 
          ? 'Impossibilitados 🚫' 
          : baptismReportTab === 'not_baptized'
            ? 'Não Batizados ⚠️'
            : 'Não Informado ❓';
    const header = `*Lista de Membros - ${titleStr}*\n\n*Nome | Contato*\n`;
    const body = list.map(p => {
      const cleanPhone = p.phone ? p.phone.replace(/\D/g, '') : '';
      const link = cleanPhone ? `wa.me/55${cleanPhone}` : 'Sem telefone';
      return `${p.name} | ${link}`;
    }).join('\n');

    navigator.clipboard.writeText(header + body)
      .then(() => alert("Lista de batismo copiada no formato duas colunas para o WhatsApp!"))
      .catch(() => alert("Erro ao copiar lista."));
  };

  const handleDownloadBaptismCSV = () => {
    const list = filteredPeople.filter(p => {
      if (baptismReportTab === 'baptized') return p.baptized === true;
      if (baptismReportTab === 'intention') return p.baptized === false && (p.baptismIntention === 1 || p.baptismIntention === true);
      if (baptismReportTab === 'unable') return p.baptized === false && p.baptismIntention === 2;
      if (baptismReportTab === 'not_baptized') return p.baptized === false && (p.baptismIntention === 0 || p.baptismIntention === false || !p.baptismIntention);
      return p.baptized === null || p.baptized === undefined;
    });
    if (list.length === 0) {
      alert("Nenhum membro nesta categoria para exportar.");
      return;
    }
    const titleFile = baptismReportTab === 'baptized' 
      ? 'batizados' 
      : baptismReportTab === 'intention' 
        ? 'intencao_batismo' 
        : baptismReportTab === 'unable' 
          ? 'impossibilitados' 
          : baptismReportTab === 'not_baptized'
            ? 'nao_batizados'
            : 'nao_informado';
    const csvHeader = "Nome,Telefone,Departamento,Função,Status Batismo\n";
    const csvRows = list.map(p => {
      const cleanPhone = p.phone ? p.phone.replace(/\D/g, '') : '';
      const statusStr = p.baptized === true 
        ? 'Batizado nas Águas' 
        : p.baptized === false 
          ? ((p.baptismIntention === 1 || p.baptismIntention === true) 
            ? 'Com Intenção' 
            : p.baptismIntention === 2 
              ? 'Impossibilitado' 
              : 'Não Batizado')
          : 'Não Informado';
      const escapedName = `"${p.name.replace(/"/g, '""')}"`;
      const escapedDept = `"${p.department.replace(/"/g, '""')}"`;
      const escapedRole = `"${p.role.replace(/"/g, '""')}"`;
      return `${escapedName},${cleanPhone},${escapedDept},${escapedRole},${statusStr}`;
    }).join('\n');

    const blob = new Blob(["\uFEFF" + csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_batismo_${titleFile}_${getLocalDateISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMergeCensus = () => {
    let importedCount = 0;
    let duplicatesCount = 0;
    const newPeople: Person[] = [];

    simulatedPeople.forEach(item => {
      // Check if person already exists (by name or phone)
      const exists = db.people.some(existing => 
        !existing.deleted && (
          existing.name.toLowerCase() === item.name.toLowerCase() ||
          (existing.phone && item.phone && existing.phone === item.phone)
        )
      );

      if (exists) {
        duplicatesCount++;
      } else {
        let targetId = 'p_' + generateUUID();
        if (item.id === 'census_235') targetId = 'p_ys_66'; // Poliany
        else if (item.id === 'census_53') targetId = 'p_ys_67'; // Samuel
        else if (item.id === 'census_56') targetId = 'p_ys_68'; // Fabricia

        const newPerson: Person = {
          id: targetId,
          name: item.name,
          phone: item.phone,
          department: item.draftDepartment,
          role: 'Membro',
          departments: [{ department: item.draftDepartment, role: 'Membro' }],
          startDate: getLocalDateISO(),
          status: 'Ativo',
          createdAt: getLocalDateISO(),
          address: item.address,
          observations: item.observations,
          gender: (item.gender as 'M' | 'F' | 'U') || 'U'
        };
        newPeople.push(newPerson);
        importedCount++;
      }
    });

    if (newPeople.length > 0) {
      onUpdatePeople([...db.people, ...newPeople]);
      alert(`Simulação mesclada com sucesso!\n✓ ${importedCount} membros importados.\n✓ ${duplicatesCount} duplicidades ignoradas.`);
    } else {
      alert("Todas as pessoas simuladas já constam cadastradas!");
    }
    setIsCensusSimulatorOpen(false);
  };

  const handleImportSingleSimulated = (item: any) => {
    const exists = db.people.some(existing => 
      !existing.deleted && (
        existing.name.toLowerCase() === item.name.toLowerCase() ||
        (existing.phone && item.phone && existing.phone === item.phone)
      )
    );
    if (exists) {
      alert("Esta pessoa já consta cadastrada!");
      return;
    }
    let targetId = 'p_' + generateUUID();
    if (item.id === 'census_235') targetId = 'p_ys_66'; // Poliany
    else if (item.id === 'census_53') targetId = 'p_ys_67'; // Samuel
    else if (item.id === 'census_56') targetId = 'p_ys_68'; // Fabricia

    const newPerson: Person = {
      id: targetId,
      name: item.name,
      phone: item.phone,
      department: item.draftDepartment,
      role: 'Membro',
      departments: [{ department: item.draftDepartment, role: 'Membro' }],
      startDate: getLocalDateISO(),
      status: 'Ativo',
      createdAt: getLocalDateISO(),
      address: item.address,
      observations: item.observations
    };
    onUpdatePeople([...db.people, newPerson]);
    alert(`${item.name} importado(a) com sucesso no departamento ${item.draftDepartment}!`);
  };

  return (
    <div className="animate-fade">
      <div className="view-header">
        <div>
          <h2>Membros & Liderança</h2>
          <p className="subtitle">Gestão geral de participantes, líderes e equipes da IEAD-JK</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {(session.role === 'Pastor' || session.role === 'Secretaria Geral' || session.role === 'Pastor Admin') && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setSimulatedPeople([...CENSUS_DATA]); setIsCensusSimulatorOpen(true); }}>
                          <FileSpreadsheet size={16} style={{ color: 'var(--power-orange)' }} /> Simular Censo Google Sheets
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsImportModalOpen(true)}>
                          <FileSpreadsheet size={16} style={{ color: '#10b981' }} /> Importar CSV
                        </button>
                      </>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => setIsBaptismModalOpen(true)}>
                      <span className="mr-1">🌊</span> Relatório de Batismo
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                      <UserPlus size={16} /> Cadastrar Membro
                    </button>
                  </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div className="flex gap-2 mb-5 flex-wrap">
                    {(['Ativo', 'Visitante', 'Arquivado'] as const).map((tab) => {
                      const count = tab === 'Ativo' ? activeCount : tab === 'Visitante' ? visitorCount : archivedCount;
                      const colors: Record<string, { bg: string; border: string; color: string }> = {
                        Ativo: { bg: 'linear-gradient(135deg, var(--power-orange), var(--power-orange))', border: 'var(--power-orange)', color: '#fff' },
                        Visitante: { bg: 'linear-gradient(135deg, #059669, #10b981)', border: '#059669', color: '#fff' },
                        Arquivado: { bg: 'linear-gradient(135deg, var(--power-muted), #94a3b8)', border: 'var(--power-muted)', color: '#fff' },
                      };
                      const isActive = !showTrash && categoryTab === tab;
                      return (
                        <button key={tab} type="button" onClick={() => { setCategoryTab(tab); setShowTrash(false); }} className="px-5 py-2 rounded-full font-bold text-sm inline-flex items-center gap-2 transition-all" style={{ border: `2px solid ${isActive ? colors[tab].border : 'var(--border-color)'}`, background: isActive ? colors[tab].bg : 'var(--glass-bg)', color: isActive ? '#fff' : 'var(--color-text-secondary)', boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.15)' : 'none' }}>
                          {tab === 'Ativo' ? '✅' : tab === 'Visitante' ? '👤' : '📦'} {tab}
                          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold" style={{ background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)' }}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                    {canViewDeletedRecords && (
                      <button type="button" onClick={toggleDeletedRecords} className="px-5 py-2 rounded-full font-bold text-sm inline-flex items-center gap-2 transition-all" style={{ border: `2px solid ${showTrash ? '#ef4444' : 'var(--border-color)'}`, background: showTrash ? '#ef4444' : 'var(--glass-bg)', color: showTrash ? '#fff' : 'var(--color-text-secondary)', boxShadow: showTrash ? '0 4px 12px rgba(239, 68, 68, 0.25)' : 'none' }}>
                        <Trash2 size={15} aria-hidden="true" /> Excluídos / Lixeira
                        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold" style={{ background: showTrash ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)' }}>{deletedCount}</span>
                      </button>
                    )}
                </div>
        {/* Perfil: Membros vs Outros Perfis */}
        {(['membros', 'outros'] as const).map((profile) => {
          const isActive = profileTab === profile;
          const profileColors: Record<string, { bg: string; border: string; color: string }> = {
            membros: { bg: 'linear-gradient(135deg, var(--power-orange), #ff9a5f)', border: 'var(--power-orange)', color: '#fff' },
            outros: { bg: 'linear-gradient(135deg, #d97706, #f59e0b)', border: '#d97706', color: '#fff' },
          };
          return (
            <button
              key={profile}
              type="button"
              onClick={() => setProfileTab(isActive ? 'todos' : profile)}
              style={{
                padding: '0.55rem 1.15rem',
                borderRadius: '50px',
                border: `2px solid ${isActive ? profileColors[profile].border : 'var(--border-color)'}`,
                background: isActive ? profileColors[profile].bg : 'var(--glass-bg)',
                color: isActive ? '#fff' : 'var(--color-text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              {profile === 'membros' ? '👥 Membros' : '⭐ Outros Perfis'}
            </button>
          );
        })}
      </div>

      {/* Filtros e Pesquisa */}
      <div className="flex flex-col gap-4">
                    <div className="relative">
                      <input type="text" className="form-control w-full" placeholder="Buscar por nome ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      <Search className="search-icon-inside" size={18} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* WhatsApp Contacts Copy Button */}
                      <button type="button" className="btn btn-secondary btn-sm inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(15, 23, 42, 0.6)' }} onClick={handleCopyContacts}>
                        <FileSpreadsheet size={15} style={{ color: 'var(--power-orange)' }} /> Copiar Contatos (WhatsApp)
                      </button>
                      {/* Missing Contact Toggle Button */}
                      <button type="button" className={`btn ${missingContactFilter ? 'btn-danger' : 'btn-secondary'} btn-sm inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg`} onClick={() => setMissingContactFilter(!missingContactFilter)} style={{ borderColor: missingContactFilter ? '#ef4444' : undefined, background: missingContactFilter ? '#ef4444' : undefined, color: missingContactFilter ? '#fff' : undefined }}>
                        <AlertTriangle size={15} style={{ color: missingContactFilter ? '#fff' : '#ea580c' }} /> {missingContactFilter ? 'Sem Contato Ativo' : 'Ver Faltando Contato/Endereço'}
                      </button>
                      {/* Cargo Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted font-semibold">Função:</span>
                        <select className="form-control" style={{ padding: '0.5rem 1rem', width: 'auto', fontSize: '0.85rem' }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                          <option value="Todos">Todas funções</option>
                          <option value="Membro">Membro</option>
                          <option value="Líder">Líder</option>
                          <option value="Multiplicador">Multiplicador</option>
                          <option value="Secretaria Geral">Secretaria Geral</option>
                          <option value="Pastor">Pastor</option>
                          <option value="Pastor Admin">Pastor Admin</option>
                        </select>
                      </div>
                      {/* Baptism Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted font-semibold">Batismo:</span>
                        <select className="form-control" style={{ padding: '0.5rem 1rem', width: 'auto', fontSize: '0.85rem' }} value={baptismFilter} onChange={(e) => setBaptismFilter(e.target.value)}>
                          <option value="Todos">Todos (Batismo)</option>
                          <option value="baptized">Batizados nas Águas 🌊</option>
                          <option value="intention">Com Intenção 🕊️</option>
                          <option value="unable">Impossibilitados 🚫</option>
                          <option value="not_baptized">Não Batizados ⚠️</option>
                          <option value="uninformed">Não Informado ❓</option>
                        </select>
                      </div>
                      {/* Department Filter */}
                      {(canUserSelectDepartment(session, db) || !isRestrictedDept) && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted font-semibold">Departamento:</span>
                          <select className="form-control" style={{ padding: '0.5rem 1.75rem 0.5rem 1rem', width: 'auto', fontSize: '0.85rem', fontWeight: 700, borderColor: getDepartmentTheme(deptFilter).primary, color: getDepartmentTheme(deptFilter).badgeText, background: getDepartmentTheme(deptFilter).bgLight }} value={deptFilter} onChange={(e) => { const val = e.target.value; setDeptFilter(val); if (onChangeDepartment) { onChangeDepartment(val === 'Todos' ? undefined : val); } }}>
                            {!isRestrictedDept && <option value="Todos">Todos depts</option>}
                            {getUserAllowedDepartments(session, db).map(dName => (
                              <option key={dName} value={dName}>{dName}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
      </div>

      {/* Cards Grid */}
      <div className="people-grid">
        {filteredPeople.map(p => {
          const isExpanded = expandedPersonId === p.id;
          const cleanPhone = p.phone ? p.phone.replace(/\D/g, '') : '';
          const absences = absencesMap.get(p.id) || 0;
            
          let badgeColor = '#10b981';
          let badgeBg = 'rgba(16, 185, 129, 0.08)';
          let badgeText = 'Frequente';
          if (absences === 1) {
            badgeColor = '#d97706';
            badgeBg = 'rgba(245, 158, 11, 0.08)';
            badgeText = 'Atenção (1 Falta)';
          } else if (absences === 2) {
            badgeColor = '#ea580c';
            badgeBg = 'rgba(234, 88, 12, 0.08)';
            badgeText = 'Importante (2 Faltas)';
          } else if (absences >= 3) {
            badgeColor = '#ef4444';
            badgeBg = 'rgba(239, 68, 68, 0.08)';
            badgeText = `Crítico (${absences} Faltas)`;
          }

          return (
            <div 
              key={p.id} 
              className="people-card" 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                padding: 0, 
                gap: 0, 
                overflow: 'hidden', 
                alignItems: 'stretch',
                borderColor: isExpanded ? 'var(--color-primary)' : 'var(--border-color)',
                boxShadow: isExpanded ? 'var(--shadow-card-hover)' : 'var(--shadow-card)'
              }}
            >
              {/* Collapsed / Header Row */}
              <div 
                className="people-card-summary"
                onClick={() => setExpandedPersonId(prev => prev === p.id ? null : p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1.25rem',
                  cursor: 'pointer',
                  width: '100%',
                  gap: '0.5rem',
                  userSelect: 'none',
                  background: isExpanded ? 'rgba(59, 130, 246, 0.02)' : 'transparent',
                  transition: 'background 0.2s',
                  flexWrap: 'wrap'
                }}
              >
                <div className="people-card-primary" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  {/* Avatar Circle */}
                  <div className="avatar-circle" style={{ background: getAvatarBg(p.role), width: '36px', height: '36px', minWidth: '36px', fontSize: '0.9rem' }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                    
                  {/* Name and Role Badges */}
                  <div className="people-card-identity-copy" style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div className="people-name-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'nowrap' }}>
                      <h4 className="people-name" style={{ 
                        fontSize: '0.95rem', 
                        color: 'var(--color-text-main)', 
                        fontWeight: 800, 
                        textTransform: 'uppercase',
                        margin: 0, 
                        display: '-webkit-box', 
                        WebkitLineClamp: 1, 
                        WebkitBoxOrient: 'vertical', 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {p.name}
                      </h4>
                      {p.role !== 'Membro' && (
                        <span className="badge" style={{ 
                          fontSize: '0.55rem', 
                          padding: '0.1rem 0.35rem', 
                          background: 'rgba(124, 58, 237, 0.08)',
                          color: 'var(--power-orange)',
                          border: '1px solid rgba(124, 58, 237, 0.15)',
                          margin: 0,
                          flexShrink: 0
                        }}>
                          {p.role}
                        </span>
                      )}
                      {p.gender === 'U' && (
                        <span title="Falta definir o sexo" style={{ display: 'inline-flex', alignItems: 'flex-start', color: '#ef4444', fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #fee2e2' }}>
                          ⚠️ Indefinido
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.2rem', alignItems: 'flex-start' }}>
                      {/* Primary Department Badge */}
                      <span className="badge" style={{
                        fontSize: '0.55rem',
                        padding: '0.1rem 0.35rem',
                        background: getDepartmentTheme(p.department).bgLight,
                        color: getDepartmentTheme(p.department).badgeText,
                        border: `1px solid ${getDepartmentTheme(p.department).primary}`,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {p.role !== 'Membro' ? `${p.role}: ` : ''}{p.department}
                      </span>

                      {/* Extra Department Badges */}
                      {p.departments && p.departments.length > 1 && p.departments.slice(1).map((d, i) => {
                        const dTheme = getDepartmentTheme(d.department);
                        return (
                          <span key={i} className="badge" style={{
                            fontSize: '0.55rem',
                            padding: '0.1rem 0.35rem',
                            background: dTheme.bgLight,
                            color: dTheme.badgeText,
                            border: `1px solid ${dTheme.primary}`,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {d.role !== 'Membro' ? `${d.role}: ` : ''}{d.department}
                          </span>
                        );
                      })}
                    </div>
                    {/* Observations preview — visible without expanding */}
                    {p.observations && p.department !== 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE' && (
                      <div className="person-obs-preview" style={{
                        fontSize: '0.72rem',
                        color: 'var(--power-muted)',
                        marginTop: '0.35rem',
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        wordBreak: 'break-word',
                        textAlign: 'left'
                      }}>
                        {p.observations}
                      </div>
                    )}
                    {/* REDENÇÃO: mostra idade ao invés de observações no preview */}
                    {p.department === 'REDENÇÃO DA CRIANÇA E DO ADOLESCENTE' && p.birthDate && (
                      <div className="person-obs-preview" style={{
                        fontSize: '0.72rem',
                        color: 'var(--power-muted)',
                        marginTop: '0.35rem',
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        wordBreak: 'break-word',
                        textAlign: 'left'
                      }}>
                        {(() => {
                          const today = new Date();
                          const parts = String(p.birthDate).split('-').map(Number);
                          const birth = new Date(parts[0] || today.getFullYear(), (parts[1] || 1) - 1, parts[2] || 1);
                          let age = today.getFullYear() - birth.getFullYear();
                          const m = today.getMonth() - birth.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                          return `${age} anos`;
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Right side: Status Badge + WhatsApp + Chevron */}
                  <div className="people-card-actions" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap', maxWidth: '100%', marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>
                    {/* Classification Status Badge */}
                    {session.role !== 'Multiplicador' && (
                      <span className="badge people-status-badge" style={{
                        fontSize: '0.68rem',
                        padding: '0.15rem 0.45rem',
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeColor}25`,
                        fontWeight: 700,
                        margin: 0,
                        whiteSpace: 'nowrap',
                        display: 'inline-block'
                      }}>
                        {badgeText}
                      </span>
                    )}

                    {showTrash ? (
                      <button
                        className="people-contact-button people-restore-button"
                        onClick={() => handleRestore(p.id)}
                        title="Restaurar Membro"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'var(--power-orange)',
                          color: 'white',
                          boxShadow: '0 2px 6px rgba(139, 92, 246, 0.25)',
                          transition: 'transform 0.2s',
                          cursor: 'pointer',
                          border: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10"></polyline>
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                        </svg>
                      </button>
                    ) : cleanPhone ? (
                      <a
                        className="people-contact-button people-whatsapp-button"
                        href={`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`A paz do Senhor, ${p.name}! Como está? Tudo bem?`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar mensagem WhatsApp"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: '#25d366',
                          color: 'white',
                          boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
                          transition: 'transform 0.2s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <MessageCircle size={18} aria-hidden="true" />
                      </a>
                    ) : null}

                    {/* Expand Chevron Icon */}
                    <div 
                      className="people-card-chevron"
                      style={{ color: 'var(--power-muted)', display: 'flex', alignItems: 'flex-start', cursor: 'pointer', padding: '0.2rem' }}
                      onClick={() => setExpandedPersonId(prev => prev === p.id ? null : p.id)}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>
              </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div style={{
                    padding: '1.25rem',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--power-raised)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    width: '100%'
                  }}>
                    <div className="people-card-info" style={{ gap: '1.25rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        <span className="badge" style={{ 
                          fontSize: '0.65rem', 
                          padding: '0.15rem 0.45rem', 
                          background: p.role === 'Membro' ? 'var(--bg-input)' : 'rgba(124, 58, 237, 0.08)',
                          color: p.role === 'Membro' ? 'var(--power-muted)' : 'var(--power-orange)',
                          border: p.role === 'Membro' ? '1px solid var(--power-muted)' : '1px solid rgba(124, 58, 237, 0.15)',
                          margin: 0
                        }}>
                          Função: {p.role}
                        </span>
                        {p.baptized === true ? (
                          <span className="badge" style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.45rem',
                            background: 'rgba(59, 130, 246, 0.08)',
                            color: 'var(--power-orange)',
                            border: '1px solid rgba(59, 130, 246, 0.15)',
                            margin: 0
                          }}>
                            🌊 Batizado(a)
                          </span>
                        ) : p.baptized === false ? (
                          (p.baptismIntention === 1 || p.baptismIntention === true) ? (
                            <span className="badge" style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.45rem',
                              background: 'rgba(139, 92, 246, 0.08)',
                              color: 'var(--power-orange)',
                              border: '1px solid rgba(139, 92, 246, 0.15)',
                              margin: 0
                            }}>
                              🕊️ Com Intenção
                            </span>
                          ) : p.baptismIntention === 2 ? (
                            <span className="badge" style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.45rem',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#dc2626',
                              border: '1px solid rgba(239, 68, 68, 0.15)',
                              margin: 0
                            }}>
                              🚫 Impossibilitado(a)
                            </span>
                          ) : (
                            <span className="badge" style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.45rem',
                              background: 'rgba(245, 158, 11, 0.08)',
                              color: '#d97706',
                              border: '1px solid rgba(245, 158, 11, 0.15)',
                              margin: 0
                            }}>
                              ⚠️ Não Batizado
                            </span>
                          )
                        ) : (
                          <span className="badge" style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.45rem',
                            background: 'rgba(15, 23, 42, 0.5)',
                            color: 'var(--power-muted)',
                            border: '1px solid var(--power-line)',
                            margin: 0
                          }}>
                            ❓ Batismo Não Informado
                          </span>
                        )}
                        <span className="badge" style={{
                          fontSize: '0.65rem',
                          padding: '0.15rem 0.45rem',
                          background: 'rgba(15, 23, 42, 0.5)',
                          color: 'var(--power-muted)',
                          border: '1px solid var(--power-line)',
                          margin: 0
                        }}>
                          Sexo: {p.gender === 'M' ? 'Masculino' : p.gender === 'F' ? 'Feminino' : 'Indefinido'}
                        </span>
                      </div>
                    </div>

                    <div className="people-card-details" style={{ flexWrap: 'wrap', gap: '1rem 2rem' }}>
                      {/* Department display */}
                      <div className="people-card-detail-item">
                        <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>Dept:</span>
                        {activeChangeDeptId === p.id ? (
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <select
                              value={p.department}
                              onChange={(e) => {
                                const newDept = e.target.value;
                                if (newDept && newDept !== p.department) {
                                  const updated = db.people.map(person => 
                                    person.id === p.id ? transferPerson(person, newDept) : person
                                  );
                                  onUpdatePeople(updated);
                                  alert(`Departamento de ${p.name} alterado para ${newDept}`);
                                }
                                setActiveChangeDeptId(null);
                              }}
                              className="form-control"
                              style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', width: 'auto', height: 'auto', maxWidth: '100%' }}
                            >
                              {departments.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                              ))}
                            </select>
                            <button 
                              type="button" 
                              className="btn btn-secondary btn-small" 
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', margin: 0, flexShrink: 0 }}
                              onClick={() => setActiveChangeDeptId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <span>{p.department}</span>
                        )}
                      </div>
                      {/* Phone display */}
                      <div className="people-card-detail-item">
                        <Phone size={13} style={{ color: p.phone && p.phone !== '999999999' && p.phone !== '69999999999' ? 'var(--power-orange)' : '#ef4444' }} />
                        {p.phone && p.phone !== '999999999' && p.phone !== '69999999999' ? (
                          <a href={`tel:${p.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {p.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                          </a>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>Falta Telefone (Atualizar!)</span>
                        )}
                      </div>
                      {p.birthDate && (
                        <div className="people-card-detail-item">
                          <span style={{ fontWeight: 600 }}>Nascimento:</span>
                          <span>{p.birthDate.split('-').reverse().join('/')}</span>
                        </div>
                      )}
                    </div>

                    {p.address && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--power-muted)' }}>
                        <strong>Endereço:</strong> {p.address}
                      </div>
                    )}
                    {p.observations && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--power-muted)', background: 'rgba(15, 23, 42, 0.5)', padding: '0.5rem 0.75rem', borderRadius: '8px', borderLeft: '3px solid var(--power-muted)' }}>
                        <strong>Observações:</strong> {p.observations}
                      </div>
                    )}

                    <div className="card-actions-wrapper flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--power-line)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      {showTrash && canViewDeletedRecords && (
                        <button className="btn btn-primary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem' }} onClick={() => handleRestore(p.id)}>
                          Restaurar cadastro
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem', borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'rgba(59, 130, 246, 0.03)', fontWeight: 700 }} onClick={() => openDetailsModal(p)}>
                        <Search size={12} /> Ver Perfil
                      </button>
                      {/* Botão de Enviar Credenciais por WhatsApp */}
                      {((p.role === 'Multiplicador' && ['Líder', 'Pastor', 'Secretaria Geral', 'Pastor Admin'].includes(session.role)) || (p.role === 'Líder' && ['Pastor', 'Secretaria Geral', 'Pastor Admin'].includes(session.role)) || (p.role === 'Secretaria Geral' && ['Pastor', 'Pastor Admin'].includes(session.role)) || (p.role === 'Pastor' && ['Pastor', 'Pastor Admin'].includes(session.role))) && p.username && (
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem', borderColor: '#10b981', color: '#10b981', background: 'rgba(16, 185, 129, 0.05)', fontWeight: 700 }} onClick={() => { const password = p.passwordChanged ? '(senha pessoal já definida)' : 'mudar123'; const message = `Olá, *${p.name}*!\n\nSeja bem-vindo ao *Multiplica PLUS*!\n\n🌐 *Acesse o app:* https://multiplica-plus-ieadjota.vercel.app\n👤 *Usuário:* \`${p.username}\`\n🔑 *Senha Temporária:* \`${password}\`\n\n_Obs: No primeiro acesso, altere para sua senha pessoal._\n\nDeus abençoe! 🙏✨`; const encoded = encodeURIComponent(message); window.open(`https://api.whatsapp.com/send?phone=55${p.phone}&text=${encoded}`, '_blank'); }}>
                        <Phone size={12} /> Enviar Credenciais
                      </button>
                    )}
                    {canChangeDepartment(p) && activeChangeDeptId !== p.id && (
                      <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem' }} onClick={() => setActiveChangeDeptId(p.id)}>
                        <Network size={12} /> Trocar Depto
                      </button>
                    )}
                    {canEditPerson(p) && (
                      <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem' }} onClick={() => openEditModal(p)}>
                        <Edit3 size={12} /> Editar
                      </button>
                    )}
                    {/* Quick status shortcuts */}
                    {canEditPerson(p) && p.status === 'Ativo' && (
                      <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem', color: 'var(--power-muted)', fontSize: '0.75rem' }} onClick={() => handleChangeStatus(p.id, 'Arquivado')} title="Arquivar este membro (retira das chamadas)">
                        📦 Arquivar
                      </button>
                    )}
                    {canEditPerson(p) && p.status === 'Visitante' && (
                      <>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem', color: '#059669', fontSize: '0.75rem' }} onClick={() => handleChangeStatus(p.id, 'Ativo')} title="Tornar membro ativo">
                            ✅ Tornar Membro
                        </button>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem', color: 'var(--power-muted)', fontSize: '0.75rem' }} onClick={() => handleChangeStatus(p.id, 'Arquivado')} title="Arquivar visitante">
                            📦 Arquivar
                        </button>
                      </>
                    )}
                    {canEditPerson(p) && p.status === 'Arquivado' && (
                      <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem', color: 'var(--power-orange)', fontSize: '0.75rem' }} onClick={() => handleChangeStatus(p.id, 'Ativo')} title="Reativar membro">
                        📤 Reativar
                      </button>
                    )}
                    {isAuthorizedToDelete && !showTrash && (
                      <button className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem', color: '#ef4444' }} onClick={() => handleDelete(p.id)}>
                        <Trash2 size={12} /> Excluir
                      </button>
                    )}
                  </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredPeople.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 0', color: 'var(--power-muted)' }}>
              <User size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>Nenhuma pessoa encontrada com os filtros atuais.</p>
            </div>
          )}
        </div>

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingPerson ? 'Editar Pessoa' : 'Adicionar Nova Pessoa'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="reg-name">Nome Completo</label>
                <input
                  id="reg-name"
                  type="text"
                  className="form-control"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-phone">Telefone (Opcional)</label>
                <input
                  id="reg-phone"
                  type="tel"
                  className="form-control"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Ex: 69992345678"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-dept">Departamento</label>
                {isRestrictedDept ? (
                  <input
                    type="text"
                    className="form-control"
                    value={session.department || ''}
                    disabled
                    style={{ background: 'rgba(15, 23, 42, 0.5)', color: 'var(--power-muted)' }}
                  />
                ) : (
                  <select
                    id="reg-dept"
                    className="form-control"
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="reg-role">Função / Cargo</label>
                <select
                  id="reg-role"
                  className="form-control"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                >
                  {session.role === 'Multiplicador' ? (
                    <option value="Membro">Membro</option>
                  ) : (
                    <>
                      <option value="Membro">Membro</option>
                      {(session.role === 'Líder' || session.role === 'Secretaria Geral' || session.role === 'Pastor' || session.role === 'Pastor Admin') && (
                        <option value="Multiplicador">Multiplicador</option>
                      )}
                      {(session.role === 'Secretaria Geral' || session.role === 'Pastor' || session.role === 'Pastor Admin') && (
                        <option value="Líder">Líder</option>
                      )}
                      {(session.role === 'Pastor' || session.role === 'Pastor Admin') && (
                        <>
                          <option value="Secretaria Geral">Secretaria Geral</option>
                          <option value="Pastor">Pastor</option>
                        </>
                      )}
                      {session.role === 'Pastor Admin' && (
                        <option value="Pastor Admin">Pastor Admin</option>
                      )}
                    </>
                  )}
                </select>
              </div>

              {/* Extra Departments (multi-department support) */}
              {!isRestrictedDept && (
                <div className="form-group">
                  <label>
                    Departamentos Adicionais
                    <button
                      type="button"
                      onClick={() => setFormExtraDepts([...formExtraDepts, { department: departments[0]?.name || '', role: 'Membro' }])}
                      style={{
                        marginLeft: '0.5rem',
                        background: 'none',
                        border: '1px dashed var(--power-orange)',
                        color: 'var(--power-orange)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center'
                      }}
                      title="Adicionar departamento"
                    >+</button>
                  </label>
                  {formExtraDepts.map((extra, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'flex-start' }}>
                      <select
                        className="form-control"
                        value={extra.department}
                        onChange={(e) => {
                          const updated = [...formExtraDepts];
                          updated[idx] = { ...updated[idx], department: e.target.value };
                          setFormExtraDepts(updated);
                        }}
                        style={{ flex: 1, padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                      >
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                      <select
                        className="form-control"
                        value={extra.role}
                        onChange={(e) => {
                          const updated = [...formExtraDepts];
                          updated[idx] = { ...updated[idx], role: e.target.value as 'Pastor Admin' | 'Pastor' | 'Secretaria Geral' | 'Líder' | 'Multiplicador' | 'Membro' };
                          setFormExtraDepts(updated);
                        }}
                        style={{ flex: 1, padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                      >
                        <option value="Membro">Membro</option>
                        <option value="Multiplicador">Multiplicador</option>
                        <option value="Líder">Líder</option>
                        <option value="Secretaria Geral">Secretaria Geral</option>
                        <option value="Pastor">Pastor</option>
                        <option value="Pastor Admin">Pastor Admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setFormExtraDepts(formExtraDepts.filter((_, i) => i !== idx))}
                        style={{
                          background: 'none',
                          border: '1px solid #ef4444',
                          color: '#ef4444',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center'
                        }}
                        title="Remover departamento"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>Sexo <span style={{color:'red'}}>*</span></label>
                <select
                  required
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value as any)}
                >
                  <option value="U">Selecione...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
                {formGender === 'U' && <span style={{color:'#ef4444', fontSize:'0.75rem', marginTop:'0.25rem', display:'block'}}>Por favor, defina Masculino ou Feminino para ativar as missões.</span>}
              </div>

              {/* Mother select for Infantil and Redenção departments */}
              {(formDept.toLowerCase().includes('infantil') || formDept.toLowerCase().includes('criança') || formDept.toLowerCase().includes('crianca') || formDept.toLowerCase().includes('redenção') || formDept.toLowerCase().includes('redencao')) && (
                <div className="form-group">
                  <label htmlFor="reg-mother">👩 Nome da Mãe</label>
                  <input
                    id="reg-mother"
                    type="text"
                    className="form-control"
                    value={formMotherName}
                    onChange={(e) => setFormMotherName(e.target.value)}
                    placeholder="Ex: Maria"
                  />
                  <span style={{ color: 'var(--power-muted)', fontSize: '0.72rem', marginTop: '0.25rem', display: 'block' }}>
                    Nome da mãe da criança (preenchido automaticamente a partir das observações).
                  </span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="reg-date">Data de Início</label>
                <input
                  id="reg-date"
                  type="date"
                  className="form-control"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-birthdate">Data de Nascimento</label>
                <input
                  id="reg-birthdate"
                  type="date"
                  className="form-control"
                  value={formBirthDate}
                  onChange={(e) => setFormBirthDate(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '2rem', margin: '1rem 0', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', marginBottom: '0.5rem' }}>
                  <label htmlFor="form-baptism-status" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--power-muted)' }}>Status de Batismo</label>
                  <select
                    id="form-baptism-status"
                    className="form-control"
                    value={formBaptized === true ? 'baptized' : (formBaptized === false ? (formBaptismIntention === 1 ? 'intention' : (formBaptismIntention === 2 ? 'unable' : 'not_baptized')) : 'uninformed')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'baptized') {
                        setFormBaptized(true);
                        setFormBaptismIntention(0);
                      } else if (val === 'intention') {
                        setFormBaptized(false);
                        setFormBaptismIntention(1);
                      } else if (val === 'unable') {
                        setFormBaptized(false);
                        setFormBaptismIntention(2);
                      } else if (val === 'not_baptized') {
                        setFormBaptized(false);
                        setFormBaptismIntention(0);
                      } else {
                        setFormBaptized(null);
                        setFormBaptismIntention(0);
                      }
                    }}
                  >
                    <option value="uninformed">❓ Não Informado</option>
                    <option value="baptized">🌊 Batizado(a) nas Águas</option>
                    <option value="intention">🕊️ Com Intenção (Manifestou Interesse)</option>
                    <option value="unable">🚫 Impossibilitado(a)</option>
                    <option value="not_baptized">⚠️ Não Batizado</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-address">Endereço (Opcional)</label>
                <input
                  id="reg-address"
                  type="text"
                  className="form-control"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Ex: Rua das Flores, 123 - Bairro"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-observations">Observações / Detalhes (Opcional)</label>
                <textarea
                  id="reg-observations"
                  className="form-control"
                  value={formObservations}
                  onChange={(e) => setFormObservations(e.target.value)}
                  placeholder="Informações adicionais sobre o participante..."
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-category">Categoria de Participação</label>
                <select
                  id="reg-category"
                  className="form-control"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                >
                  <option value="Ativo">✅ Membro Ativo</option>
                  <option value="Visitante">👤 Visitante</option>
                  <option value="Arquivado">📦 Arquivado</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPerson ? 'Salvar Alterações' : 'Cadastrar Membro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import CSV */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Importar Planilha de Membros (CSV)</h3>
              <button className="modal-close" onClick={() => {
                setIsImportModalOpen(false);
                setImportPreview([]);
                setImportError('');
                setImportSuccess('');
                setCsvText('');
              }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
              <div className="alert alert-info" style={{ background: 'rgba(255, 97, 1, 0.10)', border: '1px solid rgba(255, 97, 1, 0.28)', color: '#ff9a5f', padding: '0.75rem', borderRadius: '8px' }}>
                <p><strong>Dica Importante:</strong> A planilha deve possuir os seguintes cabeçalhos de coluna:</p>
                <code style={{ background: '#e0f2fe', padding: '0.2rem 0.4rem', borderRadius: '4px', display: 'block', marginTop: '0.35rem', fontFamily: 'monospace' }}>
                  Nome, Telefone, Departamento, Funcao, Nascimento, Inicio
                </code>
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>Exemplo de Funções válidas: Membro, Líder, Multiplicador. Líderes e Multiplicadores receberão automaticamente o acesso com senha padrão <strong>mudar123</strong>.</p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-start' }}>
                <button type="button" className="btn btn-secondary btn-small" onClick={downloadCSVTemplate}>
                  Baixar Planilha Modelo (CSV)
                </button>
                <label className="btn btn-primary btn-small" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'flex-start', width: 'auto' }}>
                  Selecionar Arquivo .CSV
                  <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
                </label>
              </div>

              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label>Ou Cole o Conteúdo do CSV Abaixo:</label>
                <textarea
                  className="form-control"
                  rows={6}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  placeholder="Nome,Telefone,Departamento,Funcao,Nascimento,Inicio&#10;Jose da Silva,69992001122,Novo Alvorecer (Jovens),Membro,2001-05-15,2026-06-18"
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    processCSV(e.target.value);
                  }}
                />
              </div>

              {importError && (
                <div style={{ color: '#ef4444', fontWeight: 600 }}>{importError}</div>
              )}
              {importSuccess && (
                <div style={{ color: '#10b981', fontWeight: 600 }}>{importSuccess}</div>
              )}

              {importPreview.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>Visualização da Importação ({importPreview.length} linhas detectadas)</h4>
                  <div style={{ maxHeight: '180px', overflow: 'auto', border: '1px solid var(--power-line)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--power-raised)', borderBottom: '1px solid var(--power-line)' }}>
                          <th style={{ padding: '0.5rem' }}>Nome</th>
                          <th style={{ padding: '0.5rem' }}>Telefone</th>
                          <th style={{ padding: '0.5rem' }}>Função</th>
                          <th style={{ padding: '0.5rem' }}>Dept</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((p, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <td style={{ padding: '0.5rem' }}>{p.name}</td>
                            <td style={{ padding: '0.5rem' }}>{p.phone}</td>
                            <td style={{ padding: '0.5rem' }}>{p.role}</td>
                            <td style={{ padding: '0.5rem' }}>{p.department}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => {
                      setImportPreview([]);
                      setCsvText('');
                    }}>Limpar</button>
                    <button type="button" className="btn btn-primary" onClick={confirmImport}>Confirmar Importação</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Census Simulator */}
      {isCensusSimulatorOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%' }}>
            <div className="modal-header">
              <h3>Simulador de Censo Google Sheets (Local-only)</h3>
              <button className="modal-close" onClick={() => setIsCensusSimulatorOpen(false)}>&times;</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginBottom: '1rem' }}>
              Aqui você pode simular os 235 nomes coletados no censo. Edite as recomendações de departamentos de forma local e decida quando mesclar de forma definitiva no banco de dados.
            </p>

            {/* Statistics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {(() => {
                const statsMap: { [key: string]: number } = {};
                departments.forEach(d => { statsMap[d.name] = 0; });
                simulatedPeople.forEach(p => {
                  statsMap[p.draftDepartment] = (statsMap[p.draftDepartment] || 0) + 1;
                });
                return departments.map(d => (
                  <div key={d.id} style={{ background: 'var(--power-raised)', padding: '0.6rem 0.4rem', borderRadius: '10px', border: '1px solid var(--power-line)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--power-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.name}>
                      {d.name.split(' ')[0]}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {statsMap[d.name] || 0}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div className="search-input-wrapper" style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar na simulação..."
                  value={simulatorSearch}
                  onChange={(e) => setSimulatorSearch(e.target.value)}
                  style={{ padding: '0.5rem 1rem 0.5rem 2.25rem', fontSize: '0.85rem' }}
                />
                <Search className="search-icon-inside" size={15} style={{ left: '0.75rem' }} />
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  const header = `Nome | Departamento Recomendado | WhatsApp\n`;
                  const body = simulatedPeople.map(p => {
                    const cleanPhone = p.phone.replace(/\D/g, '');
                    const link = cleanPhone ? `wa.me/55${cleanPhone}` : 'Sem telefone';
                    return `${p.name} | ${p.draftDepartment} | ${link}`;
                  }).join('\n');
                  navigator.clipboard.writeText(header + body)
                    .then(() => alert("Relatório de simulação copiado com sucesso!"))
                    .catch(() => alert("Erro ao copiar."));
                }}
                style={{ fontSize: '0.8rem', background: 'rgba(15, 23, 42, 0.6)' }}
              >
                Copiar Relatório Simulação
              </button>

              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={handleMergeCensus}
                style={{ fontSize: '0.8rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}
              >
                Mesclar no Banco de Dados
              </button>
            </div>

            {/* Simulated List */}
            <div style={{ maxHeight: '350px', overflow: 'auto', border: '1px solid var(--power-line)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--power-raised)', borderBottom: '1px solid var(--power-line)', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Nome</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Telefone</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Obs / Endereço</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Recomendação Depto</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {simulatedPeople
                    .filter(p => p.name.toLowerCase().includes(simulatorSearch.toLowerCase()))
                    .map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {item.phone ? item.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : <span style={{ color: '#ef4444' }}>Sem telefone</span>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', maxWidth: '100%', whiteSpace: 'normal', overflow: 'visible', wordBreak: 'break-word' }} title={`${item.address} | ${item.observations}`}>
                          {item.address && <span>📍 {item.address} | </span>}
                          {item.observations}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <select
                            value={item.draftDepartment}
                            onChange={(e) => {
                              const newDept = e.target.value;
                              setSimulatedPeople(prev => prev.map(p => p.id === item.id ? { ...p, draftDepartment: newDept } : p));
                            }}
                            className="form-control"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', width: 'auto', height: 'auto', border: '1px solid var(--power-muted)' }}
                          >
                            {departments.map(d => (
                              <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => handleImportSingleSimulated(item)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                          >
                            Importar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Relatório de Batismo */}
      {isBaptismModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span>🌊</span> Relatório de Batismo
              </h3>
              <button className="modal-close" onClick={() => setIsBaptismModalOpen(false)}>&times;</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--power-muted)', marginBottom: '1.25rem' }}>
              Consulte e exporte os membros de acordo com a classificação de batismo no escopo de filtros selecionado.
            </p>

            {/* Abas e Estatísticas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                style={{
                  background: baptismReportTab === 'baptized' ? 'rgba(255, 97, 1, 0.10)' : 'var(--power-muted)',
                  border: baptismReportTab === 'baptized' ? '2px solid var(--power-orange)' : '1px solid var(--power-line)',
                  color: baptismReportTab === 'baptized' ? '#d94f00' : 'var(--power-muted)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.25rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: 700,
                  transition: 'all 0.2s'
                }}
                onClick={() => setBaptismReportTab('baptized')}
              >
                <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>🌊</div>
                <div style={{ fontSize: '0.7rem' }}>Batizados ({filteredPeople.filter(p => p.baptized === true).length})</div>
              </button>

              <button
                type="button"
                style={{
                  background: baptismReportTab === 'intention' ? 'rgba(124, 58, 237, 0.08)' : 'var(--power-muted)',
                  border: baptismReportTab === 'intention' ? '2px solid var(--power-orange)' : '1px solid var(--power-line)',
                  color: baptismReportTab === 'intention' ? '#d94f00' : 'var(--power-muted)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.25rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: 700,
                  transition: 'all 0.2s'
                }}
                onClick={() => setBaptismReportTab('intention')}
              >
                <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>🕊️</div>
                <div style={{ fontSize: '0.7rem' }}>Intenção ({filteredPeople.filter(p => p.baptized === false && (p.baptismIntention === 1 || p.baptismIntention === true)).length})</div>
              </button>

              <button
                type="button"
                style={{
                  background: baptismReportTab === 'unable' ? 'rgba(239, 68, 68, 0.08)' : 'var(--power-muted)',
                  border: baptismReportTab === 'unable' ? '2px solid #dc2626' : '1px solid var(--power-line)',
                  color: baptismReportTab === 'unable' ? '#b91c1c' : 'var(--power-muted)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.25rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: 700,
                  transition: 'all 0.2s'
                }}
                onClick={() => setBaptismReportTab('unable')}
              >
                <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>🚫</div>
                <div style={{ fontSize: '0.7rem' }}>Impossib. ({filteredPeople.filter(p => p.baptized === false && p.baptismIntention === 2).length})</div>
              </button>

              <button
                type="button"
                style={{
                  background: baptismReportTab === 'not_baptized' ? 'rgba(245, 158, 11, 0.08)' : 'var(--power-muted)',
                  border: baptismReportTab === 'not_baptized' ? '2px solid #d97706' : '1px solid var(--power-line)',
                  color: baptismReportTab === 'not_baptized' ? '#b45309' : 'var(--power-muted)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.25rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: 700,
                  transition: 'all 0.2s'
                }}
                onClick={() => setBaptismReportTab('not_baptized')}
              >
                <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>⚠️</div>
                <div style={{ fontSize: '0.7rem' }}>Não Batizados ({filteredPeople.filter(p => p.baptized === false && (p.baptismIntention === 0 || p.baptismIntention === false || !p.baptismIntention)).length})</div>
              </button>

              <button
                type="button"
                style={{
                  background: baptismReportTab === 'uninformed' ? 'rgba(100, 116, 139, 0.08)' : 'var(--power-muted)',
                  border: baptismReportTab === 'uninformed' ? '2px solid var(--power-muted)' : '1px solid var(--power-line)',
                  color: baptismReportTab === 'uninformed' ? 'var(--power-muted)' : 'var(--power-muted)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.25rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: 700,
                  transition: 'all 0.2s'
                }}
                onClick={() => setBaptismReportTab('uninformed')}
              >
                <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>❓</div>
                <div style={{ fontSize: '0.7rem' }}>Não Informado ({filteredPeople.filter(p => p.baptized === null || p.baptized === undefined).length})</div>
              </button>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleCopyBaptismList}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', background: 'rgba(15, 23, 42, 0.6)' }}
              >
                <span>💬</span> Copiar Aba Atual (WhatsApp)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleDownloadBaptismCSV}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', background: 'rgba(15, 23, 42, 0.6)' }}
              >
                <FileSpreadsheet size={15} style={{ color: '#10b981' }} /> Exportar CSV
              </button>
            </div>

            {/* List */}
            <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid var(--power-line)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--power-raised)', borderBottom: '1px solid var(--power-line)', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Nome</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Telefone</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Departamento</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Função</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const list = filteredPeople.filter(p => {
                      if (baptismReportTab === 'baptized') return p.baptized === true;
                      if (baptismReportTab === 'intention') return p.baptized === false && (p.baptismIntention === 1 || p.baptismIntention === true);
                      if (baptismReportTab === 'unable') return p.baptized === false && p.baptismIntention === 2;
                      if (baptismReportTab === 'not_baptized') return p.baptized === false && (p.baptismIntention === 0 || p.baptismIntention === false || !p.baptismIntention);
                      return p.baptized === null || p.baptized === undefined;
                    });
                    
                    if (list.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--power-muted)' }}>
                            Nenhum membro nesta categoria sob os filtros atuais.
                          </td>
                        </tr>
                      );
                    }
                    return list.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {p.phone && p.phone !== '999999999' && p.phone !== '69999999999' ? (
                            p.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
                          ) : (
                            <span style={{ color: '#ef4444' }}>Falta telefone</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>{p.department}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{p.role}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            style={{ margin: 0, padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              setIsBaptismModalOpen(false);
                              openDetailsModal(p);
                            }}
                          >
                            🔎 Perfil / Alterar
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Membro (Perfil Completo) */}
      {selectedPersonForDetails && (
        <div className="modal-overlay" onClick={() => setSelectedPersonForDetails(null)}>
          <div className="modal-content" style={{ maxWidth: '650px', width: '95%', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                <div className="avatar-circle" style={{ background: getAvatarBg(selectedPersonForDetails.role), width: '45px', height: '45px', fontSize: '1.25rem' }}>
                  {selectedPersonForDetails.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                    {selectedPersonForDetails.name}
                    {selectedPersonForDetails.gender === 'U' && (
                      <span title="Falta definir o sexo" style={{ display: 'inline-flex', alignItems: 'flex-start', marginLeft: '0.5rem', color: '#ef4444', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        <AlertTriangle size={12} style={{ marginRight: '0.2rem' }} /> Indefinido
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    <span className="badge" style={{ 
                      fontSize: '0.65rem', 
                      padding: '0.15rem 0.45rem', 
                      background: selectedPersonForDetails.role === 'Membro' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(124, 58, 237, 0.08)',
                      color: selectedPersonForDetails.role === 'Membro' ? 'var(--power-muted)' : 'var(--power-orange)',
                      border: '1px solid ' + (selectedPersonForDetails.role === 'Membro' ? 'var(--power-line)' : 'rgba(124, 58, 237, 0.15)')
                    }}>{selectedPersonForDetails.role}</span>
                    {/* Status badge in modal removed */}
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedPersonForDetails(null)}>&times;</button>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {/* Seção 1: Classificação de Batismo */}
              <div style={{ 
                background: 'rgba(59, 130, 246, 0.03)', 
                border: '1px solid rgba(59, 130, 246, 0.12)', 
                borderRadius: '12px', 
                padding: '1.25rem',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--power-orange)', display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                  <span>🌊</span> Classificação de Batismo
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '0.5rem' }}>
                  <button
                    type="button"
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      border: selectedPersonForDetails.baptized === true
                        ? '2px solid var(--power-orange)' 
                        : '1px solid var(--power-muted)',
                      background: selectedPersonForDetails.baptized === true ? 'rgba(255, 97, 1, 0.10)' : 'white',
                      color: selectedPersonForDetails.baptized === true ? '#d94f00' : 'var(--power-muted)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleUpdateBaptismStatus(selectedPersonForDetails.id, 'baptized')}
                  >
                    <span>🌊</span> Batizado(a)
                  </button>

                  <button
                    type="button"
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      border: (selectedPersonForDetails.baptized === false && (selectedPersonForDetails.baptismIntention === 1 || selectedPersonForDetails.baptismIntention === true)) 
                        ? '2px solid var(--power-orange)' 
                        : '1px solid var(--power-muted)',
                      background: (selectedPersonForDetails.baptized === false && (selectedPersonForDetails.baptismIntention === 1 || selectedPersonForDetails.baptismIntention === true)) ? 'rgba(124, 58, 237, 0.08)' : 'white',
                      color: (selectedPersonForDetails.baptized === false && (selectedPersonForDetails.baptismIntention === 1 || selectedPersonForDetails.baptismIntention === true)) ? '#d94f00' : 'var(--power-muted)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleUpdateBaptismStatus(selectedPersonForDetails.id, 'intention')}
                  >
                    <span>🕊️</span> Com Intenção
                  </button>

                  <button
                    type="button"
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      border: (selectedPersonForDetails.baptized === false && selectedPersonForDetails.baptismIntention === 2) 
                        ? '2px solid #dc2626' 
                        : '1px solid var(--power-muted)',
                      background: (selectedPersonForDetails.baptized === false && selectedPersonForDetails.baptismIntention === 2) ? 'rgba(239, 68, 68, 0.08)' : 'white',
                      color: (selectedPersonForDetails.baptized === false && selectedPersonForDetails.baptismIntention === 2) ? '#b91c1c' : 'var(--power-muted)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleUpdateBaptismStatus(selectedPersonForDetails.id, 'unable')}
                  >
                    <span>🚫</span> Impossibilitado
                  </button>

                  <button
                    type="button"
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      border: (selectedPersonForDetails.baptized === false && (selectedPersonForDetails.baptismIntention === 0 || selectedPersonForDetails.baptismIntention === false || !selectedPersonForDetails.baptismIntention)) 
                        ? '2px solid #d97706' 
                        : '1px solid var(--power-muted)',
                      background: (selectedPersonForDetails.baptized === false && (selectedPersonForDetails.baptismIntention === 0 || selectedPersonForDetails.baptismIntention === false || !selectedPersonForDetails.baptismIntention)) ? 'rgba(217, 119, 6, 0.08)' : 'white',
                      color: (selectedPersonForDetails.baptized === false && (selectedPersonForDetails.baptismIntention === 0 || selectedPersonForDetails.baptismIntention === false || !selectedPersonForDetails.baptismIntention)) ? '#b45309' : 'var(--power-muted)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleUpdateBaptismStatus(selectedPersonForDetails.id, 'not_baptized')}
                  >
                    <span>⚠️</span> Não Batizado
                  </button>

                  <button
                    type="button"
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      border: (selectedPersonForDetails.baptized === null || selectedPersonForDetails.baptized === undefined)
                        ? '2px solid var(--power-muted)' 
                        : '1px solid var(--power-muted)',
                      background: (selectedPersonForDetails.baptized === null || selectedPersonForDetails.baptized === undefined) ? 'rgba(100, 116, 139, 0.08)' : 'white',
                      color: (selectedPersonForDetails.baptized === null || selectedPersonForDetails.baptized === undefined) ? 'var(--power-muted)' : 'var(--power-muted)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleUpdateBaptismStatus(selectedPersonForDetails.id, 'uninformed')}
                  >
                    <span>❓</span> Não Informado
                  </button>
                </div>
              </div>

              {/* Seção 2: Informações Pessoais */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--power-raised)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--power-line)' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--power-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Contato & Local</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <Phone size={14} style={{ color: 'var(--power-orange)' }} />
                      {selectedPersonForDetails.phone && selectedPersonForDetails.phone !== '999999999' && selectedPersonForDetails.phone !== '69999999999' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <a href={`tel:${selectedPersonForDetails.phone}`} style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
                            {selectedPersonForDetails.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                          </a>
                          <a 
                            href={`https://api.whatsapp.com/send?phone=55${selectedPersonForDetails.phone}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ textDecoration: 'none', fontSize: '1rem' }}
                            title="Conversar no WhatsApp"
                          >
                            💬
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>Falta Telefone</span>
                      )}
                    </div>
                    <div>
                      <strong>Depto:</strong> {selectedPersonForDetails.department}
                    </div>
                    <div>
                      <strong>Endereço:</strong> {selectedPersonForDetails.address || <span style={{ color: '#ea580c' }}>Não informado</span>}
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--power-raised)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--power-line)' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--power-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Datas Importantes</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div>
                      <strong>Admissão:</strong> {selectedPersonForDetails.startDate.split('-').reverse().join('/')}
                    </div>
                    {selectedPersonForDetails.birthDate ? (
                      <div>
                        <strong>Nascimento:</strong> {selectedPersonForDetails.birthDate.split('-').reverse().slice(0, 2).join('/')} ({(() => {
                          const parts = selectedPersonForDetails.birthDate!.split('-');
                          const bYear = parseInt(parts[0], 10);
                          const bMonth = parseInt(parts[1], 10);
                          const bDay = parseInt(parts[2], 10);
                          const today = new Date();
                          let age = today.getFullYear() - bYear;
                          if (today.getMonth() + 1 < bMonth || (today.getMonth() + 1 === bMonth && today.getDate() < bDay)) {
                            age--;
                          }
                          return `${age} anos`;
                        })()})
                      </div>
                    ) : (
                      <div>
                        <strong>Nascimento:</strong> <span style={{ color: 'var(--power-muted)' }}>Não cadastrado</span>
                      </div>
                    )}
                    <div>
                      <strong>Cadastrado em:</strong> {selectedPersonForDetails.createdAt ? selectedPersonForDetails.createdAt.split('-').reverse().join('/') : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 3: Credenciais de Acesso */}
              {canViewSystemAccess && selectedPersonForDetails.role !== 'Membro' && selectedPersonForDetails.username && (
                <div style={{ 
                  background: 'rgba(124, 58, 237, 0.03)', 
                  border: '1px dashed rgba(124, 58, 237, 0.25)', 
                  borderRadius: '10px', 
                  padding: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--power-orange)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>🔑 Dados de Acesso ao Sistema</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div>
                      <div><strong>Usuário:</strong> <code style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{selectedPersonForDetails.username}</code></div>
                      <div style={{ marginTop: '0.25rem' }}>
                        <strong>Senha:</strong> {selectedPersonForDetails.passwordChanged ? (
                          <span style={{ color: '#10b981', fontWeight: 600 }}>Modificada pelo usuário</span>
                        ) : (
                          <code style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>mudar123</code>
                        )}
                      </div>
                    </div>
                    {selectedPersonForDetails.phone && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          style={{ borderColor: '#10b981', color: '#10b981', background: 'rgba(15, 23, 42, 0.6)', margin: 0 }}
                          onClick={() => {
                            const password = selectedPersonForDetails.passwordChanged ? '(senha pessoal já definida)' : 'mudar123';
                            const message = `Olá, *${selectedPersonForDetails.name}*!\n\nSeja bem-vindo ao *Multiplica PLUS*!\n\n🌐 *Acesse o app:* https://multiplica-plus-ieadjota.vercel.app\n👤 *Usuário:* \`${selectedPersonForDetails.username}\`\n🔑 *Senha Temporária:* \`${password}\`\n\n_Obs: No primeiro acesso, altere para sua senha pessoal._\n\nDeus abençoe! 🙏✨`;
                            const encoded = encodeURIComponent(message);
                            window.open(`https://api.whatsapp.com/send?phone=55${selectedPersonForDetails.phone}&text=${encoded}`, '_blank');
                          }}
                        >
                          Enviar Credenciais (WhatsApp)
                        </button>
                        {canResetPasswords && selectedPersonForDetails.username && onResetPassword && (
                          <button
                            type="button"
                            className="btn btn-danger btn-small"
                            style={{ borderColor: '#ef4444', color: '#ef4444', background: 'rgba(15, 23, 42, 0.6)', margin: 0 }}
                            onClick={() => {
                              const customPassword = window.prompt('Informe a nova senha para este usuário (deixe em branco para resetar para mudar123):', '');
                              if (customPassword === null) return;
                              onResetPassword(selectedPersonForDetails.id, customPassword.trim() || 'mudar123');
                              alert(`Senha de ${selectedPersonForDetails.name} foi redefinida com sucesso.`);
                            }}
                          >
                            Redefinir Senha
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Seção 4: Observações com salvamento */}
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--power-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Observações / Anotações Internas</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '80px', resize: 'vertical', fontSize: '0.85rem' }}
                    value={obsText}
                    onChange={(e) => setObsText(e.target.value)}
                    placeholder="Escreva observações sobre esta pessoa (ex: dons, histórico, pedidos de oração)..."
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    style={{ alignSelf: 'flex-end', margin: 0, padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={handleSaveObservations}
                  >
                    Salvar Observações
                  </button>
                </div>
              </div>

              {/* Seção 5: Histórico de Acompanhamento */}
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--power-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>📋 Histórico de Contatos do Radar</span>
                {(() => {
                  const personLogs = db.pastoralLogs.filter(log => log.personId === selectedPersonForDetails.id);
                  const sortedLogs = [...personLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  
                  if (sortedLogs.length === 0) {
                    return (
                      <p style={{ fontSize: '0.8rem', color: 'var(--power-muted)', fontStyle: 'italic', margin: 0 }}>
                        Nenhum contato ou visita pastoral registrado para este membro.
                      </p>
                    );
                  }
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                      {sortedLogs.map(log => (
                        <div key={log.id} style={{ background: 'var(--power-raised)', borderLeft: '3px solid var(--power-orange)', padding: '0.65rem 0.85rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--power-muted)', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.75rem' }}>
                            <span>
                              {log.type === 'Visita' ? '🏠 Visita de Acompanhamento' : log.type === 'Ligação' ? '📞 Ligação' : '💬 Mensagem'}
                            </span>
                            <span>{log.date.split('-').reverse().join('/')}</span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--color-text-main)' }}>{log.notes}</p>
                          <div style={{ fontSize: '0.7rem', color: 'var(--power-muted)', marginTop: '0.25rem', textAlign: 'right' }}>
                            Registrado por: {log.recordedBy}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
