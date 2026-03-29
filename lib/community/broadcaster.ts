import type { CommunityState } from "@/types"

// Singleton stored on globalThis to survive Next.js HMR
declare global {
  // eslint-disable-next-line no-var
  var __communityBroadcaster: CommunityBroadcaster | undefined
}

type StateListener = (state: CommunityState) => void

class CommunityBroadcaster {
  private listeners = new Set<StateListener>()
  private lastState: CommunityState | null = null

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  publish(state: CommunityState): void {
    this.lastState = state
    for (const listener of this.listeners) {
      listener(state)
    }
  }

  /** Returns the most recently published state, or null if nothing published yet. */
  getLastState(): CommunityState | null {
    return this.lastState
  }

  listenerCount(): number {
    return this.listeners.size
  }

  static getInstance(): CommunityBroadcaster {
    if (!globalThis.__communityBroadcaster) {
      globalThis.__communityBroadcaster = new CommunityBroadcaster()
    }
    return globalThis.__communityBroadcaster
  }
}

export { CommunityBroadcaster }
