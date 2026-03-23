import type { NeedsToWinMap } from '../types'

interface NeedsToWinTableProps {
  needsToWin: NeedsToWinMap
  participants: string[]
}

const NeedsToWinTable = ({ needsToWin, participants }: NeedsToWinTableProps) => {
  const maxRows = participants.reduce((max, participant) => {
    const entries = needsToWin[participant] ?? []
    return Math.max(max, entries.length)
  }, 0)

  if (maxRows === 0) {
    return null
  }

  const rows = Array.from({ length: maxRows })

  return (
    <section className="needs-table" aria-labelledby="needs-to-win-title">
      <header className="needs-table__header">
        <h2 id="needs-to-win-title" className="needs-table__title">
          Needs to Win
        </h2>
      </header>

      <div className="needs-table__wrapper" role="region" aria-labelledby="needs-to-win-title">
        <table>
          <thead>
            <tr>
              {participants.map((participant) => (
                <th key={participant} scope="col">
                  {participant}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((_, rowIndex) => (
              <tr key={`needs-row-${rowIndex}`}>
                {participants.map((participant) => {
                  const entry = needsToWin[participant]?.[rowIndex] ?? '—'
                  return <td key={`${participant}-needs-${rowIndex}`}>{entry}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default NeedsToWinTable
