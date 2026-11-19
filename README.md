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
| 6. Categorías una a una (20 s), saltar, pendientes, STOP y terminar ronda | Hecha (falta probarla en línea) |
| 7. Validación automática (diccionario, Wikidata, Wikcionario) | Hecha (falta probarla en línea) |
| 8. Votación de palabras y aprendizaje | Hecha (falta probarla en línea) |
| 9. Puntos, rondas elegidas al crear la sala y resultados finales | Hecha (falta probarla en línea) |
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
   4. `supabase/migrations/20261116000004_respuestas.sql`
   5. `supabase/migrations/20261116000005_validacion.sql`
   6. `supabase/migrations/20261116000006_votacion_palabras.sql`
   7. `supabase/migrations/20261116000007_puntos_y_rondas.sql`
   8. `supabase/seed.sql`
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
3. En **Environment Variables** agrega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y también `SUPABASE_SERVICE_ROLE_KEY` (clave *service_role* de Supabase: Project Settings > API; solo para el servidor).
4. Despliega. Cada `git push` a `main` publica una versión nueva.

## Mantener Supabase despierto

El plan gratuito de Supabase pausa el proyecto tras 7 días sin actividad. `vercel.json` programa un Vercel Cron que llama una vez al día a `/api/keepalive`, que hace una consulta mínima. Si el proyecto llegara a pausarse, se reactiva desde el panel de Supabase (**Restore project**).

## Seguridad

- El navegador **nunca escribe directo** en las tablas. Solo lee lo de su sala (RLS) y llama a funciones SQL que validan las reglas (`create_room`, `join_room`, `leave_room`, `ensure_player`).
- Las respuestas de los demás no se pueden leer mientras se escribe: solo cuando la ronda pasa a revisión.
- El diccionario es de solo lectura para los jugadores; solo el servidor (`service_role`) lo ampliará.
- La clave `service_role` **nunca** va en variables `NEXT_PUBLIC_`. Se usa solo en `src/app/api/validar` (servidor de Vercel).

## Pruebas

- `npm test`: reglas de texto, fuentes externas de validación (con respuestas simuladas, sin red) reglas de la votación de palabras y de puntos (minúsculas, sin números ni símbolos, ñ, tildes, código de sala).
- `supabase/tests/`: 20 pruebas de reglas y seguridad (salas, asientos, jugador mano, votos, RLS, Realtime). Se ejecutan sobre un PostgreSQL con `supabase_shim.sql` (simula roles y `auth.uid()` de Supabase), luego las migraciones, el seed y `reglas_y_seguridad.sql`.

## Decisiones de diseño

- **Validación (etapa 7):** formato y letra se comprueban al enviar la palabra. Al pasar la ronda a revisión, `/api/validar` mira primero el diccionario propio y después Wikidata y Wikcionario (`src/lib/validation/config.ts` dice qué fuente sirve para cada categoría). Las fuentes solo pueden **aceptar**: lo que no confirman, o si fallan, queda `in_review` para la votación de los jugadores (etapa 8). Lo aceptado por una fuente externa se guarda en `word_dictionary` con su origen.

- **Categorías fijas** para todas las rondas, guardadas en `categories` (se pueden desactivar con `is_active`). La partida copia las activas en `game_categories` al empezar.
- **Identidad:** sesión anónima de Supabase + nombre de jugador. La sesión persiste en el navegador, lo que permite reconectarse.
- **Reloj oficial en el servidor:** `rounds.phase_started_at`; los plazos de 20 s se calcularán a partir de ahí.
- **Votación de palabras (etapa 8):** una palabra `in_review` la votan todos los jugadores menos su autor. Un voto en contra la rechaza al instante; hace falta que TODOS voten a favor para aceptarla. El voto no se puede cambiar. Si se acepta por unanimidad se guarda en `word_dictionary` con origen `vote`. La decide la función SQL `vote_word`; `src/lib/game/reviews.ts` replica la regla para la pantalla y para las pruebas.
- **Puntos y rondas (etapa 9):** el anfitrión elige 3 a 10 rondas al crear la sala. Al terminar la revisión, `finish_round` da 50 puntos a cada jugador que comparte una palabra válida (misma categoría, sin importar tildes ni mayúsculas) y 100 a quien tiene una palabra válida que nadie más tiene; lo rechazado vale 0. `game_results` guarda el total de cada jugador. Al cerrar la última ronda la partida termina y se calculan las posiciones (los empates comparten lugar). Si se rechaza la letra, esa ronda no cuenta. `src/lib/game/scoring.ts` replica la regla para las pruebas.
- **Tildes:** se conserva la escritura original y se busca con `word_normalized` (sin tildes, con ñ).
- **Jugador mano:** el orden lo da `room_players.seat`; un trigger impide que alguien sea mano dos rondas seguidas.

## Estructura

```
src/app/            páginas (inicio y sala/[codigo])
src/components/     interfaz reutilizable
src/lib/game/       reglas de texto (con pruebas)
src/lib/validation/ fuentes externas de validación (con pruebas)
src/app/api/validar ruta del servidor que valida las respuestas
src/app/api/keepalive ruta que Vercel Cron llama cada día para mantener activo Supabase
src/lib/            Supabase, salas, tiempo real, errores
supabase/migrations esquema, RLS y funciones
supabase/seed.sql   diccionario inicial (14 categorías)
supabase/tests/     pruebas de la base de datos
```
