import { charadesCards } from '../data/charades'
import type { Award, CharadesCard, CharadesState, GameState, QuestionResponses, Team, TeamId } from './types'

export const getStartingBonus = (teams: Team[], teamId: TeamId) => {
  const women = teams.find((team) => team.id === 'women')
  const men = teams.find((team) => team.id === 'men')

  if (!women || !men) {
    return 0
  }

  const difference = women.players.length - men.players.length

  if (difference === 0) {
    return 0
  }

  if (difference < 0) {
    return teamId === 'women' ? Math.abs(difference) : 0
  }

  return teamId === 'men' ? difference : 0
}

export const getDisplayScore = (team: Team, teams: Team[]) => team.score + getStartingBonus(teams, team.id)

export const getWinner = (teams: Team[]) => {
  const women = teams.find((team) => team.id === 'women')
  const men = teams.find((team) => team.id === 'men')

  if (!women || !men) {
    return { winner: 'Tie', difference: 0 }
  }

  const womenScore = getDisplayScore(women, teams)
  const menScore = getDisplayScore(men, teams)

  if (womenScore > menScore) {
    return { winner: 'Venus Team', difference: womenScore - menScore }
  }

  if (menScore > womenScore) {
    return { winner: 'Mars Team', difference: menScore - womenScore }
  }

  return { winner: 'Tie', difference: 0 }
}

export const formatFinalMessage = (teams: Team[]) => {
  const result = getWinner(teams)

  if (result.winner === 'Venus Team') {
    return 'The Venus Team wins. Democracy has spoken.'
  }

  if (result.winner === 'Mars Team') {
    return 'The Mars Team wins. Suspicious, but accepted.'
  }

  return 'It is a tie. Everyone is equally unbearable.'
}

export const evaluateEstimation = (womenAnswer: number, menAnswer: number, correctAnswer: number): Award => {
  const womenDistance = Math.abs(womenAnswer - correctAnswer)
  const menDistance = Math.abs(menAnswer - correctAnswer)

  if (womenDistance === menDistance) {
    return { women: 1, men: 1 }
  }

  return womenDistance < menDistance ? { women: 2, men: 0 } : { women: 0, men: 2 }
}

export const splitCharadesCards = (): Record<'women' | 'men', CharadesCard[]> => {
  const shuffled = [...charadesCards].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, 10)

  return {
    women: selected.slice(0, 5),
    men: selected.slice(5, 10),
  }
}

export const makeCharadesState = (): CharadesState => {
  const decks = splitCharadesCards()

  return {
    activeTeam: 'women',
    women: { deck: decks.women, currentIndex: 0, turnComplete: false },
    men: { deck: decks.men, currentIndex: 0, turnComplete: false },
    secondsLeft: 60,
    running: false,
    resolved: false,
  }
}

export const getCurrentCharadesCard = (state: CharadesState) => {
  const active = state[state.activeTeam]
  return active.deck[active.currentIndex]
}

export const replaceQuestionAward = (state: GameState, award: Award): GameState => {
  const currentAward = state.currentAward ?? { women: 0, men: 0 }

  return {
    ...state,
    teams: state.teams.map((team) => ({
      ...team,
      score: team.score - currentAward[team.id] + award[team.id],
    })),
    currentAward: award,
  }
}

export const scoreMultipleChoiceResponses = (
  correctOptionIndex: number,
  responses: QuestionResponses,
): Award => {
  const womenCorrect = responses.women.answerIndex === correctOptionIndex
  const menCorrect = responses.men.answerIndex === correctOptionIndex

  if (womenCorrect && menCorrect) {
    const womenMs = responses.women.responseMs
    const menMs = responses.men.responseMs

    if (womenMs === null && menMs === null) {
      return { women: 0, men: 0 }
    }

    if (womenMs === null) {
      return { women: 0, men: 1 }
    }

    if (menMs === null) {
      return { women: 1, men: 0 }
    }

    if (womenMs === menMs) {
      return { women: 0, men: 0 }
    }

    return womenMs < menMs ? { women: 1, men: 0 } : { women: 0, men: 1 }
  }

  if (womenCorrect) {
    return { women: 1, men: 0 }
  }

  if (menCorrect) {
    return { women: 0, men: 1 }
  }

  return { women: 0, men: 0 }
}

export const clearCurrentAward = (state: GameState): GameState => ({
  ...state,
  currentAward: null,
})
