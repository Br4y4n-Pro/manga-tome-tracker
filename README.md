# Manga Tome Tracker

Mi Biblioteca Otaku: progreso, notas por capítulo y calendario de salidas de manga, manhwa, manhua y anime.

Stack: TanStack Start (React 19) + Vite, Tailwind CSS, Supabase (auth y Postgres con RLS).

## Requisitos

- Node.js 22+
- Un proyecto de [Supabase](https://supabase.com)

## Configuración

1. Instala dependencias:

   ```sh
   npm install
   ```

2. Copia `.env.example` a `.env` y completa la URL y la clave **publishable** de tu proyecto de Supabase.
   Nunca pongas la clave secreta (`sb_secret_…` / `service_role`) en el `.env` del frontend.

3. Crea las tablas: en Supabase → SQL Editor, ejecuta `drizzle/migrations/0000_migration.sql`.

4. En Supabase → Authentication → URL Configuration, agrega la URL de la app
   (y `http://localhost:8080` para desarrollo) para que funcionen la confirmación de correo
   y la recuperación de contraseña (`/reset-password`).

## Scripts

```sh
npm run dev      # servidor de desarrollo en http://localhost:8080
npm run build    # build de producción
npm run preview  # sirve el build
npm test         # tests
npm run lint     # lint
```
