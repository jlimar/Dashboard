"use client"

import { useState, useMemo } from "react"
import { Search, User, Loader2, Phone, IdCard, UserX } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface Driver {
    id: string
    first_name?: string
    last_name?: string
    national_id?: string
    phone?: string
    currentVehicle?: {
        id: string
        modelo: string
        placa: string
    } | null
}

interface DriverSelectorProps {
    drivers: Driver[]
    selectedDriverId?: string | null
    onSelect: (driver: Driver | null) => void
    loading?: boolean
    label?: string
}

export function DriverSelector({
    drivers,
    selectedDriverId,
    onSelect,
    loading = false,
    label = "Conductor Asignado"
}: DriverSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    const selectedDriver = useMemo(() =>
        selectedDriverId && selectedDriverId !== 'none'
            ? drivers.find(d => d.id === selectedDriverId)
            : null,
        [drivers, selectedDriverId])

    const filteredDrivers = useMemo(() => {
        if (!searchTerm) return drivers
        const lower = searchTerm.toLowerCase()
        return drivers.filter(d =>
            (d.first_name?.toLowerCase().includes(lower) || false) ||
            (d.last_name?.toLowerCase().includes(lower) || false) ||
            (d.national_id?.toLowerCase().includes(lower) || false)
        )
    }, [drivers, searchTerm])

    const handleSelect = (driver: Driver | null) => {
        onSelect(driver)
        setOpen(false)
        setSearchTerm("")
    }

    return (
        <div className="space-y-2">
            {/* Label only rendered here, ensure parent doesn't duplicate or use empty string prop if needed */}
            {label && <Label className="text-xs font-medium text-neutral-500">{label}</Label>}

            {selectedDriver ? (
                <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <User className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.5} />
                        <div className="min-w-0">
                            <div className="font-medium text-sm text-neutral-900 truncate">
                                {selectedDriver.first_name} {selectedDriver.last_name}
                            </div>
                            <div className="text-xs text-neutral-500 flex items-center gap-3 mt-0.5">
                                {selectedDriver.national_id && (
                                    <span className="flex items-center gap-1">
                                        <IdCard size={12} strokeWidth={1.5} />
                                        {selectedDriver.national_id}
                                    </span>
                                )}
                                {selectedDriver.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone size={12} strokeWidth={1.5} />
                                        {selectedDriver.phone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors shrink-0"
                    >
                        Cambiar
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="w-full flex items-center justify-between gap-2 bg-transparent border-b border-neutral-200 hover:border-neutral-400 py-1.5 text-sm text-neutral-400 hover:text-neutral-700 transition-colors text-left"
                >
                    <span className="inline-flex items-center gap-2">
                        <User className="w-4 h-4" strokeWidth={1.5} />
                        Seleccionar conductor...
                    </span>
                </button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-5 py-4 border-b border-neutral-100">
                        <DialogTitle className="text-base font-medium text-neutral-900">Seleccionar conductor</DialogTitle>
                    </DialogHeader>

                    <div className="p-5 space-y-4">
                        <div className="flex items-center gap-2 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors">
                            <Search className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.5} />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por nombre o cédula..."
                                className="w-full bg-transparent py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto divide-y divide-neutral-100">
                            {/* Unassign Option */}
                            <div
                                onClick={() => handleSelect(null)}
                                className="py-3 px-1 cursor-pointer flex items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <UserX className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors shrink-0" strokeWidth={1.5} />
                                    <span className={`text-sm ${!selectedDriverId ? 'font-medium text-neutral-900' : 'text-neutral-500 group-hover:text-neutral-900'}`}>
                                        Sin conductor (Desasignar)
                                    </span>
                                </div>
                                {!selectedDriverId && (
                                    <span className="text-xs text-neutral-400 shrink-0">
                                        Seleccionado
                                    </span>
                                )}
                            </div>

                            {loading ? (
                                <div className="py-8 text-center text-neutral-400 text-sm flex flex-col items-center gap-2">
                                    <Loader2 className="animate-spin w-4 h-4" />
                                    <span>Cargando conductores...</span>
                                </div>
                            ) : filteredDrivers.length === 0 ? (
                                <div className="py-8 text-center text-neutral-400 text-sm">
                                    {searchTerm ? "No se encontraron resultados" : "No hay conductores disponibles"}
                                </div>
                            ) : (
                                filteredDrivers.map(d => (
                                    <div
                                        key={d.id}
                                        onClick={() => handleSelect(d)}
                                        className="py-3 px-1 cursor-pointer flex justify-between items-center gap-3 hover:bg-neutral-50/50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <User className={`w-4 h-4 shrink-0 ${selectedDriverId === d.id ? 'text-neutral-900' : 'text-neutral-400 group-hover:text-neutral-700'}`} strokeWidth={1.5} />
                                            <div className="min-w-0">
                                                <div className="font-medium text-sm text-neutral-900 truncate">
                                                    {d.first_name} {d.last_name}
                                                </div>
                                                {d.national_id && (
                                                    <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                                                        <IdCard size={12} className="text-neutral-400" strokeWidth={1.5} />
                                                        {d.national_id}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {d.currentVehicle && d.currentVehicle.id !== (selectedDriver?.currentVehicle?.id) && (
                                                <span className="text-xs text-neutral-400">
                                                    {d.currentVehicle.modelo}
                                                </span>
                                            )}
                                            {selectedDriverId === d.id && (
                                                <span className="text-xs font-medium text-neutral-900">
                                                    Actual
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
