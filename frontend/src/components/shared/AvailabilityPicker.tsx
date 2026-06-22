import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const SLOTS = ["morning", "afternoon", "evening"] as const
type Slot = (typeof SLOTS)[number]
const SLOT_LABELS: Record<Slot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
}

interface AvailabilityEntry {
  day: string
  slots: string[]
}

interface Props {
  value: AvailabilityEntry[]
  onChange: (v: AvailabilityEntry[]) => void
}

export function AvailabilityPicker({ value = [], onChange }: Props) {
  const toggle = (day: string, slot: Slot) => {
    const existing = value.find((v) => v.day === day)
    if (!existing) {
      onChange([...value, { day, slots: [slot] }])
      return
    }
    const hasSlot = existing.slots.includes(slot)
    const newSlots = hasSlot ? existing.slots.filter((s) => s !== slot) : [...existing.slots, slot]
    const updated = value
      .map((v) => (v.day === day ? { ...v, slots: newSlots } : v))
      .filter((v) => v.slots.length > 0)
    onChange(updated)
  }

  const isChecked = (day: string, slot: Slot) =>
    value.find((v) => v.day === day)?.slots.includes(slot) ?? false

  return (
    <div role="group" aria-label="Availability picker" className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-16 py-2 text-left text-sm font-medium text-muted-foreground">Day</th>
            {SLOTS.map((slot) => (
              <th key={slot} className="py-2 text-center text-sm font-medium text-muted-foreground">
                {SLOT_LABELS[slot]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) => (
            <tr key={day} className={cn("border-t transition-colors hover:bg-muted/30")}>
              <td className="py-2 pr-2 font-medium">{day}</td>
              {SLOTS.map((slot) => (
                <td key={slot} className="py-2 text-center">
                  <Checkbox
                    id={`${day}-${slot}`}
                    checked={isChecked(day, slot)}
                    onCheckedChange={() => toggle(day, slot)}
                    aria-label={`${day} ${SLOT_LABELS[slot]}`}
                    className="mx-auto"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
