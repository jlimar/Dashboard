"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { setupLocalUser } from "./actions"

interface LocalAccountSetupProps {
  email?: string
}

export function LocalAccountSetup({ email }: LocalAccountSetupProps) {
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const isGoogleUser = email && !email.includes("@dashboard.local")

  return (
    <div className="space-y-4 pt-6 border-t border-neutral-100">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-900">
          {isGoogleUser ? "Configurar acceso local" : "Cambiar contraseña"}
        </span>
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
          >
            {isGoogleUser ? "Asignar usuario/clave" : "Modificar"}
          </button>
        )}
      </div>

      {isGoogleUser && !isOpen && (
        <p className="text-xs text-neutral-500 leading-relaxed">
          Actualmente inicias sesión mediante Google. Si deseas poder iniciar sesión escribiendo un usuario y contraseña, configúralo aquí. Podrás seguir usando Google.
        </p>
      )}

      {isOpen && (
        <form
          action={async (formData) => {
            setLoading(true)
            const result = await setupLocalUser(formData)
            setLoading(false)
            if (result.success) {
              toast.success(result.message)
              setIsOpen(false)
              router.refresh()
            } else {
              toast.error(result.message)
            }
          }}
          className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="space-y-4 pt-1">
            {isGoogleUser && (
              <div className="space-y-1">
                <label className="text-xs text-neutral-500 block">Nuevo usuario</label>
                <input
                  name="username"
                  type="text"
                  placeholder="Ej: jlima"
                  className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-neutral-500 block">Nueva contraseña</label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                required
                minLength={6}
              />
            </div>

            <div className="flex items-center justify-end gap-5 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
              >
                {loading ? "Guardando..." : "Guardar credenciales"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
