import { NextResponse } from "next/server"
import { Orchestrator } from "@/lib/orchestrator"
import { updateBotParamsSchema } from "@/lib/validation"
import type { ApiError } from "@/types"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params
  const bot = Orchestrator.getInstance().getState().bots.find((b) => b.config.id === id)
  if (!bot) {
    const err: ApiError = { error: `Bot '${id}' not found` }
    return NextResponse.json(err, { status: 404 })
  }
  return NextResponse.json(bot)
}

export async function PATCH(request: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    const err: ApiError = { error: "Invalid JSON body" }
    return NextResponse.json(err, { status: 400 })
  }

  const parsed = updateBotParamsSchema.safeParse(body)
  if (!parsed.success) {
    const err: ApiError = { error: parsed.error.issues[0]?.message ?? "Validation error" }
    return NextResponse.json(err, { status: 400 })
  }

  const orc = Orchestrator.getInstance()
  const exists = orc.getState().bots.find((b) => b.config.id === id)
  if (!exists) {
    const err: ApiError = { error: `Bot '${id}' not found` }
    return NextResponse.json(err, { status: 404 })
  }

  orc.updateBotParams(id, parsed.data.params)
  const updated = orc.getState().bots.find((b) => b.config.id === id)
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params
  const orc = Orchestrator.getInstance()
  const exists = orc.getState().bots.find((b) => b.config.id === id)
  if (!exists) {
    const err: ApiError = { error: `Bot '${id}' not found` }
    return NextResponse.json(err, { status: 404 })
  }
  orc.removeBot(id)
  return new NextResponse(null, { status: 204 })
}
