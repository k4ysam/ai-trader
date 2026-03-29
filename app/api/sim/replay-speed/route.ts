import { NextResponse } from "next/server"
import { Orchestrator } from "@/lib/orchestrator"
import type { ReplaySpeed } from "@/types"

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => ({})) as { speed?: number }
  const speed = body.speed
  if (speed !== 1 && speed !== 5 && speed !== 10 && speed !== 50) {
    return NextResponse.json({ error: "speed must be 1, 5, 10, or 50" }, { status: 400 })
  }
  Orchestrator.getInstance().setReplaySpeed(speed as ReplaySpeed)
  return NextResponse.json({ ok: true })
}
