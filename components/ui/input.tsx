import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-neutral-900 placeholder:text-neutral-400 selection:bg-neutral-900 selection:text-white w-full min-w-0 bg-transparent border-0 border-b border-neutral-200 focus:border-neutral-900 rounded-none px-0 py-1.5 text-sm text-neutral-900 transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-xs file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-red-500',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
