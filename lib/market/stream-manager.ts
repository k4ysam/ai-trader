import { EventEmitter } from "events"
import WebSocket from "ws"
import { ALPACA_DATA_WS_URL, WATCHLIST } from "@/lib/constants"
import type { MarketTick } from "@/types"

// Singleton stored on globalThis to survive Next.js HMR
declare global {
  // eslint-disable-next-line no-var
  var __streamManager: StreamManager | undefined
}

type AlpacaTradeMsg = {
  T: "t"
  S: string
  p: number
  s: number
  t: string
}

function isAlpacaTradeMsg(v: unknown): v is AlpacaTradeMsg {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<string, unknown>).T === "t" &&
    typeof (v as Record<string, unknown>).S === "string" &&
    typeof (v as Record<string, unknown>).p === "number"
  )
}

export class StreamManager extends EventEmitter {
  private ws: WebSocket | null = null
  private reconnectDelay = 1000
  private readonly maxReconnectDelay = 30_000
  private destroyed = false
  private subscriptions: string[] = []

  constructor() {
    super()
    this.setMaxListeners(100) // Many SSE clients may subscribe
  }

  connect(tickers: string[] = WATCHLIST): void {
    this.subscriptions = tickers
    this.createSocket()
  }

  private createSocket(): void {
    if (this.destroyed) return

    const apiKey = process.env.ALPACA_API_KEY
    const apiSecret = process.env.ALPACA_API_SECRET
    if (!apiKey || !apiSecret) {
      throw new Error("ALPACA_API_KEY and ALPACA_API_SECRET must be configured")
    }

    this.ws = new WebSocket(ALPACA_DATA_WS_URL)

    this.ws.on("open", () => {
      this.reconnectDelay = 1000
      this.ws?.send(
        JSON.stringify({ action: "auth", key: apiKey, secret: apiSecret })
      )
    })

    this.ws.on("message", (data: Buffer | string) => {
      this.handleMessage(data.toString())
    })

    this.ws.on("close", () => {
      if (!this.destroyed) this.scheduleReconnect()
    })

    this.ws.on("error", () => {
      // Close will follow; let reconnect handle it
      this.ws?.terminate()
    })
  }

  private handleMessage(raw: string): void {
    let msgs: unknown
    try {
      msgs = JSON.parse(raw)
    } catch {
      return
    }

    if (!Array.isArray(msgs)) return

    for (const msg of msgs) {
      if (typeof msg !== "object" || msg === null) continue
      const m = msg as Record<string, unknown>

      // Auth success → subscribe
      if (m.T === "success" && m.msg === "authenticated") {
        this.ws?.send(
          JSON.stringify({
            action: "subscribe",
            trades: this.subscriptions,
            quotes: [],
            bars: [],
          })
        )
        return
      }

      // Trade tick
      if (isAlpacaTradeMsg(msg)) {
        const tick: MarketTick = {
          ticker: msg.S,
          price: msg.p,
          volume: msg.s,
          timestamp: new Date(msg.t).getTime(),
        }
        this.emit("tick", tick)
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    setTimeout(() => this.createSocket(), this.reconnectDelay)
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay
    )
  }

  destroy(): void {
    this.destroyed = true
    this.ws?.terminate()
    this.ws = null
  }

  static getInstance(): StreamManager {
    if (!globalThis.__streamManager) {
      globalThis.__streamManager = new StreamManager()
    }
    return globalThis.__streamManager
  }
}
