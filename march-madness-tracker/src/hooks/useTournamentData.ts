import { useEffect, useMemo, useState } from 'react'
import type { TournamentData, TournamentDay } from '../types'
import { loadTournamentData } from '../utils/parseTournamentData'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type UseTournamentDataResult = {
  loadState: LoadState
  error: string | null
  data: TournamentData | null
  selectedDay: TournamentDay | null
  selectedDayId: string | null
  setSelectedDayId: (dayId: string | null) => void
}

const useTournamentData = (): UseTournamentDataResult => {
  const [state, setState] = useState<LoadState>('idle')
  const [data, setData] = useState<TournamentData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState('loading')
        const loaded = await loadTournamentData()
        setData(loaded)
        setSelectedDayId(loaded.days[0]?.id ?? null)
        setState('ready')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load bracket data.'
        setError(message)
        setState('error')
      }
    }

    fetchData()
  }, [])

  const selectedDay: TournamentDay | null = useMemo(() => {
    if (!data || !selectedDayId) return null
    return data.days.find((day) => day.id === selectedDayId) ?? data.days[0] ?? null
  }, [data, selectedDayId])

  return {
    loadState: state,
    error,
    data,
    selectedDay,
    selectedDayId,
    setSelectedDayId,
  }
}

export default useTournamentData
