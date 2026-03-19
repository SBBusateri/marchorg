import MatchupSummary from './MatchupSummary'
import type { Matchup } from '../types'

interface LiveGamesTableProps {
  matchups: Matchup[]
  participants: string[]
  liveCount: number
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
  }
}

const LiveGamesTable = ({ matchups, participants, liveCount }: LiveGamesTableProps) => (
  <div className="current-games__table" role="region" aria-label="Live games picks">
    <table className="picks-table picks-table--live">
      <thead>
        <tr>
          <th className="picks-table__participant picks-table__participant--header" scope="col">
            Participant
          </th>
          {matchups.map((matchup, index) => {
            const status = index < liveCount ? 'live' : 'upcoming'
            const headerClass = `picks-table__matchup-header picks-table__matchup-header--${status}`
            return (
              <th key={matchup.id} scope="col" className={headerClass} data-status={status}>
                <MatchupSummary matchup={matchup} compact />
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {participants.map((participant) => (
          <tr key={participant}>
            <th scope="row" className="picks-table__participant picks-table__participant--body">
              {participant}
            </th>
            {matchups.map((matchup, index) => {
              const status = index < liveCount ? 'live' : 'upcoming'
              const state = getCellState(matchup, matchup.picks[participant] ?? null)
              const className = `picks-table__cell picks-table__cell--${state.variant} picks-table__cell--${status}`
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
)

export default LiveGamesTable
