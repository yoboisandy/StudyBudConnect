import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Option {
  value: string
  label: string
}

interface Props {
  options: Option[]
  value: string[]
  onChange: (v: string[]) => void
  columns?: 1 | 2
  className?: string
}

export function MultiSelectCheckbox({ options, value = [], onChange, columns = 2, className }: Props) {
  const toggle = (v: string) => {
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v]
    onChange(next)
  }

  return (
    <div
      className={cn("grid gap-3", columns === 2 ? "grid-cols-2" : "grid-cols-1", className)}
      role="group"
    >
      {options.map((opt) => (
        <div key={opt.value} className="flex items-center gap-2">
          <Checkbox
            id={opt.value}
            checked={value.includes(opt.value)}
            onCheckedChange={() => toggle(opt.value)}
          />
          <Label htmlFor={opt.value} className="cursor-pointer font-normal">
            {opt.label}
          </Label>
        </div>
      ))}
    </div>
  )
}
