"use client"

import { ArrowLeft, ArrowRight, UserCog, ShieldCheck, LayoutGrid, Database, Map, Users2 } from "lucide-react"
import Link from "next/link"

const ADMIN_SECTIONS = [
    {
        href: "/admin/configuracion",
        title: "Gestión de módulos",
        description: "Habilitar o deshabilitar paneles del sistema.",
        icon: LayoutGrid,
    },
    {
        href: "/admin/usuarios",
        title: "Gestión de usuarios",
        description: "Roles, departamentos y permisos de acceso.",
        icon: UserCog,
    },
    {
        href: "/admin/vehiculos",
        title: "Flota vehicular",
        description: "Coches, mantenimiento y asignaciones.",
        icon: ShieldCheck,
    },
    {
        href: "/admin/geodata",
        title: "Zonas operativas",
        description: "Gestión de estados, municipios y sectores.",
        icon: Map,
    },
    {
        href: "/admin/cuadrillas",
        title: "Gestión de cuadrillas",
        description: "Equipos de trabajo, líderes y auxiliares.",
        icon: Users2,
    },
    {
        href: "/admin/database",
        title: "Base de datos",
        description: "Limpieza y reseteo para testing.",
        icon: Database,
    },
]

export default function AdminDashboard() {
    return (
        <div className="min-h-screen bg-white text-neutral-900 px-6 py-10 md:px-10">
            <div className="max-w-3xl mx-auto">
                <header className="pb-6 mb-2 border-b border-neutral-100">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Inicio
                    </Link>
                    <h1 className="text-2xl font-light tracking-tight text-neutral-900">
                        Panel de administración
                    </h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Configuración global del sistema y accesos.
                    </p>
                </header>

                <div className="divide-y divide-neutral-100">
                    {ADMIN_SECTIONS.map((section) => {
                        const Icon = section.icon
                        return (
                            <Link
                                key={section.href}
                                href={section.href}
                                className="group flex items-center justify-between py-5 px-2 -mx-2 hover:bg-neutral-50/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <Icon
                                        className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors shrink-0"
                                        strokeWidth={1.5}
                                    />
                                    <div>
                                        <h2 className="text-sm font-medium text-neutral-900">
                                            {section.title}
                                        </h2>
                                        <p className="text-xs text-neutral-500 mt-0.5">
                                            {section.description}
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight
                                    className="w-4 h-4 text-neutral-300 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0"
                                    strokeWidth={1.5}
                                />
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
