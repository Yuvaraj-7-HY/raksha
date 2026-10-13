// app/api/health/route.ts
// Public health check — no auth, used by preflight

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true });
}