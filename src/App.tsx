import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './components/Button'
import { Panel } from './components/Panel'
import { buildQuizRounds } from './data/quiz'
import { defaultTeams } from './data/teams'
import { createRealtimeSync } from './lib/realtime'
import { clearGameState, loadGameState, saveGameState } from './lib/storage'
import {
  clearCurrentAward,
  evaluateEstimation,
  formatFinalMessage,
  getCurrentCharadesCard,
  getDisplayScore,
  getStartingBonus,
  getWinner,
  makeCharadesState,
  scoreMultipleChoiceResponses,
  replaceQuestionAward,
} from './lib/scoring'
import type {
  GameState,
  LoggedInPlayer,
  PersonalFactEntry,
  PlayerStat,
  QuestionResponses,
  QuizQuestion,
  Screen,
  Team,
  TeamId,
} from './lib/types'

const createEmptyQuestionResponses = (): QuestionResponses => ({
  women: { responderId: null, answerIndex: null, lockedAtMs: null, responseMs: null },
  men: { responderId: null, answerIndex: null, lockedAtMs: null, responseMs: null },
})

const createQuestionSession = () => ({
  questionStartedAtMs: Date.now(),
  questionResponses: createEmptyQuestionResponses(),
})

const FIXED_PLAYERS: LoggedInPlayer[] = [
  { id: 'women-captain-dev', name: 'Rita', teamId: 'women' },
  { id: 'men-captain-dev', name: 'David', teamId: 'men' },
]

const FIXED_PLAYER_IDS = new Set(FIXED_PLAYERS.map((player) => player.id))

const createInitialState = (): GameState => {
  return {
    screen: 'welcome',
    teams: defaultTeams.map((team) => ({ ...team, players: [...team.players], score: 0 })),
    teamReady: { women: false, men: false },
    deviceLocks: { women: null, men: null },
    nextQuestionReady: { women: false, men: false },
    currentRoundIndex: 0,
    currentQuestionIndex: 0,
    ...createQuestionSession(),
    answerRevealed: false,
    currentAward: null,
    personalFacts: [],
    loggedInPlayers: FIXED_PLAYERS,
    playerStats: {
      'women-captain-dev': {
        answersCount: 0,
        correctCount: 0,
        totalResponseMs: 0,
        fastestMs: Infinity,
        slowestMs: -Infinity,
      },
      'men-captain-dev': {
        answersCount: 0,
        correctCount: 0,
        totalResponseMs: 0,
        fastestMs: Infinity,
        slowestMs: -Infinity,
      },
    },
    charades: makeCharadesState(),
    finished: false,
  }
}

const normalizeLoadedState = (saved: GameState | null | undefined): GameState => {
  if (!saved) {
    return createInitialState()
  }

  return {
    ...saved,
    teamReady: saved.teamReady ?? { women: false, men: false },
    deviceLocks: saved.deviceLocks ?? { women: null, men: null },
    nextQuestionReady: saved.nextQuestionReady ?? { women: false, men: false },
  }
}

const initialState = typeof window === 'undefined' ? createInitialState() : normalizeLoadedState(loadGameState())

