import { NextResponse } from "next/server"
import { Orchestrator } from "@/lib/orchestrator"
import type { ReplaySpeed, SimMode } from "@/types"

interface StartBody {
  mode?: SimMode
  speed?: number
  date?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => ({})) as StartBody

  if (body.mode === "replay") {
    const speed = (body.speed ?? 1) as ReplaySpeed
    await Orchestrator.getInstance().startReplay(speed, body.date)
    return NextResponse.json({ status: "running" })
  }

  Orchestrator.getInstance().start()
  return NextResponse.json({ status: "running" })
}
