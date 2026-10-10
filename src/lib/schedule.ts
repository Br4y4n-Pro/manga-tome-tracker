// Pure release-schedule calculations (client-side).
export type RuleType = "cada_n" | "dia_fijo" | "varios_dias";
export interface ScheduleRule {
  tipo_regla: string;
  cada_n_dias: number | null;
  dias_semana: number[]; // 0 = domingo … 6 = sábado
  fecha_inicio: string; // YYYY-MM-DD
  activo: boolean;
}

export const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DIAS_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function toISODate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function diffDays(a: Date, b: Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}
function addDays(d: Date, n: number) {
  const r = startOfDay(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isReleaseDay(rule: ScheduleRule, date: Date): boolean {
  if (!rule.activo) return false;
  const start = parseLocalDate(rule.fecha_inicio);
  const diff = diffDays(date, start);
  if (diff < 0) return false;
  if (rule.tipo_regla === "cada_n") {
    const n = rule.cada_n_dias ?? 0;
    return n > 0 && diff % n === 0;
  }
  return rule.dias_semana.includes(startOfDay(date).getDay());
}

/** Release dates in [from, from + days). */
export function upcomingReleases(rule: ScheduleRule, from: Date, days: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (isReleaseDay(rule, d)) out.push(d);
  }
  return out;
}

export function lastReleaseOnOrBefore(rule: ScheduleRule, date: Date, lookback = 120): Date | null {
  for (let i = 0; i <= lookback; i++) {
    const d = addDays(date, -i);
    if (isReleaseDay(rule, d)) return d;
  }
  return null;
}

/** True when a release day has arrived and progress wasn't advanced since. */
export function possibleNewChapter(
  rule: ScheduleRule | null | undefined,
  lastReadAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!rule || !rule.activo) return false;
  const last = lastReleaseOnOrBefore(rule, now);
  if (!last) return false;
  if (!lastReadAt) return true;
  return new Date(lastReadAt).getTime() < last.getTime();
}

export function describeRule(rule: ScheduleRule): string {
  if (rule.tipo_regla === "cada_n") return `Cada ${rule.cada_n_dias} días`;
  const dias = [...rule.dias_semana].sort().map((d) => DIAS_LARGO[d]);
  if (rule.tipo_regla === "dia_fijo") return `Todos los ${dias[0] ?? "—"}`;
  return dias.join(", ");
}
