"use client"

import Link from "next/link"
import { useUser } from "@/components/providers/user-provider"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { INITIAL_MODULES_CONFIG } from "@/lib/constants"

export function DashboardMenu() {
    const { hasRole, isAdmin, isLoading: isUserLoading } = useUser()
    const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({})
    const [loadingSettings, setLoadingSettings] = useState(true)

    useEffect(() => {
        const loadSettings = async () => {
            try {
                // Initialize with defaults
                const settings: Record<string, boolean> = {}
                INITIAL_MODULES_CONFIG.forEach(m => settings[m.key] = m.default)

                const supabase = createClient()
                const { data, error } = await supabase.from('app_settings').select('*')

                if (data && !error) {
                    data.forEach((item: any) => {
                        settings[item.key] = item.value
                    })
                }
                setEnabledModules(settings)
            } catch (e) {
                console.error("Error loading module settings", e)
            } finally {
                setLoadingSettings(false)
            }
        }
        loadSettings()
    }, [])

    if (isUserLoading || loadingSettings) {
        return <div className="text-neutral-400 text-sm py-10">Cargando panel...</div>
    }

    const canAccess = (roleKey: string) => {
        if (isAdmin) return true
        return hasRole(roleKey as any)
    }

    const isModuleEnabled = (key: string) => {
        return enabledModules[key] !== false
    }

    const items = [
        ...(isModuleEnabled("module_transporte") && (canAccess("transporte") || hasRole("chofer"))
            ? [{
                href: "/transporte",
                title: "Transporte",
                description: "Control de flota y salidas de vehículos.",
                action: "Acceder",
            }]
            : []),
        ...(isModuleEnabled("module_taller") && (canAccess("taller") || hasRole("mecanico" as any))
            ? [{
                href: "/taller",
                title: "Taller mecánico",
                description: "Gestión de fallas y mantenimiento.",
                action: "Ir al taller",
            }]
            : []),
        ...(isModuleEnabled("module_combustible") && canAccess("supervisor")
            ? [{
                href: "/control/combustible",
                title: "Control",
                description: "Control de combustible y auditorías.",
                action: "Ver control",
            }]
            : []),
        ...(isAdmin
            ? [{
                href: "/admin",
                title: "Panel admin",
                description: "Configuración global y ajustes del sistema.",
                action: "Configurar",
            }]
            : []),
        ...(canAccess("gerencia")
            ? [{
                href: "/gerencia",
                title: "Gerencia",
                description: "Tablero de control y resumen operativo.",
                action: "Acceder",
            }]
            : []),
        ...(isModuleEnabled("module_supervision") && canAccess("reportes")
            ? [{
                href: "/supervision",
                title: "Supervisión",
                description: "Módulo de control para operaciones en calle y almacén.",
                action: "Acceder",
            }]
            : []),
        {
            href: "/perfil",
            title: "Mi perfil",
            description: "Ver información de cuenta y roles asignados.",
            action: "Ver perfil",
        },
    ]

    return (
        <div className="divide-y divide-neutral-100 border-b border-neutral-100">
            {items.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center justify-between gap-4 py-4 sm:py-5 px-2.5 -mx-2.5 rounded-md hover:bg-neutral-50/80 active:scale-[0.99] transition-all duration-150"
                >
                    <div className="min-w-0 pr-2">
                        <h2 className="text-sm sm:text-base font-medium text-neutral-900 group-hover:text-neutral-700 transition-colors">
                            {item.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 leading-relaxed measure-copy">
                            {item.description}
                        </p>
                    </div>
                    <span className="text-xs text-neutral-400 group-hover:text-neutral-900 transition-colors shrink-0 flex items-center gap-1">
                        <span>{item.action}</span>
                        <span className="inline-block transition-transform duration-150 group-hover:translate-x-1">→</span>
                    </span>
                </Link>
            ))}
        </div>
    )
}

