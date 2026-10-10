import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Series, Schedule } from "./data";

/** Optimistic patch of a series row. */
export function useUpdateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Series> }) => {
      const { error } = await supabase.from("series").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["series"] });
      const prev = qc.getQueryData<Series[]>(["series"]);
      qc.setQueryData<Series[]>(["series"], (old) => old?.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["series"], ctx.prev);
      toast.error("No se pudo guardar");
    },
  });
}

export function plusOnePatch(s: Series): Partial<Series> {
  return {
    ultimo_cap_leido: Number(s.ultimo_cap_leido) + 1,
    caps_leidos: s.caps_leidos != null ? s.caps_leidos + 1 : null,
    sin_leer: s.sin_leer != null ? Math.max(0, s.sin_leer - 1) : null,
    last_read_at: new Date().toISOString(),
  };
}

export function useSaveChapterNote(seriesId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: { id?: string; capitulo: number; nota: string }) => {
      const { error } = note.id
        ? await supabase.from("chapter_notes").update({ capitulo: note.capitulo, nota: note.nota }).eq("id", note.id)
        : await supabase.from("chapter_notes").insert({ series_id: seriesId, capitulo: note.capitulo, nota: note.nota });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter-notes", seriesId] }),
    onError: () => toast.error("No se pudo guardar la nota"),
  });
}

export function useDeleteChapterNote(seriesId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapter_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter-notes", seriesId] }),
    onError: () => toast.error("No se pudo borrar la nota"),
  });
}

export function useSaveSchedule(seriesId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<Schedule, "id" | "series_id" | "user_id" | "created_at">) => {
      const { error } = await supabase
        .from("release_schedules")
        .upsert({ series_id: seriesId, ...rule }, { onConflict: "series_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", seriesId] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Calendario guardado");
    },
    onError: () => toast.error("No se pudo guardar el calendario"),
  });
}
