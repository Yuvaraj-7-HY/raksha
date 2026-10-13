import { readRingState } from "@/lib/ringState";

export async function GET() {
  return Response.json(readRingState(), {
    headers: { "Cache-Control": "no-store" },
  });
}
