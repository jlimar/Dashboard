"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, FileText, Loader2 } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { generateDailyReport } from "./actions"

export function DailyReportDialog({ onSuccess }: { onSuccess?: () => void }) {
    const [open, setOpen] = useState(false)
    const [date, setDate] = useState<Date>()
    const [loading, setLoading] = useState(false)
    const [successData, setSuccessData] = useState<{ total: number, count: number, details?: any[], date?: string, supervisor?: string } | null>(null)

    useEffect(() => {
        setDate(new Date())
    }, [])

    const handleGenerate = async () => {
        if (!date) return
        setLoading(true)
        setSuccessData(null)

        try {
            const dateStr = format(date, "yyyy-MM-dd")
            const res = await generateDailyReport(dateStr)

            if (res.success) {
                toast.success("Reporte generado correctamente")
                setSuccessData({
                    total: res.totalLiters || 0,
                    count: res.count || 0,
                    details: res.details,
                    date: dateStr,
                    supervisor: res.supervisorName
                })
                if (onSuccess) onSuccess()
            } else {
                toast.error(res.error || "Error al generar reporte")
            }
        } catch (error) {
            console.error(error)
            toast.error("Error de conexión")
        } finally {
            setLoading(false)
        }
    }

    const handleWhatsApp = () => {
        if (!successData) return

        const vehiclesList = successData.details?.map((v: any, index: number) =>
            `${index + 1}. ${v.model} / ${v.liters.toFixed(2)} L (${v.startKm}-${v.endKm} km)`
        ).join("\n")

        const message = `*Reporte de Combustible Diario*\n\n*Fecha:* ${successData.date}\n*Supervisor:* ${successData.supervisor || "N/A"}\n\n*Vehículos:*\n${vehiclesList}\n\n*Total:* ${successData.total.toFixed(2)} L`

        const url = `https://wa.me/?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
    }

    const reset = () => {
        setOpen(false)
        setSuccessData(null)
        setDate(new Date())
    }

    return (
        <Dialog open={open} onOpenChange={(val) => !val && reset()}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                >
                    <FileText className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.5} />
                    <span>Generar reporte</span>
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm p-6 animate-in fade-in zoom-in-95 duration-150">
                <DialogHeader className="text-left space-y-1.5">
                    <DialogTitle className="text-base font-medium text-neutral-900">Generar reporte diario</DialogTitle>
                    <DialogDescription className="text-sm text-neutral-500">
                        Selecciona la fecha para consolidar el reporte de combustible.
                    </DialogDescription>
                </DialogHeader>

                {!successData ? (
                    <div className="pt-4 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-xs text-neutral-500">Fecha del reporte</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            "w-full flex items-center gap-2 bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-left outline-none transition-colors",
                                            date ? "text-neutral-900" : "text-neutral-400"
                                        )}
                                    >
                                        <CalendarIcon className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.5} />
                                        {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm" align="center">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex items-center justify-end gap-5 pt-2">
                            <button
                                type="button"
                                onClick={reset}
                                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={loading}
                                className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</> : "Generar reporte"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="pt-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
                        <div>
                            <h3 className="text-base font-medium text-neutral-900">Reporte guardado</h3>
                            <p className="text-xs text-neutral-500 mt-1">El reporte ha sido archivado exitosamente.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6 py-4 border-y border-neutral-100">
                            <div className="flex flex-col">
                                <span className="text-xs text-neutral-500 font-normal">Total litros</span>
                                <span className="text-2xl font-light tracking-tight text-neutral-900 mt-0.5 tabular-nums">{successData.total.toFixed(2)} L</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-neutral-500 font-normal">Registros</span>
                                <span className="text-2xl font-light tracking-tight text-neutral-900 mt-0.5 tabular-nums">{successData.count}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-5">
                            <button
                                type="button"
                                onClick={reset}
                                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={handleWhatsApp}
                                className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                            >
                                Enviar por WhatsApp
                            </button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
