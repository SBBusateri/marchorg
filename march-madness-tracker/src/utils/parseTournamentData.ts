import { DateTime } from 'luxon'
import { read, utils } from 'xlsx'
import type {
  Matchup,
  MatchupDifference,
  ParticipantComparisonMap,
  ParticipantOpponentComparison,
  TeamInfo,
  TournamentData,
  TournamentDay,
} from '../types'

const ET_ZONE = 'America/New_York'
const CT_ZONE = 'America/Chicago'

const DATE_HEADING_PATTERN = /(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(.+)/

const LIVE_WINDOW_HOURS = 2.5

const sanitizeString = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null
  const trimmed = `${value}`.trim()
  return trimmed.length ? trimmed : null
}

const parseDayHeading = (heading: string): { id: string; label: string; date: DateTime; stage: string } | null => {
  const match = heading.match(DATE_HEADING_PATTERN)
  if (!match) return null

  const [, datePart, stage] = match
  const date = DateTime.fromFormat(datePart.trim(), 'M/d/yyyy', { zone: ET_ZONE })
  if (!date.isValid) return null

  const normalizedStage = stage.trim()
  const label = `${date.toFormat('MMM d, yyyy')} · ${normalizedStage}`
  const id = `${date.toISODate()}-${normalizedStage.toLowerCase().replace(/\s+/g, '-')}`

  return { id, label, date, stage: normalizedStage }
}

const parseTeam = (input: string): TeamInfo => {
  const trimmed = input.trim()
  const seedMatch = trimmed.match(/^\(([^)]+)\)\s*(.+)$/)

  if (!seedMatch) {
    return { seed: '', name: trimmed }
  }

  return {
    seed: seedMatch[1].trim(),
    name: seedMatch[2].trim(),
  }
}

const formatCentralTime = (date: DateTime | undefined) =>
  date?.setZone(CT_ZONE).toFormat('h:mm a').replace('AM', 'a.m.').replace('PM', 'p.m.')

const parseTime = (timePart: string | undefined, date: DateTime) => {
  if (!timePart) {
    return {
      timeEastern: undefined,
      timeCentral: undefined,
      formattedCentralTime: undefined,
    }
  }

  const cleaned = timePart
    .replace(/Eastern|ET|EST|EDT/gi, '')
    .replace(/\./g, '')
    .toUpperCase()
    .trim()

  if (!cleaned || cleaned === 'TBD') {
    return {
      timeEastern: undefined,
      timeCentral: undefined,
      formattedCentralTime: undefined,
    }
  }

  let format = 'h:mm a'
  if (!cleaned.includes(':')) {
    format = 'h a'
  }

  let parsed = DateTime.fromFormat(cleaned, format, { zone: ET_ZONE })

  if (!parsed.isValid && cleaned.includes('NOON')) {
    parsed = DateTime.fromFormat('12:00 PM', 'h:mm a', { zone: ET_ZONE })
  }

  if (!parsed.isValid) {
    return {
      timeEastern: undefined,
      timeCentral: undefined,
      formattedCentralTime: undefined,
    }
  }

  const withDate = date.set({ hour: parsed.hour, minute: parsed.minute })
  const central = withDate.setZone(CT_ZONE)

  return {
    timeEastern: withDate,
    timeCentral: central,
    formattedCentralTime: formatCentralTime(central),
  }
}

const parseMatchupLabel = (label: string, date: DateTime): Omit<Matchup, 'picks' | 'id' | 'dateLabel' | 'stage'> => {
  const [teamsPartRaw, timePartRaw, networkRaw] = label.split('|').map((segment) => segment?.trim())
  const teamsPart = sanitizeString(teamsPartRaw) ?? ''
  const timePart = sanitizeString(timePartRaw) ?? undefined
  const network = sanitizeString(networkRaw) ?? undefined

  const [teamOneRaw, teamTwoRaw] = teamsPart.split(/vs\.?/i)

  const teamOne = parseTeam(teamOneRaw ?? '')
  const teamTwo = parseTeam(teamTwoRaw ?? '')

  const { timeCentral, timeEastern, formattedCentralTime } = parseTime(timePart, date)

  return {
    label,
    teams: [teamOne, teamTwo],
    network,
    timeEastern,
    timeCentral,
    formattedCentralTime,
    date,
  }
}

const hydrateMatchup = (
  base: Omit<Matchup, 'picks' | 'id' | 'dateLabel' | 'stage'>,
  day: TournamentDay,
  picks: Record<string, string | null>,
): Matchup => ({
  ...base,
  id: `${day.id}-${base.teams[0].name.replace(/\s+/g, '-')}-vs-${base.teams[1].name.replace(/\s+/g, '-')}`.toLowerCase(),
  dateLabel: day.label,
  stage: day.stage,
  picks,
})

const normalizePick = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

const createDifferenceEntry = (
  matchup: Matchup,
  primaryPick: string | null,
  opponentPick: string | null,
): MatchupDifference => ({
  matchupId: matchup.id,
  label: matchup.label,
  stage: matchup.stage,
  dateLabel: matchup.dateLabel,
  teams: matchup.teams,
  picks: {
    primary: primaryPick ?? '—',
    opponent: opponentPick ?? '—',
  },
})

