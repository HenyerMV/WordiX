// GET /api/keepalive
// Lo llama Vercel Cron una vez al día (ver vercel.json). Hace una consulta mínima a
// Supabase para que el proyecto del plan gratuito cuente como activo y no se pause
// por inactividad. Usa solo la clave pública y una tabla de lectura abierta.

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Si defines CRON_SECRET en Vercel, solo Vercel Cron puede llamar a esta ruta
  // (Vercel envía ese valor en la cabecera Authorization).
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "NOT_AUTHORIZED" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "SERVER_NOT_CONFIGURED" }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.from("categories").select("id").limit(1);
  if (error) {
    console.error("[wordix] keepalive falló", error);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
