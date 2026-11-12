'use client'

import * as React from 'react'
import { CustomDropdown } from '@/components/ui/custom-dropdown'
import { cn } from '@/lib/utils'

export const CAUCHOS_OPTIONS = [
  {
    value: '100% al 80% Estado Óptimo',
    label: '100% al 80% · Estado Óptimo',
    description: 'Neumáticos nuevos o con desgaste mínimo, dibujo profundo',
  },
  {
    value: '79% al 50% Desgaste Medio',
    label: '79% al 50% · Desgaste Regular',
    description: 'Dibujo y presión en condiciones normales para transitar',
  },
  {
    value: '49% al 20% Planificar Cambio',
    label: '49% al 20% · Planificar Cambio',
    description: 'Desgaste notable en la banda, requiere reemplazo pronto',
  },
  {
    value: '19% al 1% Riesgo Crítico',
    label: '19% al 1% · Riesgo Crítico',
    description: 'Neumático liso o deformado, peligro para circular',
  },
]

const QUICK_CHIPS = [
  { value: '100% al 80% Estado Óptimo', pct: '100% - 80%', title: 'Óptimo' },
  { value: '79% al 50% Desgaste Medio', pct: '79% - 50%', title: 'Medio' },
  { value: '49% al 20% Planificar Cambio', pct: '49% - 20%', title: 'Revisar' },
  { value: '19% al 1% Riesgo Crítico', pct: '19% - 1%', title: 'Crítico' },
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
    <div className={cn('py-4 border-b border-neutral-100 space-y-3', className)}>
      {/* Header del campo con estado de validación visible */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs font-medium text-neutral-900 block tracking-tight"
        >
          {label}
        </label>
        {!isSelected ? (
          <span className="text-[11px] font-medium text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded-full">
            Selección requerida *
          </span>
        ) : (
          <span className="text-[11px] font-mono text-neutral-400">
            Confirmado
          </span>
        )}
      </div>

      {/* Desplegable principal mejorado */}
      <CustomDropdown
        id={id}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        placeholder="Toca aquí para seleccionar el estado de los cauchos..."
        triggerClassName={cn(
          'w-full py-2.5 text-sm transition-colors',
          !isSelected
            ? 'border-amber-400/80 text-neutral-700 font-medium'
            : 'border-neutral-200 text-neutral-900',
        )}
        options={CAUCHOS_OPTIONS}
      />

      {/* Botones directos de 1 toque (evita que los choferes se queden atascados) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
        {QUICK_CHIPS.map((chip) => {
          const active = value === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onChange(chip.value)}
              className={cn(
                'py-2 px-2.5 text-left border-b-2 transition-all duration-150 active:scale-[0.985] cursor-pointer',
                active
                  ? 'border-neutral-900 bg-neutral-50 text-neutral-900 font-medium'
                  : 'border-neutral-200/60 hover:border-neutral-400 text-neutral-500 bg-transparent',
              )}
            >
              <div
                className={cn(
                  'text-xs font-mono tabular-nums leading-tight',
                  active ? 'text-neutral-900 font-medium' : 'text-neutral-500',
                )}
              >
                {chip.pct}
              </div>
              <div
                className={cn(
                  'text-[11px] mt-0.5 leading-tight',
                  active ? 'text-neutral-900' : 'text-neutral-400',
                )}
              >
                {chip.title}
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

