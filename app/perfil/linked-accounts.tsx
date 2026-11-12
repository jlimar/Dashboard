"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Chrome, Link2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { UserIdentity } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

interface LinkedAccountsProps {
  identities: UserIdentity[]
}

export function LinkedAccounts({ identities }: LinkedAccountsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Find google identity
  const googleIdentity = identities.find(id => id.provider === "google")

  const handleLinkGoogle = async () => {
    setLoading(true)
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo,
        },
      })
      if (error) throw error
    } catch (error: any) {
      console.error("Error linking google:", error)
      toast.error(`Error: ${error.message || "No se pudo vincular la cuenta"}`)
      setLoading(false)
    }
  }

  const handleUnlinkGoogle = async () => {
    if (!googleIdentity) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.unlinkIdentity(googleIdentity)
      if (error) throw error

      toast.success("Cuenta de Google desvinculada correctamente")
      router.refresh()
    } catch (error: any) {
      console.error("Error unlinking google:", error)
      toast.error(`Error: ${error.message || "No se pudo desvincular la cuenta"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <span className="text-xs text-neutral-400 block">Cuentas vinculadas</span>
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <Chrome className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
          <div>
            <p className="text-sm text-neutral-900">Google</p>
            <p className="text-xs text-neutral-500">
              {googleIdentity
                ? `Conectado (${googleIdentity.identity_data?.email || "Google Account"})`
                : "No conectado"}
            </p>
          </div>
        </div>
        {googleIdentity ? (
          <button
            type="button"
            onClick={handleUnlinkGoogle}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 transition-colors disabled:opacity-40"
          >
            <Unlink className="h-3.5 w-3.5" strokeWidth={1.5} />
            {loading ? "Procesando..." : "Desvincular"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLinkGoogle}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
          >
            <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            {loading ? "Procesando..." : "Vincular"}
          </button>
        )}
      </div>
    </div>
  )
}
