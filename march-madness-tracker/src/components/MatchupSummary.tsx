import type { Matchup, TeamInfo } from '../types'

interface MatchupSummaryProps {
  matchup: Matchup
  className?: string
  compact?: boolean
}

const formatTeamLabel = (team: TeamInfo, append?: string) => {
  const seed = team.seed ? `(${team.seed}) ` : ''
  return `${seed}${team.name}${append ?? ''}`.trim()
}

const joinClassNames = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

const MatchupSummary = ({ matchup, className, compact = false }: MatchupSummaryProps) => {
  const timeLabel = matchup.formattedCentralTime ? `${matchup.formattedCentralTime} CT` : 'TBD'
  const metaPieces = [timeLabel]
  if (matchup.network) {
    metaPieces.push(matchup.network)
  }

  return (
    <div className={joinClassNames('matchup-summary', compact && 'matchup-summary--compact', className)}>
      <div className="matchup-summary__line matchup-summary__line--primary">
        {formatTeamLabel(matchup.teams[0], ' vs.')}
      </div>
      <div className="matchup-summary__line matchup-summary__line--secondary">
        {formatTeamLabel(matchup.teams[1])}
      </div>
      <div className="matchup-summary__meta">| {metaPieces.join(' | ')} |</div>
    </div>
  )
}

export default MatchupSummary
