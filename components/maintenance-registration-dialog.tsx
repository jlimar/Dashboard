"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { Droplets, Bike, Search, Loader2, Car, Timer, Check, CheckCircle2 } from "lucide-react"
import { registerMaintenance, reportFault } from "@/app/taller/actions"
import { toast } from "sonner"

type Vehicle = {
    id: string
    placa: string
    modelo: string
    tipo: string
    kilometraje?: number
}

interface MaintenanceRegistrationDialogProps {
    isOpen: boolean
    onClose: () => void
    initialVehicleId?: string
    initialServiceType?: string // [NEW] Pre-select service
    lockServiceType?: boolean   // [NEW] Prevent changing service
    lockVehicle?: boolean // [NEW]
    onSuccess?: () => void
    closingFaultId?: string // [NEW] If set, this log resolves a fault
}

export function MaintenanceRegistrationDialog({
    isOpen,
    onClose,
    initialVehicleId,
    initialServiceType,
    lockServiceType = false,
    lockVehicle = false, // [NEW]
    onSuccess,
    closingFaultId
}: MaintenanceRegistrationDialogProps) {
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [loadingVehicles, setLoadingVehicles] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    // Tab State
    const [activeTab, setActiveTab] = useState<'maintenance' | 'fault' | 'corrective'>('maintenance')

    // Form State
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
    const [serviceType, setServiceType] = useState<string>("")
    const [mileage, setMileage] = useState<string>("")
    const [notes, setNotes] = useState("")
    const [faultPriority, setFaultPriority] = useState("Media") // For Fault Report
    const [faultType, setFaultType] = useState("Mecánica") // For Fault Report
    // [New] Reparación Fields
    const [partsUsed, setPartsUsed] = useState("")
    const [userName, setUserName] = useState("Mecánico") // [NEW] Store current user name
    const [originalFaultDescription, setOriginalFaultDescription] = useState("") // [NEW] Store fault desc
    // Removed Cost Fields as per user request

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [successData, setSuccessData] = useState<any>(null) // To store data for WhatsApp

    useEffect(() => {
        if (isOpen) {
            loadVehicles()
            resetForm()
            // If resolving a fault (and not a specific preventive maintenance), default to Corrective
            if (closingFaultId && !initialServiceType) {
                setActiveTab('corrective')
            }
        }
    }, [isOpen, initialVehicleId, initialServiceType, lockVehicle, lockServiceType, closingFaultId])

    async function loadVehicles() {
        setLoadingVehicles(true)
        const supabase = createClient()

        // Fetch vehicles and current mileage
        const { data: vData } = await supabase.from('vehiculos').select('id, placa, modelo, tipo')
        const { data: kData } = await supabase.from('vista_ultimos_kilometrajes').select('*')

        if (vData) {
            const merged = vData.map(v => ({
                ...v,
                kilometraje: kData?.find(k => k.vehiculo_id === v.id)?.ultimo_kilometraje || 0
            }))
            setVehicles(merged)

            // Handle Pre-selection
            if (initialVehicleId) {
                const preselected = merged.find(v => v.id === initialVehicleId)
                if (preselected) {
                    setSelectedVehicle(preselected)
                    setMileage(preselected.kilometraje?.toString() || "")
                }
            }
        }

        // [NEW] Fetch Current User
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name') // [FIX] Correct columns
                .eq('id', user.id)
                .single()

            if (profile) {
                const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                if (fullName) setUserName(fullName)
            }
        }

        // [NEW] Fetch Fault Description if closingFaultId
        if (closingFaultId) {
            const { data: faultData } = await supabase
                .from('fallas')
                .select('descripcion')
                .eq('id', closingFaultId)
                .single()

            if (faultData?.descripcion) {
                setOriginalFaultDescription(faultData.descripcion)
            }
        }

        setLoadingVehicles(false)
    }

    function resetForm() {
        if (!initialVehicleId && !lockVehicle) setSelectedVehicle(null)

        // Handle Service Type Pre-selection
        if (initialServiceType) {
            setServiceType(initialServiceType)
        } else {
            setServiceType("")
        }

        setNotes("")
        setFaultPriority("Media")
        setFaultType("Mecánica")
        setSearchTerm("")
        setPartsUsed("")
        setActiveTab('maintenance')
        setSuccessData(null)
    }

    const filteredVehicles = vehicles.filter(v =>
        v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.modelo.toLowerCase().includes(searchTerm.toLowerCase())
    )

    async function handleSubmit() {
        if (!selectedVehicle) return

        if (activeTab === 'maintenance' && (!serviceType || !mileage)) {
            toast.error("Complete todos los campos requeridos")
            return
        }

        if (activeTab === 'fault' && !notes) {
            toast.error("Describa la falla")
            return
        }

        if (activeTab === 'corrective' && !notes) {
            toast.error("Describa el trabajo realizado")
            return
        }

        const currentKm = selectedVehicle.kilometraje || 0
        const newKm = parseFloat(mileage)

        if (serviceType !== 'WASH' && activeTab !== 'fault' && activeTab !== 'corrective' && newKm < currentKm) {
            toast.error(`El kilometraje no puede ser menor al actual (${currentKm} km)`)
            return
        }

        setIsSubmitting(true)

        let result
        if (activeTab === 'fault') {
            result = await reportFault({
                vehicle_id: selectedVehicle!.id,
                description: notes || "Sin descripción",
                priority: faultPriority,
                fault_type: faultType
            })
        } else if (activeTab === 'corrective') {
            result = await registerMaintenance({
                vehicle_id: selectedVehicle!.id,
                service_type: 'CORRECTIVE',
                mileage: parseFloat(mileage) || currentKm,
                notes: `[Falla: ${originalFaultDescription}] ${notes}`, // Prepend fault desc to notes for DB history
                performed_by: userName,
                parts_used: partsUsed,
                labor_cost: 0,
                parts_cost: 0
            })
        } else {
            result = await registerMaintenance({
                vehicle_id: selectedVehicle!.id,
                service_type: serviceType,
                mileage: parseFloat(mileage),
                notes,
                performed_by: userName
            })
        }

        setIsSubmitting(false)

        if (result.success) {
            toast.success(activeTab === 'fault' ? "Falla reportada correctamente" : "Mantenimiento registrado correctamente")

            // Prepare data for WhatsApp
            setSuccessData({
                type: activeTab,
                vehicle: selectedVehicle,
                details: {
                    serviceType,
                    mileage,
                    notes,
                    faultType,
                    faultPriority,
                    partsUsed,
                    performedBy: userName,
                    originalFaultDescription // Pass to success view
                }
            })

            // Trigger parent refresh immediately
            if (onSuccess) onSuccess()

            // Don't close immediately. Wait for user to click "Cerrar" in success view or "Enviar WhatsApp"
            // if (onSuccess) onSuccess() <--- Delayed
        } else {
            toast.error("Error al registrar: " + result.error)
        }
    }

    const generateWhatsAppLink = () => {
        if (!successData || !successData.vehicle) return ""

        const { type, vehicle, details } = successData
        const date = new Date().toLocaleDateString('es-VE')
        const time = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })

        let header = "Reporte de Reparación Vehicular"
        let typeLabel = "Mantenimiento"

        if (type === 'fault') {
            typeLabel = "Falla"
            header = "Reporte de Falla Vehicular"
        } else if (type === 'corrective') {
            typeLabel = "Reparación"
        }

        let message = `${header}\n\n` +
            `Fecha: ${date}\n` +
            `Hora: ${time}\n` +
            `Vehículo: ${vehicle.modelo}\n` +
            `Placa: ${vehicle.placa}\n` +
            `Tipo: ${typeLabel}\n\n`

        if (type === 'fault') {
            message += `Falla: ${details.notes || "Sin descripción"}\n` +
                `Prioridad: ${details.faultPriority}\n` +
                `Tipo Falla: ${details.faultType}`
        } else if (type === 'corrective') {
            message += `Kilometraje: ${parseFloat(details.mileage).toLocaleString()} km\n` +
                `Falla: ${details.originalFaultDescription || "No especificada"}\n` + // [NEW] Added Falla field
                `Trabajo Realizado: ${details.notes || "Sin detalles"}\n` +
                `Repuestos Utilizados: ${details.partsUsed || "N/A"}\n` +
                `Realizado por: ${details.performedBy || "Mecánico"}`
        } else {
            const serviceLabel = {
                'OIL_CHANGE': 'Cambio de Aceite',
                'TIMING_BELT': 'Correa de Tiempo',
                'CHAIN_KIT': 'Kit de Arrastre',
                'WASH': 'Lavado'
            }[details.serviceType as string] || details.serviceType

            message += `Servicio: ${serviceLabel}\n` +
                `Kilometraje: ${parseFloat(details.mileage).toLocaleString()} km\n` +
                `Notas: ${details.notes || "-"}\n` +
                `Realizado por: ${details.performedBy || "Mecánico"}`
        }

        return `https://wa.me/?text=${encodeURIComponent(message)}`
    }




    // Render Success View
    if (successData) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-md p-6 text-center">
                    <div className="flex flex-col items-center gap-4 py-2">
                        <CheckCircle2 className="w-8 h-8 text-neutral-900" strokeWidth={1.25} />
                        <DialogTitle className="text-lg font-medium text-neutral-900">
                            {successData.type === 'fault' ? 'Falla reportada' : 'Registro exitoso'}
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-neutral-500">
                            El registro se ha guardado correctamente en el sistema.
                        </DialogDescription>

                        <div className="w-full flex flex-col items-center gap-4 mt-4 pt-4 border-t border-neutral-100">
                            <a
                                href={generateWhatsAppLink()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                            >
                                Enviar reporte por WhatsApp →
                            </a>
                            <button
                                type="button"
                                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                                onClick={() => onClose()}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-100">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-medium text-neutral-900">
                            {closingFaultId ? 'Registrar reparación' : 'Registrar mantenimiento'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-neutral-500">
                            {closingFaultId ? 'Registra el trabajo realizado para cerrar esta falla.' : 'Seleccione el vehículo y el tipo de servicio realizado.'}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    {/* 1. Vehicle Selection */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-neutral-500">Vehículo</Label>
                        {!selectedVehicle ? (
                            <div className="relative">
                                <SearchInput
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    placeholder="Buscar placa o modelo..."
                                />
                                <div className="mt-1 max-h-40 overflow-y-auto divide-y divide-neutral-100">
                                    {loadingVehicles ? (
                                        <div className="py-4 text-center text-neutral-400 text-xs">Cargando...</div>
                                    ) : filteredVehicles.length === 0 ? (
                                        <div className="py-4 text-center text-neutral-400 text-xs">No se encontraron vehículos</div>
                                    ) : (
                                        filteredVehicles.map(v => (
                                            <div
                                                key={v.id}
                                                onClick={() => {
                                                    setSelectedVehicle(v)
                                                    setMileage(v.kilometraje?.toString() || "")
                                                }}
                                                className="py-2.5 px-1 hover:bg-neutral-50/50 cursor-pointer flex justify-between items-center transition-colors"
                                            >
                                                <div>
                                                    <div className="font-medium text-sm text-neutral-900">{v.modelo}</div>
                                                    <div className="text-xs text-neutral-500 font-mono">{v.placa}</div>
                                                </div>
                                                <div className="text-xs font-mono text-neutral-400">
                                                    {(v.kilometraje || 0).toLocaleString()} km
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                                <div className="flex items-center gap-3">
                                    <Car className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.25} />
                                    <div>
                                        <div className="font-medium text-sm text-neutral-900">{selectedVehicle.modelo}</div>
                                        <div className="text-xs text-neutral-500 font-mono">{selectedVehicle.placa}</div>
                                    </div>
                                </div>
                                {!lockVehicle && activeTab !== 'fault' && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedVehicle(null)}
                                        className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                                    >
                                        Cambiar
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. Toggle Mode (Only if vehicle selected AND not resolving a specific fault) */}
                    {selectedVehicle && !closingFaultId && (
                        <div className="flex gap-6 border-b border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setActiveTab('maintenance')}
                                className={`pb-2 text-xs transition-colors border-b-2 -mb-[1px] ${activeTab === 'maintenance' ? 'border-neutral-900 text-neutral-900 font-medium' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
                            >
                                Mantenimiento
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('corrective')}
                                className={`pb-2 text-xs transition-colors border-b-2 -mb-[1px] ${activeTab === 'corrective' ? 'border-neutral-900 text-neutral-900 font-medium' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
                            >
                                Reparación
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('fault')}
                                className={`pb-2 text-xs transition-colors border-b-2 -mb-[1px] ${activeTab === 'fault' ? 'border-neutral-900 text-neutral-900 font-medium' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
                            >
                                Falla
                            </button>
                        </div>
                    )}

                    {/* Fault context when resolving */}
                    {closingFaultId && originalFaultDescription && (
                        <div className="pb-3 border-b border-neutral-100 space-y-0.5">
                            <p className="text-xs text-neutral-400">Falla a resolver</p>
                            <p className="text-sm font-medium text-neutral-900">{originalFaultDescription}</p>
                        </div>
                    )}

                    {/* Reparación Fields */}
                    {selectedVehicle && activeTab === 'corrective' && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-neutral-500">Falla a reparar</Label>
                                <Input
                                    value={originalFaultDescription}
                                    onChange={e => setOriginalFaultDescription(e.target.value)}
                                    placeholder="Describa la falla que está reparando..."
                                    disabled={!!closingFaultId}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-neutral-500">Repuestos utilizados</Label>
                                <Input
                                    value={partsUsed}
                                    onChange={e => setPartsUsed(e.target.value)}
                                    placeholder="Ej. Pastillas de freno, Bombillo H4..."
                                />
                            </div>
                        </div>
                    )}

                    {/* 3. Content based on Tab */}
                    {selectedVehicle && activeTab === 'maintenance' && (
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-neutral-500">Tipo de servicio</Label>
                            <div className="divide-y divide-neutral-100">
                                {[
                                    { id: 'OIL_CHANGE', label: 'Cambio de aceite', icon: Droplets },
                                    { id: 'TIMING_BELT', label: 'Correa de tiempo', icon: Timer },
                                    { id: 'CHAIN_KIT', label: 'Kit de arrastre', icon: Bike },
                                    { id: 'WASH', label: 'Lavado', icon: Droplets },
                                ].map((service) => {
                                    if (selectedVehicle) {
                                        const model = selectedVehicle.modelo.toUpperCase()
                                        const isMoto = model.includes('MOTO') || selectedVehicle.tipo?.toLowerCase() === 'moto'
                                        const hasChainOrGear = ['HILUX', 'TRITON', 'DONFENG', 'RICH', 'NKR'].some(k => model.includes(k))

                                        if (service.id === 'TIMING_BELT' && (isMoto || hasChainOrGear)) return null
                                        if (service.id === 'CHAIN_KIT' && !isMoto) return null
                                    }

                                    const isSelected = serviceType === service.id
                                    const isDisabled = lockServiceType && initialServiceType !== service.id

                                    if (isDisabled && !isSelected) return null

                                    return (
                                        <button
                                            type="button"
                                            key={service.id}
                                            onClick={() => !lockServiceType && setServiceType(service.id)}
                                            disabled={lockServiceType}
                                            className={`w-full py-2.5 flex items-center justify-between text-left transition-colors ${isSelected ? 'text-neutral-900 font-medium' : 'text-neutral-500 hover:text-neutral-900'} ${lockServiceType ? 'cursor-default opacity-70' : ''}`}
                                        >
                                            <span className="inline-flex items-center gap-2.5 text-sm">
                                                <service.icon className={`w-4 h-4 ${isSelected ? 'text-neutral-900' : 'text-neutral-400'}`} strokeWidth={1.25} />
                                                {service.label}
                                            </span>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-neutral-900" strokeWidth={1.25} />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {selectedVehicle && activeTab === 'fault' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-neutral-500">Tipo de falla</Label>
                                <CustomDropdown
                                    value={faultType}
                                    onChange={setFaultType}
                                    options={[
                                        { value: "Mecánica", label: "Mecánica" },
                                        { value: "Eléctrica", label: "Eléctrica" },
                                        { value: "Cauchos", label: "Cauchos" },
                                        { value: "Carrocería", label: "Carrocería" },
                                        { value: "Otro", label: "Otro" },
                                    ]}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-neutral-500">Prioridad</Label>
                                <CustomDropdown
                                    value={faultPriority}
                                    onChange={setFaultPriority}
                                    options={[
                                        { value: "Baja", label: "Baja" },
                                        { value: "Media", label: "Media" },
                                        { value: "Alta", label: "Alta" },
                                        { value: "Crítica", label: "Crítica" },
                                    ]}
                                />
                            </div>
                        </div>
                    )}

                    {/* 4. Common Details */}
                    {selectedVehicle && (
                        <div className="space-y-4">
                            {(activeTab === 'maintenance' || activeTab === 'corrective') && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-neutral-500">Kilometraje actual</Label>
                                    <Input
                                        type="number"
                                        value={mileage}
                                        onChange={(e) => setMileage(e.target.value)}
                                        className="font-mono font-medium"
                                    />
                                    <p className="text-xs text-neutral-400">
                                        Registrado: {(selectedVehicle.kilometraje || 0).toLocaleString()} km
                                    </p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-neutral-500">
                                    {activeTab === 'fault' ? 'Descripción del problema' : 'Notas (opcional)'}
                                </Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={activeTab === 'fault' ? "Describa detalladamente la falla..." : activeTab === 'corrective' ? "Detalles del trabajo realizado..." : "Detalles adicionales del servicio..."}
                                    className="resize-none min-h-20"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-end gap-5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedVehicle || (activeTab === 'maintenance' && (!serviceType || !mileage)) || (activeTab === 'fault' && !notes)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                    >
                        {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {activeTab === 'fault' ? 'Reportar falla' : activeTab === 'corrective' ? 'Registrar reparación' : 'Registrar servicio'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function SearchInput({ value, onChange, placeholder }: any) {
    return (
        <div className="flex items-center gap-2 border-b border-neutral-200 focus-within:border-neutral-900 transition-colors">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.25} />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
            />
        </div>
    )
}
