"use client"

import { createClient } from "@/lib/supabase/client"
import { LogOut } from "lucide-react"

export function LogoutButton({ className = "" }: { className?: string }) {
    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.href = "/login"
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            className={`text-xs text-neutral-400 hover:text-neutral-900 font-normal inline-flex items-center gap-1.5 transition-all duration-150 active:scale-[0.985] py-1 shrink-0 cursor-pointer ${className}`}
            title="Cerrar sesión"
        >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.25} />
            <span>Cerrar sesión</span>
        </button>
    )
}

