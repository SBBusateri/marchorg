import { useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import CurrentGamesSection from './components/CurrentGamesSection'
import DateSelector from './components/DateSelector'
import NeedsToWinTable from './components/NeedsToWinTable'
import TournamentTable from './components/TournamentTable'
import GameDifferenceSection from './components/GameDifferenceSection'
import type { Matchup, TournamentData, TournamentDay } from './types'
import { isMatchupLive, loadTournamentData } from './utils/parseTournamentData'
import './App.css'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type CurrentGamesStatus = 'live' | 'upcoming' | 'empty'

function App() {
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null)
  const [state, setState] = useState<LoadState>('idle')
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [referenceTime, setReferenceTime] = useState(DateTime.now().setZone('America/Chicago'))

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState('loading')
        const data = await loadTournamentData()
        setTournamentData(data)

        const now = DateTime.now().setZone('America/New_York')
        const upcomingDay = data.days.find((day) => day.date.setZone('America/New_York').endOf('day') >= now)
        const fallbackDay = data.days[0]
        setSelectedDayId(upcomingDay?.id ?? fallbackDay?.id ?? null)
        setState('ready')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load bracket data.'
        setErrorMessage(message)
        setState('error')
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setReferenceTime(DateTime.now().setZone('America/Chicago'))
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [])

  const orderedDays = useMemo(() => {
    if (!tournamentData) return []

    const nowET = referenceTime.setZone('America/New_York')

    const current: TournamentDay[] = []
    const upcoming: TournamentDay[] = []
    const past: TournamentDay[] = []

    tournamentData.days.forEach((day) => {
      const dayStart = day.date.setZone('America/New_York').startOf('day')
      const dayEnd = day.date.setZone('America/New_York').endOf('day')

      if (nowET >= dayStart && nowET <= dayEnd) {
        current.push(day)
        return
      }

      if (dayStart > nowET) {
        upcoming.push(day)
        return
      }

      past.push(day)
    })

    const sortByDate = (days: TournamentDay[]) =>
      days.slice().sort((a, b) => a.date.toMillis() - b.date.toMillis())

    return [...sortByDate(current), ...sortByDate(upcoming), ...sortByDate(past)]
  }, [referenceTime, tournamentData])

  const selectedDay: TournamentDay | null = useMemo(() => {
    if (orderedDays.length === 0) return null
    if (!selectedDayId) {
      return orderedDays[0]
    }
    return orderedDays.find((day) => day.id === selectedDayId) ?? orderedDays[0]
  }, [orderedDays, selectedDayId])

  const currentGames = useMemo(
    (): { matchups: TournamentDay['matchups']; status: CurrentGamesStatus; liveCount: number } => {
      if (!tournamentData) {
        return { matchups: [], status: 'empty', liveCount: 0 }
      }

      const allMatchups = tournamentData.days.flatMap((day) => day.matchups)

      const live = allMatchups
        .filter((matchup) => matchup.timeCentral)
        .filter((matchup) => isMatchupLive(matchup, referenceTime))
        .sort((a, b) => a.timeCentral!.toMillis() - b.timeCentral!.toMillis())

      const upcomingWithTimes = allMatchups
        .filter((matchup) => matchup.timeCentral && matchup.timeCentral > referenceTime)
        .sort((a, b) => a.timeCentral!.toMillis() - b.timeCentral!.toMillis())

      const referenceDayStart = referenceTime.startOf('day')
      const upcomingWithoutTimes = allMatchups
        .filter((matchup) => !matchup.timeCentral)
        .filter((matchup) => matchup.date.setZone('America/Chicago').endOf('day') >= referenceDayStart)
        .sort((a, b) => a.date.toMillis() - b.date.toMillis())

      const selected: TournamentDay['matchups'] = []

      const addMatchup = (matchup: Matchup) => {
        if (selected.length >= 4) return
        if (selected.some((existing) => existing.id === matchup.id)) return
        selected.push(matchup)
      }

      live.forEach(addMatchup)
      upcomingWithTimes.forEach(addMatchup)
      upcomingWithoutTimes.forEach(addMatchup)

      const liveCount = Math.min(live.length, selected.length)

      const status: CurrentGamesStatus =
        liveCount > 0 ? 'live' : selected.length > 0 ? 'upcoming' : 'empty'

      return { matchups: selected, status, liveCount }
    },
    [referenceTime, tournamentData],
  )

  const handleDaySelect = (dayId: string) => {
    setSelectedDayId(dayId)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Busateri Bracket Room</h1>
        <p className="app-subtitle">March Madness Picks Tracker</p>
      </header>

      <main className="app-main" role="main">
        {state === 'loading' && <p className="app-status">Loading bracket data…</p>}
        {state === 'error' && <p className="app-status app-status--error">{errorMessage}</p>}

        {state === 'ready' && tournamentData && (
          <>
            <NeedsToWinTable needsToWin={tournamentData.needsToWin} participants={tournamentData.participants} />

            <CurrentGamesSection
              matchups={currentGames.matchups}
              status={currentGames.status}
              participants={tournamentData.participants}
              liveCount={currentGames.liveCount}
            />
            <DateSelector days={orderedDays} selectedDayId={selectedDayId} onSelect={handleDaySelect} />

            {selectedDay ? (
              <TournamentTable day={selectedDay} participants={tournamentData.participants} />
            ) : (
              <p className="app-status">Select a date to view matchups.</p>
            )}

            <GameDifferenceSection
              participants={tournamentData.participants}
              comparisons={tournamentData.comparisons}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App
