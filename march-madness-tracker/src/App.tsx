import { useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import CurrentGamesSection from './components/CurrentGamesSection'
import DateSelector from './components/DateSelector'
import TournamentTable from './components/TournamentTable'
import type { TournamentData, TournamentDay } from './types'
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
        setSelectedDayId(data.days[0]?.id ?? null)
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

  const selectedDay: TournamentDay | null = useMemo(() => {
    if (!tournamentData || !selectedDayId) return null
    return tournamentData.days.find((day) => day.id === selectedDayId) ?? tournamentData.days[0] ?? null
  }, [selectedDayId, tournamentData])

  const currentGames = useMemo(
    (): { matchups: TournamentDay['matchups']; status: CurrentGamesStatus; liveCount: number } => {
      if (!tournamentData) {
        return { matchups: [], status: 'empty', liveCount: 0 }
      }

      const allMatchups = tournamentData.days.flatMap((day) => day.matchups)
      const sortedWithTimes = allMatchups
        .filter((matchup) => matchup.timeCentral)
        .sort((a, b) => (a.timeCentral!.toMillis() ?? 0) - (b.timeCentral!.toMillis() ?? 0))

      if (sortedWithTimes.length === 0) {
        return { matchups: [], status: 'empty', liveCount: 0 }
      }

      const selected: TournamentDay['matchups'] = []
      const live = sortedWithTimes.filter((matchup) => isMatchupLive(matchup, referenceTime))

      live.forEach((matchup) => {
        if (selected.length < 4) {
          selected.push(matchup)
        }
      })

      const upcoming = sortedWithTimes.filter((matchup) => matchup.timeCentral && matchup.timeCentral > referenceTime)

      upcoming.forEach((matchup) => {
        if (selected.length < 4 && !selected.some((existing) => existing.id === matchup.id)) {
          selected.push(matchup)
        }
      })

      if (selected.length < 4) {
        sortedWithTimes.forEach((matchup) => {
          if (selected.length < 4 && !selected.some((existing) => existing.id === matchup.id)) {
            selected.push(matchup)
          }
        })
      }

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
            <CurrentGamesSection
              matchups={currentGames.matchups}
              status={currentGames.status}
              participants={tournamentData.participants}
              liveCount={currentGames.liveCount}
            />
            <DateSelector
              days={tournamentData.days}
              selectedDayId={selectedDayId}
              onSelect={handleDaySelect}
            />

            {selectedDay ? (
              <TournamentTable day={selectedDay} participants={tournamentData.participants} />
            ) : (
              <p className="app-status">Select a date to view matchups.</p>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
