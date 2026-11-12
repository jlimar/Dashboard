"use client"

import { X, Car, Bike, Truck, Droplets, Gauge, Wrench, User, CheckCircle2 } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { toast } from "sonner"

type Vehicle = {
    id: string
    codigo: string
    placa: string
    modelo: string
    año: string
    color: string
    tipo: string
    capacidad_tanque: string
    foto_url?: string
    department?: string
    kilometraje?: number
    current_fuel_level?: number
    last_fuel_update?: string
    last_oil_change_km?: number
    last_timing_belt_km?: number
    last_chain_kit_km?: number
    last_wash_date?: string
    assigned_driver_id?: string
    falla_activa?: {
        prioridad: string
        tipo_falla: string
    }
    activeReport?: any // [NEW]
}

type Fault = {
    id: string
    descripcion: string
    tipo_falla: string
    prioridad: string
    estado: string
    created_at: string
}

type VehicleDetailsDialogProps = {
    isOpen: boolean
    onClose: () => void
    vehicle: Vehicle | null
    onUpdate?: () => void
    readonly?: boolean
}

import { DriverSelector, Driver } from "./driver-selector"

export function VehicleDetailsDialog({ isOpen, onClose, vehicle, onUpdate, readonly = false }: VehicleDetailsDialogProps) {
    const [drivers, setDrivers] = useState<Driver[]>([])
    const [assigning, setAssigning] = useState(false)
    const [faults, setFaults] = useState<Fault[]>([])
    const [loadingFaults, setLoadingFaults] = useState(false)

    // Transfer Confirmation State
    const [pendingDriver, setPendingDriver] = useState<any>(null)
    const [transferDialogOpen, setTransferDialogOpen] = useState(false)

    useEffect(() => {
        if (isOpen && vehicle) {
            loadFaults()
            loadDrivers()
        }
    }, [isOpen, vehicle])

    async function loadFaults() {
        if (!vehicle) return
        setLoadingFaults(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('fallas')
            .select('*')
            .eq('vehiculo_id', vehicle.id)
            .neq('estado', 'Descartado')
            .order('created_at', { ascending: false })

        if (data) setFaults(data)
        setLoadingFaults(false)
    }

    async function loadDrivers() {
        const supabase = createClient()

        // 1. Fetch profiles
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')

        // 2. Fetch active vehicle assignments
        const { data: vehicles } = await supabase
            .from('vehiculos')
            .select('id, modelo, placa, assigned_driver_id')
            .not('assigned_driver_id', 'is', null)

            // 1. All profiles are considered drivers now
            const driversList = profiles || []

            // Map current vehicle to driver
            const driversWithStatus = driversList.map((d: any) => {
                const assigned = vehicles?.find((v: any) => v.assigned_driver_id === d.id)
                return { ...d, currentVehicle: assigned }
            })

            setDrivers(driversWithStatus)
    }

    async function handleAssignDriver(d: Driver | null) {
        if (!vehicle) return;

        // If null selected, unassign
        if (!d) {
            executeAssignment('none')
            return
        }

        const driverId = d.id

        // Check availability
        const selectedDriver = drivers.find(dr => dr.id === driverId)

        // Logic for Transfer
        if (selectedDriver?.currentVehicle && selectedDriver.currentVehicle.id !== vehicle.id) {
            setPendingDriver(selectedDriver)
            setTransferDialogOpen(true)
            return
        }

        // Proceed with Assignment directly if no conflict
        executeAssignment(driverId)
    }

    async function executeAssignment(driverId: string, isTransfer = false) {
        if (!vehicle) return

        if (isTransfer && pendingDriver) {
            setAssigning(true)
            const supabase = createClient()
            // 1. Unassign from old vehicle
            const { error: unassignError } = await supabase
                .from('vehiculos')
                .update({ assigned_driver_id: null })
                .eq('id', pendingDriver.currentVehicle.id)

            if (unassignError) {
                console.error("Error unassigning:", unassignError)
                toast.error("Error al desvincular vehículo anterior")
                setAssigning(false)
                return
            }
        }

        setAssigning(true)
        const supabase = createClient()
        const { error } = await supabase
            .from('vehiculos')
            .update({ assigned_driver_id: driverId === 'none' ? null : driverId })
            .eq('id', vehicle.id)

        setAssigning(false)
        if (error) {
            console.error(error)
            toast.error("Error al asignar conductor")
        } else {
            toast.success(isTransfer ? "Traslado realizado con éxito" : "Conductor asignado")
            if (onUpdate) onUpdate()
            onClose()
        }
    }

    const getIcon = (tipo: string) => {
        switch (tipo?.toLowerCase()) {
            case 'moto': return <Bike className="w-4 h-4" strokeWidth={1.25} />;
            case 'carga': return <Truck className="w-4 h-4" strokeWidth={1.25} />;
            default: return <Car className="w-4 h-4" strokeWidth={1.25} />;
        }
    }

    const getPriorityTextClass = (prioridad: string) => {
        switch (prioridad) {
            case 'Crítica': return 'text-red-600 font-medium';
            case 'Alta': return 'text-neutral-900 font-medium';
            default: return 'text-neutral-500';
        }
    }

    if (!isOpen || !vehicle) return null

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent showCloseButton={false} className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col focus:outline-none">

                    {/* Scrollable Content Container */}
                    <div className="overflow-y-auto flex flex-col">

                        {/* Top Section: Image & Key Info */}
                        <div className="w-full flex flex-col">
                            <div className="relative w-full aspect-video bg-neutral-100">
                                {vehicle.foto_url ? (
                                    <Image
                                        src={vehicle.foto_url}
                                        alt={vehicle.modelo}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-neutral-300">
                                        {getIcon(vehicle.tipo)}
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 bg-neutral-950/60 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                    {getIcon(vehicle.tipo)}
                                    <span>{vehicle.tipo}</span>
                                </div>
                                <button
                                    type="button"
                                    className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors p-1 z-10"
                                    onClick={onClose}
                                >
                                    <X className="w-5 h-5" strokeWidth={1.5} />
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="pb-5 border-b border-neutral-100">
                                    <DialogTitle className="text-xl font-medium text-neutral-900 leading-tight">{vehicle.modelo}</DialogTitle>
                                    <DialogDescription className="text-neutral-500 font-mono text-sm mt-0.5">{vehicle.placa}</DialogDescription>
                                </div>

                                {/* Driver Assignment Section */}
                                <div className="py-5 border-b border-neutral-100">
                                    {readonly ? (
                                        <div>
                                            <div className="text-neutral-400 text-xs mb-2">Conductor asignado</div>
                                            <div className="flex items-center gap-3">
                                                <User className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.25} />
                                                <div>
                                                    <div className="font-medium text-sm text-neutral-900">
                                                        {drivers.find(d => d.id === vehicle.assigned_driver_id)?.first_name} {drivers.find(d => d.id === vehicle.assigned_driver_id)?.last_name || "Sin asignar"}
                                                    </div>
                                                    <div className="text-xs text-neutral-500">
                                                        {vehicle.assigned_driver_id ? "Conductor oficial" : "Vehículo sin conductor"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <DriverSelector
                                            drivers={drivers}
                                            selectedDriverId={vehicle.assigned_driver_id}
                                            onSelect={handleAssignDriver}
                                            loading={assigning}
                                        />
                                    )}
                                </div>

                                {/* Key Metrics (Pure Typography) */}
                                <div className="grid grid-cols-3 gap-6 py-5 border-b border-neutral-100">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-neutral-500">Kilometraje</span>
                                        <span className="text-xl font-light tracking-tight text-neutral-900 mt-0.5">
                                            {(vehicle.kilometraje || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-neutral-500">Código</span>
                                        <span className="text-xl font-light tracking-tight font-mono text-neutral-900 mt-0.5">
                                            {vehicle.codigo}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-neutral-500">Combustible</span>
                                        <span className={`text-xl font-light tracking-tight mt-0.5 ${(vehicle.current_fuel_level || 0) <= 25 ? "text-red-600" : "text-neutral-900"}`}>
                                            {vehicle.current_fuel_level || 0}%
                                        </span>
                                    </div>
                                </div>

                                {/* ACTIVE REPORT SECTION */}
                                {vehicle.activeReport && (
                                    <div className="py-5 border-b border-neutral-100 space-y-4">
                                        <div>
                                            <h3 className="font-medium text-neutral-900 text-sm">Reporte de salida activo</h3>
                                            <p className="text-xs text-neutral-500 mt-0.5">
                                                Salida: {new Date(vehicle.activeReport.fecha_salida).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-xs text-neutral-400 block">Conductor</span>
                                                <span className="font-medium text-neutral-900 text-sm block truncate">{vehicle.activeReport.conductor}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-neutral-400 block">Km salida</span>
                                                <span className="font-medium text-neutral-900 text-sm block font-mono">{vehicle.activeReport.km_salida} km</span>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <div className="text-xs text-neutral-400 mb-3">Verificación de salida</div>
                                            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                                                <CheckItem label="Aceite" checked={vehicle.activeReport.aceite_salida} />
                                                <CheckItem label="Iluminación" checked={vehicle.activeReport.luces_salida} />
                                                <CheckItem label="Frenos" checked={vehicle.activeReport.frenos_salida} />
                                                <CheckItem label="Corneta" checked={vehicle.activeReport.corneta_salida} />
                                                <div className="col-span-2 mt-1">
                                                    <TextItem label="Estado de cauchos" value={vehicle.activeReport.estado_cauchos_salida} />
                                                </div>

                                                {!vehicle.tipo?.toLowerCase().includes('moto') && !vehicle.modelo?.toLowerCase().includes('moto') && (
                                                    <>
                                                        <CheckItem label="Cinturones" checked={vehicle.activeReport.cinturones_salida} />
                                                        <CheckItem label="Conos" checked={vehicle.activeReport.conos_salida} />
                                                        <CheckItem label="Extintor" checked={vehicle.activeReport.extintor_salida} />
                                                        <CheckItem label="Botiquín" checked={vehicle.activeReport.botiquin_salida} />
                                                        <CheckItem label="Agua / Refr." checked={vehicle.activeReport.agua_salida} />
                                                        <CheckItem label="Caucho" checked={vehicle.activeReport.caucho_salida} />
                                                        <CheckItem label="Gato" checked={vehicle.activeReport.gato_salida} />
                                                        <CheckItem label="Triángulo" checked={vehicle.activeReport.triangulo_salida} />
                                                        <CheckItem label="Cruz" checked={vehicle.activeReport.cruz_salida} />
                                                        <CheckItem label="Carpeta" checked={vehicle.activeReport.carpeta_salida} />
                                                    </>
                                                )}

                                                {(vehicle.tipo?.toLowerCase().includes('moto') || vehicle.modelo?.toLowerCase().includes('moto')) && (
                                                    <>
                                                        <CheckItem label="Casco" checked={vehicle.activeReport.casco_salida} />
                                                        <CheckItem label="Herramientas" checked={vehicle.activeReport.herramientas_salida} />
                                                    </>
                                                )}

                                                {(vehicle.department === 'Soporte' || vehicle.department === 'Instalación' || vehicle.department === 'Distribución' || vehicle.department === 'Afectaciones') && !vehicle.tipo?.toLowerCase().includes('moto') && !vehicle.modelo?.toLowerCase().includes('moto') && (
                                                    <>
                                                        {vehicle.department === 'Instalación' && (
                                                            <CheckItem label="UPS" checked={vehicle.activeReport.ups_salida === 1} />
                                                        )}
                                                        <CheckItem label="Esc. Telescópica" checked={vehicle.activeReport.escalera_salida} />
                                                    </>
                                                )}

                                                {(vehicle.tipo?.toLowerCase() === 'carga' || vehicle.modelo?.toLowerCase().includes('carga')) && (
                                                    <CheckItem label="Esc. Tijera" checked={vehicle.activeReport.escalera_tijera_salida} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Maintenance Section */}
                                <div className="py-5 border-b border-neutral-100">
                                    <h3 className="text-sm font-medium text-neutral-900 mb-3">
                                        Mantenimiento preventivo
                                    </h3>

                                    <div className="divide-y divide-neutral-100">
                                        {/* Oil Change */}
                                        <div className="py-3.5">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Droplets className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.25} />
                                                    <span className="text-sm text-neutral-700">Cambio de aceite</span>
                                                </div>
                                                <span className="text-xs text-neutral-400 font-mono">
                                                    Último: {vehicle.last_oil_change_km ? vehicle.last_oil_change_km.toLocaleString() + ' km' : 'N/A'}
                                                </span>
                                            </div>

                                            {vehicle.last_oil_change_km && vehicle.kilometraje ? (() => {
                                                const interval = 5000
                                                const driven = (vehicle.kilometraje || 0) - vehicle.last_oil_change_km
                                                const progress = Math.min(100, (driven / interval) * 100)
                                                const remaining = Math.max(0, interval - driven)
                                                const statusColor = progress >= 90 ? 'bg-red-500' : progress >= 75 ? 'bg-neutral-700' : 'bg-neutral-900'

                                                return (
                                                    <div>
                                                        <div className="flex justify-between text-xs mb-1.5">
                                                            <span className="text-neutral-500">Recorrido: {driven.toLocaleString()} km</span>
                                                            <span className={progress >= 90 ? 'text-red-600 font-medium' : 'text-neutral-600'}>
                                                                {remaining.toLocaleString()} km restantes
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${statusColor}`}
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })() : (
                                                <div className="text-xs text-neutral-400 italic">Sin información de servicio</div>
                                            )}
                                        </div>

                                        {/* Timing Belt */}
                                        {(() => {
                                            const model = vehicle.modelo?.toUpperCase() || ''
                                            const type = vehicle.tipo?.toLowerCase() || (model.includes('MOTO') ? 'moto' : '')
                                            const hideFor = ['HILUX', 'TRITON', 'DONFENG', 'RICH', 'NKR']

                                            if (type === 'moto') return null
                                            if (hideFor.some(keyword => model.includes(keyword))) return null

                                            return (
                                                <div className="py-3.5">
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <Gauge className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.25} />
                                                            <span className="text-sm text-neutral-700">Correa de tiempo</span>
                                                        </div>
                                                        <span className="text-xs text-neutral-400 font-mono">
                                                            Último: {vehicle.last_timing_belt_km ? vehicle.last_timing_belt_km.toLocaleString() + ' km' : 'N/A'}
                                                        </span>
                                                    </div>

                                                    {vehicle.last_timing_belt_km && vehicle.kilometraje ? (() => {
                                                        const interval = 50000
                                                        const driven = (vehicle.kilometraje || 0) - vehicle.last_timing_belt_km
                                                        const progress = Math.min(100, (driven / interval) * 100)
                                                        const remaining = Math.max(0, interval - driven)
                                                        const statusColor = progress >= 90 ? 'bg-red-500' : progress >= 75 ? 'bg-neutral-700' : 'bg-neutral-900'

                                                        return (
                                                            <div>
                                                                <div className="flex justify-between text-xs mb-1.5">
                                                                    <span className="text-neutral-500">Recorrido: {driven.toLocaleString()} km</span>
                                                                    <span className={progress >= 90 ? 'text-red-600 font-medium' : 'text-neutral-600'}>
                                                                        {remaining.toLocaleString()} km restantes
                                                                    </span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-500 ${statusColor}`}
                                                                        style={{ width: `${progress}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )
                                                    })() : (
                                                        <div className="text-xs text-neutral-400 italic">Sin información de servicio</div>
                                                    )}
                                                </div>
                                            )
                                        })()}

                                        {/* Chain Kit - Only for Motos */}
                                        {(vehicle.tipo?.toLowerCase() === 'moto' || vehicle.modelo?.toLowerCase().includes('moto')) && (
                                            <div className="py-3.5">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <Bike className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.25} />
                                                        <span className="text-sm text-neutral-700">Kit de arrastre</span>
                                                    </div>
                                                    <span className="text-xs text-neutral-400 font-mono">
                                                        Último: {vehicle.last_chain_kit_km ? vehicle.last_chain_kit_km.toLocaleString() + ' km' : 'N/A'}
                                                    </span>
                                                </div>

                                                {vehicle.last_chain_kit_km && vehicle.kilometraje ? (() => {
                                                    const interval = 20000
                                                    const driven = (vehicle.kilometraje || 0) - vehicle.last_chain_kit_km
                                                    const progress = Math.min(100, (driven / interval) * 100)
                                                    const remaining = Math.max(0, interval - driven)
                                                    const statusColor = progress >= 90 ? 'bg-red-500' : progress >= 75 ? 'bg-neutral-700' : 'bg-neutral-900'

                                                    return (
                                                        <div>
                                                            <div className="flex justify-between text-xs mb-1.5">
                                                                <span className="text-neutral-500">Recorrido: {driven.toLocaleString()} km</span>
                                                                <span className={progress >= 90 ? 'text-red-600 font-medium' : 'text-neutral-600'}>
                                                                    {remaining.toLocaleString()} km restantes
                                                                </span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${statusColor}`}
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )
                                                })() : (
                                                    <div className="text-xs text-neutral-400 italic">Sin información de servicio</div>
                                                )}
                                            </div>
                                        )}

                                        {/* Washing */}
                                        <div className="py-3.5">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Droplets className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.25} />
                                                <span className="text-sm text-neutral-700">Lavado y aspirado</span>
                                            </div>

                                            {vehicle.last_wash_date ? (() => {
                                                const lastWash = new Date(vehicle.last_wash_date)
                                                const today = new Date()
                                                const diffTime = Math.abs(today.getTime() - lastWash.getTime())
                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                                                const statusTextClass = diffDays > 15 ? 'text-red-600 font-medium' : diffDays > 7 ? 'text-neutral-700' : 'text-neutral-500'
                                                const statusText = diffDays > 15 ? 'Necesita lavado' : diffDays > 7 ? 'Aceptable' : 'Limpio'

                                                return (
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-neutral-500">
                                                            Hace {diffDays} días ({lastWash.toLocaleDateString()})
                                                        </span>
                                                        <span className={statusTextClass}>
                                                            {statusText}
                                                        </span>
                                                    </div>
                                                )
                                            })() : (
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-neutral-400 italic">Sin registro de lavado</span>
                                                    <span className="text-neutral-400">Desconocido</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {vehicle.last_fuel_update && (
                                    <p className="text-xs text-neutral-400 text-right pt-3">
                                        Combustible actualizado: {new Date(vehicle.last_fuel_update).toLocaleString()}
                                    </p>
                                )}

                                <div className="grid grid-cols-3 gap-4 text-sm py-5 border-b border-neutral-100">
                                    <div>
                                        <span className="block text-neutral-400 text-xs mb-0.5">Año</span>
                                        <span className="font-medium text-neutral-900">{vehicle.año || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-neutral-400 text-xs mb-0.5">Color</span>
                                        <span className="font-medium text-neutral-900">{vehicle.color || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-neutral-400 text-xs mb-0.5">Tanque</span>
                                        <span className="font-medium text-neutral-900">{vehicle.capacidad_tanque || '-'} L</span>
                                    </div>
                                </div>

                                {/* Faults History */}
                                <div className="pt-5">
                                    <h3 className="text-sm font-medium text-neutral-900 mb-3">
                                        Historial de fallas
                                    </h3>

                                    <div className="divide-y divide-neutral-100">
                                        {loadingFaults ? (
                                            <div className="text-center py-6 text-neutral-400 text-sm">Cargando historial...</div>
                                        ) : faults.length === 0 ? (
                                            <div className="text-center py-8 text-neutral-400 text-sm">
                                                Sin fallas reportadas
                                            </div>
                                        ) : (
                                            faults.map((fault) => (
                                                <div key={fault.id} className="py-3.5 space-y-1">
                                                    <div className="flex justify-between items-center gap-2">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className={getPriorityTextClass(fault.prioridad)}>
                                                                {fault.prioridad}
                                                            </span>
                                                            <span className="text-neutral-300">·</span>
                                                            <span className="text-neutral-500">
                                                                {fault.estado}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-neutral-400 font-mono">
                                                            {new Date(fault.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <h4 className="font-medium text-neutral-900 text-sm">{fault.tipo_falla}</h4>
                                                    <p className="text-sm text-neutral-600 leading-relaxed">{fault.descripcion}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <DeleteConfirmDialog
                open={transferDialogOpen}
                onOpenChange={setTransferDialogOpen}
                title="Confirmar traslado"
                confirmLabel="Confirmar traslado"
                cancelLabel="Cancelar"
                destructive={false}
                description={
                    pendingDriver ? (
                        <span>
                            <strong className="font-medium text-neutral-900">{pendingDriver.first_name}</strong> actualmente tiene asignado el vehículo{" "}
                            <strong className="font-medium text-neutral-900">{pendingDriver.currentVehicle.modelo}</strong> ({pendingDriver.currentVehicle.placa}). ¿Deseas desvincularlo de su unidad actual y asignarlo a este vehículo?
                        </span>
                    ) : null
                }
                onConfirm={() => {
                    if (pendingDriver) {
                        executeAssignment(pendingDriver.id, true)
                    }
                }}
            />
        </>
    )
}

function CheckItem({ label, checked }: { label: string, checked: boolean }) {
    return (
        <div className="flex items-center gap-2">
            {checked ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 shrink-0" strokeWidth={1.25} />
            ) : (
                <X className="w-3.5 h-3.5 text-neutral-300 shrink-0" strokeWidth={1.25} />
            )}
            <span className={`text-xs ${checked ? 'text-neutral-700' : 'text-neutral-400'}`}>{label}</span>
        </div>
    )
}

function TextItem({ label, value }: { label: string, value: string | undefined | null }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs text-neutral-400">{label}</span>
            <span className="text-sm text-neutral-700">{value || 'N/A'}</span>
        </div>
    )
}
