"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Home as HomeIcon, ArrowUpRight, ArrowDownLeft, Wrench, Car, Fuel, QrCode } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import { useSearchParams, useRouter } from "next/navigation"
import { SalidaFormDialog } from "@/components/salida-form-dialog"
import { EntradaFormDialog } from "@/components/entrada-form-dialog"
import { ReportFaultDialog } from "@/components/report-fault-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import QRCode from "react-qr-code"
import Link from "next/link"
import { VehicleSelector } from "@/components/vehicle-selector" // [FIX] Import added

import { assignVehicleToDriver } from "./actions" // [FIX] Import server action

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

        if (vId) setInitialVehicleId(vId)

        if (action === 'salida' && vId) {
            setSalidaOpen(true)
        } else if (action === 'entrada' && vId) {
            setEntradaOpen(true)
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

            // 1. Fetch Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
            setProfile(profileData)

            // 2. Check for Assigned Vehicle (Driver Mode)
            // IF user is 'mecanico', we SKIP Driver Mode to allow them to see ALL vehicles
            // Normalize roles to avoid case sensitivity issues
            const isMecanico = (profileData.roles || []).map((r: string) => r.toLowerCase()).includes('mecanico')
            let myVehicle = null

            if (!isMecanico) {
                const { data } = await supabase
                    .from('vehiculos')
                    .select('*')
                    .eq('assigned_driver_id', user.id)
                    .limit(1)
                    .maybeSingle()
                myVehicle = data
            }

            if (myVehicle) {
                setAssignedVehicle(myVehicle)
            }

            // 3. Always load Pool for Selector availability
            // [FIX] 'kilometraje' is not in 'vehiculos' table. We must fetch it from view or omit.
            // Fetch Vehicles
            const { data: allVehicles } = await supabase
                .from('vehiculos')
                .select('id, modelo, placa, codigo, foto_url')
                .order('modelo', { ascending: true })

            // 4. [FIX] Check for Active Trip (PRIORITY over Assigned)
            // Logic: If user has an open trip, THAT is the context vehicle.
            const { data: activeTripData } = await supabase
                .from('reportes')
                .select('*')
                .eq('user_id', user.id)
                .is('km_entrada', null)
                .limit(1)
                .maybeSingle()

            let contextVehicle = null

            // If active trip exists, fetch THAT vehicle and use it
            if (activeTripData) {
                const { data: tripVehicle } = await supabase
                    .from('vehiculos')
                    .select('*')
                    .eq('id', activeTripData.vehiculo_id)
                    .single()

                if (tripVehicle) {
                    contextVehicle = tripVehicle
                    setActiveTripReport(activeTripData)
                }
            } else {
                // If no active trip, fallback to Assigned Vehicle
                if (myVehicle) {
                    contextVehicle = myVehicle
                }
                setActiveTripReport(null)
            }

            // Set the vehicle context
            if (contextVehicle) {
                setAssignedVehicle(contextVehicle)
            } else {
                // Optimization: Only load pool if NO context vehicle to show
                // Actually, we moved pool load to 'loadVehicleList' on demand (for selector),
                // BUT we might want to pre-load for speed or just leave it lazy.
                // Let's leave it lazy OR empty.
            }

        } catch (error: any) {
            console.error("Error loading data:", error)
            toast.error("Error al cargar datos del panel")
        } finally {
            if (!silent) setLoading(false)
        }
    }

    // --- SHARED ACTIONS ---
    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
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
                            title="Ir al inicio"
                        >
                            <HomeIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                            Inicio
                        </Link>
                        <LogoutButton />
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
                {assignedVehicle && (
                    <div className="pb-8 mb-6 border-b border-neutral-100 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <span className="text-xs text-neutral-500">Vehículo asignado</span>
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
                                className={`text-xs inline-flex items-center gap-1.5 transition-colors ${activeTripReport ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-500 hover:text-neutral-900'}`}
                            >
                                <Car className="w-3.5 h-3.5" strokeWidth={1.5} />
                                Cambiar unidad
                            </button>
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
                                <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                                    <span className="font-mono">{assignedVehicle.placa}</span>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <Fuel className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.25} />
                                        {assignedVehicle.current_fuel_level || 0}%
                                    </span>
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
                )}

                {/* UNIFIED ACTION LIST */}
                <div className="divide-y divide-neutral-100 border-b border-neutral-100">
                    {/* SALIDA */}
                    <button
                        type="button"
                        disabled={!!activeTripReport} // [NEW] Disable if in trip
                        onClick={() => {
                            if (activeTripReport) return // Prevent click if disabled check fails
                            if (assignedVehicle) {
                                setInitialVehicleId(assignedVehicle.id)
                                setSalidaOpen(true)
                            } else {
                                setInitialVehicleId("")
                                setSalidaOpen(true)
                            }
                        }}
                        className="group w-full py-6 flex items-center justify-between gap-4 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                            <span className="text-xs font-medium text-neutral-500 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0">
                                Iniciar →
                            </span>
                        )}
                    </button>

                    {/* ENTRADA */}
                    <button
                        type="button"
                        disabled={!activeTripReport} // [NEW] Disable if NOT in trip
                        onClick={() => {
                            if (!activeTripReport) return // Prevent click

                            // [NEW] Logic: If active trip, PRE-SELECT that vehicle
                            if (activeTripReport) {
                                setInitialVehicleId(activeTripReport.vehiculo_id)
                                setEntradaOpen(true)
                            }
                        }}
                        className="group w-full py-6 flex items-center justify-between gap-4 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <div className="flex items-start gap-4">
                            <ArrowDownLeft className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors mt-0.5 shrink-0" strokeWidth={1.25} />
                            <div>
                                <h2 className="text-base font-medium text-neutral-900">
                                    {!activeTripReport ? "Sin viaje activo" : "Registrar entrada"}
                                </h2>
                                <p className="text-sm text-neutral-500 mt-0.5">
                                    {!activeTripReport ? "No tienes un vehículo en ruta actualmente. Registra una salida primero." : (assignedVehicle ? "Finalizar ruta y reportar kilometraje." : "Cerrar ruta, registrar kilometraje y liberar vehículo.")}
                                </p>
                            </div>
                        </div>
                        {activeTripReport && (
                            <span className="text-xs font-medium text-neutral-500 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0">
                                Registrar →
                            </span>
                        )}
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
                            <Wrench className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors mt-0.5 shrink-0" strokeWidth={1.25} />
                            <div>
                                <h2 className="text-base font-medium text-neutral-900">Reportar falla</h2>
                                <p className="text-sm text-neutral-500 mt-0.5">
                                    {assignedVehicle ? "Notificar avería en tu unidad asignada." : "Notificar avería en un vehículo de la flota."}
                                </p>
                            </div>
                        </div>
                        <span className="text-xs font-medium text-neutral-500 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0">
                            Reportar →
                        </span>
                    </button>
                </div>

                {/* MODALS */}
                <SalidaFormDialog
                    isOpen={salidaOpen}
                    onClose={() => setSalidaOpen(false)}
                    initialVehicleId={initialVehicleId}
                    onSuccess={() => {
                        loadData(true) // [NEW] Silent reload to keep dialog open
                    }}
                />

                <EntradaFormDialog
                    isOpen={entradaOpen}
                    onClose={() => setEntradaOpen(false)}
                    initialVehicleId={initialVehicleId}
                    onSuccess={() => {
                        loadData(true) // [NEW] Silent reload to keep dialog open
                    }}
                />

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
            </div>
        </main>
    )
}
