import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import EquipmentControlFormLogic from "@/components/EquipmentControlFormLogic"

export default async function ControlEquipamientoPage() {
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
    <main className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-10">
      {/* Navegación y Volver */}
      <div className="flex items-center justify-between gap-4 mb-8 pb-4 border-b border-neutral-100 max-w-5xl mx-auto">
        <Link
          href="/supervision"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
          Volver a supervisión
        </Link>
        <LogoutButton />
      </div>

      {/* Aquí inyectamos el componente modular */}
      <EquipmentControlFormLogic
        usuarioActual={usuarioActual}
      />
    </main>
  )
}
