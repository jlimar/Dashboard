import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import EquipmentHistoryViewer from "@/components/EquipmentHistoryViewer"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function EquipmentHistoryPage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Verificar rol (supervisor o admin)
  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', session.user.id)
    .single()

  const hasAccess = profile?.roles?.some((r: string) => 
    ['admin', 'supervisor', 'gerencia', 'reportes'].includes(r)
  )

  if (!hasAccess) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-6xl mx-auto mb-6 pb-4 border-b border-neutral-100">
        <Link 
          href="/supervision/control-equipamiento"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
          Volver a control de equipamiento
        </Link>
      </div>

      <EquipmentHistoryViewer />
    </div>
  )
}
