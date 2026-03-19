import LiveGamesTable from './LiveGamesTable'
import type { Matchup } from '../types'

interface CurrentGamesSectionProps {
  matchups: Matchup[]
  status: 'live' | 'upcoming' | 'empty'
  participants: string[]
  liveCount: number
}

const statusLabel: Record<CurrentGamesSectionProps['status'], string> = {
  live: 'Live now',
  upcoming: 'Next up',
  empty: 'Status update',
}

const CurrentGamesSection = ({ matchups, status, participants, liveCount }: CurrentGamesSectionProps) => (
  <section className="current-games" aria-labelledby="current-games-title">
    <header className="current-games__header">
      <div>
        <h2 id="current-games-title">
          {status === 'live' ? 'Live Picks (Central Time)' : 'Current / Upcoming Games'}
        </h2>
        {status !== 'live' && matchups.length > 0 && (
          <p className="current-games__subtitle">Automatically converts game times to Central Time.</p>
        )}
      </div>
      <span className={`current-games__badge current-games__badge--${status}`}>{statusLabel[status]}</span>
    </header>

    {matchups.length === 0 ? (
      <p className="current-games__empty">There are no games to display.</p>
    ) : (
      <LiveGamesTable matchups={matchups} participants={participants} liveCount={liveCount} />
    )}
  </section>
)

export default CurrentGamesSection
