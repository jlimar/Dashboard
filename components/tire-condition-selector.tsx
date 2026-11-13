'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export const CAUCHOS_OPTIONS = [
  { value: '100% al 80% Estado Óptimo', pct: '100% – 80%', title: 'Óptimo' },
  { value: '79% al 50% Desgaste Medio', pct: '79% – 50%', title: 'Medio' },
  { value: '49% al 20% Planificar Cambio', pct: '49% – 20%', title: 'Revisar' },
  { value: '19% al 1% Riesgo Crítico', pct: '19% – 1%', title: 'Crítico' },
]

export interface TireConditionSelectorProps {
  value: string
  onChange: (value: string) => void
  id?: string
  name?: string
  label?: string
  required?: boolean
  className?: string
}

export function TireConditionSelector({
  value,
  onChange,
  id = 'estado_cauchos',
  name,
  label = 'Estado de cauchos / neumáticos',
  required = true,
  className,
}: TireConditionSelectorProps) {
  const isSelected = !!value

  return (
    <div className={cn('py-3.5 space-y-2.5', className)}>
      {/* Campo oculto para compatibilidad con FormData */}
      {name && <input type="hidden" name={name} value={value} required={required} />}

      {/* Encabezado limpio: tipografía pura, sin fondos ni sombreados de color */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs font-medium text-neutral-900 block tracking-tight"
        >
          {label}{' '}
          {!isSelected && (
            <span className="text-amber-500 font-normal" title="Campo obligatorio">
              *
            </span>
          )}
        </label>
        {!isSelected ? (
          <span className="text-xs text-neutral-400 font-normal">
            Selección pendiente
          </span>
        ) : (
          <span className="text-xs font-mono text-neutral-400 font-normal">
            Confirmado
          </span>
        )}
      </div>

      {/* Botones de selección directa en 1 toque */}
      <div
        className={cn(
          'grid grid-cols-2 sm:grid-cols-4 gap-2 border-b pb-2.5 transition-colors',
          !isSelected ? 'border-amber-400/60' : 'border-neutral-100',
        )}
      >
        {CAUCHOS_OPTIONS.map((item) => {
          const active = value === item.value
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                'py-2 px-2.5 text-left border-b-2 transition-all duration-150 active:scale-[0.985] cursor-pointer',
                active
                  ? 'border-neutral-900 text-neutral-900 font-medium'
                  : 'border-transparent hover:border-neutral-300 text-neutral-400 hover:text-neutral-700 bg-transparent',
              )}
            >
              <div
                className={cn(
                  'text-xs font-mono tabular-nums leading-tight',
                  active ? 'text-neutral-900 font-medium' : 'text-neutral-500',
                )}
              >
                {item.pct}
              </div>
              <div
                className={cn(
                  'text-[11px] mt-0.5 leading-tight',
                  active ? 'text-neutral-900 font-medium' : 'text-neutral-400',
                )}
              >
                {item.title}
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-neutral-400 leading-tight">
        Inspecciona visualmente el dibujo y la presión de los cauchos antes de confirmar.
      </p>
    </div>
  )
}
