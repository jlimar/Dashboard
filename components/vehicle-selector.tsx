"use client"

import { useState, useMemo } from "react"
import { Search, Car, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"

export interface Vehicle {
    id: string
    placa: string
    modelo: string
    tipo?: string
    kilometraje?: number | null
    codigo?: string // Useful for "Salida" display
}

interface VehicleSelectorProps {
    vehicles: Vehicle[]
    selectedVehicleId?: string
    onSelect: (vehicle: Vehicle | null) => void
    loading?: boolean
    label?: string
}

export function VehicleSelector({
    vehicles,
    selectedVehicleId,
    onSelect,
    loading = false,
    label = "Vehículo"
}: VehicleSelectorProps) {
    const [searchTerm, setSearchTerm] = useState("")

    const selectedVehicle = useMemo(() =>
        vehicles.find(v => v.id === selectedVehicleId),
        [vehicles, selectedVehicleId])

    const filteredVehicles = useMemo(() => {
        if (!searchTerm) return vehicles
        const lower = searchTerm.toLowerCase()
        return vehicles.filter(v =>
            v.placa.toLowerCase().includes(lower) ||
            v.modelo.toLowerCase().includes(lower) ||
            (v.codigo && v.codigo.toLowerCase().includes(lower))
        )
    }, [vehicles, searchTerm])

    if (selectedVehicle) {
        return (
            <div className="space-y-2">
                <Label className="text-xs font-medium text-neutral-500">{label}</Label>
                <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <Car className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.25} />
                        <div className="min-w-0">
                            <div className="font-medium text-sm text-neutral-900 truncate">{selectedVehicle.modelo}</div>
                            <div className="text-xs text-neutral-500 font-mono flex items-center gap-2">
                                <span>{selectedVehicle.placa}</span>
                                {selectedVehicle.codigo && (
                                    <span className="text-neutral-400">· {selectedVehicle.codigo}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            onSelect(null)
                            setSearchTerm("")
                        }}
                        className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors shrink-0"
                    >
                        Cambiar
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <Label className="text-xs font-medium text-neutral-500">{label}</Label>
            <div className="relative">
                <div className="flex items-center gap-2 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors">
                    <Search className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.25} />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar placa, modelo o código..."
                        className="w-full bg-transparent py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
                    />
                </div>

                <div className="mt-1 max-h-60 overflow-y-auto divide-y divide-neutral-100">
                    {loading ? (
                        <div className="py-8 text-center text-neutral-400 text-sm flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin w-4 h-4" />
                            <span>Cargando vehículos...</span>
                        </div>
                    ) : filteredVehicles.length === 0 ? (
                        <div className="py-8 text-center text-neutral-400 text-sm">
                            {searchTerm ? "No se encontraron resultados" : "No hay vehículos disponibles"}
                        </div>
                    ) : (
                        filteredVehicles.map(v => (
                            <div
                                key={v.id}
                                onClick={() => onSelect(v)}
                                className="py-3 px-1 hover:bg-neutral-50/50 cursor-pointer flex justify-between items-center transition-colors group"
                            >
                                <div>
                                    <div className="font-medium text-sm text-neutral-900">{v.modelo}</div>
                                    <div className="text-xs text-neutral-500 font-mono flex items-center gap-2 mt-0.5">
                                        {v.placa}
                                        {v.codigo && <span className="text-neutral-300">|</span>}
                                        {v.codigo}
                                    </div>
                                </div>
                                {(v.kilometraje !== undefined && v.kilometraje !== null) && (
                                    <div className="text-xs font-mono text-neutral-400 group-hover:text-neutral-700 transition-colors">
                                        {v.kilometraje.toLocaleString()} km
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
