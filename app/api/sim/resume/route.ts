import { NextResponse } from "next/server"
import { Orchestrator } from "@/lib/orchestrator"

export async function POST(): Promise<NextResponse> {
  Orchestrator.getInstance().resume()
  return NextResponse.json({ status: "running" })
}
