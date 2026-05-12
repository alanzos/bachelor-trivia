import type { PropsWithChildren } from 'react'

type PanelProps = PropsWithChildren<{ className?: string; isDarkTheme?: boolean }>

export const Panel = ({ children, className = '', isDarkTheme = true }: PanelProps) => {
  const themeClass = isDarkTheme
    ? 'border-white/10 bg-white/8 shadow-black/20'
    : 'border-purple-200 bg-purple-100/30 shadow-purple-200/10'
  return (
    <section className={['rounded-3xl border p-5 shadow-2xl backdrop-blur-sm', themeClass, className].join(' ')}>
      {children}
    </section>
  )
}
