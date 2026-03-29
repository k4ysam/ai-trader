import { NextResponse } from "next/server"
import { getSnapshots } from "@/lib/market/alpaca-rest"
import { WATCHLIST } from "@/lib/constants"
import type { ApiError } from "@/types"

export async function GET(): Promise<NextResponse> {
  try {
    const snapshots = await getSnapshots(WATCHLIST)
    return NextResponse.json(snapshots)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch snapshots"
    const body: ApiError = { error: msg }
    return NextResponse.json(body, { status: 500 })
  }
}
