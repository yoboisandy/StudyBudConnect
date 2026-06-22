import { useState, useRef } from "react"
import type { KeyboardEvent } from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  className?: string
}

export function CreatableTagInput({
  value = [],
  onChange,
  placeholder = "Type and press Enter…",
  className,
}: Props) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const tag = raw.trim().toUpperCase().replace(/[^A-Z0-9 _-]/g, "")
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
    setInput("")
  }

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === "Backspace" && !input && value.length) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div
      className={cn(
        "border-input ring-offset-background focus-within:ring-ring flex min-h-10 flex-wrap gap-1.5 rounded-md border bg-transparent px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-offset-2",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(tag)
            }}
            className="ring-ring rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input && addTag(input)}
        placeholder={value.length === 0 ? placeholder : ""}
        className="h-auto min-w-24 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        aria-label="Add course tag"
      />
    </div>
  )
}
