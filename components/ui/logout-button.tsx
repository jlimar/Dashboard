"use client"

import { createClient } from "@/lib/supabase/client"

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
            className={`text-xs text-neutral-400 hover:text-neutral-900 font-normal transition-all duration-150 active:scale-[0.985] py-1 shrink-0 cursor-pointer ${className}`}
        >
            Cerrar sesión
        </button>
    )
}

