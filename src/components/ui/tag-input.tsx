import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "./input"

export interface TagInputProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function TagInput({
  tags,
  onTagsChange,
  placeholder = "Type and press Enter or Comma",
  className,
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("")

  const normalizeExtension = (value: string): string => {
    let ext = value.trim().toLowerCase()
    if (ext && !ext.startsWith(".")) {
      ext = "." + ext
    }
    return ext
  }

  const addTag = (value: string) => {
    const normalized = normalizeExtension(value)
    if (normalized.length > 1 && !tags.includes(normalized)) {
      onTagsChange([...tags, normalized])
      setInputValue("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      if (inputValue.trim()) {
        addTag(inputValue)
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      removeTag(tags[tags.length - 1])
    }
  }

  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 min-h-[2.5rem] w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {tags.map((tag, index) => (
        <div
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 px-2.5 py-1 text-xs text-slate-200 border border-slate-600"
        >
          <span>{tag}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-sm hover:bg-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-500 p-0.5 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3 text-slate-400 hover:text-slate-200" />
            </button>
          )}
        </div>
      ))}
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : ""}
        disabled={disabled}
        className="flex-1 min-w-[120px] border-0 bg-transparent p-0 text-slate-200 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  )
}


