import { useEffect, useMemo, useState } from 'react'
import type { ParticipantComparisonMap } from '../types'

interface GameDifferenceSectionProps {
  participants: string[]
  comparisons: ParticipantComparisonMap
}

const formatSimilarity = (value: number | null): string => {
  if (value === null) return 'No comparable picks yet'
  const percentage = Math.round(value * 100)
  return `${percentage}% alignment`
}

const GameDifferenceSection = ({ participants, comparisons }: GameDifferenceSectionProps) => {
  const [activeParticipant, setActiveParticipant] = useState<string | null>(participants[0] ?? null)
  const [openOpponent, setOpenOpponent] = useState<string | null>(null)

  const activeComparisons = useMemo(() => {
    if (!activeParticipant) return []
    return comparisons[activeParticipant] ?? []
  }, [activeParticipant, comparisons])

  useEffect(() => {
    if (activeComparisons.length === 0) {
      setOpenOpponent(null)
      return
    }

    const defaultOpponent = activeComparisons[0]?.opponent ?? null
    setOpenOpponent(defaultOpponent)
  }, [activeParticipant, activeComparisons])

  if (participants.length === 0 || !activeParticipant) {
    return null
  }

  return (
    <section className="differences" aria-labelledby="differences-title">
      <header className="differences__header">
        <div>
          <h2 id="differences-title">Game Difference</h2>
          <p className="differences__subtitle">
            Explore how each participant&apos;s bracket compares. Select a name to see matchup differences versus the rest of the room.
          </p>
        </div>
      </header>

      <div className="differences__tabs date-selector" role="tablist" aria-label="Select participant">
        {participants.map((participant) => {
          const isActive = participant === activeParticipant
          const tabClassName = isActive
            ? 'date-selector__item date-selector__item--active'
            : 'date-selector__item'
          return (
            <button
              key={participant}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={tabClassName}
              onClick={() => setActiveParticipant(participant)}
            >
              {participant}
            </button>
          )
        })}
      </div>

      <div className="differences__content" role="tabpanel" aria-live="polite">
        {activeComparisons.length === 0 ? (
          <p className="differences__empty">No matchup differences to show yet.</p>
        ) : (
          <div className="differences__panels">
            {activeComparisons.map((comparison, index) => {
              const { opponent, similarity, differences: mismatchList, comparedCount, matchingCount } = comparison
              const differenceCount = mismatchList.length
              const isOpen = openOpponent === opponent
              const panelId = `difference-panel-${activeParticipant?.replace(/\s+/g, '-').toLowerCase()}-${index}`

              const comparableLabel =
                comparedCount > 0 ? `${matchingCount}/${comparedCount} aligned picks` : 'No comparable picks yet'
              const alignmentLabel = similarity !== null ? formatSimilarity(similarity) : null
              const differenceLabel =
                differenceCount > 0 ? `${differenceCount} difference${differenceCount === 1 ? '' : 's'}` : 'No differences'

              const summaryParts = [comparableLabel, alignmentLabel, differenceLabel].filter(Boolean)

              const summary = summaryParts.join(' - ')

              return (
                <article
                  key={opponent}
                  className={`table-section difference-panel${isOpen ? ' difference-panel--open' : ''}`}
                >
                  <button
                    type="button"
                    className="difference-panel__trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenOpponent((prev) => (prev === opponent ? null : opponent))}
                  >
                    <span className="difference-panel__title">vs {opponent}</span>
                    <span className="difference-panel__summary">{summary}</span>
                    <span
                      className={`difference-panel__chevron${isOpen ? ' difference-panel__chevron--open' : ''}`}
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                  </button>

                  {isOpen && (
                    <div id={panelId} className="difference-panel__body">
                      {differenceCount === 0 ? (
                        <p className="difference-panel__empty">Every shared pick matches so far.</p>
                      ) : (
                        <div className="table-section__table difference-panel__table">
                          <div
                            className="table-scroll table-scroll--difference"
                            role="region"
                            aria-label={`Difference table for ${activeParticipant} and ${opponent}`}
                          >
                            <table className="picks-table picks-table--differences">
                              <thead>
                                <tr>
                                  <th className="picks-table__participant picks-table__participant--header" scope="col">
                                    Matchup
                                  </th>
                                  <th scope="col">{activeParticipant}</th>
                                  <th scope="col">{opponent}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mismatchList.map((difference) => {
                                  const primaryPick = difference.picks.primary
                                  const opponentPick = difference.picks.opponent
                                  const primaryClass = `picks-table__cell picks-table__cell--difference ${
                                    primaryPick === '—'
                                      ? 'picks-table__cell--difference-empty'
                                      : 'picks-table__cell--difference-primary'
                                  }`
                                  const opponentClass = `picks-table__cell picks-table__cell--difference ${
                                    opponentPick === '—'
                                      ? 'picks-table__cell--difference-empty'
                                      : 'picks-table__cell--difference-opponent'
                                  }`

                                  return (
                                    <tr key={difference.matchupId}>
                                      <th
                                        scope="row"
                                        className="picks-table__participant picks-table__participant--body difference-panel__matchup"
                                      >
                                        <span className="difference-game__stage">{difference.stage}</span>
                                        <span className="difference-game__teams">
                                          {difference.teams[0].name}
                                          <span className="difference-game__vs">vs</span>
                                          {difference.teams[1].name}
                                        </span>
                                      </th>
                                      <td className={primaryClass}>
                                        <span>{primaryPick}</span>
                                      </td>
                                      <td className={opponentClass}>
                                        <span>{opponentPick}</span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default GameDifferenceSection
