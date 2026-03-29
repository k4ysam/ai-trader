import { NextResponse } from "next/server"
import { Orchestrator } from "@/lib/orchestrator"
import { importBotSchema } from "@/lib/validation"
import type { ApiError, BotConfig } from "@/types"
import { nanoid } from "@/lib/nanoid"

export async function GET(): Promise<NextResponse> {
  const state = Orchestrator.getInstance().getState()
  return NextResponse.json(state.bots)
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const err: ApiError = { error: "Invalid JSON body" }
    return NextResponse.json(err, { status: 400 })
  }

  const parsed = importBotSchema.safeParse(body)
  if (!parsed.success) {
    const err: ApiError = { error: parsed.error.issues[0]?.message ?? "Validation error" }
    return NextResponse.json(err, { status: 400 })
  }

  const { name, type, params, emoji, color } = parsed.data
  const config: BotConfig = {
    id: `custom-${nanoid()}`,
    name,
    type,
    params,
    emoji: emoji ?? "🤖",
    color: color ?? "#6b7280",
  }

  const botState = Orchestrator.getInstance().addBot(config)
  return NextResponse.json(botState, { status: 201 })
}
