import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-normal transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none bg-transparent",
  {
    variants: {
      variant: {
        default: 'text-neutral-900 font-medium hover:text-neutral-600',
        destructive: 'text-red-600 hover:text-red-700',
        outline: 'text-neutral-600 hover:text-neutral-900',
        secondary: 'text-neutral-500 hover:text-neutral-900',
        ghost: 'text-neutral-400 hover:text-neutral-900',
        link: 'text-neutral-600 hover:text-neutral-900 underline-offset-4 hover:underline',
      },
      size: {
        default: 'py-1.5 px-1',
        sm: 'text-xs py-1 px-1 gap-1',
        lg: 'text-sm py-2 px-1',
        icon: 'p-1 text-neutral-400 hover:text-neutral-900',
        'icon-sm': 'p-0.5 text-neutral-400 hover:text-neutral-900',
        'icon-lg': 'p-1.5 text-neutral-400 hover:text-neutral-900',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
