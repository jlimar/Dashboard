import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { FileText, ArrowLeft, Wrench } from "lucide-react"

export default async function SupervisionHubPage() {
  const supabase = await createClient()

  // 1. Verificar autenticación
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  // 2. Obtener Perfil del Usuario
  const { data: profile } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .single()

  const roles = (profile?.roles || []).map((r: string) => r.toLowerCase())
  const hasAccess = roles.includes("admin") || roles.includes("reportes")

  if (!hasAccess) {
    return redirect("/unauthorized")
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900 px-6 py-10 md:py-14">
      <div className="max-w-3xl mx-auto">
        <header className="pb-6 mb-4 border-b border-neutral-100 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-light tracking-tight text-neutral-900">Supervisión</h1>
            <p className="text-sm text-neutral-500 mt-1">Módulo de control para operaciones en calle y almacén.</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Volver al inicio
          </Link>
        </header>

        <div className="divide-y divide-neutral-100">
          <Link
            href="/supervision/reporte-diario"
            className="group py-6 flex items-center justify-between gap-4 transition-colors"
          >
            <div className="flex items-start gap-4">
              <FileText className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <h2 className="text-base font-medium text-neutral-900">Reporte Diario</h2>
                <p className="text-sm text-neutral-500 mt-0.5">Llenar el reporte de las operaciones realizadas.</p>
              </div>
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0">
              Acceder →
            </span>
          </Link>

          <Link
            href="/supervision/control-equipamiento"
            className="group py-6 flex items-center justify-between gap-4 transition-colors"
          >
            <div className="flex items-start gap-4">
              <Wrench className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <h2 className="text-base font-medium text-neutral-900">Control de Equipamiento</h2>
                <p className="text-sm text-neutral-500 mt-0.5">Auditoría de herramientas y kits FTTH del equipo de técnicos.</p>
              </div>
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0">
              Auditar equipos →
            </span>
          </Link>
        </div>
      </div>
    </main>
  )
}
