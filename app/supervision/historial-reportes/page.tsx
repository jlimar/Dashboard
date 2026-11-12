import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import HistorialLogic from "@/components/HistorialLogic"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function HistorialReportesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, roles")
    .eq("id", user.id)
    .single()

  const roles = (profile?.roles || []).map((r: string) => r.toLowerCase())
  const hasAccess = roles.includes("admin") || roles.includes("reportes")

  if (!hasAccess) {
    return redirect("/unauthorized")
  }

  const usuarioActual = {
    id: user.id,
    nombre: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Usuario",
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900 px-6 py-10 md:py-14">
      {/* Navegación Pestañas y Volver */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-8 border-b border-neutral-100 max-w-5xl mx-auto gap-4">
        <Link
          href="/supervision"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Volver a Supervisión
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/supervision/reporte-diario"
            className="text-sm text-neutral-400 hover:text-neutral-900 transition-colors pb-1"
          >
            Nuevo Reporte
          </Link>
          <Link
            href="/supervision/historial-reportes"
            className="text-sm font-medium text-neutral-900 border-b border-neutral-900 pb-1"
          >
            Mi Historial
          </Link>
        </div>
      </div>

      <HistorialLogic usuarioActual={usuarioActual} />
    </main>
  )
}
