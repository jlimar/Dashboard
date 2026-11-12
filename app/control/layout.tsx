
export default function ControlLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-neutral-100 bg-white/95 backdrop-blur-xs px-6">
        <span className="text-sm font-medium text-neutral-900 tracking-tight">Control y fiscalización</span>
      </header>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
