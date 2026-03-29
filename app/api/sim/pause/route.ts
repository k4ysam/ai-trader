import { NextResponse } from "next/server"
import { Orchestrator } from "@/lib/orchestrator"

export async function POST(): Promise<NextResponse> {
  Orchestrator.getInstance().pause()
  return NextResponse.json({ status: "paused" })
}
