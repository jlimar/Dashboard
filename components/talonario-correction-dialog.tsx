"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Save, FileDigit } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { resetVehicleTalonario } from "@/app/admin/vehiculos/actions"

import { createClient } from "@/lib/supabase/client"

interface TalonarioCorrectionDialogProps {
    isOpen: boolean
    onClose: () => void
    vehicleId: string
    vehicleName: string
    onUpdate: () => void
}

export function TalonarioCorrectionDialog({ isOpen, onClose, vehicleId, vehicleName, onUpdate }: TalonarioCorrectionDialogProps) {
    const [loading, setLoading] = useState(false)
    const [nextTicket, setNextTicket] = useState<string>("")
    const [currentTicket, setCurrentTicket] = useState<string | null>(null)
    const [loadingCurrent, setLoadingCurrent] = useState(false)

    useEffect(() => {
        if (isOpen && vehicleId) {
            setNextTicket("")
            loadCurrentTicket()
        } else {
            setNextTicket("")
            setCurrentTicket(null)
        }
    }, [isOpen, vehicleId])

    async function loadCurrentTicket() {
        setLoadingCurrent(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('fuel_logs')
            .select('ticket_number')
            .eq('talonario_vehiculo_id', vehicleId)
            .order('created_at', { ascending: false })
            .limit(1)

        if (data && data.length > 0) {
            setCurrentTicket(data[0].ticket_number)
        } else {
            setCurrentTicket("Ninguno")
        }
        setLoadingCurrent(false)
    }

    async function handleSave() {
        if (!nextTicket) {
            toast.error("Ingrese el número del próximo ticket")
            return
        }

        setLoading(true)
        try {
            const { success, error } = await resetVehicleTalonario(vehicleId, nextTicket)
            if (success) {
                toast.success("Talonario actualizado exitosamente")
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
                    <DialogTitle className="text-lg font-medium text-neutral-900">Actualizar talonario</DialogTitle>
                    <DialogDescription className="text-sm text-neutral-500">
                        {vehicleName}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2 space-y-5">
                    <div className="pb-4 border-b border-neutral-100 space-y-1.5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-xs font-medium text-neutral-900">
                                <FileDigit className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                                Nuevo talonario
                            </div>
                            <div className="text-xs text-neutral-500 font-mono flex items-center gap-1">
                                {loadingCurrent ? (
                                    <Loader2 className="animate-spin w-3 h-3" />
                                ) : (
                                    <>Último: <strong className="text-neutral-900">{currentTicket}</strong></>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-neutral-500">
                            Establece el número del <strong className="font-medium text-neutral-700">siguiente ticket vacío</strong> que tienes en tu talonario físico.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-neutral-500">Número del próximo ticket</label>
                        <Input
                            type="text"
                            placeholder="Ej. 0001"
                            value={nextTicket}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '')
                                setNextTicket(val)
                            }}
                            className="text-base font-mono font-medium"
                        />
                    </div>
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
                        disabled={loading || !nextTicket}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                    >
                        {loading && <Loader2 className="animate-spin w-3.5 h-3.5" />}
                        <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Guardar talonario
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
