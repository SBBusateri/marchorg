import type { TournamentDay } from '../types'

type DateSelectorProps = {
  days: TournamentDay[]
  selectedDayId: string | null
  onSelect: (id: string) => void
}

const DateSelector = ({ days, selectedDayId, onSelect }: DateSelectorProps) => (
  <div className="date-selector" role="tablist" aria-label="Tournament dates">
    {days.map((day) => {
      const isActive = day.id === selectedDayId
      return (
        <button
          key={day.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          className={isActive ? 'date-selector__item date-selector__item--active' : 'date-selector__item'}
          onClick={() => onSelect(day.id)}
        >
          <span className="date-selector__date">{day.date.toFormat('ccc · MMM d')}</span>
          <span className="date-selector__stage">{day.stage}</span>
        </button>
      )
    })}
  </div>
)

export default DateSelector
