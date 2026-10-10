import { describe, expect, it } from "vitest";
import { possibleNewChapter, upcomingReleases, type ScheduleRule } from "./schedule";

const base = { activo: true, fecha_inicio: "2026-10-01", cada_n_dias: null, dias_semana: [] };

describe("schedule rules", () => {
  it("every 7 days from start date", () => {
    const r: ScheduleRule = { ...base, tipo_regla: "cada_n", cada_n_dias: 7 };
    const d = upcomingReleases(r, new Date(2026, 9, 1), 15).map((x) => x.getDate());
    expect(d).toEqual([1, 8, 15]);
  });
  it("fixed weekday (Tuesday)", () => {
    const r: ScheduleRule = { ...base, tipo_regla: "dia_fijo", dias_semana: [2] };
    const d = upcomingReleases(r, new Date(2026, 9, 1), 14).map((x) => x.getDate());
    expect(d).toEqual([6, 13]);
  });
  it("multiple weekdays (Fri, Sat, Sun)", () => {
    const r: ScheduleRule = { ...base, tipo_regla: "varios_dias", dias_semana: [5, 6, 0] };
    const d = upcomingReleases(r, new Date(2026, 9, 5), 7).map((x) => x.getDate());
    expect(d).toEqual([9, 10, 11]);
  });
  it("flags possible new chapter after release day until progress advances", () => {
    const r: ScheduleRule = { ...base, tipo_regla: "dia_fijo", dias_semana: [2] };
    const wed = new Date(2026, 9, 7, 12);
    expect(possibleNewChapter(r, new Date(2026, 9, 5).toISOString(), wed)).toBe(true);
    expect(possibleNewChapter(r, new Date(2026, 9, 6, 20).toISOString(), wed)).toBe(false);
  });
});
