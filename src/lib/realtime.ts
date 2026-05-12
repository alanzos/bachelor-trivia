import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import type { GameState } from './types'

type RealtimeCallbacks = {
  onRemoteState: (state: GameState) => void
  onPeersChanged?: (peerCount: number) => void
}

type RealtimeSync = {
  shareUrl: string
  publishState: (state: GameState) => void
  destroy: () => void
}

const ROOM_PARAM = 'room'

const makeShareLink = () => {
  const url = new URL(window.location.href)
  let roomId = url.searchParams.get(ROOM_PARAM)

  if (!roomId) {
    roomId = crypto.randomUUID().slice(0, 8)
    url.searchParams.set(ROOM_PARAM, roomId)
    window.history.replaceState({}, '', url)
  }

  return {
    roomId,
    shareUrl: url.toString(),
  }
}

export const createRealtimeSync = (initialState: GameState, callbacks: RealtimeCallbacks): RealtimeSync => {
  const { roomId, shareUrl } = makeShareLink()
  const tabId = crypto.randomUUID()
  const storageStateKey = `bachelor-trivia-storage-state-${roomId}`
  const document = new Y.Doc()
  const signalingServers = import.meta.env.DEV
    ? [
        'ws://127.0.0.1:4444',
        'wss://signaling.yjs.dev',
        'wss://y-webrtc-signaling-eu.herokuapp.com',
        'wss://y-webrtc-signaling-us.herokuapp.com',
      ]
    : [
        'wss://signaling.yjs.dev',
        'wss://y-webrtc-signaling-eu.herokuapp.com',
        'wss://y-webrtc-signaling-us.herokuapp.com',
      ]
  const provider = new WebrtcProvider(`bachelor-trivia-${roomId}`, document, {
    signaling: signalingServers,
  })
  const stateMap = document.getMap<string>('game-state')
  const channel = typeof window.BroadcastChannel !== 'undefined'
    ? new window.BroadcastChannel(`bachelor-trivia-local-${roomId}`)
    : null
  const localPeers = new Map<string, number>()
  const LOCAL_PEER_TTL_MS = 7000
  const HEARTBEAT_MS = 2000
  let lastRaw = ''

  const getPeerCount = () => {
    const webrtcPeers = Math.max(0, provider.awareness.getStates().size - 1)
    return Math.max(webrtcPeers, localPeers.size)
  }

  const updatePeers = () => {
    callbacks.onPeersChanged?.(getPeerCount())
  }

  const postLocal = (payload: Record<string, unknown>) => {
    if (!channel) {
      return
    }

    channel.postMessage({ ...payload, from: tabId, sentAt: Date.now() })
  }

  const pruneLocalPeers = () => {
    const now = Date.now()
    let changed = false

    for (const [peerId, lastSeen] of localPeers.entries()) {
      if (now - lastSeen > LOCAL_PEER_TTL_MS) {
        localPeers.delete(peerId)
        changed = true
      }
    }

    if (changed) {
      updatePeers()
    }
  }

  const markPeerSeen = (peerId: string) => {
    if (!peerId || peerId === tabId) {
      return
    }

    const previous = localPeers.get(peerId)
    localPeers.set(peerId, Date.now())

    if (!previous) {
      updatePeers()
    }
  }

  const publishState = (state: GameState) => {
    const raw = JSON.stringify(state)
    if (raw === lastRaw) {
      return
    }

    lastRaw = raw
    stateMap.set('state', raw)
    postLocal({ type: 'state', raw })

    try {
      window.localStorage.setItem(
        storageStateKey,
        JSON.stringify({ from: tabId, sentAt: Date.now(), raw }),
      )
    } catch {
      // Ignore localStorage write errors (e.g. quota/private mode restrictions).
    }
  }

  const syncFromMap = () => {
    const raw = stateMap.get('state')
    if (!raw || raw === lastRaw) {
      return
    }

    try {
      const remote = JSON.parse(raw) as GameState
      lastRaw = raw
      callbacks.onRemoteState(remote)
    } catch {
      // Ignore invalid payloads.
    }
  }

  stateMap.observe(syncFromMap)

  provider.awareness.on('change', updatePeers)

  const onChannelMessage = (event: MessageEvent) => {
    const data = event.data
    if (!data || typeof data !== 'object') {
      return
    }

    const from = typeof data.from === 'string' ? data.from : ''
    if (!from || from === tabId) {
      return
    }

    markPeerSeen(from)

    if (data.type === 'bye') {
      if (localPeers.delete(from)) {
        updatePeers()
      }
      return
    }

    if (data.type !== 'state' || typeof data.raw !== 'string') {
      return
    }

    const raw = data.raw
    if (raw === lastRaw) {
      return
    }

    try {
      const remote = JSON.parse(raw) as GameState
      lastRaw = raw
      stateMap.set('state', raw)
      callbacks.onRemoteState(remote)
    } catch {
      // Ignore invalid payloads.
    }
  }

  if (channel) {
    channel.addEventListener('message', onChannelMessage)
    postLocal({ type: 'hello' })
  }

  const onStorageMessage = (event: StorageEvent) => {
    if (event.key !== storageStateKey || !event.newValue) {
      return
    }

    try {
      const payload = JSON.parse(event.newValue) as { from?: string; raw?: string }
      if (!payload?.raw || payload.from === tabId || payload.raw === lastRaw) {
        return
      }

      const remote = JSON.parse(payload.raw) as GameState
      lastRaw = payload.raw
      stateMap.set('state', payload.raw)
      callbacks.onRemoteState(remote)
    } catch {
      // Ignore malformed storage payloads.
    }
  }

  window.addEventListener('storage', onStorageMessage)

  const heartbeatTimer = window.setInterval(() => {
    pruneLocalPeers()
    postLocal({ type: 'heartbeat' })
  }, HEARTBEAT_MS)

  updatePeers()

  if (stateMap.get('state')) {
    syncFromMap()
  } else {
    publishState(initialState)
  }

  return {
    shareUrl,
    publishState,
    destroy: () => {
      window.clearInterval(heartbeatTimer)
      postLocal({ type: 'bye' })
      if (channel) {
        channel.removeEventListener('message', onChannelMessage)
        channel.close()
      }
      window.removeEventListener('storage', onStorageMessage)
      stateMap.unobserve(syncFromMap)
      provider.awareness.off('change', updatePeers)
      provider.destroy()
      document.destroy()
    },
  }
}
