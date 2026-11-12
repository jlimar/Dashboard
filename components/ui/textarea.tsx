import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'placeholder:text-neutral-400 flex field-sizing-content min-h-16 w-full bg-transparent border-0 border-b border-neutral-200 focus:border-neutral-900 rounded-none px-0 py-1.5 text-sm text-neutral-900 transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
