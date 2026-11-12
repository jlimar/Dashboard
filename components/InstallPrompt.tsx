"use client"

import { useState, useEffect } from "react"

import { X, Download } from "lucide-react"
import Image from "next/image"

export function InstallPrompt() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {


        // 2. Check if dismissed recently (e.g., 24h cooldown)
        const dismissedAt = localStorage.getItem("install_prompt_dismissed")
        if (dismissedAt) {
            const diff = Date.now() - parseInt(dismissedAt)
            // 24 hours = 86400000 ms
            if (diff < 86400000) return
        }

        // Show after small delay
        setTimeout(() => setIsVisible(true), 2000)
    }, [])

    const handleDismiss = () => {
        setIsVisible(false)
        localStorage.setItem("install_prompt_dismissed", Date.now().toString())
    }

    if (!isVisible) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200/70 bg-white/95 backdrop-blur-xs px-6 py-4 animate-in slide-in-from-bottom-full duration-300">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <Image src="/logo.png" alt="App Logo" width={32} height={32} className="w-8 h-8 object-contain shrink-0" />
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium text-neutral-900 leading-tight">
                            Descarga la app oficial
                        </h3>
                        <p className="text-xs text-neutral-500 truncate">
                            Notificaciones, acceso offline y GPS.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-5 shrink-0">
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                        onClick={() => window.open("/app-release.apk", "_blank")}
                    >
                        <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Descargar APK
                    </button>
                    <button
                        type="button"
                        className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        onClick={handleDismiss}
                    >
                        Quizás luego
                    </button>
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="text-neutral-400 hover:text-neutral-900 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                </div>
            </div>
        </div>
    )
}
