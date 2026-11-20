"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, AlertCircle, ChevronRight, Car, Fuel, QrCode } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { ReportFaultDialog } from "@/components/report-fault-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import QRCode from "react-qr-code"
import Link from "next/link"
import { VehicleSelector } from "@/components/vehicle-selector" // [FIX] Import added
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"

import { assignVehicleToDriver, releaseVehicleAction } from "./actions" // [FIX] Import server actions

// ... inside component ...

// (Removed misplaced function)
// ... imports fixed ...

type Vehicle = {
    id: string
    modelo: string
    placa: string
    codigo: string
    falla_activa?: any
    current_fuel_level?: number
    kilometraje?: number
    foto_url?: string // [UPDATED] Use correct column name
}

type Profile = {
    id: string
    first_name: string
    last_name: string
    national_id: string
}

export default function TransportePage() {
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null) // For Driver Mode

    // Pool Mode States
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("")
    const [activeTripReport, setActiveTripReport] = useState<any>(null) // [NEW] Track active trip for user

    // Dialog States
    const [salidaOpen, setSalidaOpen] = useState(false)
    const [entradaOpen, setEntradaOpen] = useState(false)
    const [faultOpen, setFaultOpen] = useState(false)
    const [vehicleSelectOpen, setVehicleSelectOpen] = useState(false) // For manual select in Pool Mode
    const [qrOpen, setQrOpen] = useState(false) // For Driver Mode
    const [releaseDialogOpen, setReleaseDialogOpen] = useState(false)
    const [releasing, setReleasing] = useState(false)
    const [openTripsCount, setOpenTripsCount] = useState(0)
    const [fleetOpenTrips, setFleetOpenTrips] = useState<any[]>([])

    const [initialVehicleId, setInitialVehicleId] = useState<string>("")

    const searchParams = useSearchParams()
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        const action = searchParams.get('action')
        const vId = searchParams.get('vehicle_id')

        if (action === 'salida') {
            router.replace(vId ? `/transporte/salida?vehicle_id=${vId}` : `/transporte/salida`)
        } else if (action === 'entrada') {
            router.replace(vId ? `/transporte/entrada?vehicle_id=${vId}` : `/transporte/entrada`)
        }
    }, [searchParams])

    async function loadData(silent = false) {
        if (!silent) setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // 1. Fetch Profile, Assigned Vehicle, Active Trip, and Fleet Open Trips in PARALLEL
            const [profileRes, assignedVehRes, activeTripRes, allOpenTripsRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single(),
                supabase
                    .from('vehiculos')
                    .select('*')
                    .eq('assigned_driver_id', user.id)
                    .limit(1)
                    .maybeSingle(),
                supabase
                    .from('reportes')
                    .select('*, vehiculos(*)')
                    .eq('user_id', user.id)
                    .is('km_entrada', null)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                supabase
                    .from('reportes')
                    .select('id, vehiculo_id, conductor, km_salida, fecha_salida, user_id, vehiculos(modelo, placa)')
                    .is('km_entrada', null)
                    .order('fecha_salida', { ascending: false })
            ])

            const profileData = profileRes.data
            setProfile(profileData)

            const openTripsList = (allOpenTripsRes.data as any[]) || []
            setOpenTripsCount(openTripsList.length)
            setFleetOpenTrips(openTripsList)

            let activeTripData = activeTripRes.data
            let myVehicle = assignedVehRes.data

            // IF user is 'mecanico', we SKIP Driver Mode to allow them to see ALL vehicles
            const isMecanico = (profileData?.roles || []).map((r: string) => r.toLowerCase()).includes('mecanico')
            if (isMecanico) {
                myVehicle = null
            }

            // If user has an assigned vehicle and it is currently in route, link the trip
            if (!activeTripData && myVehicle) {
                const vTrip = openTripsList.find((t: any) => t.vehiculo_id === myVehicle.id)
                if (vTrip) {
                    activeTripData = { ...vTrip, vehiculos: myVehicle }
                }
            }

            let contextVehicle = null

            // If active trip exists, that vehicle has top priority
            if (activeTripData) {
                contextVehicle = activeTripData.vehiculos
                setActiveTripReport(activeTripData)
            } else {
                if (myVehicle) {
                    contextVehicle = myVehicle
                }
                setActiveTripReport(null)
            }

            if (contextVehicle) {
                setAssignedVehicle(contextVehicle)
            } else {
                setAssignedVehicle(null)
            }

        } catch (error: any) {
            console.error("Error loading data:", error)
            toast.error("Error al cargar datos del panel")
        } finally {
            if (!silent) setLoading(false)
        }
    }

    // --- POOL MODE HANDLERS ---
    const startFaultReportingPool = () => {
        setVehicleSelectOpen(true)
    }

    // [NEW] Refresh vehicles when selector opens to ensure fresh list
    useEffect(() => {
        if (vehicleSelectOpen) {
            // [FIX] ONLY load vehicle list, DO NOT reload profile/assigned vehicle
            // This prevents overwriting the manually selected vehicle
            loadVehicleList()
        }
    }, [vehicleSelectOpen])

    async function loadVehicleList() {
        if (!profile) return

        // [FIX] 'kilometraje' is not in 'vehiculos' table. We must fetch it from view or omit.
        // Fetch Vehicles WITH DEPARTMENT FILTER
        let query = supabase
            .from('vehiculos')
            .select('id, modelo, placa, codigo, foto_url, department') // [FIX] Added department to check
            .order('modelo', { ascending: true })

        // Department filter removed per user request: all vehicles are global for module users.

        const { data: allVehicles } = await query

        // [NEW] Fetch Occupied Vehicles (Active Trips)
        const { data: occupiedData } = await supabase
            .from('reportes')
            .select('vehiculo_id')
            .is('km_entrada', null)

        const occupiedIds = new Set(occupiedData?.map(r => r.vehiculo_id) || [])

        // Fetch Mileage Data
        const { data: kData } = await supabase
            .from('vista_ultimos_kilometrajes')
            .select('vehiculo_id, ultimo_kilometraje')

        if (allVehicles) {
            // Filter out occupied vehicles AND Merge mileage
            const availableVehicles = allVehicles
                .filter(v => !occupiedIds.has(v.id)) // [FILTER] Exclude busy vehicles
                .map(v => ({
                    ...v,
                    kilometraje: kData?.find(k => k.vehiculo_id === v.id)?.ultimo_kilometraje || 0
                }))
            // @ts-ignore
            setVehicles(availableVehicles)
        }
    }

    const confirmVehicleSelectionPool = async (targetId?: string) => {
        const vId = targetId || selectedVehicleId
        if (!vId || !profile) return
        setLoading(true) // Show loading state

        try {
            // [CONSTRAINT] Block change if active trip exists
            if (activeTripReport) {
                toast.error("No puedes cambiar de unidad con un viaje activo. Registra la entrada primero.")
                setVehicleSelectOpen(false)
                setLoading(false)
                return
            }

            // [FIX] Use Server Action to Assign (Bypass potential RLS or client issues)
            const result = await assignVehicleToDriver(vId)

            if (!result.success) {
                throw new Error(result.error)
            }

            toast.success("Vehículo asignado correctamente")

            // 3. Refresh Context
            setVehicleSelectOpen(false)

            // Find the vehicle object locally to update state immediately before reload
            const v = vehicles.find(v => v.id === selectedVehicleId)
            if (v) {
                setAssignedVehicle(v)
                checkTripForVehicle(v.id)
            }

            // Reload all data to ensure consistency
            loadData(true)

        } catch (error) {
            console.error(error)
            // @ts-ignore
            toast.error("Error al asignar el vehículo: " + (error.message || "Descociendo"))
        } finally {
            setLoading(false)
        }
    }

    // [NEW] Helper to check trip status for a specific switched vehicle
    async function checkTripForVehicle(vId: string) {
        setActiveTripReport(null) // Reset first
        const { data } = await supabase
            .from('reportes')
            .select('*')
            .eq('vehiculo_id', vId)
            .is('km_entrada', null)
            .limit(1)
            .maybeSingle()

        if (data) setActiveTripReport(data)
    }

    const handleReleaseVehicle = async () => {
        if (activeTripReport) {
            toast.error("Debes finalizar tu viaje actual antes de liberar la unidad.")
            return
        }

        setReleasing(true)
        try {
            const result = await releaseVehicleAction()
            if (!result.success) {
                throw new Error(result.error)
            }

            setAssignedVehicle(null)
            setActiveTripReport(null)
            toast.success("Unidad liberada exitosamente")
            loadData(true)
        } catch (error: any) {
            console.error("Error al liberar unidad:", error)
            toast.error(error.message || "Error al liberar la unidad")
        } finally {
            setReleasing(false)
        }
    }

    // --- RENDER HELPERS ---

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-white text-sm text-neutral-400">Cargando panel...</div>
    }

    return (
        <main className="min-h-screen bg-white text-neutral-900 pb-20">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">

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

                    <div className="space-y-1">
                        <p className="text-xs text-neutral-400">
                            {assignedVehicle ? "Modo chofer" : "Panel de operaciones"}
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900">
                            Hola, {profile?.first_name || 'Usuario'}
                        </h1>
                    </div>
                </header>

                {/* DRIVER SPECIFIC HEADER */}
                {assignedVehicle ? (
                    <div className="pb-8 mb-6 border-b border-neutral-100 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <span className="text-xs text-neutral-500">Vehículo asignado</span>
                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    disabled={!!activeTripReport || releasing}
                                    onClick={() => {
                                        if (activeTripReport) {
                                            toast.error("Debes finalizar tu viaje actual antes de liberar la unidad.")
                                            return
                                        }
                                        setReleaseDialogOpen(true)
                                    }}
                                    className={`text-xs transition-colors active:scale-[0.985] duration-150 ${activeTripReport ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-500 hover:text-neutral-900'}`}
                                >
                                    {releasing ? "Liberando..." : "Liberar unidad"}
                                </button>
                                <span className="text-neutral-200">·</span>
                                <button
                                    type="button"
                                    disabled={!!activeTripReport} // [FIX] Disable if in trip
                                    onClick={() => {
                                        if (activeTripReport) {
                                            toast.error("Debes finalizar tu viaje actual antes de cambiar de unidad.")
                                            return
                                        }
                                        setVehicleSelectOpen(true)
                                    }}
                                    className={`text-xs transition-colors active:scale-[0.985] duration-150 ${activeTripReport ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-500 hover:text-neutral-900'}`}
                                >
                                    Cambiar unidad
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {(assignedVehicle.foto_url || assignedVehicle.modelo.toUpperCase().includes('MITSUBISHI L300')) ? (
                                <div className="h-14 w-14 bg-neutral-50 rounded-md flex items-center justify-center overflow-hidden shrink-0">
                                    <img
                                        src={assignedVehicle.foto_url || "/vehicles/mitsubishi_l300.png"}
                                        alt={assignedVehicle.modelo}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="h-14 w-14 bg-neutral-50 rounded-md flex items-center justify-center text-neutral-400 shrink-0">
                                    <Car className="w-6 h-6" strokeWidth={1.25} />
                                </div>
                            )}
                            <div>
                                <h2 className="text-xl font-medium text-neutral-900 leading-tight">{assignedVehicle.modelo}</h2>
                                <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 flex-wrap">
                                    <span className="font-mono">{assignedVehicle.placa}</span>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <Fuel className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.25} />
                                        {assignedVehicle.current_fuel_level || 0}%
                                    </span>
                                    {activeTripReport && (
                                        <>
                                            <span>·</span>
                                            <span className="text-neutral-900 font-medium">En ruta</span>
                                            <span>·</span>
                                            <button
                                                type="button"
                                                onClick={() => router.push(`/transporte/entrada?vehicle_id=${assignedVehicle.id}`)}
                                                className="text-neutral-500 hover:text-neutral-900 underline underline-offset-2 transition-colors active:scale-[0.985]"
                                            >
                                                Cerrar viaje
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-5">
                            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                                <DialogTrigger asChild>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-2 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                                    >
                                        <QrCode className="w-4 h-4" strokeWidth={1.25} />
                                        <span>Código de combustible</span>
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-sm p-6 flex flex-col items-center">
                                    <DialogHeader className="text-center">
                                        <DialogTitle className="text-center text-lg font-medium text-neutral-900">Código de carga</DialogTitle>
                                        <DialogDescription className="text-center text-xs text-neutral-500">Autorización digital</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 my-2 w-full max-w-[240px]">
                                        <div style={{ height: "auto", margin: "0 auto", width: "100%" }}>
                                            <QRCode
                                                size={256}
                                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                value={JSON.stringify({
                                                    type: 'FUEL_AUTH',
                                                    driverId: profile?.id,
                                                    vehicleId: assignedVehicle.id,
                                                    placa: assignedVehicle.placa,
                                                    driverName: `${profile?.first_name} ${profile?.last_name}`
                                                })}
                                                viewBox={`0 0 256 256`}
                                            />
                                        </div>
                                    </div>
                                    <p className="font-mono text-xs text-neutral-600 tracking-wider">
                                        {assignedVehicle.placa}
                                    </p>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                ) : (
                    <div className="pb-6 mb-6 border-b border-neutral-100 flex items-center justify-between gap-4 animate-in fade-in duration-300">
                        <span className="text-xs text-neutral-400">Sin vehículo asignado</span>
                        <button
                            type="button"
                            onClick={() => setVehicleSelectOpen(true)}
                            className="text-xs text-neutral-600 hover:text-neutral-900 transition-colors active:scale-[0.985] duration-150"
                        >
                            Asignar unidad
                        </button>
                    </div>
                )}

                {/* UNIFIED ACTION LIST */}
                <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                    {/* SALIDA */}
                    <button
                        type="button"
                        disabled={!!activeTripReport} // [NEW] Disable if in trip
                        onClick={() => {
                            if (activeTripReport) return // Prevent click if disabled check fails
                            const targetUrl = assignedVehicle
                                ? `/transporte/salida?vehicle_id=${assignedVehicle.id}`
                                : `/transporte/salida`
                            router.push(targetUrl)
                        }}
                        className="group w-full py-6 flex items-center justify-between gap-4 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <div className="flex items-start gap-4">
                            <ArrowUpRight className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors mt-0.5 shrink-0" strokeWidth={1.25} />
                            <div>
                                <h2 className="text-base font-medium text-neutral-900">
                                    {activeTripReport ? "En ruta (Activo)" : "Registrar salida"}
                                </h2>
                                <p className="text-sm text-neutral-500 mt-0.5">
                                    {activeTripReport ? "Tienes un viaje en curso. Registra la entrada para iniciar otro." : (assignedVehicle ? "Iniciar ruta con tu unidad asignada." : "Seleccionar vehículo del departamento para iniciar ruta.")}
                                </p>
                            </div>
                        </div>
                        {!activeTripReport && (
                            <ChevronRight
                                className="w-4 h-4 text-neutral-300 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
                                strokeWidth={1.25}
                            />
                        )}
                    </button>

                    {/* ENTRADA */}
                    <button
                        type="button"
                        onClick={() => {
                            const targetUrl = activeTripReport?.vehiculo_id
                                ? `/transporte/entrada?vehicle_id=${activeTripReport.vehiculo_id}`
                                : `/transporte/entrada`
                            router.push(targetUrl)
                        }}
                        className="group w-full py-6 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
                    >
                        <div className="flex items-start gap-4">
                            <ArrowDownLeft className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors mt-0.5 shrink-0" strokeWidth={1.25} />
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-medium text-neutral-900">
                                        {activeTripReport ? "Cerrar viaje / Registrar entrada" : "Cerrar vehículo en ruta"}
                                    </h2>
                                    {openTripsCount > 0 && !activeTripReport && (
                                        <span className="text-xs font-mono text-neutral-500">
                                            ({openTripsCount} en ruta)
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-neutral-500 mt-0.5">
                                    {activeTripReport
                                        ? `Finalizar viaje de ${activeTripReport.vehiculos?.modelo || 'unidad asignada'} y reportar kilometraje.`
                                        : openTripsCount > 0
                                            ? `Hay ${openTripsCount} unidad${openTripsCount > 1 ? 'es' : ''} en ruta actualmente. Selecciona un viaje para registrar llegada.`
                                            : "Cerrar ruta y registrar kilometraje de llegada."}
                                </p>
                            </div>
                        </div>
                        <ChevronRight
                            className="w-4 h-4 text-neutral-300 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
                            strokeWidth={1.25}
                        />
                    </button>

                    {/* FALLA */}
                    <button
                        type="button"
                        onClick={() => {
                            if (assignedVehicle) {
                                setSelectedVehicleId(assignedVehicle.id)
                                setFaultOpen(true)
                            } else {
                                startFaultReportingPool()
                            }
                        }}
                        className="group w-full py-6 flex items-center justify-between gap-4 text-left transition-colors"
                    >
                        <div className="flex items-start gap-4">
                            <AlertCircle className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors mt-0.5 shrink-0" strokeWidth={1.25} />
                            <div>
                                <h2 className="text-base font-medium text-neutral-900">Reportar falla</h2>
                                <p className="text-sm text-neutral-500 mt-0.5">
                                    {assignedVehicle ? "Notificar avería en tu unidad asignada." : "Notificar avería en un vehículo de la flota."}
                                </p>
                            </div>
                        </div>
                        <ChevronRight
                            className="w-4 h-4 text-neutral-300 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
                            strokeWidth={1.25}
                        />
                    </button>
                </div>

                {/* VEHICLES CURRENTLY IN ROUTE QUICK LIST */}
                {openTripsCount > 0 && !activeTripReport && (
                    <div className="pt-8 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                            <span className="text-xs font-medium text-neutral-900">
                                Unidades en ruta actualmente ({openTripsCount})
                            </span>
                            <Link
                                href="/transporte/entrada"
                                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                            >
                                Ver todas
                            </Link>
                        </div>
                        <div className="divide-y divide-neutral-100">
                            {fleetOpenTrips.slice(0, 5).map((trip: any) => (
                                <div key={trip.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                                    <div className="min-w-0">
                                        <span className="font-medium text-neutral-900 truncate block">
                                            {trip.vehiculos?.modelo || 'Vehículo'}
                                        </span>
                                        <span className="text-neutral-400 font-mono text-[11px]">
                                            {trip.vehiculos?.placa} · Conductor: {trip.conductor}
                                        </span>
                                    </div>
                                    <Link
                                        href={`/transporte/entrada?vehicle_id=${trip.vehiculo_id}`}
                                        className="text-neutral-600 hover:text-neutral-900 underline underline-offset-2 shrink-0 transition-colors active:scale-[0.985]"
                                    >
                                        Cerrar vehículo
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* POOL SELECTOR DIALOG */}
                <Dialog open={vehicleSelectOpen} onOpenChange={setVehicleSelectOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogTitle className="sr-only">Seleccionar Vehículo</DialogTitle> {/* [FIX] Accessiblity */}
                        <DialogDescription className="sr-only">
                            Seleccione un vehículo de la lista disponible para operar.
                        </DialogDescription>

                        {/* [MOD] Using VehicleSelector for Rich UI */}
                        <VehicleSelector
                            vehicles={vehicles}
                            selectedVehicleId={selectedVehicleId}
                            onSelect={(v) => {
                                if (v) {
                                    setSelectedVehicleId(v.id)
                                    // [FIX] Call Server Action immediately to persist assignment
                                    confirmVehicleSelectionPool(v.id)
                                } else {
                                    // [FIX] Handle Deselection (User clicked 'Cambiar')
                                    setSelectedVehicleId("")
                                    // Do NOT clear assignedVehicle yet, user is just browsing.
                                }
                            }}
                            label="Seleccionar unidad"
                        />
                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setVehicleSelectOpen(false)}
                                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* FAULT DIALOG */}
                {(selectedVehicleId || (assignedVehicle && faultOpen)) && (
                    <ReportFaultDialog
                        isOpen={faultOpen}
                        onClose={() => {
                            setFaultOpen(false)
                            if (!assignedVehicle) setSelectedVehicleId("") // Reset only if pool
                        }}
                        vehicleId={assignedVehicle ? assignedVehicle.id : selectedVehicleId}
                        onFaultReported={() => { }}
                    />
                )}

                {/* RELEASE CONFIRM DIALOG */}
                <DeleteConfirmDialog
                    open={releaseDialogOpen}
                    onOpenChange={setReleaseDialogOpen}
                    title="Liberar unidad"
                    description={
                        assignedVehicle
                            ? `¿Deseas desvincularte del vehículo ${assignedVehicle.modelo} (${assignedVehicle.placa})? La unidad quedará disponible para otros conductores y podrás volver a asignarte una unidad cuando lo necesites.`
                            : "¿Deseas liberar tu vehículo asignado actualmente?"
                    }
                    confirmLabel="Liberar unidad"
                    cancelLabel="Cancelar"
                    destructive={false}
                    onConfirm={handleReleaseVehicle}
                    isLoading={releasing}
                />
            </div>
        </main>
    )
}
