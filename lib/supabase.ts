// lib/supabase.ts
// Browser-safe Supabase client singleton used for Realtime subscriptions.
// SQLite (better-sqlite3) remains the primary data store on the server side.
// This client is intentionally kept anon-only; it never runs in server
// components or API routes — only in "use client" components.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Add them to .env.local."
  );
}

// Singleton pattern — safe for hot-reload in Next.js dev mode.
type GlobalWithSupabase = typeof globalThis & {
  __supabase?: SupabaseClient;
};

function getSupabaseClient(): SupabaseClient {
  const g = globalThis as GlobalWithSupabase;
  if (!g.__supabase) {
    g.__supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return g.__supabase;
}

export const supabase = getSupabaseClient();
