"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, AlertTriangle, Save } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { getMileageSource, correctMileage, type MileageSource } from "@/app/admin/vehiculos/actions"

interface MileageCorrectionDialogProps {
    isOpen: boolean
    onClose: () => void
    vehicleId: string
    vehicleName: string
    currentMileage: number
    onUpdate: () => void
}

export function MileageCorrectionDialog({ isOpen, onClose, vehicleId, vehicleName, currentMileage, onUpdate }: MileageCorrectionDialogProps) {
    const [loading, setLoading] = useState(false)
    const [analyzing, setAnalyzing] = useState(true)
    const [source, setSource] = useState<MileageSource | null>(null)
    const [newMileage, setNewMileage] = useState<string>("")
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen && vehicleId) {
            analyzeSource()
            setNewMileage(currentMileage.toString())
        } else {
            // Reset state on close
            setSource(null)
            setAnalyzing(true)
            setError(null)
        }
    }, [isOpen, vehicleId, currentMileage])

    async function analyzeSource() {
        setAnalyzing(true)
        try {
            const result = await getMileageSource(vehicleId, currentMileage)
            setSource(result)
            if (!result) {
                setError("No se pudo identificar el registro origen de este kilometraje. Podría ser un valor heredado o antiguo.")
            }
        } catch (err) {
            console.error(err)
            setError("Error al analizar el origen del kilometraje.")
        } finally {
            setAnalyzing(false)
        }
    }

    async function handleSave() {
        if (!source) return

        const val = parseInt(newMileage)
        if (isNaN(val) || val < 0) {
            toast.error("Ingrese un kilometraje válido")
            return
        }

        setLoading(true)
        try {
            const { success, error } = await correctMileage(source, val)
            if (success) {
                toast.success("Kilometraje corregido exitosamente")
                onUpdate()
                onClose()
            } else {
                toast.error(error || "Error al actualizar")
            }
        } catch (err) {
            console.error(err)
            toast.error("Error inesperado")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="pb-4 border-b border-neutral-100">
                    <DialogTitle className="text-lg font-medium text-neutral-900">Corregir kilometraje</DialogTitle>
                    <DialogDescription className="text-sm text-neutral-500">
                        {vehicleName}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    {analyzing ? (
                        <div className="flex flex-col items-center justify-center py-6 gap-2 text-neutral-400">
                            <Loader2 className="animate-spin w-4 h-4" />
                            <span className="text-xs">Buscando origen del dato...</span>
                        </div>
                    ) : error ? (
                        <div className="py-2 flex gap-2 items-start text-xs text-neutral-600">
                            <AlertTriangle className="shrink-0 mt-0.5 w-4 h-4 text-neutral-500" strokeWidth={1.5} />
                            <p>{error}</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Source Info */}
                            <div className="pb-4 border-b border-neutral-100 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-neutral-400">Origen detectado</span>
                                    <span className="text-xs text-neutral-500">
                                        {source?.type === 'fuel_log' ? 'Carga de combustible' : 'Reporte'}
                                    </span>
                                </div>
                                <div className="text-sm font-medium text-neutral-900">
                                    {source?.description}
                                </div>
                                <p className="text-xs text-neutral-400">
                                    Registrado el: {source?.date ? new Date(source.date).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>

                            {/* Input Field */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-neutral-500">Nuevo kilometraje</label>
                                <Input
                                    type="number"
                                    value={newMileage}
                                    onChange={(e) => setNewMileage(e.target.value)}
                                    className="text-base font-mono"
                                />
                                <p className="text-xs text-neutral-400">
                                    Esto modificará directamente el registro original.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-row items-center justify-end gap-5 pt-4 border-t border-neutral-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading || analyzing || !!error}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                    >
                        {loading && <Loader2 className="animate-spin w-3.5 h-3.5" />}
                        <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Guardar corrección
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
