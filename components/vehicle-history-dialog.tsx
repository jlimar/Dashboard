"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, MapPin, User, Calendar } from "lucide-react"

interface VehicleHistoryDialogProps {
    isOpen: boolean
    onClose: () => void
    vehicleId?: string
    vehiclePlate?: string
}

export function VehicleHistoryDialog({ isOpen, onClose, vehicleId, vehiclePlate }: VehicleHistoryDialogProps) {
    const [loading, setLoading] = useState(false)
    const [history, setHistory] = useState<any[]>([])

    useEffect(() => {
        if (isOpen && vehicleId) {
            loadHistory(vehicleId)
        }
    }, [isOpen, vehicleId])

    async function loadHistory(id: string) {
        setLoading(true)
        const supabase = createClient()

        const { data } = await supabase
            .from('reportes')
            .select('*')
            .eq('vehiculo_id', id)
            .order('created_at', { ascending: false })
            .limit(10)

        if (data) setHistory(data)
        setLoading(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader className="pb-4 border-b border-neutral-100">
                    <DialogTitle className="text-lg font-medium text-neutral-900">Historial de transporte</DialogTitle>
                    <DialogDescription className="text-sm text-neutral-500">
                        Últimos recorridos del vehículo <span className="font-mono font-medium text-neutral-900">{vehiclePlate}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-neutral-200/60 hover:bg-transparent">
                                <TableHead className="text-xs font-medium text-neutral-500">Fecha</TableHead>
                                <TableHead className="text-xs font-medium text-neutral-500">Conductor</TableHead>
                                <TableHead className="text-xs font-medium text-neutral-500">Departamento</TableHead>
                                <TableHead className="text-right text-xs font-medium text-neutral-500">Salida (km)</TableHead>
                                <TableHead className="text-right text-xs font-medium text-neutral-500">Entrada (km)</TableHead>
                                <TableHead className="text-xs font-medium text-neutral-500">Novedades</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-neutral-100">
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-neutral-400 text-sm">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="animate-spin w-4 h-4" />
                                            Cargando historial...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-neutral-400 text-sm">
                                        No hay reportes recientes.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map((trip) => (
                                    <TableRow key={trip.id} className="hover:bg-neutral-50/50 border-neutral-100">
                                        <TableCell className="text-xs">
                                            <div className="flex flex-col">
                                                <span className="text-neutral-900">{format(new Date(trip.created_at), "dd MMM yy", { locale: es })}</span>
                                                <span className="text-neutral-400">{format(new Date(trip.created_at), "HH:mm")}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-neutral-700">
                                                <User className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.5} />
                                                {trip.conductor}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-neutral-600">
                                                {trip.departamento}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-neutral-600">
                                            {trip.km_salida.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs font-medium text-neutral-900">
                                            {trip.km_entrada ? trip.km_entrada.toLocaleString() : (
                                                <span className="text-neutral-500 font-sans italic">En ruta</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            <div className="text-xs text-neutral-500 truncate" title={trip.observaciones_entrada || trip.observaciones_salida}>
                                                {trip.observaciones_entrada || trip.observaciones_salida || "-"}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}
