
import { ShieldCheck } from "lucide-react"

export default function ControlLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-neutral-100 bg-white/95 backdrop-blur-xs px-6">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
          <ShieldCheck className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
          <span>Control y fiscalización</span>
        </div>
      </header>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
