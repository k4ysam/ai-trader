import { NextResponse } from "next/server"
import { Orchestrator } from "@/lib/orchestrator"

export async function POST(): Promise<NextResponse> {
  const orc = Orchestrator.getInstance()
  orc.reset()
  return NextResponse.json(orc.getState())
}
