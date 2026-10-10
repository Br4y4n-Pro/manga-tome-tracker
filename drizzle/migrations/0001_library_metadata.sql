-- Richer series metadata (Komikku backup + AniList) and ownership hardening.

ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS fuentes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS categorias text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS autor text,
  ADD COLUMN IF NOT EXISTS artista text,
  ADD COLUMN IF NOT EXISTS sinopsis text,
  ADD COLUMN IF NOT EXISTS generos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS anilist_id integer,
  ADD COLUMN IF NOT EXISTS mal_id integer,
  ADD COLUMN IF NOT EXISTS anilist_url text,
  ADD COLUMN IF NOT EXISTS total_api integer,
  ADD COLUMN IF NOT EXISTS puntuacion integer,
  ADD COLUMN IF NOT EXISTS estado_api text,
  ADD COLUMN IF NOT EXISTS proximo_ep integer,
  ADD COLUMN IF NOT EXISTS proximo_ep_at timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_agregado timestamptz,
  ADD COLUMN IF NOT EXISTS info_checked boolean NOT NULL DEFAULT false;

-- Backfill the array columns from the single-value ones.
UPDATE public.series SET fuentes = ARRAY[fuente] WHERE fuente <> '' AND fuentes = '{}';
UPDATE public.series
  SET categorias = string_to_array(categoria, ', ')
  WHERE categoria IS NOT NULL AND categoria <> '(sin categoría)' AND categorias = '{}';

CREATE INDEX IF NOT EXISTS series_user_anilist ON public.series(user_id, anilist_id);

-- An anime and a manga can share a title (e.g. "Ajin"), so uniqueness is per kind of work.
ALTER TABLE public.series DROP CONSTRAINT IF EXISTS series_user_id_titulo_fuente_key;
CREATE UNIQUE INDEX IF NOT EXISTS series_user_kind_titulo_fuente
  ON public.series (user_id, (tipo = 'anime'), titulo, fuente);

-- Notes and schedules may only point at a series owned by the same user.
-- RLS checks user_id, but without this a user could attach rows to another user's series id.
ALTER TABLE public.series ADD CONSTRAINT series_id_user_unique UNIQUE (id, user_id);

ALTER TABLE public.chapter_notes
  ADD CONSTRAINT chapter_notes_series_owner_fk
  FOREIGN KEY (series_id, user_id) REFERENCES public.series(id, user_id) ON DELETE CASCADE;

ALTER TABLE public.release_schedules
  ADD CONSTRAINT release_schedules_series_owner_fk
  FOREIGN KEY (series_id, user_id) REFERENCES public.series(id, user_id) ON DELETE CASCADE;
