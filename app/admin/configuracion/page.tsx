"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { INITIAL_MODULES_CONFIG } from "@/lib/constants"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getSystemSettings } from "../settings-actions"

export default function AdminConfigModulesPage() {
    const [settings, setSettings] = useState<Record<string, boolean>>({})
    const [systemSettings, setSystemSettings] = useState<Record<string, any>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [tableExists, setTableExists] = useState(true)

    useEffect(() => {
        loadSettings()
    }, [])

    async function loadSettings() {
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('app_settings').select('*')

            if (error) {
                // Determine if error is "table not found"
                if (error.code === '42P01') {
                    setTableExists(false)
                }
                console.error("Config load error:", error)
            }

            // Defaults
            const currentSettings: Record<string, boolean> = {}
            INITIAL_MODULES_CONFIG.forEach(m => {
                currentSettings[m.key] = m.default
            })

            // Merge DB
            if (data) {
                data.forEach((item: any) => {
                    currentSettings[item.key] = item.value
                })
            }

            setSettings(currentSettings)

            // Load System Settings (Backend Flags)
            const sys = await getSystemSettings()
            setSystemSettings(sys)

        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        try {
            const supabase = createClient()

            if (!tableExists) {
                toast.error("Error: Tabla 'app_settings' no existe en DB.")
                return
            }

            const updates = Object.entries(settings).map(([key, value]) => ({
                key,
                value,
                label: INITIAL_MODULES_CONFIG.find(m => m.key === key)?.label
            }))

            const { error } = await supabase.from('app_settings').upsert(updates)

            if (error) throw error

            toast.success("Configuración guardada")
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar")
        } finally {
            setSaving(false)
        }
    }

    const toggle = (key: string) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-white px-6 py-16 text-center text-sm text-neutral-400">
                Cargando configuración...
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-10">
            <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
                {/* HEADER UNIFORME */}
                <header className="pb-6 border-b border-neutral-100 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <Link
                            href="/admin"
                            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
                            Volver al panel
                        </Link>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900">
                            Gestión de módulos
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500">
                            Habilita o deshabilita secciones del sistema.
                        </p>
                    </div>
                </header>

                {!tableExists && (
                    <section className="mb-8 pb-6 border-b border-neutral-200/60 space-y-3">
                        <p className="text-sm font-medium text-neutral-900">
                            Configuración de base de datos necesaria
                        </p>
                        <p className="text-xs text-neutral-500">
                            Para usar esta función, ejecuta el siguiente comando SQL en Supabase:
                        </p>
                        <pre className="pl-4 border-l border-neutral-200 py-2 text-xs font-mono text-neutral-600 overflow-auto">
                            {`create table if not exists app_settings (
    key text primary key,
    value boolean default true,
    label text
);

-- Habilitar RLS público por simplicidad o restringir a admin
alter table app_settings enable row level security;
create policy "Public Read" on app_settings for select using (true);
create policy "Admin Update" on app_settings for all using (true); -- Ajustar en prod`}
                        </pre>
                    </section>
                )}

                <section>
                    <div className="mb-4">
                        <h2 className="text-sm font-medium text-neutral-900">
                            Visibilidad de paneles
                        </h2>
                        <p className="text-xs text-neutral-500 mt-0.5">
                            Los paneles deshabilitados se ocultarán del menú principal para todos los usuarios.
                        </p>
                    </div>

                    <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100">
                        {INITIAL_MODULES_CONFIG.map((module) => (
                            <div
                                key={module.key}
                                className="flex items-center justify-between py-4"
                            >
                                <div>
                                    <div className="text-sm font-medium text-neutral-900">
                                        {module.label}
                                    </div>
                                    <div className="text-xs text-neutral-400 font-mono mt-0.5">
                                        {module.path}
                                    </div>
                                </div>
                                <Switch
                                    checked={settings[module.key]}
                                    onCheckedChange={() => toggle(module.key)}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 flex justify-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !tableExists}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? "Guardando..." : "Guardar cambios"}
                        </button>
                    </div>
                </section>
            </div>
        </main>
    )
}
