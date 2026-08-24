/** Datas civis do Multiplica Plus devem respeitar o calendário local do aparelho. */
export function getLocalDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addLocalDaysISO(days: number, base: Date = new Date()): string {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  date.setDate(date.getDate() + days);
  return getLocalDateISO(date);
}
