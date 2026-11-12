'use client'

import * as React from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface CustomDropdownOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface CustomDropdownProps {
  value?: string
  onChange: (value: string) => void
  options: CustomDropdownOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
  searchable?: boolean
  searchPlaceholder?: string
  emptyText?: string
  align?: 'start' | 'center' | 'end'
  name?: string
  id?: string
  required?: boolean
  ariaLabel?: string
}

export function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  searchable = false,
  searchPlaceholder = 'Buscar...',
  emptyText = 'Sin resultados',
  align = 'start',
  name,
  id,
  required,
  ariaLabel,
}: CustomDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  )

  const filteredOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)),
    )
  }, [options, query])

  React.useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  return (
    <div className={cn('relative w-full', className)}>
      {name ? (
        <input type="hidden" name={name} value={value ?? ''} required={required} />
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-expanded={open}
            className={cn(
              'w-full flex items-center justify-between gap-2 bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-left outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              selectedOption ? 'text-neutral-900' : 'text-neutral-400',
              triggerClassName,
            )}
          >
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 shrink-0 text-neutral-400 transition-transform duration-150',
                open && 'rotate-180 text-neutral-700',
              )}
              strokeWidth={1.5}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          sideOffset={6}
          className={cn(
            'w-[var(--radix-popover-trigger-width)] min-w-[180px] p-1 bg-white/95 backdrop-blur-xs border border-neutral-200/70 rounded-lg shadow-sm animate-in fade-in zoom-in-95 duration-150',
            contentClassName,
          )}
        >
          {searchable ? (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-neutral-100">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" strokeWidth={1.5} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 outline-none"
                autoFocus
              />
            </div>
          ) : null}

          <div className="max-h-60 overflow-y-auto divide-y divide-neutral-50">
            {filteredOptions.length === 0 ? (
              <div className="px-2.5 py-2 text-xs text-neutral-400 text-center">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm rounded-md transition-colors',
                      option.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-neutral-50 cursor-pointer',
                      isSelected ? 'text-neutral-900 font-medium' : 'text-neutral-600 font-normal',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{option.label}</div>
                      {option.description ? (
                        <div className="truncate text-[11px] text-neutral-400">
                          {option.description}
                        </div>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 shrink-0 text-neutral-700" strokeWidth={1.5} />
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

