
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getFleetStatus } from "./actions"
import { LiveFleetDashboard } from "./components/live-fleet-dashboard"
import { RealtimeNotifications } from "./components/realtime-notifications"
import { NotificationBell } from "./components/notification-bell"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function GerenciaDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect("/login")

    // Fetch Fleet Data
    const fleet = await getFleetStatus()

    return (
        <main className="min-h-screen bg-white text-neutral-900 p-4 md:p-12 pb-24">
            <RealtimeNotifications />

            <div className="max-w-7xl mx-auto space-y-8">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-neutral-100">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-light text-neutral-900 tracking-tight">Centro de control</h1>
                        <p className="text-neutral-500 mt-1 text-sm md:text-base">Monitoreo de flota y operaciones en tiempo real.</p>
                    </div>

                    <div className="flex flex-wrap gap-4 sm:gap-5 items-center">
                        <NotificationBell />
                        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
                            Inicio
                        </Link>
                    </div>
                </div>

                {/* MAIN DASHBOARD */}
                <Suspense fallback={<div className="h-96 flex items-center justify-center text-sm text-neutral-400">Cargando flota...</div>}>
                    <LiveFleetDashboard vehicles={fleet} />
                </Suspense>
            </div>
        </main>
    )
}
