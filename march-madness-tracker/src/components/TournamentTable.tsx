import MatchupSummary from './MatchupSummary'
import type { Matchup, TournamentDay } from '../types'

interface TournamentTableProps {
  day: TournamentDay
  participants: string[]
}

const normalize = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\((?:\d+[A-Za-z]?)\)\s*/, '')
    .replace(/\s*\((?:\d+[A-Za-z]?)\)\s*$/, '')
    .toLowerCase()

const getCellState = (matchup: Matchup, pick: string | null) => {
  if (!pick) {
    return {
      label: '—',
      variant: 'empty' as const,
    }
  }

  const normalizedPick = normalize(pick)
  if (normalize(matchup.teams[0].name) === normalizedPick) {
    return {
      label: pick,
      variant: 'selected-top' as const,
    }
  }

  if (normalize(matchup.teams[1].name) === normalizedPick) {
    return {
      label: pick,
      variant: 'selected-bottom' as const,
    }
  }

  return {
    label: pick,
    variant: 'neutral' as const,
    suppressStrikethrough: /\bgame\b/i.test(matchup.label),
  }
}

const TournamentTable = ({ day, participants }: TournamentTableProps) => {
  const sortedMatchups = [...day.matchups].sort((a, b) => {
    const aTime = a.timeCentral ?? a.timeEastern ?? null
    const bTime = b.timeCentral ?? b.timeEastern ?? null

    if (aTime && bTime) {
      return aTime.toMillis() - bTime.toMillis()
    }

    if (aTime) return -1
    if (bTime) return 1
    return a.label.localeCompare(b.label)
  })

  const timeLabels = sortedMatchups
    .map((matchup) => matchup.formattedCentralTime)
    .filter((value): value is string => Boolean(value))

  const timeWindow = timeLabels.length
    ? timeLabels[0] === timeLabels[timeLabels.length - 1]
      ? timeLabels[0]
      : `${timeLabels[0]} – ${timeLabels[timeLabels.length - 1]}`
    : null

  const dateTitle = day.date.toFormat('cccc, MMMM d')
  const titleWithTime = timeWindow ? `${dateTitle} · ${timeWindow} CT` : dateTitle

  return (
    <section className="table-section" aria-labelledby={`day-${day.id}-title`}>
      <header className="table-section__header">
        <h2 id={`day-${day.id}-title`} className="table-section__title">
          {titleWithTime}
        </h2>
        <p className="table-section__subtitle">{day.stage}</p>
      </header>

      <div className="table-section__table">
        <div className="table-scroll" role="region" aria-labelledby={`day-${day.id}-title`}>
          <table className="picks-table">
            <thead>
              <tr>
                <th className="picks-table__participant picks-table__participant--header" scope="col">
                  <span className="sr-only">Participant</span>
                </th>
                {sortedMatchups.map((matchup) => (
                  <th key={matchup.id} scope="col">
                    <MatchupSummary matchup={matchup} compact />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr key={participant}>
                  <th scope="row" className="picks-table__participant picks-table__participant--body">
                    {participant}
                  </th>
                  {sortedMatchups.map((matchup) => {
                    const state = getCellState(matchup, matchup.picks[participant] ?? null)
                    return (
                      <td
                        key={`${participant}-${matchup.id}`}
                        className={`picks-table__cell picks-table__cell--${state.variant} ${
                          state.suppressStrikethrough ? 'picks-table__cell--no-strike' : ''
                        }`.trim()}
                      >
                        <span>{state.label}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default TournamentTable
