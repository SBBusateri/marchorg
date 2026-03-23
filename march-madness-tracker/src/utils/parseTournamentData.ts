import { DateTime } from 'luxon'
import { read, utils } from 'xlsx'
import type {
  Matchup,
  MatchupDifference,
  NeedsToWinMap,
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
  const normalized = trimmed.replace(/\s+/g, ' ')
  return normalized.length ? normalized : null
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

  let cleaned = timePart
    .replace(/Eastern|ET|EST|EDT/gi, '')
    .replace(/\./g, '')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .trim()

  cleaned = cleaned.replace(/\b([AP])\s*M\b/g, '$1M')

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
  const rawSegments = label.split('|').map((segment) => sanitizeString(segment))

  let teamsPart = rawSegments[0] ?? ''
  let timePart = rawSegments[1] ?? undefined
  let network = rawSegments[2] ?? undefined

  if (rawSegments.length === 2) {
    if (rawSegments[1] && /\d/.test(rawSegments[1]!)) {
      timePart = rawSegments[1]!
      network = undefined
    } else {
      network = rawSegments[1]!
      timePart = undefined
    }
  }

  if (!timePart) {
    const trailingTimeMatch = teamsPart.match(/,(?!.*,)\s*(.+)$/)
    if (trailingTimeMatch) {
      timePart = trailingTimeMatch[1]
      teamsPart = teamsPart.replace(/,(?!.*,)\s*.+$/, '')
    }
  }

  teamsPart = sanitizeString(teamsPart) ?? ''
  timePart = sanitizeString(timePart) ?? undefined
  network = sanitizeString(network) ?? undefined

  const [teamOneRaw, teamTwoRaw] = teamsPart.split(/vs\.?/i)

  let teamOne = parseTeam(teamOneRaw ?? '')
  let teamTwo = parseTeam(teamTwoRaw ?? '')

  if (!teamTwo.name) {
    const teamSegments = teamsPart.match(/\([^()]+\)\s*[^()]+/g)

    if (teamSegments && teamSegments.length >= 2) {
      teamOne = parseTeam(teamSegments[0])
      teamTwo = parseTeam(teamSegments[1])
    }
  }

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

const initializeNeedsToWinMap = (participants: string[]): NeedsToWinMap =>
  participants.reduce<NeedsToWinMap>((acc, participant) => {
    acc[participant] = []
    return acc
  }, {})

const parseNeedsToWinSection = (
  rows: (string | null | undefined)[][],
  startIndex: number,
  participants: string[],
  existing: NeedsToWinMap,
): NeedsToWinMap => {
  const needsMap = { ...existing }

  for (let rowIndex = startIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!row) continue

    const label = sanitizeString(row[0])
    if (label) {
      break
    }

    participants.forEach((participant, participantIndex) => {
      const entry = sanitizeString(row[participantIndex + 1])
      if (entry) {
        needsMap[participant] = [...(needsMap[participant] ?? []), entry]
      }
    })
  }

  return needsMap
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

  let needsToWin = initializeNeedsToWinMap(participants)

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const cell = sanitizeString(row[0])

    if (cell && cell.toLowerCase().includes('needs to win')) {
      needsToWin = parseNeedsToWinSection(rows, rowIndex, participants, needsToWin)
      break
    }

    if (!cell) {
      continue
    }

    const dayHeading = parseDayHeading(cell)

    if (dayHeading) {
      currentDay = {
        ...dayHeading,
        matchups: [],
      }
      days.push(currentDay)
      continue
    }

    if (!currentDay) {
      continue
    }

    const baseMatchup = parseMatchupLabel(cell, currentDay.date)

    const picks: Record<string, string | null> = {}

    participants.forEach((participant, index) => {
      const value = row[index + 1]
      picks[participant] = sanitizeString(value) ?? null
    })

    const matchup = hydrateMatchup(baseMatchup, currentDay, picks)
    currentDay.matchups.push(matchup)
  }

  const populatedDays = days.filter((day) => day.matchups.length > 0)
  const comparisons = buildParticipantComparisons(participants, populatedDays)

  return {
    participants,
    days: populatedDays,
    comparisons,
    needsToWin,
  }
}
