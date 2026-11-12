import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { LinkedAccounts } from "./linked-accounts"
import { LocalAccountSetup } from "./local-account-setup"

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch roles and new fields from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const roles = profile?.roles || []

  // Helper for displaying optional fields
  const getDisplayValue = (value: string | undefined | null) => {
    return value || <span className="text-neutral-400 italic text-xs">En espera de asignación (por admin)</span>
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email?.split('@')[0]

  return (
    <div className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
        {/* HEADER UNIFORME */}
        <header className="pb-6 border-b border-neutral-100 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
              Inicio
            </Link>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900">
              Mi perfil
            </h1>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-medium text-neutral-900 capitalize">{fullName}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{user.email}</p>
            </div>
          </div>
        </header>

        {/* Personal Info Grid */}
        <section className="py-6 border-b border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-xs text-neutral-400 block">Correo electrónico</span>
            <p className="text-sm text-neutral-900 mt-1">{user.email}</p>
          </div>

          <div>
            <span className="text-xs text-neutral-400 block">Cédula de identidad</span>
            <p className="text-sm text-neutral-900 mt-1">{profile?.national_id || "No especificado"}</p>
          </div>

          <div>
            <span className="text-xs text-neutral-400 block">Teléfono</span>
            <p className="text-sm text-neutral-900 mt-1">{profile?.phone || "No registrado"}</p>
          </div>

          <div>
            <span className="text-xs text-neutral-400 block">Departamento</span>
            <p className="text-sm text-neutral-900 mt-1">{getDisplayValue(profile?.department)}</p>
          </div>

          <div>
            <span className="text-xs text-neutral-400 block">Cargo</span>
            <p className="text-sm text-neutral-900 mt-1">{getDisplayValue(profile?.job_title)}</p>
          </div>
        </section>

        {/* Roles Section */}
        <section className="py-6 border-b border-neutral-100 space-y-2">
          <span className="text-xs text-neutral-400 block">Roles y permisos</span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {roles.length > 0 ? (
              roles.map((role: string, idx: number) => (
                <span
                  key={role}
                  className="text-sm text-neutral-900 capitalize"
                >
                  {role}{idx < roles.length - 1 ? " ·" : ""}
                </span>
              ))
            ) : (
              <p className="text-xs text-neutral-400 italic">Sin roles asignados</p>
            )}
          </div>
        </section>

        {/* Account Info */}
        <section className="py-6 space-y-6">
          <LinkedAccounts identities={user.identities || []} />

          <LocalAccountSetup email={user.email} />

          <div className="text-xs text-neutral-400 pt-4 border-t border-neutral-100">
            ID de usuario: <span className="font-mono">{user.id}</span>
          </div>
        </section>
      </div>
    </div>
  )
}
