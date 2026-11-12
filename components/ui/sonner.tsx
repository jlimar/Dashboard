'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'
import { Check, X, AlertCircle, Info, Loader2 } from 'lucide-react'

export const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-center"
      richColors={false}
      className="toaster group"
      icons={{
        success: <Check className="w-3.5 h-3.5 text-neutral-900" strokeWidth={1.5} />,
        error: <X className="w-3.5 h-3.5 text-neutral-900" strokeWidth={1.5} />,
        warning: <AlertCircle className="w-3.5 h-3.5 text-neutral-700" strokeWidth={1.5} />,
        info: <Info className="w-3.5 h-3.5 text-neutral-600" strokeWidth={1.5} />,
        loading: <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin" strokeWidth={1.5} />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            'group toast !bg-white/95 !backdrop-blur-md !border !border-neutral-200/70 !text-neutral-900 !shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] !rounded-full !px-4 !py-2 !text-xs !font-normal !gap-2.5',
          title: '!text-xs !font-normal !text-neutral-900 tracking-tight',
          description: '!text-xs !text-neutral-500',
          actionButton: '!bg-neutral-900 !text-white !text-xs !font-medium !rounded-full !px-3 !py-1',
          cancelButton: '!text-neutral-500 hover:!text-neutral-900 !text-xs',
          closeButton: '!border-neutral-200 !text-neutral-400 hover:!text-neutral-900',
        },
      }}
      {...props}
    />
  )
}
