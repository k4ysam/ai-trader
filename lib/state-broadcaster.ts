import type { SimState } from "@/types"

// Singleton stored on globalThis to survive Next.js HMR
declare global {
  // eslint-disable-next-line no-var
  var __stateBroadcaster: StateBroadcaster | undefined
}

type StateListener = (state: SimState) => void

class StateBroadcaster {
  private listeners = new Set<StateListener>()

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  publish(state: SimState): void {
    for (const listener of this.listeners) {
      listener(state)
    }
  }

  listenerCount(): number {
    return this.listeners.size
  }

  static getInstance(): StateBroadcaster {
    if (!globalThis.__stateBroadcaster) {
      globalThis.__stateBroadcaster = new StateBroadcaster()
    }
    return globalThis.__stateBroadcaster
  }
}

export { StateBroadcaster }
