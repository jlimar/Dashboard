import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"

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
    <main className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
        {/* HEADER UNIFORME */}
        <header className="pb-6 border-b border-neutral-100 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              Inicio
            </Link>
            <LogoutButton />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900">
              Supervisión
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500">
              Módulo de control para operaciones en calle y almacén.
            </p>
          </div>
        </header>

        <div className="divide-y divide-neutral-100 border-b border-neutral-100">
          <Link
            href="/supervision/reporte-diario"
            className="group flex items-center justify-between gap-4 py-4 sm:py-5 px-2.5 -mx-2.5 rounded-md hover:bg-neutral-50/80 active:scale-[0.99] transition-all duration-150"
          >
            <div className="min-w-0 pr-2">
              <h2 className="text-sm sm:text-base font-medium text-neutral-900 group-hover:text-neutral-700 transition-colors">
                Reporte diario
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 leading-relaxed measure-copy">
                Llenar el reporte de las operaciones realizadas.
              </p>
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-neutral-900 transition-colors shrink-0 flex items-center gap-1">
              <span>Acceder</span>
              <span className="inline-block transition-transform duration-150 group-hover:translate-x-1">→</span>
            </span>
          </Link>

          <Link
            href="/supervision/control-equipamiento"
            className="group flex items-center justify-between gap-4 py-4 sm:py-5 px-2.5 -mx-2.5 rounded-md hover:bg-neutral-50/80 active:scale-[0.99] transition-all duration-150"
          >
            <div className="min-w-0 pr-2">
              <h2 className="text-sm sm:text-base font-medium text-neutral-900 group-hover:text-neutral-700 transition-colors">
                Control de equipamiento
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 leading-relaxed measure-copy">
                Auditoría de herramientas y kits FTTH del equipo de técnicos.
              </p>
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-neutral-900 transition-colors shrink-0 flex items-center gap-1">
              <span>Auditar equipos</span>
              <span className="inline-block transition-transform duration-150 group-hover:translate-x-1">→</span>
            </span>
          </Link>
        </div>
      </div>
    </main>
  )
}

