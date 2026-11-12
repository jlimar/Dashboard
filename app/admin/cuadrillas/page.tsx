import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CuadrillasManager from "@/components/CuadrillasManager"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function AdminCuadrillasPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .single()

  const roles = (profile?.roles || []).map((r: string) => r.toLowerCase())
  if (!roles.includes("admin")) {
    return redirect("/unauthorized")
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* HEADER UNIFORME */}
        <header className="pb-6 border-b border-neutral-100 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              Volver al panel
            </Link>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900">
              Gestión de cuadrillas
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500">
              Administra los equipos de técnicos, asignando líderes y auxiliares.
            </p>
          </div>
        </header>

        <div>
          <CuadrillasManager />
        </div>
      </div>
    </main>
  )
}

