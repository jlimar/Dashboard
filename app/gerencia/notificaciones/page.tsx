import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getNotificationHistory } from "../actions"
import { ArrowLeft } from "lucide-react"
import { NotificationList } from "./notification-list"

export const dynamic = "force-dynamic"

export default async function NotificationsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect("/login")

    const notifications = await getNotificationHistory(0, 50)

    return (
        <main className="min-h-screen bg-white text-neutral-900 p-4">
            <div className="max-w-lg mx-auto">
                <div className="flex items-center gap-4 mb-6 sticky top-0 bg-white/95 backdrop-blur-xs py-4 z-20 border-b border-neutral-100">
                    <Link href="/gerencia" className="text-neutral-400 hover:text-neutral-900 transition-colors">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                    </Link>
                    <div>
                        <h1 className="text-base font-medium text-neutral-900 tracking-tight">Notificaciones</h1>
                    </div>
                </div>

                <NotificationList initialNotifications={notifications} />
            </div>
        </main>
    )
}
