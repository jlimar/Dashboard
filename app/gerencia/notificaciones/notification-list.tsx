"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Car, ArrowRightLeft, Clock, X, Loader2, CheckCircle } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { NotificationItem } from "../actions"
import { getNotificationHistory } from "../actions"

export function NotificationList({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
    const [notifications, setNotifications] = useState(initialNotifications)
    const [offset, setOffset] = useState(50)
    const [hasMore, setHasMore] = useState(true)
    const [loading, setLoading] = useState(false)
    const [lastReadTime, setLastReadTime] = useState<string | null>(null)

    useEffect(() => {
        // 1. Get previous read time to show dots
        const lastCheck = localStorage.getItem('last_notification_check')
        setLastReadTime(lastCheck || new Date(0).toISOString())

        // 2. Update read time to now (so badge clears on next check)
        localStorage.setItem('last_notification_check', new Date().toISOString())
    }, [])

    const loadMore = async () => {
        if (loading || !hasMore) return
        setLoading(true)

        // Load 10 more
        const newItems = await getNotificationHistory(offset, 10)

        if (newItems.length < 10) {
            setHasMore(false)
        }

        if (newItems.length > 0) {
            setNotifications(prev => [...prev, ...newItems])
            setOffset(prev => prev + 10)
        }

        setLoading(false)
    }

    const removeNotification = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'FALLA': return <AlertTriangle className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
            case 'SALIDA': return <Car className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
            case 'ENTRADA': return <ArrowRightLeft className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
            case 'REPARACION': return <CheckCircle className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
            default: return <Clock className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
        }
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'FALLA': return 'Falla'
            case 'SALIDA': return 'Salida'
            case 'ENTRADA': return 'Entrada'
            case 'REPARACION': return 'Reparación'
            default: return 'Alerta'
        }
    }

    const getTypeTextColor = (type: string) => {
        switch (type) {
            case 'FALLA': return 'text-amber-600'
            case 'SALIDA': return 'text-neutral-500'
            case 'ENTRADA': return 'text-emerald-600'
            case 'REPARACION': return 'text-emerald-600'
            default: return 'text-neutral-500'
        }
    }

    // Group notifications by date
    const groupedNotifications = notifications.reduce((groups, notification) => {
        const date = new Date(notification.timestamp)
        let key = 'Anterior'

        const today = new Date()
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        if (date.toDateString() === today.toDateString()) {
            key = 'Hoy'
        } else if (date.toDateString() === yesterday.toDateString()) {
            key = 'Ayer'
        } else {
            key = format(date, "d 'de' MMMM", { locale: es })
        }

        if (!groups[key]) {
            groups[key] = []
        }
        groups[key].push(notification)
        return groups
    }, {} as Record<string, NotificationItem[]>)

    return (
        <div className="space-y-8 pb-8">
            {notifications.length === 0 ? (
                <div className="text-center py-20">
                    <Clock className="w-5 h-5 text-neutral-300 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm text-neutral-400">Sin actividad reciente</p>
                </div>
            ) : (
                <>
                    {Object.entries(groupedNotifications).map(([dateLabel, groupItems]) => (
                        <div key={dateLabel} className="space-y-2">
                            <h2 className="text-xs font-medium text-neutral-400 pb-2 border-b border-neutral-100">{dateLabel}</h2>
                            <div className="divide-y divide-neutral-100">
                                <AnimatePresence>
                                    {groupItems.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            initial={{ opacity: 1, x: 0, height: "auto" }}
                                            exit={{ opacity: 0, x: 200, height: 0, marginBottom: 0 }}
                                            transition={{ duration: 0.2 }}
                                            drag="x"
                                            dragConstraints={{ left: 0, right: 0 }}
                                            onDragEnd={(_, info) => {
                                                if (info.offset.x > 100) {
                                                    removeNotification(item.id)
                                                }
                                            }}
                                            className="relative group cursor-grab active:cursor-grabbing touch-pan-y"
                                        >
                                            {/* Minimalist Dismiss Icon (Revealed on Drag) */}
                                            <div className="absolute inset-y-0 left-0 flex items-center px-3 w-full justify-start -z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                                            </div>

                                            <div className="flex items-start gap-3 py-3.5 bg-white hover:bg-neutral-50/50 transition-colors relative z-10">
                                                {/* Minimalist Icon */}
                                                <div className="flex-shrink-0 pt-0.5">
                                                    {getIcon(item.type)}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            {lastReadTime && new Date(item.timestamp) > new Date(lastReadTime) && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 shrink-0" title="Nueva" />
                                                            )}
                                                            <h3 className="font-medium text-neutral-900 truncate text-sm">
                                                                {item.title}
                                                            </h3>
                                                            <span className={`text-xs shrink-0 ${getTypeTextColor(item.type)}`}>
                                                                {getTypeLabel(item.type)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-[11px] text-neutral-400 tabular-nums">
                                                                {format(new Date(item.timestamp), "h:mm a")}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeNotification(item.id)}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900"
                                                                aria-label="Descartar notificación"
                                                            >
                                                                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5">
                                                        <span>{item.description}</span>
                                                        {(item.type === 'SALIDA' || item.type === 'ENTRADA') && (
                                                            <>
                                                                <span className="text-neutral-300">·</span>
                                                                <span className="text-neutral-600 tabular-nums">
                                                                    {format(new Date(item.timestamp), "h:mm a")}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {item.type === 'FALLA' && (
                                                        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                                                            <span className={item.metadata.priority === 'Crítica' ? 'text-red-600 font-medium' : 'text-amber-600'}>
                                                                {item.metadata.priority}
                                                            </span>
                                                            <span className="text-neutral-300">·</span>
                                                            <span className="text-neutral-500">
                                                                {item.metadata.status}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    ))}

                    {/* Infinite Scroll Trigger / Load More Button */}
                    {hasMore && (
                        <div className="pt-4 flex justify-center">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={loadMore}
                                onViewportEnter={() => loadMore()} // Simple infinite scroll
                                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1.5"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Cargando...
                                    </>
                                ) : (
                                    "Cargar más"
                                )}
                            </motion.button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
