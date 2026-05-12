import type { Team } from '../lib/types'

export const defaultTeams: Team[] = [
  {
    id: 'women',
    name: 'Venus Team',
    players: ['Juna', 'Taisia', 'Lia', 'Sofia', 'Roberta', 'Rita', 'Núria'],
    score: 0,
  },
  {
    id: 'men',
    name: 'Mars Team',
    players: ['Flo', 'Corrado', 'Andres', 'Panagiotis', 'Hadrien', 'David', 'Carlos', 'Rodrigo'],
    score: 0,
  },
]

export const allPlayers = defaultTeams.flatMap((team) => team.players)
