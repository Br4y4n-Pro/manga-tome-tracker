CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'manga',
  categoria text,
  fuente text NOT NULL DEFAULT '',
  estado text,
  cover_url text,
  cover_checked boolean NOT NULL DEFAULT false,
  ultimo_cap_leido numeric NOT NULL DEFAULT 0,
  ultimo_cap_nombre text,
  caps_leidos integer,
  caps_totales integer,
  sin_leer integer,
  ultimo_cap_disponible numeric,
  ultimo_cap_tracker numeric,
  nota_general text,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, titulo, fuente)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT ALL ON public.series TO service_role;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own series" ON public.series FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX series_user_titulo ON public.series(user_id, titulo);

CREATE TABLE public.chapter_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  capitulo numeric NOT NULL,
  nota text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_notes TO authenticated;
GRANT ALL ON public.chapter_notes TO service_role;
ALTER TABLE public.chapter_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.chapter_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.release_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL UNIQUE REFERENCES public.series(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tipo_regla text NOT NULL,
  cada_n_dias integer,
  dias_semana integer[] NOT NULL DEFAULT '{}',
  fecha_inicio date NOT NULL DEFAULT current_date,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_schedules TO authenticated;
GRANT ALL ON public.release_schedules TO service_role;
ALTER TABLE public.release_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own schedules" ON public.release_schedules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  archivo text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  nuevas integer NOT NULL DEFAULT 0,
  actualizadas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_logs TO authenticated;
GRANT ALL ON public.import_logs TO service_role;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs" ON public.import_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER series_touch BEFORE UPDATE ON public.series FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();