import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/client/lib/cn'

const buttonVariants = cva(
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-line px-4 font-semibold text-ink no-underline transition-[transform,box-shadow] select-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary shadow-retro',
        secondary: 'bg-surface shadow-retro',
        ghost: 'border-transparent bg-transparent shadow-none hover:bg-surface-2 active:translate-x-0 active:translate-y-0',
        danger: 'bg-surface text-danger shadow-retro',
      },
      size: {
        md: 'text-base',
        sm: 'min-h-9 rounded-lg px-3 text-sm',
        lg: 'min-h-13 px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} type={asChild ? undefined : (type ?? 'button')} {...props} />
}
