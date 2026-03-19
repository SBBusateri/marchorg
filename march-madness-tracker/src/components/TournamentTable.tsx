import MatchupSummary from './MatchupSummary'
import type { Matchup, TournamentDay } from '../types'

interface TournamentTableProps {
  day: TournamentDay
  participants: string[]
}

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()

const getCellState = (matchup: Matchup, pick: string | null) => {
  if (!pick) {
    return {
      label: '—',
      variant: 'empty' as const,
    }
  }

  const normalizedPick = normalize(pick)
  const didMatch = matchup.teams.some((team) => normalize(team.name) === normalizedPick)

  return {
    label: pick,
    variant: didMatch ? 'selected' : 'neutral',
  }
}

const TournamentTable = ({ day, participants }: TournamentTableProps) => (
  <section className="table-section" aria-labelledby={`day-${day.id}-title`}>
    <header className="table-section__header">
      <h2 id={`day-${day.id}-title`} className="table-section__title">
        {day.date.toFormat('cccc, MMMM d')}
      </h2>
      <p className="table-section__subtitle">{day.stage}</p>
    </header>

    <div className="table-section__table">
      <div className="table-scroll" role="region" aria-labelledby={`day-${day.id}-title`}>
        <table className="picks-table">
          <thead>
            <tr>
              <th className="picks-table__participant picks-table__participant--header" scope="col">
                Participant
              </th>
              {day.matchups.map((matchup) => (
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
                {day.matchups.map((matchup) => {
                  const state = getCellState(matchup, matchup.picks[participant] ?? null)
                  const className = `picks-table__cell picks-table__cell--${state.variant}`
                  return (
                    <td key={`${participant}-${matchup.id}`} className={className}>
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

export default TournamentTable
