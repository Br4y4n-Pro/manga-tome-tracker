import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Series } from "./data";

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
