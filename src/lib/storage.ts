import type { GameState } from './types'

const STORAGE_KEY = 'bachelor-trivia-state-v9'

export const loadGameState = (): GameState | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as GameState
  } catch {
    return null
  }
}

export const saveGameState = (state: GameState) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const clearGameState = () => {
  window.localStorage.removeItem(STORAGE_KEY)
}
