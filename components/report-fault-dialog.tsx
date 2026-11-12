"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { toast } from "sonner"

type ReportFaultDialogProps = {
    isOpen: boolean
    onClose: () => void
    vehicleId: string
    onFaultReported: () => void
}

export function ReportFaultDialog({ isOpen, onClose, vehicleId, onFaultReported }: ReportFaultDialogProps) {
    const [loading, setLoading] = useState(false)
    const [descripcion, setDescripcion] = useState("")
    const [tipo, setTipo] = useState("Mecánica")
    const [prioridad, setPrioridad] = useState("Media")

    async function handleSubmit() {
        if (!descripcion.trim()) {
            toast.error("Por favor describe la falla")
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('fallas')
                .insert({
                    vehiculo_id: vehicleId,
                    descripcion: descripcion,
                    tipo_falla: tipo,
                    prioridad: prioridad,
                    estado: 'Pendiente'
                })

            if (error) throw error

            toast.success("Falla reportada correctamente")
            setDescripcion("")
            setTipo("Mecánica")
            setPrioridad("Media")
            onFaultReported()
            onClose()
        } catch (error) {
            console.error("Error reporting fault:", error)
            toast.error("Error al reportar la falla")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="pb-4 border-b border-neutral-100">
                    <DialogTitle className="text-lg font-medium text-neutral-900">Reportar falla</DialogTitle>
                    <DialogDescription className="text-sm text-neutral-500">
                        Describe el problema para que el taller pueda revisarlo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-neutral-500">Tipo de falla</label>
                        <CustomDropdown
                            value={tipo}
                            onChange={setTipo}
                            options={[
                                { value: "Mecánica", label: "Mecánica" },
                                { value: "Eléctrica", label: "Eléctrica" },
                                { value: "Cauchos", label: "Cauchos" },
                                { value: "Carrocería", label: "Carrocería" },
                                { value: "Otro", label: "Otro" },
                            ]}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-neutral-500">Prioridad</label>
                        <CustomDropdown
                            value={prioridad}
                            onChange={setPrioridad}
                            options={[
                                { value: "Baja", label: "Baja (Puede esperar)" },
                                { value: "Media", label: "Media (Revisar pronto)" },
                                { value: "Alta", label: "Alta (Urgente)" },
                                { value: "Crítica", label: "Crítica (Vehículo parado)" },
                            ]}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-neutral-500">Descripción</label>
                        <Textarea
                            placeholder="Ej. Ruido en los frenos traseros al detenerse..."
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            className="min-h-24 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="flex-row items-center justify-end gap-5 pt-4 border-t border-neutral-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="text-xs text-neutral-500 hover:text-neutral-900 transition-all duration-150 active:scale-[0.985] disabled:opacity-40 cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-all duration-150 active:scale-[0.985] disabled:opacity-40 cursor-pointer"
                    >
                        {loading ? "Enviando..." : "Reportar falla"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
