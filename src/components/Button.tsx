import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; isDarkTheme?: boolean }>

const getVariantClasses = (variant: Variant, isDarkTheme: boolean): string => {
  const variants: Record<Variant, Record<string, string>> = {
    primary: {
      dark: 'bg-amber-300 text-slate-950 hover:bg-amber-200 shadow-lg shadow-amber-500/20',
      light: 'bg-purple-700 text-white hover:bg-purple-800 shadow-lg shadow-purple-700/30',
    },
    secondary: {
      dark: 'bg-slate-800 text-white hover:bg-slate-700 ring-1 ring-white/10',
      light: 'bg-purple-200 text-purple-900 hover:bg-purple-300 ring-1 ring-purple-300',
    },
    ghost: {
      dark: 'bg-white/5 text-white hover:bg-white/10 ring-1 ring-white/10',
      light: 'bg-purple-100 text-purple-900 hover:bg-purple-200 ring-1 ring-purple-400',
    },
    danger: {
      dark: 'bg-rose-500 text-white hover:bg-rose-400',
      light: 'bg-rose-600 text-white hover:bg-rose-500',
    },
  }
  return variants[variant][isDarkTheme ? 'dark' : 'light']
}

export const Button = ({ variant = 'secondary', className = '', isDarkTheme = true, children, ...props }: ButtonProps) => (
  <button
    {...props}
    className={[
      'inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
      getVariantClasses(variant, isDarkTheme),
      className,
    ].join(' ')}
  >
    {children}
  </button>
)
