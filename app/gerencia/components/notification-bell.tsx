"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { getNotificationHistory } from "../actions"

export function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        const checkUnread = async () => {
            const lastCheck = localStorage.getItem('last_notification_check') || new Date(0).toISOString()
            const notifications = await getNotificationHistory(0, 20) // Fetch just enough to check recent ones

            const count = notifications.filter(n => new Date(n.timestamp) > new Date(lastCheck)).length
            setUnreadCount(count)
        }

        checkUnread()
        // Optional: Poll every minute or listen to realtime events if needed
        const interval = setInterval(checkUnread, 60000)
        return () => clearInterval(interval)
    }, [])

    return (
        <Link
            href="/gerencia/notificaciones"
            className="relative inline-flex items-center justify-center p-1 text-neutral-400 hover:text-neutral-900 transition-colors"
            title="Ver historial de notificaciones"
        >
            <span className="sr-only">Notificaciones</span>
            <Bell className="w-4 h-4" strokeWidth={1.25} />

            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 text-[10px] font-medium leading-none text-red-600 tabular-nums animate-in zoom-in-50 duration-300">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </Link>
    )
}
