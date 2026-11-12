"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation" // [NEW]

export function RealtimeNotifications() {
    const router = useRouter() // [NEW]

    useEffect(() => {
        const supabase = createClient()

        // Listener for FAULTS (Fallas)
        const faultsChannel = supabase
            .channel('realtime-faults')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'fallas' },
                (payload) => {
                    const newFault = payload.new as any

                    // Custom Toast - Minimalist Style
                    toast.custom(() => (
                        <div className="w-[340px] flex items-start gap-3 bg-white/95 backdrop-blur-xs border-b border-neutral-200/70 px-4 py-3 pointer-events-auto animate-in slide-in-from-top-5 fade-in duration-300">
                            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" strokeWidth={1.5} />

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-medium text-neutral-900 leading-tight">
                                        Nueva falla reportada
                                    </h3>
                                    <span className="text-[11px] text-neutral-400 shrink-0">
                                        Prioridad: {newFault.prioridad}
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-500 leading-snug line-clamp-2 mt-1">
                                    {newFault.descripcion}
                                </p>
                            </div>
                        </div>
                    ), { duration: 5000 })

                    // Audio Alert
                    const audio = new Audio('/notification.mp3') // Assuming we might add one, or browser default beep not possible without interaction. 
                    // Use Speech Synthesis for alert
                    if (window.speechSynthesis) {
                        const u = new SpeechSynthesisUtterance("Alerta gerente. Nueva falla de vehículo reportada.")
                        window.speechSynthesis.speak(u)
                    }

                    // Refresh data
                    router.refresh()
                }
            )
            .subscribe()

        // [NEW] Listener for TRIPS (Reports)
        const tripsChannel = supabase
            .channel('realtime-trips')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reportes' }, // Listen to everything on reportes
                (payload) => {
                    console.log("Trip update detected, refreshing dashboard...", payload)
                    router.refresh()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(faultsChannel)
            supabase.removeChannel(tripsChannel)
        }
    }, [router])

    return null // Invisible component
}