function App() {
  const [state, setState] = useState<GameState>(initialState)
  const [estimateInputs, setEstimateInputs] = useState({ women: '', men: '' })
  const [now, setNow] = useState(() => Date.now())
  const [activePlayerId, setActivePlayerId] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return 'women-captain-dev'
    }
    return window.sessionStorage.getItem('bachelor-trivia-player-id') ?? null
  })
  const [shareUrl, setShareUrl] = useState('')
  const [connectedPeers, setConnectedPeers] = useState(0)
  const syncRef = useRef<ReturnType<typeof createRealtimeSync> | null>(null)
  const initialStateRef = useRef(state)
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    const stored = window.localStorage.getItem('bachelor-trivia-theme')
    return stored === 'dark' || stored === null
  })
  const deviceId = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'server-device'
    }

    const key = 'bachelor-trivia-device-id'
    const existing = window.sessionStorage.getItem(key)
    if (existing) {
      return existing
    }

    const created = crypto.randomUUID()
    window.sessionStorage.setItem(key, created)
    return created
  }, [])

  const toggleTheme = () => {
    setIsDarkTheme((prev) => {
      const next = !prev
      window.localStorage.setItem('bachelor-trivia-theme', next ? 'dark' : 'light')
      return next
    })
  }

  const themeClasses = {
    main: isDarkTheme
      ? 'bg-slate-950 text-white'
      : 'bg-white text-purple-900',
    header: isDarkTheme
      ? 'border-white/10 bg-black/20'
      : 'border-purple-200 bg-purple-50/80',
    panel: isDarkTheme
      ? 'border-white/10 bg-slate-950/40'
      : 'border-purple-200 bg-purple-100/40',
    input: isDarkTheme
      ? 'border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500'
      : 'border-purple-300 bg-white text-purple-900 placeholder:text-purple-400',
    text: {
      primary: isDarkTheme ? 'text-white' : 'text-purple-900',
      secondary: isDarkTheme ? 'text-slate-300' : 'text-purple-700',
      tertiary: isDarkTheme ? 'text-slate-400' : 'text-purple-700',
    },
    pill: isDarkTheme
      ? 'bg-slate-950/60 text-white'
      : 'border border-purple-300 bg-purple-100 text-purple-900 shadow-sm shadow-purple-200/40',
    pillLabel: isDarkTheme ? 'text-slate-400' : 'text-purple-700',
    chip: isDarkTheme
      ? 'bg-white/10 text-slate-100'
      : 'border border-purple-300/80 bg-purple-100/90 text-purple-800',
  }

  const rounds = useMemo(() => buildQuizRounds(state.personalFacts), [state.personalFacts])
  const quizRound = state.currentRoundIndex < rounds.length ? rounds[state.currentRoundIndex] : null
  const currentQuestion = quizRound?.questions[state.currentQuestionIndex] ?? null
  const charadesCard = getCurrentCharadesCard(state.charades)
  const winner = getWinner(state.teams)
  const finalMessage = formatFinalMessage(state.teams)

  useEffect(() => {
    const sync = createRealtimeSync(initialStateRef.current, {
      onRemoteState: (remoteState) => {
        setState(remoteState)
      },
      onPeersChanged: setConnectedPeers,
    })

    syncRef.current = sync
    setShareUrl(sync.shareUrl)

    return () => {
      syncRef.current = null
      sync.destroy()
    }
  }, [])

  useEffect(() => {
    saveGameState(state)
    syncRef.current?.publishState(state)
  }, [state])

  useEffect(() => {
    const hasPlayers = state.loggedInPlayers.length > 0
    const activeStillExists = activePlayerId
      ? state.loggedInPlayers.some((player) => player.id === activePlayerId)
      : false

    if (activeStillExists || !hasPlayers) {
      return
    }

    const fallbackPlayer = state.loggedInPlayers[0]
    setActivePlayerId(fallbackPlayer.id)
    window.sessionStorage.setItem('bachelor-trivia-player-id', fallbackPlayer.id)
  }, [activePlayerId, state.loggedInPlayers])

  useEffect(() => {
    setState((current) => {
      const samePlayers =
        current.loggedInPlayers.length === FIXED_PLAYERS.length &&
        FIXED_PLAYERS.every((expected) =>
          current.loggedInPlayers.some(
            (player) => player.id === expected.id && player.name === expected.name && player.teamId === expected.teamId,
          ),
        )

      const womenResponse = current.questionResponses.women
      const menResponse = current.questionResponses.men
      const womenResponderValid = womenResponse.responderId === null || FIXED_PLAYER_IDS.has(womenResponse.responderId)
      const menResponderValid = menResponse.responderId === null || FIXED_PLAYER_IDS.has(menResponse.responderId)

      if (samePlayers && womenResponderValid && menResponderValid) {
        return current
      }

      return {
        ...current,
        loggedInPlayers: FIXED_PLAYERS,
        questionResponses: {
          women: womenResponderValid ? womenResponse : { ...womenResponse, responderId: null },
          men: menResponderValid ? menResponse : { ...menResponse, responderId: null },
        },
      }
    })
  }, [state.loggedInPlayers, state.questionResponses.women.responderId, state.questionResponses.men.responderId])

  useEffect(() => {
    if (state.screen !== 'play') {
      return undefined
    }

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [state.screen, state.currentRoundIndex, state.currentQuestionIndex, state.questionStartedAtMs])

  useEffect(() => {
    if (state.screen !== 'charades' || !state.charades.running || state.charades.secondsLeft <= 0) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.screen !== 'charades' || !current.charades.running || current.charades.secondsLeft <= 0) {
          return current
        }

        const nextSeconds = current.charades.secondsLeft - 1

        return {
          ...current,
          charades: {
            ...current.charades,
            secondsLeft: nextSeconds,
            running: nextSeconds > 0,
          },
        }
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [state.screen, state.charades.running, state.charades.secondsLeft])

  useEffect(() => {
    if (state.screen !== 'play' || state.answerRevealed) {
      return undefined
    }

    const womenAnswered = state.questionResponses.women.answerIndex !== null
    const menAnswered = state.questionResponses.men.answerIndex !== null

    if (!womenAnswered || !menAnswered) {
      return undefined
    }

    if (!currentQuestion) {
      return undefined
    }

    setState((current) => {
      if (current.answerRevealed) {
        return current
      }

      const award =
        currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'personal'
          ? scoreMultipleChoiceResponses(currentQuestion.correctOptionIndex, current.questionResponses)
          : evaluateEstimation(
              Number(estimateInputs.women),
              Number(estimateInputs.men),
              currentQuestion.type === 'estimation' ? currentQuestion.answer : 0,
            )

      const nextPlayerStats: Record<string, PlayerStat> = { ...current.playerStats }

      ;(['women', 'men'] as TeamId[]).forEach((teamId) => {
        const response = current.questionResponses[teamId]
        if (!response.responderId || response.responseMs === null || response.answerIndex === null) {
          return
        }

        const isCorrect =
          currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'personal'
            ? response.answerIndex === currentQuestion.correctOptionIndex
            : award[teamId] > 0

        const currentStats = nextPlayerStats[response.responderId] ?? {
          answersCount: 0,
          correctCount: 0,
          totalResponseMs: 0,
          fastestMs: null,
          slowestMs: null,
        }

        nextPlayerStats[response.responderId] = {
          answersCount: currentStats.answersCount + 1,
          correctCount: currentStats.correctCount + (isCorrect ? 1 : 0),
          totalResponseMs: currentStats.totalResponseMs + response.responseMs,
          fastestMs:
            currentStats.fastestMs === null
              ? response.responseMs
              : Math.min(currentStats.fastestMs, response.responseMs),
          slowestMs:
            currentStats.slowestMs === null
              ? response.responseMs
              : Math.max(currentStats.slowestMs, response.responseMs),
        }
      })

      return replaceQuestionAward(
        {
          ...current,
          answerRevealed: true,
          nextQuestionReady: { women: false, men: false },
          playerStats: nextPlayerStats,
        },
        award,
      )
    })

    return undefined
  }, [
    state.screen,
    state.answerRevealed,
    state.questionResponses.women.answerIndex,
    state.questionResponses.men.answerIndex,
  ])

  const teams = state.teams
  const womenTeam = teams.find((team) => team.id === 'women') as Team
  const menTeam = teams.find((team) => team.id === 'men') as Team
  const womenScore = getDisplayScore(womenTeam, teams)
  const menScore = getDisplayScore(menTeam, teams)
  const womenBonus = getStartingBonus(teams, 'women')
  const menBonus = getStartingBonus(teams, 'men')
  const questionElapsedSeconds = Math.max(0, Math.floor((now - state.questionStartedAtMs) / 1000))
  const playersByTeam = {
    women: state.loggedInPlayers.filter((player) => player.teamId === 'women'),
    men: state.loggedInPlayers.filter((player) => player.teamId === 'men'),
  }
  const womenCount = playersByTeam.women.length
  const menCount = playersByTeam.men.length
  const teamDelta = Math.abs(womenCount - menCount)
  const smallerTeam = womenCount < menCount ? 'women' : menCount < womenCount ? 'men' : null
  const balancingPoints = teamDelta
  
  const activePlayer = state.loggedInPlayers.find((player) => player.id === activePlayerId) ?? null
  const bothCaptainsReady = state.teamReady.women && state.teamReady.men
  const womenLocked = state.deviceLocks.women !== null
  const menLocked = state.deviceLocks.men !== null
  const connectedPlayersCount = Number(womenLocked) + Number(menLocked)
  const locksAreDifferentDevices =
    state.deviceLocks.women !== null &&
    state.deviceLocks.men !== null &&
    state.deviceLocks.women !== state.deviceLocks.men
  const roundOneUnlocked = womenLocked && menLocked && locksAreDifferentDevices
  const myLockedTeam = (['women', 'men'] as TeamId[]).find((teamId) => state.deviceLocks[teamId] === deviceId) ?? null

  useEffect(() => {
    if (state.screen !== 'welcome' || !roundOneUnlocked) {
      return
    }

    setState((current) => {
      if (current.screen !== 'welcome') {
        return current
      }

      return {
        ...current,
        screen: 'rules',
        teamReady: { women: false, men: false },
      }
    })
  }, [state.screen, roundOneUnlocked])

  useEffect(() => {
    if (state.screen !== 'rules' || !bothCaptainsReady) {
      return
    }

    startRound(0)
  }, [state.screen, bothCaptainsReady])

  const playerStatRows = state.loggedInPlayers.map((player) => {
    const stats = state.playerStats[player.id] ?? {
      answersCount: 0,
      correctCount: 0,
      totalResponseMs: 0,
      fastestMs: null,
      slowestMs: null,
    }

    return {
      player,
      stats,
      accuracy: stats.answersCount > 0 ? Math.round((stats.correctCount / stats.answersCount) * 100) : 0,
      avgMs: stats.answersCount > 0 ? Math.round(stats.totalResponseMs / stats.answersCount) : null,
    }
  })

  const answeredRows = playerStatRows.filter((row) => row.stats.answersCount > 0)
  const fastestPlayer = answeredRows.reduce<typeof answeredRows[number] | null>((best, row) => {
    if (row.stats.fastestMs === null) {
      return best
    }
    if (!best || best.stats.fastestMs === null || row.stats.fastestMs < best.stats.fastestMs) {
      return row
    }
    return best
  }, null)
  const slowestPlayer = answeredRows.reduce<typeof answeredRows[number] | null>((best, row) => {
    if (row.stats.slowestMs === null) {
      return best
    }
    if (!best || best.stats.slowestMs === null || row.stats.slowestMs > best.stats.slowestMs) {
      return row
    }
    return best
  }, null)
  const mostCorrectPlayer = answeredRows.reduce<typeof answeredRows[number] | null>((best, row) => {
    if (!best || row.stats.correctCount > best.stats.correctCount) {
      return row
    }
    return best
  }, null)
  const leastCorrectPlayer = answeredRows.reduce<typeof answeredRows[number] | null>((best, row) => {
    if (!best || row.stats.correctCount < best.stats.correctCount) {
      return row
    }
    return best
  }, null)
  const mostAnsweredPlayer = playerStatRows.reduce<typeof playerStatRows[number] | null>((best, row) => {
    if (!best || row.stats.answersCount > best.stats.answersCount) {
      return row
    }
    return best
  }, null)
  const leastAnsweredPlayer = playerStatRows.reduce<typeof playerStatRows[number] | null>((best, row) => {
    if (!best || row.stats.answersCount < best.stats.answersCount) {
      return row
    }
    return best
  }, null)

  const setScreen = (screen: Screen) => setState((current) => ({ ...current, screen }))

  const updateTeams = (updater: (items: Team[]) => Team[]) => {
    setState((current) => ({ ...current, teams: updater(current.teams) }))
  }

  const updateTeamPlayers = (teamId: TeamId, players: string[]) => {
    updateTeams((items) => items.map((team) => (team.id === teamId ? { ...team, players } : team)))
  }

  const adjustScore = (teamId: TeamId, delta: number) => {
    setState((current) => ({
      ...current,
      teams: current.teams.map((team) => (team.id === teamId ? { ...team, score: team.score + delta } : team)),
    }))
  }

  const revealAnswer = () => {
    if (!currentQuestion) {
      return
    }

    setState((current) => {
      if (current.answerRevealed) {
        return current
      }

      const award =
        currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'personal'
          ? scoreMultipleChoiceResponses(currentQuestion.correctOptionIndex, current.questionResponses)
          : evaluateEstimation(
              Number(estimateInputs.women),
              Number(estimateInputs.men),
              currentQuestion.type === 'estimation' ? currentQuestion.answer : 0,
            )

      const nextPlayerStats: Record<string, PlayerStat> = { ...current.playerStats }

      ;(['women', 'men'] as TeamId[]).forEach((teamId) => {
        const response = current.questionResponses[teamId]
        if (!response.responderId || response.responseMs === null || response.answerIndex === null) {
          return
        }

        const isCorrect =
          currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'personal'
            ? response.answerIndex === currentQuestion.correctOptionIndex
            : award[teamId] > 0

        const currentStats = nextPlayerStats[response.responderId] ?? {
          answersCount: 0,
          correctCount: 0,
          totalResponseMs: 0,
          fastestMs: null,
          slowestMs: null,
        }

        nextPlayerStats[response.responderId] = {
          answersCount: currentStats.answersCount + 1,
          correctCount: currentStats.correctCount + (isCorrect ? 1 : 0),
          totalResponseMs: currentStats.totalResponseMs + response.responseMs,
          fastestMs:
            currentStats.fastestMs === null
              ? response.responseMs
              : Math.min(currentStats.fastestMs, response.responseMs),
          slowestMs:
            currentStats.slowestMs === null
              ? response.responseMs
              : Math.max(currentStats.slowestMs, response.responseMs),
        }
      })

      return replaceQuestionAward(
        {
          ...current,
          answerRevealed: true,
          nextQuestionReady: { women: false, men: false },
          playerStats: nextPlayerStats,
        },
        award,
      )
    })
  }

  const startRound = (roundIndex: number) => {
    if (roundIndex === 4) {
      setState((current) => ({
        ...current,
        screen: 'charades',
        currentRoundIndex: 4,
        currentQuestionIndex: 0,
        answerRevealed: false,
        currentAward: null,
      }))
      setEstimateInputs({ women: '', men: '' })
      return
    }

    setState((current) => ({
      ...current,
      screen: 'play',
      currentRoundIndex: roundIndex,
      currentQuestionIndex: 0,
      answerRevealed: false,
      currentAward: null,
      nextQuestionReady: { women: false, men: false },
      ...createQuestionSession(),
    }))
    setEstimateInputs({ women: '', men: '' })
  }

  const continueSequentialRound = () => {
    if (state.currentRoundIndex >= 3) {
      startRound(4)
      return
    }

    startRound(state.currentRoundIndex + 1)
  }

  const lockActiveIdentityOnThisDevice = () => {
    if (!activePlayer) {
      return
    }

    const teamId = activePlayer.teamId
    const otherTeamId: TeamId = teamId === 'women' ? 'men' : 'women'

    setState((current) => {
      if (current.deviceLocks[otherTeamId] === deviceId) {
        return current
      }

      return {
        ...current,
        deviceLocks: {
          ...current.deviceLocks,
          [teamId]: deviceId,
        },
      }
    })
  }

  const unlockMyIdentity = (teamId: TeamId) => {
    setState((current) => {
      if (current.deviceLocks[teamId] !== deviceId) {
        return current
      }

      return {
        ...current,
        deviceLocks: {
          ...current.deviceLocks,
          [teamId]: null,
        },
        teamReady: {
          ...current.teamReady,
          [teamId]: false,
        },
      }
    })
  }

  const updateFacts = (facts: PersonalFactEntry[]) => {
    setState((current) => ({ ...current, personalFacts: facts }))
  }

  const updateCharades = (patch: Partial<GameState['charades']>) => {
    setState((current) => ({ ...current, charades: { ...current.charades, ...patch } }))
  }

  const copyShareLink = () => {
    if (!shareUrl) {
      return
    }

    window.navigator.clipboard.writeText(shareUrl).catch(() => undefined)
  }

  const setTeamAnswer = (teamId: TeamId, answerIndex: number) => {
    setState((current) => {
      const currentResponse = current.questionResponses[teamId]
      const lockedAtMs = Date.now()
      const responderId = currentResponse.responderId ?? activePlayerId

      return {
        ...current,
        questionResponses: {
          ...current.questionResponses,
          [teamId]: {
            answerIndex,
            responderId,
            lockedAtMs,
            responseMs: lockedAtMs - current.questionStartedAtMs,
          },
        },
        nextQuestionReady: {
          ...current.nextQuestionReady,
          [teamId]: false,
        },
      }
    })
  }

  const markNextQuestionReady = () => {
    if (!activePlayer || !quizRound || !state.answerRevealed) {
      return
    }

    const teamId = activePlayer.teamId

    setState((current) => {
      if (!current.answerRevealed || current.nextQuestionReady[teamId]) {
        return current
      }

      const nextReady: Record<TeamId, boolean> = {
        ...current.nextQuestionReady,
        [teamId]: true,
      }

      if (!(nextReady.women && nextReady.men)) {
        return {
          ...current,
          nextQuestionReady: nextReady,
        }
      }

      const currentRound = rounds[current.currentRoundIndex]
      const base = clearCurrentAward({
        ...current,
        answerRevealed: false,
      })

      if (!currentRound) {
        return {
          ...base,
          nextQuestionReady: { women: false, men: false },
        }
      }

      if (current.currentQuestionIndex < currentRound.questions.length - 1) {
        return {
          ...base,
          currentQuestionIndex: current.currentQuestionIndex + 1,
          screen: 'play',
          nextQuestionReady: { women: false, men: false },
          ...createQuestionSession(),
        }
      }

      return {
        ...base,
        screen: 'scoreboard',
        currentQuestionIndex: 0,
        nextQuestionReady: { women: false, men: false },
        ...createQuestionSession(),
      }
    })

    setEstimateInputs({ women: '', men: '' })
  }

  const correctCharadesCard = (points: number) => {
    setState((current) => {
      if (current.charades.resolved) {
        return current
      }

      return {
        ...current,
        teams: current.teams.map((team) =>
          team.id === current.charades.activeTeam ? { ...team, score: team.score + points } : team,
        ),
        charades: { ...current.charades, resolved: true },
      }
    })
  }

  const nextCharadesCard = () => {
    setState((current) => {
      const active = current.charades.activeTeam
      const currentTeam = current.charades[active]

      if (currentTeam.currentIndex >= currentTeam.deck.length - 1) {
        return current
      }

      return {
        ...current,
        charades: {
          ...current.charades,
          [active]: { ...currentTeam, currentIndex: currentTeam.currentIndex + 1 },
          secondsLeft: 60,
          running: false,
          resolved: false,
        },
      }
    })
  }

  const endCharadesTurn = () => {
    setState((current) => {
      const active = current.charades.activeTeam
      const activeState = current.charades[active]
      const nextCharadesState = {
        ...current.charades,
        [active]: { ...activeState, turnComplete: true },
      }

      if (nextCharadesState.women.turnComplete && nextCharadesState.men.turnComplete) {
        return {
          ...current,
          screen: 'final',
          finished: true,
          charades: nextCharadesState,
        }
      }

      return {
        ...current,
        charades: {
          ...nextCharadesState,
          activeTeam: active === 'women' ? 'men' : 'women',
          secondsLeft: 60,
          running: false,
          resolved: false,
        },
      }
    })
  }

  const resetGame = () => {
    clearGameState()
    setState(createInitialState())
    setActivePlayerId('women-captain-dev')
    window.sessionStorage.setItem('bachelor-trivia-player-id', 'women-captain-dev')
    setEstimateInputs({ women: '', men: '' })
  }

  const confirmAndResetGame = () => {
    const confirmed = window.confirm('Are you sure you want to reset the game? It will delete all answers and you will have to start again')
    if (!confirmed) {
      return
    }

    resetGame()
  }

  const renderMultipleChoice = (question: QuizQuestion) => {
    if (question.type === 'estimation') {
      return null
    }

    const formatResponseTime = (responseMs: number | null) => {
      if (responseMs === null) {
        return `${questionElapsedSeconds}s`
      }

      return `${(responseMs / 1000).toFixed(1)}s`
    }

    const renderTeamAnswerPanel = (teamId: TeamId, teamLabel: string) => {
      const response = state.questionResponses[teamId]
      const teamPlayers = playersByTeam[teamId]

      return (
        <Panel isDarkTheme={isDarkTheme} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-sm uppercase tracking-[0.3em] ${themeClasses.pillLabel}`}>{teamLabel}</p>
              <h3 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>Submit answer</h3>
            </div>
            <div className={`rounded-2xl px-4 py-2 text-right ${themeClasses.pill}`}>
              <p className={`text-xs ${themeClasses.text.tertiary}`}>Connected players: {connectedPlayersCount}/2</p>
              <p className={`text-xl font-black ${themeClasses.text.primary}`}>{formatResponseTime(response.responseMs)}</p>
            </div>
          </div>

          {teamPlayers.length === 0 ? (
            <p className="text-sm text-purple-900">No logged-in players on this team yet. Add them in Team setup.</p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((option, index) => {
              const isSelected = response.answerIndex === index

              return (
                <Button
                  key={`${teamId}-${option}`}
                  isDarkTheme={isDarkTheme}
                  variant={isSelected ? 'primary' : 'ghost'}
                  className="justify-start text-left"
                  onClick={() => setTeamAnswer(teamId, index)}
                  disabled={state.answerRevealed}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </Button>
              )
            })}
          </div>

          <div className={`rounded-2xl border p-4 text-sm ${isDarkTheme ? 'border-white/10 bg-white/5 text-slate-200' : 'border-purple-300 bg-purple-50 text-purple-900'}`}>
            <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>
              Selected: {response.answerIndex === null ? 'No answer yet' : `${String.fromCharCode(65 + response.answerIndex)}. ${question.options[response.answerIndex]}`}
            </p>
            <p>Answered after {formatResponseTime(response.responseMs)} from question start.</p>
          </div>
        </Panel>
      )
    }

    const renderTeamRevealPanel = (teamId: TeamId) => {
      const ownTeamId = teamId
      const oppositeTeamId: TeamId = ownTeamId === 'women' ? 'men' : 'women'
      const ownLabel = ownTeamId === 'women' ? 'Venus Team' : 'Mars Team'
      const oppositeLabel = oppositeTeamId === 'women' ? 'Venus Team' : 'Mars Team'

      const ownResponse = state.questionResponses[ownTeamId]
      const oppositeResponse = state.questionResponses[oppositeTeamId]
      const ownResponseMs = ownResponse.responseMs
      const oppositeResponseMs = oppositeResponse.responseMs
      const ownCorrect = ownResponse.answerIndex === question.correctOptionIndex
      const oppositeCorrect = oppositeResponse.answerIndex === question.correctOptionIndex
      const bothCorrect = ownCorrect && oppositeCorrect
      const bothAnsweredWithTime = ownResponseMs !== null && oppositeResponseMs !== null

      const revealMessage = (() => {
        if (bothCorrect && bothAnsweredWithTime) {
          const gapSeconds = Math.abs(ownResponseMs - oppositeResponseMs) / 1000

          if (ownResponseMs > oppositeResponseMs) {
            return `Pity, you got the right answer but ${gapSeconds.toFixed(1)} seconds slower than ${oppositeLabel}`
          }

          if (ownResponseMs < oppositeResponseMs) {
            return `Amazing, you got the right answer ${gapSeconds.toFixed(1)} seconds faster than ${oppositeLabel}`
          }
        }

        return ownCorrect ? 'Nice, you got the right answer' : 'Nope, you selected an incorrect answer'
      })()

      const getAnswerSpeedLabel = (responseMs: number | null, otherResponseMs: number | null, isCorrect: boolean) => {
        if (!isCorrect) {
          return 'Incorrect'
        }

        if (bothCorrect && responseMs !== null && otherResponseMs !== null) {
          if (responseMs < otherResponseMs) {
            return 'Correct and Fastest'
          }

          if (responseMs > otherResponseMs) {
            return 'Correct but Slowest'
          }
        }

        return 'Correct'
      }

      const ownStatusLabel = getAnswerSpeedLabel(ownResponseMs, oppositeResponseMs, ownCorrect)
      const oppositeStatusLabel = getAnswerSpeedLabel(oppositeResponseMs, ownResponseMs, oppositeCorrect)
      const ownIsNegative = ownStatusLabel.includes('Slowest') || ownStatusLabel === 'Incorrect'
      const oppositeIsNegative = oppositeStatusLabel.includes('Slowest') || oppositeStatusLabel === 'Incorrect'
      const revealMessageClass = revealMessage.startsWith('Pity') || !ownCorrect
        ? (isDarkTheme ? 'text-rose-200' : 'text-rose-700')
        : (isDarkTheme ? 'text-emerald-200' : 'text-emerald-700')

      const formatTeamAnswer = (response: typeof ownResponse) =>
        response.answerIndex === null ? 'No answer submitted' : `${String.fromCharCode(65 + response.answerIndex)}. ${question.options[response.answerIndex]}`

      return (
        <Panel isDarkTheme={isDarkTheme} className="bg-emerald-500/10">
          <div className="space-y-3">
            <p className={`text-lg font-semibold ${revealMessageClass}`}>
              {revealMessage}
            </p>
            <div className="space-y-3 text-sm">
              <div className={`grid grid-cols-[1fr_auto] gap-3 rounded-xl border p-3 ${isDarkTheme ? 'border-white/10 bg-white/5' : 'border-purple-200 bg-white/80'}`}>
                <div>
                  <p className={`${isDarkTheme ? 'text-slate-300' : 'text-purple-800'}`}>{ownLabel}</p>
                  <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>{formatTeamAnswer(ownResponse)}</p>
                </div>
                <div className="text-right">
                  <p className={`${isDarkTheme ? 'text-slate-300' : 'text-purple-800'}`}>{formatResponseTime(ownResponse.responseMs)}</p>
                  <p className={`font-semibold ${ownIsNegative ? (isDarkTheme ? 'text-rose-300' : 'text-rose-600') : (isDarkTheme ? 'text-emerald-300' : 'text-emerald-600')}`}>
                    {ownStatusLabel}
                  </p>
                </div>
              </div>

              <div className={`grid grid-cols-[1fr_auto] gap-3 rounded-xl border p-3 ${isDarkTheme ? 'border-white/10 bg-white/5' : 'border-purple-200 bg-white/80'}`}>
                <div>
                  <p className={`${isDarkTheme ? 'text-slate-300' : 'text-purple-800'}`}>{oppositeLabel}</p>
                  <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>{formatTeamAnswer(oppositeResponse)}</p>
                </div>
                <div className="text-right">
                  <p className={`${isDarkTheme ? 'text-slate-300' : 'text-purple-800'}`}>{formatResponseTime(oppositeResponse.responseMs)}</p>
                  <p className={`font-semibold ${oppositeIsNegative ? (isDarkTheme ? 'text-rose-300' : 'text-rose-600') : (isDarkTheme ? 'text-emerald-300' : 'text-emerald-600')}`}>
                    {oppositeStatusLabel}
                  </p>
                </div>
              </div>

              <div className={`grid grid-cols-[1fr_auto] gap-3 rounded-xl border p-3 ${isDarkTheme ? 'border-emerald-300/40 bg-emerald-500/10' : 'border-emerald-300 bg-emerald-50'}`}>
                <p className={`${isDarkTheme ? 'text-emerald-100' : 'text-emerald-800'}`}>Correct answer</p>
                <p className={`font-semibold ${isDarkTheme ? 'text-emerald-200' : 'text-emerald-700'}`}>
                  {String.fromCharCode(65 + question.correctOptionIndex)}. {question.options[question.correctOptionIndex]}
                </p>
              </div>
            </div>
          </div>
        </Panel>
      )
    }

    if (!activePlayer) {
      return (
        <Panel isDarkTheme={isDarkTheme} className="border-rose-300/50 bg-rose-500/10">
          <p className={`text-sm ${isDarkTheme ? 'text-rose-200' : 'text-rose-700'}`}>
            Choose an active player on this device before answering.
          </p>
        </Panel>
      )
    }

    return (
      <div className="space-y-5">
        {state.answerRevealed
          ? renderTeamRevealPanel(activePlayer.teamId)
          : renderTeamAnswerPanel(activePlayer.teamId, activePlayer.teamId === 'women' ? 'Venus Team' : 'Mars Team')}
      </div>
    )
  }

  const renderEstimation = (question: QuizQuestion) => {
    if (question.type !== 'estimation') {
      return null
    }

    const teamInput = activePlayer?.teamId === 'women' ? 'women' : activePlayer?.teamId === 'men' ? 'men' : null

    if (!teamInput && !state.answerRevealed) {
      return (
        <Panel isDarkTheme={isDarkTheme} className="border-rose-300/50 bg-rose-500/10">
          <p className={`text-sm ${isDarkTheme ? 'text-rose-200' : 'text-rose-700'}`}>
            Choose an active player on this device before answering.
          </p>
        </Panel>
      )
    }

    return (
      <div className="space-y-5">
        <p className={`text-lg ${isDarkTheme ? 'text-slate-200' : 'text-purple-800'}`}>Teams submit a number. Closest answer gets 2 points.</p>
        <div className={state.answerRevealed || teamInput === null ? 'grid gap-4 md:grid-cols-2' : ''}>
          {state.answerRevealed || teamInput === null ? (
            <>
              <label className="space-y-2">
                <span className={`text-sm font-semibold ${isDarkTheme ? 'text-slate-300' : 'text-purple-700'}`}>Venus Team answer</span>
                <input
                  type="number"
                  value={estimateInputs.women}
                  onChange={(event) => setEstimateInputs((current) => ({ ...current, women: event.target.value }))}
                  className={`w-full rounded-2xl border px-4 py-3 text-lg outline-none ${isDarkTheme ? 'border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500' : 'border-purple-300 bg-purple-50 text-purple-900 placeholder:text-purple-400'}`}
                  placeholder="Enter guess"
                  disabled={!state.answerRevealed && teamInput !== null && teamInput !== 'women'}
                />
              </label>
              <label className="space-y-2">
                <span className={`text-sm font-semibold ${isDarkTheme ? 'text-slate-300' : 'text-purple-700'}`}>Mars Team answer</span>
                <input
                  type="number"
                  value={estimateInputs.men}
                  onChange={(event) => setEstimateInputs((current) => ({ ...current, men: event.target.value }))}
                  className={`w-full rounded-2xl border px-4 py-3 text-lg outline-none ${isDarkTheme ? 'border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500' : 'border-purple-300 bg-purple-50 text-purple-900 placeholder:text-purple-400'}`}
                  placeholder="Enter guess"
                  disabled={!state.answerRevealed && teamInput !== null && teamInput !== 'men'}
                />
              </label>
            </>
          ) : (
            <label className="space-y-2">
              <span className={`text-sm font-semibold ${isDarkTheme ? 'text-slate-300' : 'text-purple-700'}`}>{teamInput === 'women' ? 'Venus Team answer' : 'Mars Team answer'}</span>
              <input
                type="number"
                value={estimateInputs[teamInput]}
                onChange={(event) => setEstimateInputs((current) => ({ ...current, [teamInput!]: event.target.value }))}
                className={`w-full rounded-2xl border px-4 py-3 text-lg outline-none ${isDarkTheme ? 'border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500' : 'border-purple-300 bg-purple-50 text-purple-900 placeholder:text-purple-400'}`}
                placeholder="Enter guess"
              />
            </label>
          )}
        </div>

        {state.answerRevealed ? (
          <Panel isDarkTheme={isDarkTheme} className="bg-emerald-500/10">
            <div className="space-y-3">
              <p className={`text-sm uppercase tracking-[0.3em] ${isDarkTheme ? 'text-emerald-200' : 'text-emerald-700'}`}>Answer revealed</p>
              <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>
                {question.answer}
                {question.unit ? ` ${question.unit}` : ''}
              </p>
              {question.explanation ? <p className={themeClasses.text.secondary}>{question.explanation}</p> : null}
            </div>
          </Panel>
        ) : null}
      </div>
    )
  }

  const roundOverviewItems = [
    ...rounds.map((round) => ({ title: round.title, description: round.description })),
    { title: 'Silent charades', description: '60-second acting cards, no speaking, no numbers, one card at a time.' },
  ]

  const renderScreen = (screen: Screen) => {
    switch (screen) {
      case 'welcome':
        return (
          <div className="space-y-6 text-center">
            <div className="space-y-4">
            </div>

            <Panel isDarkTheme={isDarkTheme} className="mx-auto max-w-2xl space-y-4 text-left">
              <div>
                <h2 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>Who are you?</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {FIXED_PLAYERS.map((player) => (
                  <Button
                    key={player.id}
                    isDarkTheme={isDarkTheme}
                    variant={activePlayerId === player.id ? 'primary' : 'secondary'}
                    onClick={() => {
                      setActivePlayerId(player.id)
                      window.sessionStorage.setItem('bachelor-trivia-player-id', player.id)
                    }}
                  >
                    {player.name} ({player.teamId === 'women' ? 'Venus Team' : 'Mars Team'})
                  </Button>
                ))}
              </div>

              {activePlayer ? (
                <p className={`text-sm ${themeClasses.text.primary}`}>
                  You are logged in as <strong>{activePlayer.name}</strong> ({activePlayer.teamId === 'women' ? 'Venus Team' : 'Mars Team'}).
                </p>
              ) : (
                <p className={`text-sm ${themeClasses.text.secondary}`}>Select Rita or David to continue.</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  isDarkTheme={isDarkTheme}
                  variant="primary"
                  onClick={lockActiveIdentityOnThisDevice}
                  disabled={!activePlayer || (myLockedTeam !== null && activePlayer.teamId !== myLockedTeam)}
                >
                  Lock this device as {activePlayer ? `${activePlayer.name} (${activePlayer.teamId === 'women' ? 'Venus Team' : 'Mars Team'})` : 'selected player'}
                </Button>
                {myLockedTeam ? (
                  <Button isDarkTheme={isDarkTheme} variant="ghost" onClick={() => unlockMyIdentity(myLockedTeam)}>
                    Unlock this device ({myLockedTeam === 'women' ? 'Rita' : 'David'})
                  </Button>
                ) : null}
              </div>

              <div className={`rounded-2xl border px-4 py-3 text-sm ${isDarkTheme ? 'border-white/10 bg-slate-950/40 text-slate-200' : 'border-purple-300 bg-purple-50 text-purple-800'}`}>
                <p>Venus Team: <strong>{state.deviceLocks.women ? 'Ready' : 'Pending'}</strong></p>
                <p>Mars Team: <strong>{state.deviceLocks.men ? 'Ready' : 'Pending'}</strong></p>
                {!roundOneUnlocked && connectedPeers === 0 ? (
                  <p className={`mt-2 ${isDarkTheme ? 'text-amber-200' : 'text-amber-700'}`}>
                    Devices are not connected yet. Open the same room link on both devices in regular browsers, then lock Rita and David until Connected players shows 2/2.
                  </p>
                ) : null}
              </div>
            </Panel>

          </div>
        )
      case 'teams':
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-purple-800">Team setup</p>
                <h2 className={`text-3xl font-black ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>Edit the two teams</h2>
              </div>
              <Button isDarkTheme={isDarkTheme} variant="primary" onClick={() => setScreen('rules')}>Continue to rules</Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {teams.map((team) => (
                <Panel isDarkTheme={isDarkTheme} key={team.id} className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className={`text-2xl font-bold ${themeClasses.text.primary}`}>{team.name}</h3>
                      <p className={`text-sm ${themeClasses.text.secondary}`}>Starting bonus is recalculated from team sizes.</p>
                    </div>
                    <div className={`rounded-2xl px-4 py-2 text-right ${themeClasses.pill}`}>
                      <p className={`text-xs uppercase tracking-[0.3em] ${themeClasses.pillLabel}`}>Bonus</p>
                      <p className={`text-3xl font-black ${themeClasses.text.primary}`}>{getStartingBonus(teams, team.id)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {team.players.map((player, index) => (
                      <div key={`${team.id}-${player}-${index}`} className="flex gap-2">
                        <input
                          className={`flex-1 rounded-2xl border px-4 py-3 outline-none ${themeClasses.input}`}
                          value={player}
                          onChange={(event) => {
                            const next = [...team.players]
                            next[index] = event.target.value
                            updateTeamPlayers(team.id, next)
                          }}
                        />
                        <Button isDarkTheme={isDarkTheme} variant="ghost" onClick={() => updateTeamPlayers(team.id, team.players.filter((_, currentIndex) => currentIndex !== index))}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button isDarkTheme={isDarkTheme} variant="ghost" onClick={() => updateTeamPlayers(team.id, [...team.players, ''])}>Add player</Button>
                </Panel>
              ))}
            </div>

            <Panel isDarkTheme={isDarkTheme} className="space-y-4">
              <div>
                <h3 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Player identity</h3>
                <p className={`text-sm ${themeClasses.text.secondary}`}>Locked to Rita (Venus Team) and David (Mars Team). No additional players are allowed.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {(['women', 'men'] as TeamId[]).map((teamId) => (
                  <div key={teamId} className={isDarkTheme ? 'rounded-2xl border border-white/10 bg-slate-950/40 p-4' : 'rounded-2xl border border-purple-300 bg-purple-50 p-4'}>
                    <p className={`text-sm uppercase tracking-[0.3em] ${themeClasses.pillLabel}`}>
                      {teamId === 'women' ? 'Venus Team' : 'Mars Team'}
                    </p>
                    <div className="mt-3 space-y-2">
                      {playersByTeam[teamId].length === 0 ? (
                        <p className={`text-sm ${themeClasses.text.tertiary}`}>No players logged in yet.</p>
                      ) : (
                        playersByTeam[teamId].map((player) => (
                          <div key={player.id} className={isDarkTheme ? 'flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2' : 'flex items-center justify-between gap-3 rounded-xl border border-purple-200 bg-purple-100 px-3 py-2'}>
                            <span className={themeClasses.text.primary}>{player.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel isDarkTheme={isDarkTheme} className="space-y-4">
              <div>
                <h3 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Personal facts admin</h3>
                <p className={`text-sm ${themeClasses.text.secondary}`}>
                  Add custom facts here. If none are entered, the fallback group trivia round is used.
                </p>
              </div>

              <div className="space-y-3">
                {state.personalFacts.map((fact, index) => (
                  <div key={fact.id} className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3 md:grid-cols-4">
                    <input
                      className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                      value={fact.factText}
                      placeholder="Fact text"
                      onChange={(event) => {
                        const next = [...state.personalFacts]
                        next[index] = { ...next[index], factText: event.target.value }
                        updateFacts(next)
                      }}
                    />
                    <input
                      className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                      value={fact.correctPerson}
                      placeholder="Correct person"
                      onChange={(event) => {
                        const next = [...state.personalFacts]
                        next[index] = { ...next[index], correctPerson: event.target.value }
                        updateFacts(next)
                      }}
                    />
                    <input
                      className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                      value={fact.category ?? ''}
                      placeholder="Category"
                      onChange={(event) => {
                        const next = [...state.personalFacts]
                        next[index] = { ...next[index], category: event.target.value }
                        updateFacts(next)
                      }}
                    />
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                        value={fact.difficulty ?? ''}
                        placeholder="Difficulty"
                        onChange={(event) => {
                          const next = [...state.personalFacts]
                          next[index] = { ...next[index], difficulty: event.target.value }
                          updateFacts(next)
                        }}
                      />
                      <Button isDarkTheme={isDarkTheme} variant="ghost" onClick={() => updateFacts(state.personalFacts.filter((_, currentIndex) => currentIndex !== index))}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                isDarkTheme={isDarkTheme}
                variant="ghost"
                onClick={() =>
                  updateFacts([
                    ...state.personalFacts,
                    { id: crypto.randomUUID(), factText: '', correctPerson: '', category: '', difficulty: '' },
                  ])
                }
              >
                Add personal fact
              </Button>
            </Panel>

            <Panel>
              <p className={themeClasses.text.primary}>Venus Team bonus: {womenBonus} | Mars Team bonus: {menBonus}</p>
              <p className={themeClasses.text.secondary}>
                Venus Team starts with {womenBonus} bonus point{womenBonus === 1 ? '' : 's'} because it has {Math.abs(teams[0].players.length - teams[1].players.length)} fewer player{Math.abs(teams[0].players.length - teams[1].players.length) === 1 ? '' : 's'}.
              </p>
            </Panel>
          </div>
        )
      case 'rules':
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-purple-800">Rules</p>
              <h2 className={`text-3xl font-black ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>Keep it simple</h2>
            </div>

            <Panel isDarkTheme={isDarkTheme}>
              <ul className={`grid gap-3 text-lg ${themeClasses.text.primary} md:grid-cols-2`}>
                <li>1 point per normal question.</li>
                <li>If both teams are correct, only the faster answer gets the point.</li>
                <li>2 points for estimation questions.</li>
                <li>1 point per correctly guessed charades card.</li>
                <li>No external help: no Google, Bing, Ecosia, ChatGPT, Gemini, Claude, or any other source. Answers must come only from your own mind, knowledge, and reasoning.</li>
                <li>The smaller team gets 1 bonus point per missing player.</li>
                <li>Scores cannot be manually edited.</li>
                <li>The answer is revealed immediately once both teams have answered. Until the other team has selected an answer, a team can still change its selected answer.</li>
              </ul>
            </Panel>

            {teamDelta > 0 && smallerTeam && (
              <Panel isDarkTheme={isDarkTheme} className="space-y-3 border-emerald-300/30 bg-emerald-500/10">
                <p className={`text-sm uppercase tracking-[0.3em] ${isDarkTheme ? 'text-emerald-300' : 'text-emerald-700'}`}>Team Balance</p>
                <p className={`text-lg ${isDarkTheme ? 'text-white' : 'text-emerald-900'}`}>
                  <strong>{smallerTeam === 'women' ? 'Venus Team' : 'Mars Team'}</strong> has {smallerTeam === 'women' ? womenCount : menCount} member{smallerTeam === 'women' ? womenCount === 1 ? '' : 's' : menCount === 1 ? '' : 's'} vs <strong>{smallerTeam === 'women' ? 'Mars Team' : 'Venus Team'}</strong> with {smallerTeam === 'women' ? menCount : womenCount}.
                </p>
                <p className={`text-base ${isDarkTheme ? 'text-emerald-200' : 'text-emerald-800'}`}>
                  <strong>{smallerTeam === 'women' ? 'Venus Team' : 'Mars Team'} gets +{balancingPoints} bonus point{balancingPoints === 1 ? '' : 's'}</strong> to level the playing field.
                </p>
              </Panel>
            )}

            <div className="flex flex-wrap gap-3">
              <Button isDarkTheme={isDarkTheme} variant="primary" onClick={() => startRound(0)}>We are ready</Button>
            </div>
          </div>
        )
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-purple-800">Round overview</p>
                <h2 className={`text-3xl font-black ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>Choose the next round</h2>
              </div>
              <Button isDarkTheme={isDarkTheme} variant="primary" onClick={() => startRound(state.currentRoundIndex)}>Continue current round</Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {roundOverviewItems.map((item, index) => {
                const status = index < state.currentRoundIndex ? 'Completed' : index === state.currentRoundIndex ? 'In progress' : 'Not started'

                return (
                  <Panel isDarkTheme={isDarkTheme} key={item.title} className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm uppercase tracking-[0.3em] ${themeClasses.pillLabel}`}>Round {index + 1}</p>
                        <h3 className={`text-2xl font-bold ${themeClasses.text.primary}`}>{item.title}</h3>
                        <p className={themeClasses.text.secondary}>{item.description}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-sm ${themeClasses.chip}`}>{status}</span>
                    </div>
                    <Button isDarkTheme={isDarkTheme} variant={index === state.currentRoundIndex ? 'primary' : 'secondary'} onClick={() => startRound(index)}>
                      {index === state.currentRoundIndex ? 'Continue' : 'Start'}
                    </Button>
                  </Panel>
                )
              })}
            </div>

            <Panel isDarkTheme={isDarkTheme}>
              <h3 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Progress</h3>
              <p className={themeClasses.text.secondary}>Round {state.currentRoundIndex + 1} of 5, question {state.currentQuestionIndex + 1}</p>
              <p className={themeClasses.text.primary}>Current score: Venus Team {womenScore} - Mars Team {menScore}</p>
            </Panel>
          </div>
        )
      case 'play':
        if (!quizRound || !currentQuestion) {
          return null
        }

        return (
          <div className="space-y-6">
            <Panel isDarkTheme={isDarkTheme} className="space-y-5">
              <div className="space-y-2">
                <p className={`text-sm uppercase tracking-[0.3em] ${isDarkTheme ? 'text-slate-400' : 'text-purple-700'}`}>
                  Round {state.currentRoundIndex + 1} of {rounds.length}
                </p>
                <p className={`text-sm ${themeClasses.text.secondary}`}>
                  Question {state.currentQuestionIndex + 1} of {quizRound.questions.length}
                </p>
                <p className={`text-3xl font-bold leading-tight ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>{currentQuestion.question}</p>
              </div>

              {currentQuestion.type === 'estimation' ? renderEstimation(currentQuestion) : renderMultipleChoice(currentQuestion)}

              <div className="flex flex-wrap gap-3">
                {!activePlayer ? (
                  <>
                    <Button isDarkTheme={isDarkTheme} variant="primary" onClick={revealAnswer}>Reveal answer</Button>
                    <Button isDarkTheme={isDarkTheme} onClick={() => setScreen('scoreboard')}>Edit score</Button>
                  </>
                ) : null}
                {state.answerRevealed && activePlayer ? (
                  <Button
                    isDarkTheme={isDarkTheme}
                    onClick={markNextQuestionReady}
                    disabled={state.nextQuestionReady[activePlayer.teamId]}
                  >
                    {state.nextQuestionReady[activePlayer.teamId] ? 'Waiting for other team...' : 'Next question'}
                  </Button>
                ) : null}
              </div>
            </Panel>
          </div>
        )
      case 'scoreboard':
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-purple-800">Scoreboard</p>
                <h2 className={`text-3xl font-black ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>Current score</h2>
              </div>
              <Button isDarkTheme={isDarkTheme} variant="primary" onClick={continueSequentialRound}>
                {state.currentRoundIndex >= 3 ? 'Start charades' : 'Next round'}
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {teams.map((team) => (
                <Panel isDarkTheme={isDarkTheme} key={team.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className={`text-2xl font-bold ${themeClasses.text.primary}`}>{team.name}</h3>
                      <p className={`text-sm ${themeClasses.text.secondary}`}>Bonus {getStartingBonus(teams, team.id)}</p>
                    </div>
                    <div className={`rounded-2xl px-4 py-2 text-right ${themeClasses.pill}`}>
                      <p className={`text-xs uppercase tracking-[0.3em] ${themeClasses.pillLabel}`}>Score</p>
                      <p className={`text-3xl font-black ${themeClasses.text.primary}`}>{getDisplayScore(team, teams)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button isDarkTheme={isDarkTheme} onClick={() => adjustScore(team.id, 1)}>+1</Button>
                    <Button isDarkTheme={isDarkTheme} onClick={() => adjustScore(team.id, -1)}>-1</Button>
                  </div>
                </Panel>
              ))}
            </div>

            <Panel>
              <p className={themeClasses.text.primary}>Round progress: {quizRound?.title ?? 'Ready for charades'}</p>
              <p className={themeClasses.text.secondary}>Use the manual +1 and -1 buttons if the group disagrees or wants a bonus.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button isDarkTheme={isDarkTheme} onClick={() => setScreen('play')}>Return to question</Button>
                <Button isDarkTheme={isDarkTheme} onClick={() => startRound(state.currentRoundIndex)}>Restart this round</Button>
              </div>
            </Panel>
          </div>
        )
      case 'charades':
        return (
          <div className="space-y-6">
            <Panel isDarkTheme={isDarkTheme} className="space-y-4 text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-purple-800">Round 5</p>
              <h2 className={`text-4xl font-black ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>Silent charades</h2>
              <p className={`text-lg ${themeClasses.text.secondary}`}>No sounds. No words. No numbers with fingers. Just acting in silence.</p>
              <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-3">
                <div className={`rounded-3xl px-4 py-3 ${themeClasses.pill}`}>
                  <p className={`text-xs uppercase tracking-[0.3em] ${themeClasses.pillLabel}`}>Acting team</p>
                  <p className={`text-2xl font-black ${themeClasses.text.primary}`}>{state.charades.activeTeam === 'women' ? 'Venus Team' : 'Mars Team'}</p>
                </div>
                <div className={`rounded-3xl px-4 py-3 ${themeClasses.pill}`}>
                  <p className={`text-xs uppercase tracking-[0.3em] ${themeClasses.pillLabel}`}>Timer</p>
                  <p className={`text-5xl font-black tabular-nums ${themeClasses.text.primary}`}>{String(state.charades.secondsLeft).padStart(2, '0')}</p>
                </div>
                <div className={`rounded-3xl px-4 py-3 ${themeClasses.pill}`}>
                  <p className={`text-xs uppercase tracking-[0.3em] ${themeClasses.pillLabel}`}>Card</p>
                  <p className={`text-2xl font-black ${themeClasses.text.primary}`}>{charadesCard ? charadesCard.label : 'No card available'}</p>
                </div>
              </div>
            </Panel>

            <Panel isDarkTheme={isDarkTheme} className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button isDarkTheme={isDarkTheme} variant="primary" onClick={() => updateCharades({ running: true })}>Start timer</Button>
                <Button isDarkTheme={isDarkTheme} onClick={() => updateCharades({ running: false })}>Pause timer</Button>
                <Button isDarkTheme={isDarkTheme} onClick={() => updateCharades({ secondsLeft: 60, running: false })}>Reset timer</Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button isDarkTheme={isDarkTheme} variant="primary" onClick={() => correctCharadesCard(1)}>Correct</Button>
                <Button isDarkTheme={isDarkTheme} onClick={() => correctCharadesCard(0)}>Skip</Button>
                <Button isDarkTheme={isDarkTheme} onClick={nextCharadesCard}>Next card</Button>
                <Button isDarkTheme={isDarkTheme} variant="ghost" onClick={endCharadesTurn}>End turn</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Panel>
                  <h3 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Venus Team</h3>
                  <p className={themeClasses.text.secondary}>{state.charades.women.currentIndex + 1} / {state.charades.women.deck.length} cards</p>
                </Panel>
                <Panel>
                  <h3 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Mars Team</h3>
                  <p className={themeClasses.text.secondary}>{state.charades.men.currentIndex + 1} / {state.charades.men.deck.length} cards</p>
                </Panel>
              </div>
            </Panel>
          </div>
        )
      case 'final':
        return (
          <div className="space-y-6 text-center">
            <Panel isDarkTheme={isDarkTheme} className="space-y-4 bg-gradient-to-br from-purple-200/30 to-purple-300/30">
              <p className="text-sm uppercase tracking-[0.5em] text-purple-800">Final results</p>
              <h2 className={`text-4xl font-black md:text-6xl ${isDarkTheme ? 'text-white' : 'text-purple-900'}`}>
                {winner.winner === 'Tie' ? 'It is a tie' : `${winner.winner} wins`}
              </h2>
              <p className={`text-2xl ${themeClasses.text.primary}`}>
                Venus Team {womenScore} - Mars Team {menScore}
                {winner.difference > 0 ? `, by ${winner.difference} points` : ''}
              </p>
              <p className={`text-lg ${themeClasses.text.secondary}`}>{finalMessage}</p>
              <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">
                <Panel>
                  <h3 className={`text-xl font-bold ${themeClasses.text.primary}`}>Awards</h3>
                  <p className={themeClasses.text.secondary}>Winning team</p>
                  <p className={themeClasses.text.primary}>Best wrong answer</p>
                  <p className={themeClasses.text.primary}>Best charades performance</p>
                  <p className={themeClasses.text.primary}>Most chaotic player</p>
                </Panel>
                <Panel>
                  <h3 className={`text-xl font-bold ${themeClasses.text.primary}`}>Prize ideas</h3>
                  <p className={themeClasses.text.secondary}>First choice of dessert or drinks.</p>
                  <p className={themeClasses.text.primary}>Fake trophy.</p>
                  <p className={themeClasses.text.primary}>Losers give a 20-second tribute speech.</p>
                </Panel>
              </div>
              <Panel isDarkTheme={isDarkTheme} className="space-y-4 text-left">
                <h3 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Player stats</h3>
                {playerStatRows.length === 0 ? (
                  <p className={themeClasses.text.secondary}>No players logged in, so no individual stats yet.</p>
                ) : (
                  <>
                    <div className="grid gap-2 md:grid-cols-2">
                      <p className={themeClasses.text.primary}>
                        Fastest response: {fastestPlayer ? `${fastestPlayer.player.name} (${(fastestPlayer.stats.fastestMs! / 1000).toFixed(1)}s)` : 'No data'}
                      </p>
                      <p className={themeClasses.text.primary}>
                        Slowest response: {slowestPlayer ? `${slowestPlayer.player.name} (${(slowestPlayer.stats.slowestMs! / 1000).toFixed(1)}s)` : 'No data'}
                      </p>
                      <p className={themeClasses.text.primary}>
                        Most correct: {mostCorrectPlayer ? `${mostCorrectPlayer.player.name} (${mostCorrectPlayer.stats.correctCount})` : 'No data'}
                      </p>
                      <p className={themeClasses.text.primary}>
                        Least correct: {leastCorrectPlayer ? `${leastCorrectPlayer.player.name} (${leastCorrectPlayer.stats.correctCount})` : 'No data'}
                      </p>
                      <p className={themeClasses.text.primary}>
                        Most answered: {mostAnsweredPlayer ? `${mostAnsweredPlayer.player.name} (${mostAnsweredPlayer.stats.answersCount})` : 'No data'}
                      </p>
                      <p className={themeClasses.text.primary}>
                        Least answered: {leastAnsweredPlayer ? `${leastAnsweredPlayer.player.name} (${leastAnsweredPlayer.stats.answersCount})` : 'No data'}
                      </p>
                    </div>

                    <div className={isDarkTheme ? 'overflow-x-auto rounded-2xl border border-white/10' : 'overflow-x-auto rounded-2xl border border-purple-200'}>
                      <table className={`min-w-full text-left text-sm ${themeClasses.text.primary}`}>
                        <thead className={isDarkTheme ? 'bg-white/5 text-slate-300' : 'bg-purple-100/80 text-purple-800'}>
                          <tr>
                            <th className="px-3 py-2">Player</th>
                            <th className="px-3 py-2">Team</th>
                            <th className="px-3 py-2">Answered</th>
                            <th className="px-3 py-2">Correct</th>
                            <th className="px-3 py-2">Accuracy</th>
                            <th className="px-3 py-2">Avg time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerStatRows.map((row) => (
                            <tr key={row.player.id} className={isDarkTheme ? 'border-t border-white/10 text-slate-100' : 'border-t border-purple-200 text-purple-900'}>
                              <td className="px-3 py-2">{row.player.name}</td>
                              <td className="px-3 py-2">{row.player.teamId === 'women' ? 'Venus Team' : 'Mars Team'}</td>
                              <td className="px-3 py-2">{row.stats.answersCount}</td>
                              <td className="px-3 py-2">{row.stats.correctCount}</td>
                              <td className="px-3 py-2">{row.accuracy}%</td>
                              <td className="px-3 py-2">{row.avgMs === null ? '-' : `${(row.avgMs / 1000).toFixed(1)}s`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Panel>
              <div className="flex flex-wrap justify-center gap-3">
                <Button isDarkTheme={isDarkTheme} variant="primary" onClick={resetGame}>Play again</Button>
                <Button isDarkTheme={isDarkTheme} onClick={() => setScreen('welcome')}>Back to lobby</Button>
              </div>
            </Panel>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <main className={`min-h-screen px-4 py-6 md:px-8 md:py-8 ${themeClasses.main}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl border px-5 py-4 backdrop-blur-md ${themeClasses.header}`}>
          <div>
            <p className={`text-sm uppercase tracking-[0.3em] ${isDarkTheme ? 'text-amber-200' : 'text-purple-600'}`}>David and Rita Bachelor Quiz</p>
            <p className={`text-sm ${themeClasses.text.secondary}`}>Venus Team {womenScore} - Mars Team {menScore}</p>
            <p className={`text-xs ${themeClasses.text.tertiary}`}>Live sync peers: {connectedPeers}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button isDarkTheme={isDarkTheme} variant="ghost" onClick={copyShareLink} disabled={!shareUrl}>Copy sync link</Button>
            <Button isDarkTheme={isDarkTheme} variant="ghost" onClick={toggleTheme}>{isDarkTheme ? '☀️ Light' : '🌙 Dark'}</Button>
            <Button isDarkTheme={isDarkTheme} variant="danger" onClick={confirmAndResetGame}>Reset game</Button>
          </div>
        </header>

        {state.screen === 'welcome' ? (
          renderScreen(state.screen)
        ) : (
          <div className={`rounded-[2rem] border p-5 shadow-2xl backdrop-blur-xl md:p-8 ${isDarkTheme ? 'border-white/10 bg-slate-950/35 shadow-black/30' : 'border-purple-200 bg-purple-50/50 shadow-purple-200/20'}`}>
            {renderScreen(state.screen)}
          </div>
        )}
      </div>
    </main>
  )
}

export default App
