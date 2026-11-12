"use client"

import { Truck, User, Phone, MoreVertical } from "lucide-react"
import type { FleetStatus } from "../actions"
import { getFleetStatus } from "../actions" // Import Server Action
import { useState, useMemo, useEffect } from "react"
import { VehicleDetailsDialog } from "@/components/vehicle-details-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { differenceInMinutes } from "date-fns"
import { cn } from "@/lib/utils"

// --- SUB-COMPONENT: LIVE TIMER ---
function TripTimer({ startDate }: { startDate: string }) {
    const [duration, setDuration] = useState("")

    useEffect(() => {
        const updateTimer = () => {
            const start = new Date(startDate)
            const now = new Date()
            const diffMins = differenceInMinutes(now, start)
            const hours = Math.floor(diffMins / 60)
            const mins = diffMins % 60
            setDuration(`${hours}h ${mins}m`)
        }

        updateTimer() // Initial call
        const interval = setInterval(updateTimer, 60000) // Update every minute
        return () => clearInterval(interval)
    }, [startDate])

    return <span className="text-xs font-mono text-neutral-500 tabular-nums">{duration || "..."}</span>
}

export function LiveFleetDashboard({ vehicles: initialVehicles }: { vehicles: FleetStatus[] }) {
    // Local State for Polled Data
    const [vehicles, setVehicles] = useState<FleetStatus[]>(initialVehicles)
    const [selectedVehicle, setSelectedVehicle] = useState<FleetStatus | null>(null)
    const [filter, setFilter] = useState<'ALL' | 'ROUTE' | 'AVAILABLE' | 'WORKSHOP'>('ALL')

    // BACKGROUND POLLING (Silent - No UI Indicator)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const newData = await getFleetStatus()
                setVehicles(newData)
            } catch (error) {
                console.error("Polling failed", error)
            }
        }, 5000)

        return () => clearInterval(interval)
    }, [])

    // Derived Stats
    const stats = useMemo(() => {
        return {
            total: vehicles.length,
            inRoute: vehicles.filter(v => v.status === 'IN_ROUTE').length,
            available: vehicles.filter(v => v.status === 'AVAILABLE').length,
            maintenance: vehicles.filter(v => v.status === 'MAINTENANCE').length
        }
    }, [vehicles])

    const filteredVehicles = useMemo(() => {
        if (filter === 'ALL') return vehicles
        if (filter === 'ROUTE') return vehicles.filter(v => v.status === 'IN_ROUTE')
        if (filter === 'AVAILABLE') return vehicles.filter(v => v.status === 'AVAILABLE')
        if (filter === 'WORKSHOP') return vehicles.filter(v => v.status === 'MAINTENANCE')
        return vehicles
    }, [vehicles, filter])

    const getStatusConfig = (vehicle: FleetStatus) => {
        switch (vehicle.status) {
            case 'IN_ROUTE': return { label: "En ruta", dot: "bg-emerald-500", text: "text-emerald-700" }
            case 'CRITICAL':
                if (vehicle.faultsSummary.critical > 0 || vehicle.faultsSummary.high > 0) {
                    return { label: "Falla crítica", dot: "bg-red-500", text: "text-red-600" }
                }
                return { label: "Falla pendiente", dot: "bg-amber-500", text: "text-amber-600" }
            case 'MAINTENANCE': return { label: "En taller", dot: "bg-amber-500", text: "text-amber-600" }
            default: return { label: "Disponible", dot: "bg-neutral-400", text: "text-neutral-600" }
        }
    }

    const getFuelColor = (level: number) => {
        if (level < 25) return 'text-red-600'
        if (level < 50) return 'text-amber-600'
        return 'text-emerald-600'
    }

    const dialogVehicle = useMemo(() => {
        if (!selectedVehicle) return null
        return {
            ...selectedVehicle,
            codigo: selectedVehicle.code,
            modelo: selectedVehicle.model,
            placa: selectedVehicle.plate,
            foto_url: selectedVehicle.imageUrl,
        } as any
    }, [selectedVehicle])

    const filterTabs = [
        { id: 'ALL' as const, label: 'Total flota', value: stats.total },
        { id: 'ROUTE' as const, label: 'En ruta', value: stats.inRoute, pulse: stats.inRoute > 0 },
        { id: 'AVAILABLE' as const, label: 'Disponibles', value: stats.available },
        { id: 'WORKSHOP' as const, label: 'Mantenimiento', value: stats.maintenance },
    ]

    return (
        <div className="space-y-8">
            {/* Quick Stats Filter Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-neutral-100">
                {filterTabs.map((tab) => {
                    const active = filter === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setFilter(tab.id)}
                            className={cn(
                                "text-left pb-4 border-b-2 transition-colors",
                                active
                                    ? "border-neutral-900 text-neutral-900"
                                    : "border-transparent text-neutral-400 hover:text-neutral-700"
                            )}
                        >
                            <div className="text-xs font-normal text-neutral-500">{tab.label}</div>
                            <div className="text-2xl font-light tracking-tight mt-0.5 tabular-nums flex items-center gap-2">
                                {tab.value}
                                {tab.pulse && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Open Fleet Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-10">
                {filteredVehicles.map((vehicle) => {
                    const status = getStatusConfig(vehicle)
                    return (
                        <article
                            key={vehicle.id}
                            className="group pb-6 border-b border-neutral-100 flex flex-col gap-4"
                        >
                            {/* Image Section */}
                            <div
                                className="h-44 w-full bg-neutral-100 overflow-hidden cursor-pointer relative"
                                onClick={() => setSelectedVehicle(vehicle)}
                            >
                                {vehicle.imageUrl ? (
                                    <img
                                        src={vehicle.imageUrl}
                                        alt={vehicle.plate}
                                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-neutral-300">
                                        <Truck className="w-8 h-8" strokeWidth={1.25} />
                                    </div>
                                )}
                            </div>

                            {/* Vehicle Identity & Status */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 cursor-pointer" onClick={() => setSelectedVehicle(vehicle)}>
                                    <h3 className="font-medium text-base text-neutral-900 tracking-tight truncate">
                                        {vehicle.model}
                                    </h3>
                                    <p className="font-mono text-xs text-neutral-500 mt-0.5">{vehicle.plate}</p>
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <div className={cn("flex items-center gap-1.5 text-xs font-medium", status.text)}>
                                        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot, vehicle.status === 'IN_ROUTE' && 'animate-pulse')} />
                                        <span>{status.label}</span>
                                    </div>
                                    {vehicle.status === 'IN_ROUTE' && vehicle.lastExit && (
                                        <TripTimer startDate={vehicle.lastExit} />
                                    )}
                                </div>
                            </div>

                            {/* Driver Row */}
                            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={vehicle.driverImg || ""} />
                                        <AvatarFallback className="bg-neutral-100 text-neutral-500 text-xs">
                                            {vehicle.driver ? vehicle.driver.charAt(0) : <User className="w-3.5 h-3.5" strokeWidth={1.25} />}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-neutral-900 leading-none truncate">
                                            {vehicle.driver || "Sin asignar"}
                                        </p>
                                        <p className="text-xs text-neutral-400 mt-1">Conductor</p>
                                    </div>
                                </div>

                                {/* Quick Actions revealed subtly on hover */}
                                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                                    {vehicle.driverPhone && (
                                        <a
                                            href={`tel:${vehicle.driverPhone}`}
                                            className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                            title="Llamar al conductor"
                                        >
                                            <Phone className="w-3.5 h-3.5" strokeWidth={1.25} />
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedVehicle(vehicle)}
                                        className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                        title="Ver detalles"
                                    >
                                        <MoreVertical className="w-3.5 h-3.5" strokeWidth={1.25} />
                                    </button>
                                </div>
                            </div>

                            {/* Pure Typographic Metrics */}
                            <div className="grid grid-cols-2 gap-6 pt-2 border-t border-neutral-100">
                                <div className="flex flex-col">
                                    <span className="text-xs text-neutral-500 font-normal">Gasolina</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={cn("text-lg font-light tracking-tight tabular-nums", getFuelColor(vehicle.current_fuel_level))}>
                                            {vehicle.current_fuel_level}%
                                        </span>
                                        <div className="flex-1 h-1 bg-neutral-100 overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full transition-all duration-500",
                                                    vehicle.current_fuel_level < 25
                                                        ? 'bg-red-500'
                                                        : vehicle.current_fuel_level < 50
                                                            ? 'bg-amber-500'
                                                            : 'bg-emerald-500'
                                                )}
                                                style={{ width: `${vehicle.current_fuel_level}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col">
                                    <span className="text-xs text-neutral-500 font-normal">Kilometraje</span>
                                    <span className="text-lg font-light tracking-tight text-neutral-900 mt-1 tabular-nums">
                                        {vehicle.kilometraje.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </article>
                    )
                })}
            </div>

            {dialogVehicle && (
                <VehicleDetailsDialog
                    isOpen={!!dialogVehicle}
                    onClose={() => setSelectedVehicle(null)}
                    vehicle={dialogVehicle}
                    readonly={true}
                />
            )}
        </div>
    )
}
