"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Search, Wrench, ArrowLeft, Plus } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { MaintenanceRegistrationDialog } from "@/components/maintenance-registration-dialog"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { VehicleHistoryDialog } from "@/components/vehicle-history-dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

type Fault = {
    id: string
    vehiculo_id: string
    descripcion: string
    tipo_falla: string
    prioridad: string
    created_at: string
    placa: string
    modelo: string
    foto_url?: string
    estado: 'Pendiente' | 'En Revisión' | 'Reparado' | 'Descartado'
    fecha_solucion?: string
    isMaintenance?: boolean
    reported_by?: string
}

export default function TallerPage() {
    const [faults, setFaults] = useState<Fault[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    const searchParams = useSearchParams()
    const router = useRouter()

    // Dialog State
    const [maintenanceOpen, setMaintenanceOpen] = useState(false)
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined)
    const [selectedServiceType, setSelectedServiceType] = useState<string | undefined>(undefined)
    const [pendingResolveId, setPendingResolveId] = useState<string | null>(null)

    // History State
    const [historyVehicleId, setHistoryVehicleId] = useState<string | undefined>(undefined)
    const [historyVehiclePlate, setHistoryVehiclePlate] = useState<string | undefined>(undefined)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [historyLogs, setHistoryLogs] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [vehicles, setVehicles] = useState<any[]>([])
    const [historyFilter, setHistoryFilter] = useState("all")
    
    // Tab State
    const [activeTab, setActiveTab] = useState("pending")

    useEffect(() => {
        loadFaults()
    }, [])

    useEffect(() => {
        const action = searchParams.get("action")
        if (action === "new") setMaintenanceOpen(true)
    }, [searchParams])

    useEffect(() => {
        if (activeTab === 'history') loadHistory()
    }, [activeTab])

    async function loadFaults() {
        try {
            setLoading(true)
            const supabase = createClient()

            // 1. Fetch Existing Faults
            const { data: faultsData, error } = await supabase
                .from('fallas')
                .select(`id, vehiculo_id, descripcion, tipo_falla, prioridad, created_at, estado, fecha_solucion, reported_by, vehiculos (placa, modelo, foto_url)`)
                .neq('estado', 'Reparado')
                .neq('estado', 'Descartado')
                .order('created_at', { ascending: false })

            if (error) throw error

            // 2. Fetch Vehicles & Mileage
            const { data: vehiclesData } = await supabase.from('vehiculos').select('*').order('modelo', { ascending: true })
            setVehicles(vehiclesData || [])
            const vehiclesList = vehiclesData || []
            const { data: mileageData } = await supabase.from('vista_ultimos_kilometrajes').select('*')

            // 3. Generate Maintenance Alerts
            const maintenanceAlerts: Fault[] = []
            vehiclesList.forEach(v => {
                const km = mileageData?.find(m => m.vehiculo_id === v.id)?.ultimo_kilometraje || 0
                const model = v.modelo.toUpperCase()
                const isMoto = model.includes('MOTO') || v.tipo?.toLowerCase() === 'moto'
                const hasChainOrGear = ['HILUX', 'TRITON', 'DONFENG', 'RICH', 'NKR'].some(k => model.includes(k))

                const activeFaults = faultsData?.filter(f => f.vehiculo_id === v.id && f.tipo_falla === 'Mantenimiento' && (f.estado === 'Pendiente' || f.estado === 'En Revisión')) || []

                const OIL_LIMIT = isMoto ? 2000 : 5000
                const OIL_WARN = isMoto ? 1800 : 4500
                const distOil = km - (v.last_oil_change_km || 0)
                
                if (distOil >= OIL_WARN && !activeFaults.some(f => f.descripcion.includes('Aceite'))) {
                    maintenanceAlerts.push(createAlertObj(v, `Cambio de Aceite (Uso: ${distOil.toLocaleString()} km)`, distOil >= OIL_LIMIT ? 'Crítica' : 'Alta', 'maint-oil-'))
                }

                if (!isMoto && !hasChainOrGear) {
                    const BELT_LIMIT = 50000, BELT_WARN = 49000
                    const distBelt = km - (v.last_timing_belt_km || 0)
                    if (distBelt >= BELT_WARN && !activeFaults.some(f => f.descripcion.includes('Correa'))) {
                        maintenanceAlerts.push(createAlertObj(v, `Correa de Tiempo (Uso: ${distBelt.toLocaleString()} km)`, distBelt >= BELT_LIMIT ? 'Crítica' : 'Alta', 'maint-belt-'))
                    }
                }

                if (isMoto) {
                    const CHAIN_LIMIT = 20000, CHAIN_WARN = 19000
                    const distChain = km - (v.last_chain_kit_km || 0)
                    if (distChain >= CHAIN_WARN && !activeFaults.some(f => f.descripcion.includes('Kit de Arrastre'))) {
                        maintenanceAlerts.push(createAlertObj(v, `Kit de Arrastre (Uso: ${distChain.toLocaleString()} km)`, distChain >= CHAIN_LIMIT ? 'Crítica' : 'Alta', 'maint-chain-'))
                    }
                }
            })

            // 4. Merge
            const mappedFaults: Fault[] = faultsData?.map((f: any) => ({
                ...f,
                placa: f.vehiculos?.placa || 'Desconocido',
                modelo: f.vehiculos?.modelo || 'Desconocido',
                foto_url: f.vehiculos?.foto_url,
                reported_by: f.reported_by
            })) || []

            setFaults([...maintenanceAlerts, ...mappedFaults])
        } catch (error) {
            console.error('Error loading faults:', error)
            toast.error('Error al cargar taller')
        } finally {
            setLoading(false)
        }
    }

    function createAlertObj(v: any, desc: string, prio: string, prefix: string): Fault {
        return {
            id: `${prefix}${v.id}`,
            vehiculo_id: v.id,
            descripcion: `Prevención: ${desc}`,
            tipo_falla: 'Mantenimiento',
            prioridad: prio,
            created_at: new Date().toISOString(),
            estado: 'Pendiente',
            placa: v.placa,
            modelo: v.modelo,
            foto_url: v.foto_url,
            isMaintenance: true
        }
    }

    async function loadHistory() {
        setLoadingHistory(true)
        const supabase = createClient()
        try {
            const { data: faultsData } = await supabase.from('fallas').select(`id, descripcion, tipo_falla, fecha_solucion, created_at, reported_by, vehiculo_id, vehiculos(placa, modelo)`).eq('estado', 'Reparado').order('fecha_solucion', { ascending: false }).limit(50)
            const { data: maintenanceData } = await supabase.from('maintenance_logs').select(`id, service_type, mileage, notes, service_date, created_at, cost, parts_used, labor_cost, parts_cost, vehicle_id, performed_by, vehiculos(placa, modelo)`).order('created_at', { ascending: false }).limit(50)

            // Build a set of fault IDs that have been resolved via a CORRECTIVE maintenance log
            // We match by vehicle_id + notes containing the fault description
            const correctiveLogs = maintenanceData?.filter(m => m.service_type === 'CORRECTIVE') || []
            const resolvedFaultIds = new Set<string>()

            // For each corrective log, find matching fault and mark as resolved
            const enrichedCorrective = correctiveLogs.map(m => {
                const matchingFault = faultsData?.find(f => 
                    f.vehiculo_id === m.vehicle_id && 
                    m.notes?.includes(f.descripcion)
                )
                if (matchingFault) resolvedFaultIds.add(matchingFault.id)
                return {
                    ...m,
                    matchedFault: matchingFault
                }
            })

            const combined = [
                // Faults that were NOT resolved via a corrective log (standalone repairs)
                ...(faultsData?.filter(f => !resolvedFaultIds.has(f.id)).map((f: any) => ({
                    type: 'REPAIR', date: f.fecha_solucion || f.created_at, vehicle: f.vehiculos?.modelo || 'Desconocido', placa: f.vehiculos?.placa || '', description: f.descripcion, category: f.tipo_falla, id: f.id, mileage: null, parts: null, cost: null, reportedBy: f.reported_by
                })) || []),
                // Corrective logs (consolidated with their fault if matched)
                ...enrichedCorrective.map((m: any) => {
                    const faultDesc = m.matchedFault?.descripcion || ''
                    const workNotes = m.notes?.replace(`[Falla: ${faultDesc}] `, '') || m.notes || ''
                    return {
                        type: 'CORRECTIVE', date: m.service_date || m.created_at, vehicle: m.vehiculos?.modelo || 'Desconocido', placa: m.vehiculos?.placa || '', 
                        description: workNotes, 
                        faultDescription: faultDesc,
                        category: 'Reparación', id: m.id, mileage: m.mileage, parts: m.parts_used, cost: m.cost, 
                        performedBy: m.performed_by,
                        reportedBy: m.matchedFault?.reported_by
                    }
                }),
                // Non-corrective maintenance logs
                ...(maintenanceData?.filter(m => m.service_type !== 'CORRECTIVE').map((m: any) => ({
                    type: 'MAINTENANCE', date: m.service_date || m.created_at, vehicle: m.vehiculos?.modelo || 'Desconocido', placa: m.vehiculos?.placa || '', description: m.notes || 'Mantenimiento', category: m.service_type, mileage: m.mileage, id: m.id, parts: m.parts_used, cost: m.cost, performedBy: m.performed_by
                })) || [])
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

            setHistoryLogs(combined)
        } catch (error) {
            console.error('Error history:', error)
        } finally {
            setLoadingHistory(false)
        }
    }

    async function handleReview(fault: Fault) {
        if (fault.isMaintenance) {
            try {
                const supabase = createClient()
                const { error } = await supabase.from('fallas').insert({ vehiculo_id: fault.vehiculo_id, descripcion: fault.descripcion, tipo_falla: 'Mantenimiento', prioridad: fault.prioridad, estado: 'En Revisión', created_at: new Date().toISOString() })
                if (error) throw error
                toast.success("Mantenimiento iniciado")
                loadFaults()
            } catch (error) {
                toast.error('Error al iniciar')
            }
        } else {
            updateStatus(fault.id, 'En Revisión')
        }
    }

    function handleResolve(fault: Fault) {
        setSelectedVehicleId(fault.vehiculo_id)
        setPendingResolveId(fault.id)

        if (fault.tipo_falla === 'Mantenimiento') {
            const desc = (fault.descripcion || "").toLowerCase()
            let serviceCode = undefined
            if (desc.includes('aceite')) serviceCode = 'OIL_CHANGE'
            else if (desc.includes('correa')) serviceCode = 'TIMING_BELT'
            else if (desc.includes('arrastre') || desc.includes('cadena') || desc.includes('kit')) serviceCode = 'CHAIN_KIT'
            else if (desc.includes('lavado')) serviceCode = 'WASH'
            setSelectedServiceType(serviceCode)
        } else {
            setSelectedServiceType(undefined)
        }
        setMaintenanceOpen(true)
    }

    function handleMaintenanceSuccess() {
        if (pendingResolveId) updateStatus(pendingResolveId, 'Reparado')
        else loadFaults()
    }

    async function updateStatus(id: string, newStatus: string) {
        try {
            const supabase = createClient()
            const { error } = await supabase.from('fallas').update({ estado: newStatus, fecha_solucion: newStatus === 'Reparado' ? new Date() : null }).eq('id', id)
            if (error) throw error
            toast.success(`Estado: ${newStatus}`)
            loadFaults()
        } catch (error) {
            toast.error('Error al actualizar')
        }
    }

    const filteredFaults = faults.filter(f => f.placa.toLowerCase().includes(searchTerm.toLowerCase()) || f.modelo.toLowerCase().includes(searchTerm.toLowerCase()) || f.tipo_falla.toLowerCase().includes(searchTerm.toLowerCase()))
    const pending = filteredFaults.filter(f => f.estado === 'Pendiente')
    const inProgress = filteredFaults.filter(f => f.estado === 'En Revisión')

    return (
        <main className="min-h-screen bg-white pb-28 md:pb-12 font-sans text-neutral-900">
            {/* Header Mobile-First */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-neutral-100 px-4 py-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-light tracking-tight text-neutral-900 leading-none">Taller</h1>
                        <p className="text-xs text-neutral-500 mt-1">Gestión activa</p>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-5">
                        <button
                            type="button"
                            onClick={() => { setSelectedVehicleId(undefined); setSelectedServiceType(undefined); setPendingResolveId(null); setMaintenanceOpen(true); }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" strokeWidth={1.25} />
                            <span className="hidden md:inline">Nuevo registro</span>
                        </button>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
                            <span className="hidden sm:inline">Inicio</span>
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 mt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {/* Sticky Tabs for easy access on mobile */}
                    <div className="sticky top-[65px] z-20 bg-white pt-1 pb-4">
                        <TabsList className="w-full justify-start gap-6 bg-transparent border-b border-neutral-100 rounded-none p-0 h-auto">
                            <TabsTrigger
                                value="pending"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-neutral-900 text-neutral-400 hover:text-neutral-700 pb-2.5 px-0 text-xs sm:text-sm font-normal data-[state=active]:font-medium transition-colors"
                            >
                                Pendientes {pending.length > 0 && <span className="ml-1 text-neutral-400">({pending.length})</span>}
                            </TabsTrigger>
                            <TabsTrigger
                                value="progress"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-neutral-900 text-neutral-400 hover:text-neutral-700 pb-2.5 px-0 text-xs sm:text-sm font-normal data-[state=active]:font-medium transition-colors"
                            >
                                En taller {inProgress.length > 0 && <span className="ml-1 text-neutral-400">({inProgress.length})</span>}
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-neutral-900 text-neutral-400 hover:text-neutral-700 pb-2.5 px-0 text-xs sm:text-sm font-normal data-[state=active]:font-medium transition-colors"
                            >
                                Historial
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Search Bar - Only for Active Tabs */}
                    {activeTab !== 'history' && (
                        <div className="relative mb-4 flex items-center border-b border-neutral-200 focus-within:border-neutral-900 transition-colors">
                            <Search className="w-4 h-4 text-neutral-400 shrink-0 mr-2" strokeWidth={1.5} />
                            <input
                                type="text"
                                placeholder="Buscar placa o modelo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
                            />
                        </div>
                    )}

                    {loading ? (
                        <div className="py-20 text-center text-sm text-neutral-400">
                            Cargando datos...
                        </div>
                    ) : (
                        <div className="pb-8">
                            <TabsContent value="pending" className="mt-0 divide-y divide-neutral-100 outline-none">
                                {pending.length === 0 ? (
                                    <EmptyState message="No hay mantenimientos ni fallas pendientes." />
                                ) : (
                                    pending.map(fault => (
                                        <MobileFaultCard
                                            key={fault.id}
                                            fault={fault}
                                            actionText="Pasar a taller"
                                            onAction={() => handleReview(fault)}
                                        />
                                    ))
                                )}
                            </TabsContent>

                            <TabsContent value="progress" className="mt-0 divide-y divide-neutral-100 outline-none">
                                {inProgress.length === 0 ? (
                                    <EmptyState message="El taller está vacío." />
                                ) : (
                                    inProgress.map(fault => (
                                        <MobileFaultCard
                                            key={fault.id}
                                            fault={fault}
                                            isReviewing
                                            actionText="Finalizar y reportar"
                                            onAction={() => handleResolve(fault)}
                                            onSecondaryAction={() => updateStatus(fault.id, 'Pendiente')}
                                            secondaryActionText="Regresar a pendiente"
                                        />
                                    ))
                                )}
                            </TabsContent>

                            <TabsContent value="history" className="mt-0 outline-none">
                                <div className="mb-6">
                                    <CustomDropdown
                                        value={historyFilter}
                                        onChange={setHistoryFilter}
                                        searchable
                                        searchPlaceholder="Buscar vehículo..."
                                        placeholder="Todos los vehículos"
                                        options={[
                                            { value: "all", label: "Todos los vehículos" },
                                            ...vehicles.map((v) => ({
                                                value: v.placa,
                                                label: `${v.modelo} (${v.placa})`,
                                            })),
                                        ]}
                                    />
                                </div>

                                <div className="divide-y divide-neutral-100">
                                    {loadingHistory ? (
                                        <div className="py-10 text-center text-sm text-neutral-400">Cargando historial...</div>
                                    ) : historyLogs.length === 0 ? (
                                        <EmptyState message="No hay historial registrado." />
                                    ) : (
                                        historyLogs.filter(log => historyFilter === "all" || log.placa === historyFilter).map((log: any) => (
                                            <div key={log.id} className="py-5 flex flex-col gap-2">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div>
                                                        <div className="text-sm font-medium text-neutral-900">{log.vehicle}</div>
                                                        <div className="text-xs font-mono text-neutral-500">{log.placa}</div>
                                                    </div>
                                                    <div className="text-right text-xs text-neutral-400 shrink-0">
                                                        <span>{new Date(log.date).toLocaleDateString()}</span>
                                                        <span className="ml-2">{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>

                                                {log.type === 'CORRECTIVE' && log.faultDescription && (
                                                    <p className="text-xs text-neutral-500">
                                                        Falla{log.reportedBy ? ` · Reportada por ${log.reportedBy}` : ''}: <span className="text-neutral-700">{log.faultDescription}</span>
                                                    </p>
                                                )}

                                                <div>
                                                    <p className="text-xs text-neutral-400">
                                                        {log.type === 'CORRECTIVE' ? 'Trabajo realizado' : log.type === 'REPAIR' ? log.category : 'Servicio'}
                                                        {log.performedBy ? ` · por ${log.performedBy}` : ''}
                                                    </p>
                                                    <p className="text-sm text-neutral-700 mt-0.5">{log.description}</p>
                                                    {(log.parts || log.cost > 0 || log.mileage) && (
                                                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                                                            {log.mileage && <span>{log.mileage.toLocaleString()} km</span>}
                                                            {log.parts && <span>Repuestos: {log.parts}</span>}
                                                            {log.cost > 0 && <span className="font-mono text-neutral-900">${log.cost}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </TabsContent>
                        </div>
                    )}
                </Tabs>
            </div>

            {/* Dialogs */}
            <MaintenanceRegistrationDialog
                isOpen={maintenanceOpen}
                onClose={() => setMaintenanceOpen(false)}
                initialVehicleId={selectedVehicleId}
                initialServiceType={selectedServiceType}
                lockServiceType={!!selectedServiceType}
                lockVehicle={!!selectedVehicleId}
                onSuccess={handleMaintenanceSuccess}
                closingFaultId={pendingResolveId || undefined}
            />

            <VehicleHistoryDialog
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                vehicleId={historyVehicleId}
                vehiclePlate={historyVehiclePlate}
            />
        </main>
    )
}

function MobileFaultCard({ fault, actionText, onAction, onSecondaryAction, secondaryActionText }: any) {
    const isMaintenance = fault.tipo_falla === 'Mantenimiento'

    // Calculate Days Active
    const daysActive = Math.floor((new Date().getTime() - new Date(fault.created_at).getTime()) / (1000 * 3600 * 24))

    return (
        <div className="py-5 flex flex-col gap-3">
            <div className="flex gap-4 items-start">
                {/* Vehicle Image/Avatar */}
                <div className="relative w-12 h-12 bg-neutral-50 rounded-md overflow-hidden shrink-0">
                    {fault.foto_url ? (
                        <Image src={fault.foto_url} alt={fault.modelo} fill className="object-cover" />
                    ) : (
                        <div className="flex items-center justify-center h-full text-neutral-300">
                            <Wrench className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-medium text-neutral-900 text-base leading-tight truncate">{fault.modelo}</h3>
                        <span className={`text-xs shrink-0 ${
                            fault.prioridad === 'Crítica' ? 'text-red-600 font-medium' :
                            fault.prioridad === 'Alta' ? 'text-neutral-900 font-medium' :
                            'text-neutral-500'
                        }`}>
                            {fault.prioridad}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-500">
                        <span className="font-mono">{fault.placa}</span>
                        <span>·</span>
                        <span>{isMaintenance ? 'Mantenimiento' : fault.tipo_falla}</span>
                    </div>
                </div>
            </div>

            <div className="pl-16 space-y-2">
                <p className="text-sm text-neutral-700">{fault.descripcion}</p>
                {fault.reported_by && (
                    <p className="text-xs text-neutral-400">Conductor: {fault.reported_by}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-4 text-xs text-neutral-400">
                        <span>Registrado: {new Date(fault.created_at).toLocaleDateString()}</span>
                        <span>{daysActive > 0 ? `${daysActive} días activo` : 'Hoy'}</span>
                    </div>

                    <div className="flex items-center gap-5">
                        {onSecondaryAction && (
                            <button
                                type="button"
                                onClick={onSecondaryAction}
                                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                            >
                                {secondaryActionText}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onAction}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                        >
                            {actionText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="py-16 text-center text-sm text-neutral-400">
            {message}
        </div>
    )
}
