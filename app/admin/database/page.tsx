"use client"

import { ArrowLeft, Fuel, Loader2, Stethoscope, CheckCircle2, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { resetFuelLogsAction } from "./actions"
import { runIntegrityCheck, type IntegrityIssue } from "./integrity/actions"
import { cleanMonthData } from "@/app/control/combustible/cleanAction"
import { useRouter } from "next/navigation"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"

export default function DatabaseManagementPage() {
    const [fuelLoading, setFuelLoading] = useState(false)
    const [integrityLoading, setIntegrityLoading] = useState(false)
    const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false)
    const [resetFuelDialogOpen, setResetFuelDialogOpen] = useState(false)
    const [cleaning, setCleaning] = useState(false)
    const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([])

    const router = useRouter()

    const executeResetFuel = async () => {
        setFuelLoading(true)
        try {
            const result = await resetFuelLogsAction()
            if (result.success) {
                toast.success("Logs de combustible eliminados")
                router.refresh()
            } else {
                toast.error("Error: " + result.error)
            }
        } catch (error) {
            toast.error("Error de conexión")
        } finally {
            setFuelLoading(false)
        }
    }

    const handleCleanup = async () => {
        setCleaning(true)
        try {
            const res = await cleanMonthData()
            if (res.success) {
                toast.success(res.message || "Limpieza completada")
                setCleanupDialogOpen(false)
                router.refresh()
            } else {
                toast.error("Error: " + res.error)
            }
        } catch (error: any) {
            toast.error("Error inesperado al limpiar")
        } finally {
            setCleaning(false)
        }
    }

    const handleIntegrityCheck = async () => {
        setIntegrityLoading(true)
        setIntegrityIssues([])
        try {
            const issues = await runIntegrityCheck()
            setIntegrityIssues(issues)
            if (issues.length === 0) {
                toast.success("Base de datos saludable")
            } else {
                toast.warning(`Se detectaron ${issues.length} problemas`)
            }
        } catch (error) {
            toast.error("Error al ejecutar diagnóstico")
        } finally {
            setIntegrityLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-white text-neutral-900 px-6 py-10 md:px-10">
            <div className="max-w-3xl mx-auto">
                <header className="pb-6 mb-2 border-b border-neutral-100">
                    <Link
                        href="/admin"
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Volver al panel
                    </Link>
                    <h1 className="text-2xl font-light tracking-tight text-neutral-900">
                        Gestión de base de datos
                    </h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Herramientas de limpieza y reinicio para pruebas.
                    </p>
                </header>

                <div className="divide-y divide-neutral-100">
                    {/* MONTH END CLEANUP */}
                    <section className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-sm font-medium text-neutral-900">
                                Limpieza de fin de mes
                            </h2>
                            <p className="text-xs text-neutral-500">
                                Vacía el historial antiguo y las imágenes de combustible. Conserva el último ticket de cada vehículo para no descontrolar secuencias.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCleanupDialogOpen(true)}
                            disabled={cleaning}
                            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-40"
                        >
                            {cleaning ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                            ) : (
                                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                            )}
                            Vaciar datos del mes
                        </button>
                    </section>

                    {/* FUEL RESET */}
                    <section className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Fuel className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.5} />
                                <h2 className="text-sm font-medium text-neutral-900">
                                    Reiniciar combustible
                                </h2>
                            </div>
                            <p className="text-xs text-neutral-500">
                                Borra el historial de carga de combustible. Conserva vehículos y conductores.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setResetFuelDialogOpen(true)}
                            disabled={fuelLoading}
                            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-40"
                        >
                            {fuelLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                            ) : (
                                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                            )}
                            Borrar logs de combustible
                        </button>
                    </section>

                    {/* INTEGRITY */}
                    <section className="py-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Stethoscope className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.5} />
                                    <h2 className="text-sm font-medium text-neutral-900">
                                        Verificador de salud
                                    </h2>
                                </div>
                                <p className="text-xs text-neutral-500">
                                    Detecta inconsistencias en la base de datos.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleIntegrityCheck}
                                disabled={integrityLoading}
                                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                            >
                                {integrityLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                                ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                )}
                                Escanear base de datos
                            </button>
                        </div>

                        {integrityIssues.length > 0 ? (
                            <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100 max-h-56 overflow-y-auto">
                                {integrityIssues.map((issue, idx) => (
                                    <div key={idx} className="py-2.5 text-xs">
                                        <span className={issue.type === 'CRITICAL' ? 'font-medium text-red-600' : 'font-medium text-neutral-900'}>
                                            {issue.title}:
                                        </span>{" "}
                                        <span className="text-neutral-500">{issue.description}</span>
                                    </div>
                                ))}
                            </div>
                        ) : !integrityLoading && (
                            <p className="text-xs text-neutral-400">
                                Sistema estable. No se detectaron problemas.
                            </p>
                        )}
                    </section>
                </div>
            </div>

            <DeleteConfirmDialog
                open={cleanupDialogOpen}
                onOpenChange={setCleanupDialogOpen}
                title="¿Vaciar base de datos?"
                description={
                    <>
                        Esta acción eliminará todas las fotos de los tickets del servidor de producción y borrará el historial antiguo. El sistema mantendrá automáticamente el último registro de cada vehículo.
                    </>
                }
                confirmLabel="Sí, vaciar datos"
                onConfirm={handleCleanup}
                isLoading={cleaning}
            />

            <DeleteConfirmDialog
                open={resetFuelDialogOpen}
                onOpenChange={setResetFuelDialogOpen}
                title="Reiniciar combustible"
                description="Esto borrará todo el historial de carga de combustible. No borrará los vehículos."
                confirmLabel="Borrar logs"
                onConfirm={executeResetFuel}
                isLoading={fuelLoading}
            />
        </div>
    )
}
