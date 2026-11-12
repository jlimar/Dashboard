"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import Link from "next/link"
import { LogoutButton } from "@/components/ui/logout-button"

const ADMIN_SECTIONS = [
    {
        href: "/admin/configuracion",
        title: "Gestión de módulos",
        description: "Habilitar o deshabilitar paneles del sistema.",
    },
    {
        href: "/admin/usuarios",
        title: "Gestión de usuarios",
        description: "Roles, departamentos y permisos de acceso.",
    },
    {
        href: "/admin/vehiculos",
        title: "Flota vehicular",
        description: "Coches, mantenimiento y asignaciones.",
    },
    {
        href: "/admin/geodata",
        title: "Zonas operativas",
        description: "Gestión de estados, municipios y sectores.",
    },
    {
        href: "/admin/cuadrillas",
        title: "Gestión de cuadrillas",
        description: "Equipos de trabajo, líderes y auxiliares.",
    },
    {
        href: "/admin/database",
        title: "Base de datos",
        description: "Limpieza y reseteo para testing.",
    },
]

export default function AdminDashboard() {
    return (
        <div className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-10">
            <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
                {/* HEADER UNIFORME */}
                <header className="pb-6 border-b border-neutral-100 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                            Inicio
                        </Link>
                        <LogoutButton />
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900">
                            Panel de administración
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500">
                            Configuración global del sistema y accesos.
                        </p>
                    </div>
                </header>

                <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                    {ADMIN_SECTIONS.map((section) => (
                        <Link
                            key={section.href}
                            href={section.href}
                            className="group flex items-center justify-between gap-4 py-4 sm:py-5 px-2 -mx-2 rounded-md hover:bg-neutral-50/70 active:bg-neutral-100/70 transition-colors"
                        >
                            <div className="min-w-0 pr-2">
                                <h2 className="text-sm sm:text-base font-medium text-neutral-900 group-hover:text-neutral-600 transition-colors">
                                    {section.title}
                                </h2>
                                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 leading-relaxed">
                                    {section.description}
                                </p>
                            </div>
                            <span className="text-xs text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0">
                                Configurar →
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}

