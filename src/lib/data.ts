import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { queryOptions } from "@tanstack/react-query";

export type Series = Tables<"series">;
export type Schedule = Tables<"release_schedules">;
export type ChapterNote = Tables<"chapter_notes">;
export type ImportLog = Tables<"import_logs">;

export const TIPOS = ["manga", "manhwa", "manhua", "anime"] as const;

export async function fetchAllSeries(): Promise<Series[]> {
  const out: Series[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("series")
      .select("*")
      .order("titulo")
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

export const seriesQuery = queryOptions({
  queryKey: ["series"],
  queryFn: fetchAllSeries,
  staleTime: 60_000,
});

export const schedulesQuery = queryOptions({
  queryKey: ["schedules"],
  queryFn: async () => {
    const { data, error } = await supabase.from("release_schedules").select("*");
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
});

export const lastImportQuery = queryOptions({
  queryKey: ["last-import"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("import_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

export function formatCap(n: number | null | undefined) {
  if (n == null) return "—";
  return Number.isInteger(Number(n)) ? String(Number(n)) : String(n);
}
