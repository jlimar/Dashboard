"use client"

import Link from "next/link"
import {
    Wrench, Truck, ShieldCheck, UserCog, Package, Settings,
    Headset, CalendarRange, Network, Activity, Users2, Cpu, FileText, ShoppingBag,
    LayoutGrid, ClipboardCheck
} from "lucide-react"
import { useUser } from "@/components/providers/user-provider"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { INITIAL_MODULES_CONFIG } from "@/lib/constants"

export function DashboardMenu() {
    const { hasRole, isAdmin, isLoading: isUserLoading, profile } = useUser()
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
                icon: Truck,
                title: "Transporte",
                description: "Control de flota y salidas de vehículos.",
                action: "Acceder",
            }]
            : []),
        ...(isModuleEnabled("module_taller") && (canAccess("taller") || hasRole("mecanico" as any))
            ? [{
                href: "/taller",
                icon: Wrench,
                title: "Taller mecánico",
                description: "Gestión de fallas y mantenimiento.",
                action: "Ir al taller",
            }]
            : []),
        ...(isModuleEnabled("module_combustible") && canAccess("supervisor")
            ? [{
                href: "/control/combustible",
                icon: ClipboardCheck,
                title: "Control",
                description: "Control de combustible y auditorías.",
                action: "Ver control",
            }]
            : []),
        ...(isAdmin
            ? [{
                href: "/admin",
                icon: Settings,
                title: "Panel admin",
                description: "Configuración global y ajustes del sistema.",
                action: "Configurar",
            }]
            : []),
        ...(canAccess("gerencia")
            ? [{
                href: "/gerencia",
                icon: Activity,
                title: "Gerencia",
                description: "Tablero de control y resumen operativo.",
                action: "Acceder",
            }]
            : []),
        ...(isModuleEnabled("module_supervision") && canAccess("reportes")
            ? [{
                href: "/supervision",
                icon: FileText,
                title: "Supervisión",
                description: "Módulo de control para operaciones en calle y almacén.",
                action: "Acceder",
            }]
            : []),
        {
            href: "/perfil",
            icon: UserCog,
            title: "Mi perfil",
            description: "Ver información de cuenta y roles asignados.",
            action: "Ver perfil",
        },
    ]

    return (
        <div className="divide-y divide-neutral-100 border-b border-neutral-100">
            {items.map((item) => {
                const Icon = item.icon
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center justify-between gap-6 py-5 hover:bg-neutral-50/50 transition-colors"
                    >
                        <div className="flex items-start gap-4 min-w-0">
                            <Icon className="w-4 h-4 mt-1 text-neutral-400 group-hover:text-neutral-900 transition-colors shrink-0" strokeWidth={1.5} />
                            <div className="min-w-0">
                                <h2 className="text-base font-medium text-neutral-900">
                                    {item.title}
                                </h2>
                                <p className="text-sm text-neutral-500 mt-0.5">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                        <span className="text-xs text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0">
                            {item.action} →
                        </span>
                    </Link>
                )
            })}
        </div>
    )
}
