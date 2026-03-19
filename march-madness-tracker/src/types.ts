import { DateTime } from 'luxon'

export interface TeamInfo {
  seed: string
  name: string
}

export interface Matchup {
  id: string
  label: string
  dateLabel: string
  stage: string
  date: DateTime
  teams: [TeamInfo, TeamInfo]
  network?: string
  timeEastern?: DateTime
  timeCentral?: DateTime
  formattedCentralTime?: string
  picks: Record<string, string | null>
}

export interface TournamentDay {
  id: string
  label: string
  date: DateTime
  stage: string
  matchups: Matchup[]
}

export interface TournamentData {
  participants: string[]
  days: TournamentDay[]
}