const computeComparisonPair = (
  primary: string,
  opponent: string,
  matchups: Matchup[],
): {
  primaryComparison: ParticipantOpponentComparison
  opponentComparison: ParticipantOpponentComparison
} => {
  let comparedCount = 0
  let matchingCount = 0

  const differencesForPrimary: MatchupDifference[] = []
  const differencesForOpponent: MatchupDifference[] = []

  matchups.forEach((matchup) => {
    const primaryPick = matchup.picks[primary] ?? null
    const opponentPick = matchup.picks[opponent] ?? null

    const normalizedPrimary = normalizePick(primaryPick)
    const normalizedOpponent = normalizePick(opponentPick)

    const bothPicked = normalizedPrimary !== null && normalizedOpponent !== null

    if (bothPicked) {
      comparedCount += 1

      if (normalizedPrimary === normalizedOpponent) {
        matchingCount += 1
        return
      }
    }

    if (normalizedPrimary !== normalizedOpponent) {
      differencesForPrimary.push(createDifferenceEntry(matchup, primaryPick, opponentPick))
      differencesForOpponent.push(createDifferenceEntry(matchup, opponentPick, primaryPick))
    }
  })

  const similarity = comparedCount > 0 ? matchingCount / comparedCount : null

  const primaryComparison: ParticipantOpponentComparison = {
    opponent,
    similarity,
    comparedCount,
    matchingCount,
    differences: differencesForPrimary,
  }

  const opponentComparison: ParticipantOpponentComparison = {
    opponent: primary,
    similarity,
    comparedCount,
    matchingCount,
    differences: differencesForOpponent,
  }

  return { primaryComparison, opponentComparison }
}

const buildParticipantComparisons = (
  participants: string[],
  days: TournamentDay[],
): ParticipantComparisonMap => {
  const comparisons: ParticipantComparisonMap = participants.reduce<ParticipantComparisonMap>((acc, participant) => {
    acc[participant] = []
    return acc
  }, {})

  const allMatchups = days.flatMap((day) => day.matchups)

  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      const primary = participants[i]
      const opponent = participants[j]

      const { primaryComparison, opponentComparison } = computeComparisonPair(primary, opponent, allMatchups)

      comparisons[primary].push(primaryComparison)
      comparisons[opponent].push(opponentComparison)
    }
  }

  // Sort opponent lists by similarity (descending) then alphabetically
  participants.forEach((participant) => {
    comparisons[participant].sort((a, b) => {
      const similarityA = a.similarity ?? -1
      const similarityB = b.similarity ?? -1

      if (similarityA === similarityB) {
        return a.opponent.localeCompare(b.opponent)
      }

      return similarityB - similarityA
    })
  })

  return comparisons
}

export const isMatchupLive = (matchup: Matchup, reference: DateTime): boolean => {
  if (!matchup.timeCentral) return false
  const start = matchup.timeCentral
  const end = start.plus({ hours: LIVE_WINDOW_HOURS })
  return reference >= start && reference <= end
}

export const loadTournamentData = async (): Promise<TournamentData> => {
  const response = await fetch('/march.xlsx')

  if (!response.ok) {
    throw new Error('Unable to fetch bracket data.')
  }

  const buffer = await response.arrayBuffer()
  const workbook = read(buffer, { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]

  const rows = utils.sheet_to_json<(string | null | undefined)[]>(worksheet, {
    header: 1,
    blankrows: false,
  })

  if (!rows.length) {
    throw new Error('Bracket data is empty.')
  }

  const header = rows[0]
  const participants = header.slice(1).map((entry) => sanitizeString(entry)!).filter(Boolean) as string[]

  const headingInfo = header[0] ? parseDayHeading(String(header[0])) : null

  const days: TournamentDay[] = []

  if (headingInfo) {
    days.push({
      ...headingInfo,
      matchups: [],
    })
  }

  let currentDay: TournamentDay | undefined = days[0]

  rows.slice(1).forEach((row) => {
    const cell = sanitizeString(row[0])

    if (!cell) {
      return
    }

    const dayHeading = parseDayHeading(cell)

    if (dayHeading) {
      currentDay = {
        ...dayHeading,
        matchups: [],
      }
      days.push(currentDay)
      return
    }

    if (!currentDay) {
      return
    }

    const baseMatchup = parseMatchupLabel(cell, currentDay.date)

    const picks: Record<string, string | null> = {}

    participants.forEach((participant, index) => {
      const value = row[index + 1]
      picks[participant] = sanitizeString(value) ?? null
    })

    const matchup = hydrateMatchup(baseMatchup, currentDay, picks)
    currentDay.matchups.push(matchup)
  })

  const populatedDays = days.filter((day) => day.matchups.length > 0)
  const comparisons = buildParticipantComparisons(participants, populatedDays)

  return {
    participants,
    days: populatedDays,
    comparisons,
  }
}
