'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
  destructive?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title = 'Confirmar eliminación',
  description = 'Esta acción no se puede deshacer.',
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  onConfirm,
  isLoading = false,
  destructive = true,
}: DeleteConfirmDialogProps) {
  const [submitting, setSubmitting] = React.useState(false)
  const busy = isLoading || submitting

  const handleConfirm = async () => {
    try {
      setSubmitting(true)
      await onConfirm()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm animate-in fade-in zoom-in-95 duration-150 p-6"
      >
        <DialogHeader className="text-left space-y-1.5">
          <DialogTitle className="text-base font-medium text-neutral-900">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-sm text-neutral-500 leading-relaxed">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="text-xs text-neutral-500 hover:text-neutral-900 transition-all duration-150 active:scale-[0.985] disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            className={cn(
              'text-xs font-medium transition-all duration-150 active:scale-[0.985] disabled:opacity-50 cursor-pointer',
              destructive
                ? 'text-red-600 hover:text-red-700'
                : 'text-neutral-900 hover:text-neutral-600',
            )}
          >
            {busy ? 'Procesando...' : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

