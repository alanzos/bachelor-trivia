export type TeamId = 'women' | 'men'

export type Team = {
  id: TeamId
  name: string
  players: string[]
  score: number
}

export type LoggedInPlayer = {
  id: string
  name: string
  teamId: TeamId
}

export type QuestionType = 'multiple-choice' | 'estimation' | 'personal'

export type MultipleChoiceQuestion = {
  id: string
  type: 'multiple-choice'
  question: string
  options: string[]
  correctOptionIndex: number
  explanation?: string
}

export type EstimationQuestion = {
  id: string
  type: 'estimation'
  question: string
  answer: number
  unit?: string
  explanation?: string
}

export type PersonalFactQuestion = {
  id: string
  type: 'personal'
  question: string
  options: string[]
  correctOptionIndex: number
  explanation?: string
  factText: string
  category?: string
  difficulty?: string
}

export type QuizQuestion = MultipleChoiceQuestion | EstimationQuestion | PersonalFactQuestion

export type QuizRound = {
  id: string
  title: string
  description: string
  type: QuestionType
  pointsPerQuestion: number
  questions: QuizQuestion[]
}

export type PersonalFactEntry = {
  id: string
  factText: string
  correctPerson: string
  difficulty?: string
  category?: string
}

export type CharadesCard = {
  id: string
  label: string
}

export type Award = {
  women: number
  men: number
}

export type TeamResponse = {
  responderId: string | null
  answerIndex: number | null
  lockedAtMs: number | null
  responseMs: number | null
}

export type QuestionResponses = Record<TeamId, TeamResponse>

export type PlayerStat = {
  answersCount: number
  correctCount: number
  totalResponseMs: number
  fastestMs: number | null
  slowestMs: number | null
}

export type Screen = 'welcome' | 'teams' | 'rules' | 'overview' | 'play' | 'charades' | 'scoreboard' | 'final'

export type CharadesTeamState = {
  deck: CharadesCard[]
  currentIndex: number
  turnComplete: boolean
}

export type CharadesState = {
  activeTeam: TeamId
  women: CharadesTeamState
  men: CharadesTeamState
  secondsLeft: number
  running: boolean
  resolved: boolean
}

export type GameState = {
  screen: Screen
  teams: Team[]
  teamReady: Record<TeamId, boolean>
  deviceLocks: Record<TeamId, string | null>
  nextQuestionReady: Record<TeamId, boolean>
  currentRoundIndex: number
  currentQuestionIndex: number
  questionStartedAtMs: number
  answerRevealed: boolean
  currentAward: Award | null
  questionResponses: QuestionResponses
  loggedInPlayers: LoggedInPlayer[]
  playerStats: Record<string, PlayerStat>
  personalFacts: PersonalFactEntry[]
  charades: CharadesState
  finished: boolean
}
