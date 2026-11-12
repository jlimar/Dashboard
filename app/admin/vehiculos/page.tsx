"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { VehicleFormDialog } from "@/components/vehicle-form-dialog"
import { VehicleDetailsDialog } from "@/components/vehicle-details-dialog"
import { MileageCorrectionDialog } from "@/components/mileage-correction-dialog"
import { TalonarioCorrectionDialog } from "@/components/talonario-correction-dialog"
import {
    Plus,
    Search,
    Car,
    Bike,
    Truck,
    MoreVertical,
    PenLine,
    X,
    ArrowLeft,
    Wrench,
    FileDigit,
    XCircle,
    Download,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"

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
    falla_activa?: {
        prioridad: string
        tipo_falla: string
    }
    current_fuel_level?: number
    last_fuel_update?: string
    last_oil_change_km?: number
    last_timing_belt_km?: number
    last_chain_kit_km?: number
    last_wash_date?: string
}

function VehiculosContent() {
    const searchParams = useSearchParams()
    const initialSearch = searchParams.get("q") || ""

    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
    const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null)
    const [detailsVehicle, setDetailsVehicle] = useState<Vehicle | null>(null)
    const [correctionVehicle, setCorrectionVehicle] = useState<Vehicle | null>(null)
    const [talonarioVehicle, setTalonarioVehicle] = useState<Vehicle | null>(null)

    // Open Trips State
    const [openTrips, setOpenTrips] = useState<any[]>([])
    const [forceCloseDialog, setForceCloseDialog] = useState(false)
    const [tripToClose, setTripToClose] = useState<any | null>(null)
    const [forceCloseKm, setForceCloseKm] = useState("")
    const [forceCloseNote, setForceCloseNote] = useState("")
    const [closingTrip, setClosingTrip] = useState(false)
    const [exporting, setExporting] = useState(false)

    async function exportToExcel() {
        setExporting(true)
        try {
            const supabase = createClient()

            // 1. Obtener todos los vehículos
            const { data: vehiculosData, error: vehError } = await supabase
                .from('vehiculos')
                .select('*')

            if (vehError) throw vehError

            // 2. Fallas activas
            const { data: fallasData, error: fallasError } = await supabase
                .from('fallas')
                .select('*')
                .neq('estado', 'Reparado')
                .neq('estado', 'Descartado')

            if (fallasError) throw fallasError

            const formatCheck = (val: boolean | undefined | null) => val ? 'Sí' : 'No'

            const excelDataPromises = vehiculosData.map(async (v) => {
                const { data: lr } = await supabase
                    .from('reportes')
                    .select('*')
                    .eq('vehiculo_id', v.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                const fallas = fallasData.filter(f => f.vehiculo_id === v.id).map(f => `[${f.prioridad}] ${f.tipo_falla}: ${f.descripcion}`).join(' | ')

                const isSalida = lr && !lr.km_entrada;
                const status = isSalida ? 'En Ruta' : 'Disponible / En Base';
                const driver = isSalida ? lr.conductor : (lr?.conductor || 'Ninguno');
                const isMoto = v.tipo?.toLowerCase().includes('moto') || v.modelo?.toLowerCase().includes('moto')

                return {
                    "Código": v.codigo,
                    "Placa": v.placa,
                    "Modelo": v.modelo,
                    "Tipo": v.tipo || 'Desconocido',
                    "Color": v.color || 'Desconocido',
                    "Estado Actual": status,
                    "Último Conductor": driver,
                    "Kilometraje Actual": v.kilometraje || lr?.km_entrada || lr?.km_salida || 0,
                    "Nivel Gasolina (%)": v.current_fuel_level || 0,
                    "Fallas Activas": fallas || 'Ninguna',

                    // Chequeo Técnico
                    "Aceite (Últ. Reporte)": formatCheck(isSalida ? lr?.aceite_salida : lr?.aceite_entrada),
                    "Iluminación": formatCheck(isSalida ? lr?.luces_salida : lr?.luces_entrada),
                    "Frenos": formatCheck(isSalida ? lr?.frenos_salida : lr?.frenos_entrada),
                    "Cauchos": isSalida ? (lr?.estado_cauchos_salida || 'N/A') : (lr?.estado_cauchos_entrada || 'N/A'),
                    "Corneta": formatCheck(isSalida ? lr?.corneta_salida : lr?.corneta_entrada),
                    "Agua/Refrigerante": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.agua_salida : lr?.agua_entrada),

                    // Seguridad y Herramientas
                    "Cinturones": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.cinturones_salida : lr?.cinturones_entrada),
                    "Conos": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.conos_salida : lr?.conos_entrada),
                    "Extintor": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.extintor_salida : lr?.extintor_entrada),
                    "Botiquín": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.botiquin_salida : lr?.botiquin_entrada),
                    "Gato": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.gato_salida : lr?.gato_entrada),
                    "Llave Cruz": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.cruz_salida : lr?.cruz_entrada),
                    "Triángulo": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.triangulo_salida : lr?.triangulo_entrada),
                    "Caucho de repuesto": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.caucho_salida : lr?.caucho_entrada),
                    "Escalera Telescópica": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.escalera_salida : lr?.escalera_entrada),
                    "Escalera de Tijera": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.escalera_tijera_salida : lr?.escalera_tijera_entrada),
                    "Carpeta de Permisos": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.carpeta_salida : lr?.carpeta_entrada),

                    // Moto Specific
                    "Casco (Moto)": isMoto ? formatCheck(isSalida ? lr?.casco_salida : lr?.casco_entrada) : 'N/A',
                    "Herramientas Moto": isMoto ? formatCheck(isSalida ? lr?.herramientas_salida : lr?.herramientas_entrada) : 'N/A',

                    // Dispositivos y Notas
                    "UPS": isMoto ? 'N/A' : formatCheck(isSalida ? lr?.ups_salida : lr?.ups_entrada),
                    "Observaciones (Viaje)": isSalida ? (lr?.observaciones_salida || 'Ninguna') : (lr?.observaciones_entrada || 'Ninguna'),

                    "Departamento (Últ. Viaje)": lr?.departamento || 'N/A',
                    "Último Reporte ID": lr?.id || 'N/A',
                    "Fecha Último Reporte": lr ? new Date(lr.created_at).toLocaleString() : 'N/A'
                }
            })

            const excelData = await Promise.all(excelDataPromises)

            const XLSX = await import('xlsx')
            const worksheet = XLSX.utils.json_to_sheet(excelData)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Flota")

            XLSX.writeFile(workbook, `Reporte_Flota_${new Date().toISOString().split('T')[0]}.xlsx`)
            toast.success("Excel generado con éxito")
        } catch (error) {
            console.error("Error exporting to Excel:", error)
            toast.error("Error al exportar a Excel")
        } finally {
            setExporting(false)
        }
    }

    const filteredVehicles = vehicles.filter(v =>
        v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // HANDLE DEEP LINK (Voice Command)
    useEffect(() => {
        if (!loading && initialSearch && vehicles.length > 0) {
            const targetVehicle = vehicles.find(v =>
                v.placa.toLowerCase().includes(initialSearch.toLowerCase()) ||
                v.modelo.toLowerCase().includes(initialSearch.toLowerCase()) ||
                v.codigo.toLowerCase().includes(initialSearch.toLowerCase())
            )

            if (targetVehicle) {
                setDetailsVehicle(targetVehicle)
                setDetailsOpen(true)
                setSearchTerm(initialSearch)

                const newUrl = new URL(window.location.href)
                newUrl.searchParams.delete("q")
                window.history.replaceState({}, "", newUrl.toString())
            } else if (initialSearch) {
                toast.warning(`No encontré vehículos coincidiendo con "${initialSearch}"`)
                const newUrl = new URL(window.location.href)
                newUrl.searchParams.delete("q")
                window.history.replaceState({}, "", newUrl.toString())
            }
        }
    }, [loading, initialSearch, vehicles])

    useEffect(() => {
        loadVehicles()
    }, [])

    async function loadVehicles() {
        try {
            const supabase = createClient()

            const { data: vehiclesData, error: vehiclesError } = await supabase
                .from('vehiculos')
                .select('*')
                .order('created_at', { ascending: false })

            if (vehiclesError) throw vehiclesError

            const { data: mileageData, error: mileageError } = await supabase
                .from('vista_ultimos_kilometrajes')
                .select('vehiculo_id, ultimo_kilometraje')

            const { data: faultsData, error: faultsError } = await supabase
                .from('fallas')
                .select('vehiculo_id, prioridad, tipo_falla')
                .neq('estado', 'Reparado')
                .neq('estado', 'Descartado')

            if (mileageError) console.error('Error fetching mileages:', JSON.stringify(mileageError, null, 2))
            if (faultsError) console.error('Error fetching defaults:', JSON.stringify(faultsError, null, 2))

            const mergedVehicles = vehiclesData?.map(vehicle => {
                const mileageRecord = mileageData?.find(m => m.vehiculo_id === vehicle.id)
                const activeFaults = faultsData?.filter(f => f.vehiculo_id === vehicle.id) || []
                let mainFault = null

                if (activeFaults.length > 0) {
                    const priorityOrder = ['Crítica', 'Alta', 'Media', 'Baja']
                    mainFault = activeFaults.sort((a, b) => {
                        return priorityOrder.indexOf(a.prioridad) - priorityOrder.indexOf(b.prioridad)
                    })[0]
                }

                return {
                    ...vehicle,
                    kilometraje: mileageRecord?.ultimo_kilometraje || 0,
                    falla_activa: mainFault ? { prioridad: mainFault.prioridad, tipo_falla: mainFault.tipo_falla } : undefined
                }
            }) || []

            setVehicles(mergedVehicles)

            const { data: tripsData } = await supabase
                .from('reportes')
                .select('id, vehiculo_id, conductor, km_salida, fecha_salida, user_id')
                .is('km_entrada', null)
                .order('fecha_salida', { ascending: false })

            if (tripsData && tripsData.length > 0) {
                const enrichedTrips = tripsData.map(t => {
                    const v = mergedVehicles.find(v => v.id === t.vehiculo_id)
                    const hoursActive = Math.floor((Date.now() - new Date(t.fecha_salida).getTime()) / (1000 * 3600))
                    return {
                        ...t,
                        vehicleModel: v?.modelo || 'Desconocido',
                        vehiclePlaca: v?.placa || '',
                        hoursActive
                    }
                })
                setOpenTrips(enrichedTrips)
            } else {
                setOpenTrips([])
            }
        } catch (error) {
            console.error('Error loading vehicles:', error)
            toast.error('Error al cargar vehículos')
        } finally {
            setLoading(false)
        }
    }

    async function executeDelete() {
        if (!deletingVehicle) return

        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('vehiculos')
                .delete()
                .eq('id', deletingVehicle.id)

            if (error) throw error

            toast.success('Vehículo eliminado')
            loadVehicles()
        } catch (error) {
            console.error('Error deleting:', error)
            toast.error('Error al eliminar. Verifique que no tenga reportes asociados.')
        } finally {
            setDeletingVehicle(null)
        }
    }

    const getIcon = (tipo: string) => {
        switch (tipo?.toLowerCase()) {
            case 'moto': return <Bike className="w-4 h-4" strokeWidth={1.25} />
            case 'carga': return <Truck className="w-4 h-4" strokeWidth={1.25} />
            default: return <Car className="w-4 h-4" strokeWidth={1.25} />
        }
    }

    return (
        <main className="min-h-screen bg-white text-neutral-900 pb-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
                {/* HEADER UNIFORME */}
                <header className="pb-6 mb-8 border-b border-neutral-100 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
                            Inicio
                        </Link>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-light tracking-tight text-neutral-900">
                                Flota de vehículos
                            </h1>
                            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                                Panel de administración
                            </p>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-5">
                            <button
                                type="button"
                                onClick={exportToExcel}
                                disabled={exporting}
                                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40"
                            >
                                <Download className="w-3.5 h-3.5" strokeWidth={1.25} />
                                {exporting ? "Exportando..." : "Exportar"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingVehicle(null)
                                    setDialogOpen(true)
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" strokeWidth={1.25} />
                                Agregar vehículo
                            </button>
                        </div>
                    </div>
                </header>

                {/* SEARCH */}
                <div className="mb-8 max-w-md">
                    <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-0 pointer-events-none" strokeWidth={1.25} />
                        <input
                            type="text"
                            placeholder="Buscar por placa, modelo o código..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 pl-6 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            suppressHydrationWarning
                        />
                    </div>
                </div>

                {/* LIST */}
                {loading ? (
                    <div className="py-20 text-center text-xs text-neutral-400">
                        Cargando flota...
                    </div>
                ) : filteredVehicles.length === 0 ? (
                    <div className="py-16 text-center border-t border-b border-neutral-100">
                        <p className="text-neutral-400 text-sm">No se encontraron vehículos</p>
                    </div>
                ) : (
                    <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100">
                        {filteredVehicles.map((vehicle) => {
                            const openTrip = openTrips.find(t => t.vehiculo_id === vehicle.id)
                            const fuelLevel = vehicle.current_fuel_level || 0
                            return (
                                <div
                                    key={vehicle.id}
                                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-2 -mx-2 hover:bg-neutral-50/50 transition-colors"
                                >
                                    <div
                                        className="flex items-center gap-4 min-w-0 flex-1 cursor-pointer"
                                        onClick={() => {
                                            setDetailsVehicle(vehicle)
                                            setDetailsOpen(true)
                                        }}
                                    >
                                        <div className="w-14 h-10 relative rounded-md bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center text-neutral-400">
                                            {vehicle.foto_url ? (
                                                <Image
                                                    src={vehicle.foto_url}
                                                    alt={vehicle.modelo}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                getIcon(vehicle.tipo)
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <h3 className="text-sm font-medium text-neutral-900 truncate">
                                                    {vehicle.modelo}
                                                </h3>
                                                <span className="text-xs font-mono text-neutral-500">
                                                    {vehicle.placa}
                                                </span>
                                                {openTrip && (
                                                    <span className="text-xs font-medium text-neutral-900">
                                                        · En ruta ({openTrip.hoursActive}h)
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5 flex-wrap">
                                                <span>{vehicle.tipo || 'Vehículo'}</span>
                                                {vehicle.año && <span>· {vehicle.año}</span>}
                                                {vehicle.color && <span>· {vehicle.color}</span>}
                                                {vehicle.falla_activa && (
                                                    <span className={vehicle.falla_activa.prioridad === 'Crítica' ? 'text-red-600' : 'text-neutral-500'}>
                                                        · Falla {vehicle.falla_activa.tipo_falla.toLowerCase()} ({vehicle.falla_activa.prioridad.toLowerCase()})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                                        <div className="flex items-center gap-5 text-xs">
                                            <span className="text-neutral-600 tabular-nums">
                                                {(vehicle.kilometraje || 0).toLocaleString()} km
                                            </span>
                                            <span className={fuelLevel <= 25 ? "text-red-600 tabular-nums" : "text-neutral-500 tabular-nums"}>
                                                {fuelLevel}% comb.
                                            </span>
                                        </div>

                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingVehicle(vehicle)
                                                    setDialogOpen(true)
                                                }}
                                                title="Editar"
                                                className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                            >
                                                <PenLine className="w-3.5 h-3.5" strokeWidth={1.25} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setDeletingVehicle(vehicle)}
                                                title="Eliminar"
                                                className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                                            </button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        title="Más opciones"
                                                        className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                                    >
                                                        <MoreVertical className="w-3.5 h-3.5" strokeWidth={1.25} />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xs border border-neutral-200/70 rounded-lg shadow-sm">
                                                    <DropdownMenuItem onClick={() => setCorrectionVehicle(vehicle)}>
                                                        <Wrench className="mr-2 h-3.5 w-3.5 text-neutral-500" strokeWidth={1.25} />
                                                        <span className="text-xs">Corregir kilometraje</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setTalonarioVehicle(vehicle)}>
                                                        <FileDigit className="mr-2 h-3.5 w-3.5 text-neutral-500" strokeWidth={1.25} />
                                                        <span className="text-xs">Corregir talonario</span>
                                                    </DropdownMenuItem>
                                                    {openTrip && (
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setTripToClose(openTrip)
                                                                setForceCloseKm(openTrip.km_salida?.toString() || "")
                                                                setForceCloseNote("")
                                                                setForceCloseDialog(true)
                                                            }}
                                                        >
                                                            <XCircle className="mr-2 h-3.5 w-3.5 text-neutral-500" strokeWidth={1.25} />
                                                            <span className="text-xs">Forzar entrada</span>
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <VehicleFormDialog
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onVehicleSaved={loadVehicles}
                vehicleToEdit={editingVehicle}
            />

            <VehicleDetailsDialog
                isOpen={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                vehicle={detailsVehicle}
                onUpdate={loadVehicles}
            />

            <MileageCorrectionDialog
                isOpen={!!correctionVehicle}
                onClose={() => setCorrectionVehicle(null)}
                vehicleId={correctionVehicle?.id || ""}
                vehicleName={`${correctionVehicle?.modelo} - ${correctionVehicle?.placa}`}
                currentMileage={correctionVehicle?.kilometraje || 0}
                onUpdate={loadVehicles}
            />

            <TalonarioCorrectionDialog
                isOpen={!!talonarioVehicle}
                onClose={() => setTalonarioVehicle(null)}
                vehicleId={talonarioVehicle?.id || ""}
                vehicleName={`${talonarioVehicle?.modelo} - ${talonarioVehicle?.placa}`}
                onUpdate={loadVehicles}
            />

            <DeleteConfirmDialog
                open={!!deletingVehicle}
                onOpenChange={(open) => !open && setDeletingVehicle(null)}
                title="¿Eliminar vehículo?"
                description={
                    <>
                        Se eliminará el vehículo <strong className="font-medium text-neutral-900">{deletingVehicle?.modelo}</strong> ({deletingVehicle?.placa}). Esta acción podría fallar si existen reportes asociados.
                    </>
                }
                confirmLabel="Eliminar"
                onConfirm={executeDelete}
            />

            {/* FORCE CLOSE TRIP DIALOG */}
            <Dialog open={forceCloseDialog} onOpenChange={(open) => { if (!open) setForceCloseDialog(false) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-medium text-neutral-900">
                            Forzar cierre de viaje
                        </DialogTitle>
                        <DialogDescription className="text-xs text-neutral-500">
                            Cerrarás administrativamente el viaje de <span className="font-medium text-neutral-900">{tripToClose?.vehicleModel}</span> ({tripToClose?.vehiclePlaca}) — Conductor: {tripToClose?.conductor || 'Desconocido'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 mt-2">
                        <div className="space-y-1">
                            <label className="text-xs text-neutral-500 block">
                                Kilometraje estimado de entrada
                            </label>
                            <input
                                type="number"
                                min={tripToClose?.km_salida || 0}
                                value={forceCloseKm}
                                onChange={e => setForceCloseKm(e.target.value)}
                                placeholder="Ej. 45320"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm font-mono text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                            <p className="text-[11px] text-neutral-400">
                                Kilometraje de salida registrado: {tripToClose?.km_salida?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-neutral-500 block">
                                Nota de cierre
                            </label>
                            <textarea
                                value={forceCloseNote}
                                onChange={e => setForceCloseNote(e.target.value)}
                                placeholder="Motivo del cierre administrativo..."
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors resize-none h-20"
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={() => setForceCloseDialog(false)}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={closingTrip || !forceCloseKm}
                            onClick={async () => {
                                if (!tripToClose || !forceCloseKm) return
                                setClosingTrip(true)
                                try {
                                    const supabase = createClient()
                                    const { error } = await supabase
                                        .from('reportes')
                                        .update({
                                            km_entrada: parseInt(forceCloseKm),
                                            fecha_entrada: new Date().toISOString(),
                                            observaciones_entrada: `[Cierre Administrativo] ${forceCloseNote || 'Sin nota'}`
                                        })
                                        .eq('id', tripToClose.id)
                                    if (error) throw error

                                    await supabase
                                        .from('vehiculos')
                                        .update({ kilometraje: parseInt(forceCloseKm) })
                                        .eq('id', tripToClose.vehiculo_id)

                                    toast.success('Viaje cerrado administrativamente')
                                    setForceCloseDialog(false)
                                    setTripToClose(null)
                                    loadVehicles()
                                } catch (err: any) {
                                    toast.error('Error al cerrar viaje: ' + err.message)
                                } finally {
                                    setClosingTrip(false)
                                }
                            }}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                        >
                            {closingTrip ? 'Cerrando...' : 'Confirmar cierre'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    )
}

export default function AdminVehiculosPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center text-xs text-neutral-400">
                Cargando flota...
            </div>
        }>
            <VehiculosContent />
        </Suspense>
    )
}
