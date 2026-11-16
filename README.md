# WordiX

Juego multijugador de categorías y palabras (estilo Stop) para 2 a 4 jugadores.

**Stack:** Next.js 15 + TypeScript + Tailwind (Vercel) · Supabase (PostgreSQL, Auth anónima, Realtime) · GitHub.

## Estado actual

| Etapa | Estado |
|---|---|
| 1. Configuración técnica | Hecha |
| 2. Base de datos (esquema, RLS, diccionario inicial) | Hecha y probada |
| 3. Salas: nombre, crear, unirse por código de 6 números | Hecha |
| 4. Sincronización en tiempo real y reconexión de la sala de espera | Hecha |
| 5. Empezar partida, ruleta, votación de la letra y jugador mano | Hecha (falta probarla en línea) |
| 6. Categorías, 20 s, STOP, repetición de pendientes | Pendiente |
| 7. Validación (diccionario, Wikidata, Wikcionario) | Pendiente |
| 8. Votación de palabras y aprendizaje | Pendiente |
| 9. Puntuación y resultados | Pendiente |
| 10. Pruebas integrales y lanzamiento | Pendiente |

Las tablas de rondas, respuestas, votos y resultados ya existen con sus reglas, pero la interfaz y la lógica del juego se construyen en las etapas 5 a 9. No hay botones sin función: lo que aparece en pantalla funciona.

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en supabase.com.
2. **Authentication > Sign In / Providers**: activa **Allow anonymous sign-ins**.
3. En el **SQL Editor** ejecuta, en este orden:
   1. `supabase/migrations/20261115000001_diccionario.sql`
   2. `supabase/migrations/20261115000002_juego.sql`
   3. `supabase/migrations/20261116000003_partida.sql`
   4. `supabase/seed.sql`
4. En **Project Settings > API** copia la URL y la clave pública (anon/publishable).

### 2. Local
```bash
cp .env.example .env.local   # pega la URL y la clave pública
npm install
npm run dev                  # http://localhost:3000
npm test                     # pruebas de las reglas de texto
```

### 3. GitHub y Vercel
1. Sube el proyecto a un repositorio de GitHub (`.env.local` está en `.gitignore`).
2. En Vercel: **Add New > Project**, importa el repositorio.
3. En **Environment Variables** agrega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Despliega. Cada `git push` a `main` publica una versión nueva.

## Seguridad

- El navegador **nunca escribe directo** en las tablas. Solo lee lo de su sala (RLS) y llama a funciones SQL que validan las reglas (`create_room`, `join_room`, `leave_room`, `ensure_player`).
- Las respuestas de los demás no se pueden leer mientras se escribe: solo cuando la ronda pasa a revisión.
- El diccionario es de solo lectura para los jugadores; solo el servidor (`service_role`) lo ampliará.
- La clave `service_role` **nunca** va en variables `NEXT_PUBLIC_`. Se usará solo en rutas del servidor (etapas 6 a 8).

## Pruebas

- `npm test`: reglas de texto (minúsculas, sin números ni símbolos, ñ, tildes, código de sala).
- `supabase/tests/`: 20 pruebas de reglas y seguridad (salas, asientos, jugador mano, votos, RLS, Realtime). Se ejecutan sobre un PostgreSQL con `supabase_shim.sql` (simula roles y `auth.uid()` de Supabase), luego las migraciones, el seed y `reglas_y_seguridad.sql`.

## Decisiones de diseño

- **Categorías fijas** para todas las rondas, guardadas en `categories` (se pueden desactivar con `is_active`). La partida copia las activas en `game_categories` al empezar.
- **Identidad:** sesión anónima de Supabase + nombre de jugador. La sesión persiste en el navegador, lo que permite reconectarse.
- **Reloj oficial en el servidor:** `rounds.phase_started_at`; los plazos de 20 s se calcularán a partir de ahí.
- **Tildes:** se conserva la escritura original y se busca con `word_normalized` (sin tildes, con ñ).
- **Jugador mano:** el orden lo da `room_players.seat`; un trigger impide que alguien sea mano dos rondas seguidas.

## Estructura

```
src/app/            páginas (inicio y sala/[codigo])
src/components/     interfaz reutilizable
src/lib/game/       reglas de texto (con pruebas)
src/lib/            Supabase, salas, tiempo real, errores
supabase/migrations esquema, RLS y funciones
supabase/seed.sql   diccionario inicial (14 categorías)
supabase/tests/     pruebas de la base de datos
```
