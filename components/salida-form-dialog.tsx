"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Car, Plus, CheckCircle, Send, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { Input } from "@/components/ui/input"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { VehicleSelector, Vehicle } from "@/components/vehicle-selector"
import { submitExitReport } from "@/app/transporte/actions"
import { DEPARTMENTS } from "@/lib/constants"

interface Vehiculo extends Vehicle {
    department?: string
    assigned_driver_id?: string | null
    odometro_averiado?: boolean
}

type SalidaFormDialogProps = {
    isOpen: boolean
    onClose: () => void
    initialVehicleId?: string
    onSuccess?: () => void
}

export function SalidaFormDialog({ isOpen, onClose, initialVehicleId, onSuccess }: SalidaFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'form' | 'success'>('form')
    const [whatsappText, setWhatsappText] = useState("")

    // Form State
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
    const [vehiculoId, setVehiculoId] = useState("")
    const [currentUserId, setCurrentUserId] = useState("")
    const [selectedVehicle, setSelectedVehicle] = useState<Vehiculo | null>(null)
    const [kmSalida, setKmSalida] = useState("")
    const [conductor, setConductor] = useState("")
    const [departamento, setDepartamento] = useState('')
    const [estadoCauchos, setEstadoCauchos] = useState<string>('')
    const [gasolina, setGasolina] = useState("Full")
    const [observaciones, setObservaciones] = useState("")
    const [lastKm, setLastKm] = useState<number | null>(null)

    // Fault Reporting State (From Remote/New Logic)
    const [faultsToAdd, setFaultsToAdd] = useState<string[]>([])
    const [newFaultText, setNewFaultText] = useState("")
    const [usePlainText, setUsePlainText] = useState(false)

    // Custom Alert State
    const [conflictAlertOpen, setConflictAlertOpen] = useState(false)
    const [pendingVehicle, setPendingVehicle] = useState<Vehiculo | null>(null)
    const conflictAcceptedRef = useRef(false)

    // Checks
    const [checks, setChecks] = useState({
        aceite: false,
        agua: false,
        gato: false,
        cruz: false,
        triangulo: false,
        carpeta: false,
        cinturones: false,
        conos: false,
        extintor: false,
        botiquin: false,
        frenos: false,
        corneta: false,
        ups: false,
        escalera: false,
        escalera_tijera: false,
        // Moto specific
        casco: false,
        luces: false,
        herramientas: false,
        caucho: false,
        onu: false
    })

    const router = useRouter()

    useEffect(() => {
        if (isOpen) {
            setStep('form') // Reset step on open
            loadVehicles().then(async ({ vehicles, userId }) => {
                if (initialVehicleId) {
                    let found = vehicles?.find(v => v.id === initialVehicleId)

                    // Fallback: If vehicle is not in 'available' (e.g. busy or different dept), fetch it anyway for display
                    if (!found) {
                        const supabase = createClient()
                        const { data: vData } = await supabase.from('vehiculos').select('*').eq('id', initialVehicleId).single()
                        const { data: kData } = await supabase.from('vista_ultimos_kilometrajes').select('ultimo_kilometraje').eq('vehiculo_id', initialVehicleId).single()

                        if (vData) {
                            found = {
                                ...vData,
                                kilometraje: kData?.ultimo_kilometraje || 0
                            }
                        }
                    }

                    if (found) {
                        handleVehicleChange(found, userId || undefined)
                    }
                }
            })
        }
    }, [isOpen, initialVehicleId])

    async function loadVehicles() {
        const supabase = createClient()

        // 1. Get User Profile
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { vehicles: [], userId: null }

        setCurrentUserId(user.id)

        const { data: profile } = await supabase
            .from('profiles')
            .select('department, roles, first_name, last_name, plain_text_reports')
            .eq('id', user.id)
            .single()

        setUsePlainText(!!profile?.plain_text_reports)

        const userDept = profile?.department
        // Normalize roles to avoid case sensitivity issues
        const roles = (profile?.roles || []).map((r: string) => r.toLowerCase())
        const isMecanico = roles.includes('mecanico')

        // Auto-fill Conductor Name
        if (profile?.first_name || profile?.last_name) {
            const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            setConductor(fullName)
        }

        // 2. Get Vehicles
        const { data: allVehicles } = await supabase.from('vehiculos').select('*').order('codigo')
        const { data: busyReports } = await supabase.from('reportes').select('vehiculo_id').is('km_entrada', null)
        const { data: kData } = await supabase.from('vista_ultimos_kilometrajes').select('*')

        const busyIds = new Set(busyReports?.map(r => r.vehiculo_id))

        const available = allVehicles?.filter(v => {
            // Only filter out busy vehicles
            if (busyIds.has(v.id)) return false

            // [MOD] Removed department restriction - All users see all vehicles
            return true
        }).map(v => ({
            ...v,
            kilometraje: kData?.find(k => k.vehiculo_id === v.id)?.ultimo_kilometraje || 0
        })) || []

        setVehiculos(available)

        // Auto-select department in form if user has one
        if (userDept) setDepartamento(userDept)

        return { vehicles: available, userId: user.id }
    }

    async function handleVehicleChange(selected: Vehicle | null, overrideUserId?: string) {
        if (!selected) {
            setVehiculoId("")
            setSelectedVehicle(null)
            setLastKm(null)
            return
        }

        const userIdToCheck = overrideUserId || currentUserId

        // Assignment Check with Custom Alert
        const veh = selected as Vehiculo
        if (veh.assigned_driver_id && userIdToCheck && veh.assigned_driver_id !== userIdToCheck) {
            setPendingVehicle(veh)
            setConflictAlertOpen(true)
            return // Stop here
        }

        commitVehicleChange(veh)
    }

    async function commitVehicleChange(selected: Vehiculo) {
        const value = selected.id
        setVehiculoId(value)
        // @ts-ignore
        setSelectedVehicle(selected)

        const supabase = createClient()
        const { data } = await supabase
            .from('reportes')
            .select('km_entrada')
            .eq('vehiculo_id', value)
            .not('km_entrada', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (data) setLastKm(data.km_entrada)
        else setLastKm(selected.kilometraje || 0)
    }

    const toggleCheck = (key: keyof typeof checks) => {
        setChecks(prev => ({ ...prev, [key]: !prev[key] }))
    }

    async function handleSubmit() {
        if (!vehiculoId || !kmSalida || !conductor || !departamento || !estadoCauchos) {
            toast.error("Complete todos los campos obligatorios")
            return
        }

        const km = parseInt(kmSalida)

        // [MOD] Bypass strict validation if odometer is broken
        // If not broken, enforce rules
        if (!selectedVehicle?.odometro_averiado) {
            if (lastKm !== null && lastKm > 0 && km < lastKm) {
                toast.error(`Error Crítico: El kilometraje (${km}) no puede ser menor al histórico del vehículo (${lastKm} km). Verifique el tablero.`)
                return
            }
        } else {
            // Odometer Broken Logic??
            // Actually, if it's broken, user might input SAME value as lastKm.
            // We just skip the "less than" check to allow corrections or same value, 
            // but maybe still warn if it's drastically different? 
            // Letting it pass for now as requested "Same value allowed" which `km < lastKm` doesn't block (it blocks LESS).
            // Wait, `km < lastKm` blocks strictly less. So Equal is allowed?
            // Re-reading user request: "Permite ingresar el mismo kilometraje".
            // My previous code: `km < lastKm`. So Equal WAS allowed already?
            // Usually yes. But let's be explicit avoiding the block.
        }



        setLoading(true)
        try {
            // Use Server Action (Remote Logic)
            const result = await submitExitReport({
                vehiculo_id: vehiculoId,
                conductor,
                departamento,
                km_salida: km,
                gasolina_salida: gasolina,
                observaciones_salida: observaciones, // Still passing this for backward compat or if needed

                aceite_salida: checks.aceite,
                agua_salida: checks.agua,
                frenos_salida: checks.frenos,
                estado_cauchos_salida: estadoCauchos,
                corneta_salida: checks.corneta,

                carpeta_salida: checks.carpeta,
                gato_salida: checks.gato,
                cruz_salida: checks.cruz,
                triangulo_salida: checks.triangulo,
                cinturones_salida: checks.cinturones,
                conos_salida: checks.conos,
                extintor_salida: checks.extintor,
                botiquin_salida: checks.botiquin,

                // Dispositivos (Instalación y Distribución)
                ups_salida: checks.ups ? 1 : 0,
                escalera_salida: checks.escalera,
                escalera_tijera_salida: checks.escalera_tijera,
                // Moto specific
                casco_salida: checks.casco,
                luces_salida: checks.luces,
                herramientas_salida: checks.herramientas,

                faults: faultsToAdd // Pass explicit faults
            })

            if (!result.success) {
                throw new Error(result.error)
            }

            // Also update fuel manually just in case, though submitExitReport does it too
            // kept for safety if actions differ, but sticking to remote pattern which seemingly relies on submitExitReport logic
            // Actually, let's keep the toast from Remote
            toast.success("Salida reportada (Taller notificado si hay novedades)")

            // --- WhatsApp Integration ---
            const text = formatSalidaText({
                km_salida: km,
                conductor,
                departamento,
                gasolina_salida: gasolina,
                observaciones_salida: observaciones,
                aceite_salida: checks.aceite,
                agua_salida: checks.agua,
                frenos_salida: checks.frenos,
                estado_cauchos_salida: estadoCauchos,
                corneta_salida: checks.corneta,
                gato_salida: checks.gato,
                cruz_salida: checks.cruz,
                triangulo_salida: checks.triangulo,
                carpeta_salida: checks.carpeta,
                cinturones_salida: checks.cinturones,
                conos_salida: checks.conos,
                extintor_salida: checks.extintor,
                botiquin_salida: checks.botiquin,
                casco_salida: checks.casco,
                luces_salida: checks.luces,
                herramientas_salida: checks.herramientas,

                caucho_salida: checks.caucho,
                escalera_tijera_salida: checks.escalera_tijera,
                onu_salida: checks.onu ? 1 : 0,
                ups_salida: checks.ups ? 1 : 0,
                escalera_salida: checks.escalera
            }, selectedVehicle)

            setWhatsappText(text)
            setStep('success')
            if (onSuccess) onSuccess()

            // Reset
            setVehiculoId("")
            setSelectedVehicle(null)
            setKmSalida("")
            setConductor('')
            setDepartamento('')
            setEstadoCauchos('')
            setGasolina("Full")
            setObservaciones("")
            setFaultsToAdd([]) // Reset faults
            setNewFaultText("")
            setLastKm(null)
            setChecks({
                aceite: false, agua: false, gato: false, cruz: false,
                triangulo: false, caucho: false, carpeta: false,
                cinturones: false, conos: false, extintor: false, botiquin: false,
                frenos: false, corneta: false,
                ups: false, escalera: false, escalera_tijera: false,
                casco: false, luces: false, herramientas: false
            })

        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Error al registrar salida")
        } finally {
            setLoading(false)
        }
    }

    // Helpers
    const formatSalidaText = (data: any, vehiculoObj: Vehiculo | null) => {
        const check = (val: boolean | number) => usePlainText ? (val ? '[SI]' : '[NO]') : (val ? '✅' : '❌')
        const bullet = usePlainText ? '-' : '•'
        const vehiculoNombre = vehiculoObj ? vehiculoObj.modelo : 'Desconocido'
        const fecha = new Date().toLocaleDateString()
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const isMoto = vehiculoObj?.codigo?.startsWith('M-') || vehiculoObj?.tipo === 'Moto' || vehiculoObj?.modelo?.toLowerCase().includes('moto')

        let msg = `*Reporte de Salida*\n\n`
        msg += `Fecha: ${fecha}\n`
        msg += `Hora: ${hora}\n\n`

        msg += `Conductor: ${data.conductor}\n`
        msg += `Departamento: ${data.departamento}\n\n`

        msg += `Vehículo: ${vehiculoNombre}\n`
        if (vehiculoObj?.placa) msg += `Placa: ${vehiculoObj.placa}\n`
        msg += `Kilometraje (Salida): ${data.km_salida}\n`
        msg += `Nivel de Gasolina: ${data.gasolina_salida}\n\n`

        msg += `*Chequeo Técnico:*\n`
        msg += `Chequeo de Aceite: ${check(data.aceite_salida)}\n`
        msg += `Sistema de iluminación: ${check(data.luces_salida)}\n`
        msg += `Sistema de frenos: ${check(data.frenos_salida)}\n`
        msg += `Cauchos: ${data.estado_cauchos_salida || 'No especificado'}\n`
        msg += `Corneta: ${check(data.corneta_salida)}\n`
        if (!isMoto) {
            msg += `Agua / Refrigerante: ${check(data.agua_salida)}\n\n`
        } else {
            msg += `\n`
        }

        if (isMoto) {
            msg += `*Seguridad (Moto):*\n`
            msg += `Casco: ${check(data.casco_salida)}\n`
            msg += `Herramientas: ${check(data.herramientas_salida)}\n`
        } else {
            msg += `*Seguridad:*\n`
            msg += `Cinturones de seguridad: ${check(data.cinturones_salida)}\n`
            msg += `Conos de tráfico: ${check(data.conos_salida)}\n`
            msg += `Extintor de incendios: ${check(data.extintor_salida)}\n`
            msg += `Botiquín de primeros auxilios: ${check(data.botiquin_salida)}\n`
            msg += `Gato: ${check(data.gato_salida)}\n`
            msg += `Llave Cruz: ${check(data.cruz_salida)}\n`
            msg += `Triángulo: ${check(data.triangulo_salida)}\n`
            msg += `Caucho de repuesto: ${check(data.caucho_salida)}\n`
            msg += `Carpeta de Permisos: ${check(data.carpeta_salida)}\n`
        }
        msg += `\n`

        if ((data.departamento === 'Instalación' || data.departamento === 'Distribución' || data.departamento === 'Afectaciones') && !isMoto) {
            msg += `*Equipos Asignados:*\n`
            if (data.departamento === 'Instalación') {
                msg += `Mini-UPS: ${check(data.ups_salida)}\n`
            }
            msg += `Escalera telescópica: ${check(data.escalera_salida)}\n\n`
        }

        const isCarga = vehiculoObj?.tipo?.toLowerCase() === 'carga' || vehiculoObj?.modelo?.toLowerCase().includes('carga')
        if (isCarga) {
            msg += `*Equipos de Carga:*\n`
            msg += `Escalera de Tijera: ${check(data.escalera_tijera_salida)}\n\n`
        }

        // Add explicit faults to WhatsApp
        if (faultsToAdd.length > 0) {
            msg += `*Fallas Reportadas:*\n`
            faultsToAdd.forEach(f => msg += `${bullet} ${f}\n`)
            msg += `\n`
        }

        return msg
    }

    // Helpers conditions
    const isMoto = selectedVehicle?.codigo?.startsWith('M-') || selectedVehicle?.tipo === 'Moto' || selectedVehicle?.modelo?.toLowerCase().includes('moto')
    const isEquiposDepartamento = departamento === 'Instalación' || departamento === 'Distribución' || departamento === 'Afectaciones'
    const isCarga = selectedVehicle?.tipo?.toLowerCase() === 'carga' || selectedVehicle?.modelo?.toLowerCase().includes('carga')

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && step === 'success') return
            onClose()
        }}>
            <DialogContent
                onInteractOutside={(e) => {
                    if (step === 'success') e.preventDefault()
                }}
                onEscapeKeyDown={(e) => {
                    if (step === 'success') e.preventDefault()
                }}
                className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 focus:outline-none overflow-hidden"
            >

                {step === 'success' ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center space-y-5 min-h-[360px]">
                        <CheckCircle className="w-8 h-8 text-neutral-900" strokeWidth={1.5} />
                        <div className="space-y-1">
                            <h2 className="text-lg font-medium text-neutral-900">¡Salida registrada!</h2>
                            <p className="text-neutral-500 text-sm">El vehículo ha sido despachado correctamente.</p>
                        </div>

                        <div className="w-full flex flex-col items-center gap-4 pt-4 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => window.location.href = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                            >
                                <Send className="w-4 h-4" strokeWidth={1.5} />
                                Reportar en WhatsApp
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                            >
                                Cerrar y volver
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogHeader className="px-6 py-4 border-b border-neutral-100 shrink-0">
                            <DialogTitle className="text-lg font-medium text-neutral-900">Registrar salida</DialogTitle>
                            <DialogDescription className="text-xs text-neutral-500">Complete el formulario de pre-operación</DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2 col-span-2">
                                    {initialVehicleId ? (
                                        <div className="py-2 border-b border-neutral-100">
                                            <Label className="text-xs font-medium text-neutral-500 mb-2 block">Vehículo seleccionado</Label>
                                            <div className="flex items-center gap-3">
                                                <Car className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.5} />
                                                <div>
                                                    <div className="font-medium text-sm text-neutral-900">{selectedVehicle?.modelo || "Cargando..."}</div>
                                                    <div className="text-xs text-neutral-500 font-mono flex items-center gap-2">
                                                        {selectedVehicle?.placa}
                                                        {selectedVehicle?.codigo && <span className="text-neutral-400">· {selectedVehicle.codigo}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            {selectedVehicle?.odometro_averiado && (
                                                <p className="mt-2 text-xs text-neutral-600">
                                                    <span className="font-medium text-red-600">Odómetro averiado:</span> Validación de kilometraje relajada. Reporte el valor visible en tablero.
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <VehicleSelector
                                            vehicles={vehiculos}
                                            selectedVehicleId={vehiculoId}
                                            onSelect={handleVehicleChange}
                                            label="Vehículo disponible"
                                        />
                                    )}
                                    {lastKm !== null && (
                                        <p className="text-xs text-neutral-500 text-right">Anterior: {lastKm.toLocaleString()} km</p>
                                    )}
                                </div>

                                <div className="space-y-1.5 col-span-2">
                                    <Label className="text-xs font-medium text-neutral-500">Kilometraje actual</Label>
                                    <Input
                                        type="number"
                                        value={kmSalida}
                                        onChange={e => setKmSalida(e.target.value)}
                                        placeholder={lastKm ? `> ${lastKm}` : "0"}
                                    />
                                </div>

                                <div className="space-y-2 col-span-2">
                                    <Label className="text-xs font-medium text-neutral-500">Nivel de gasolina</Label>
                                    <div className="flex items-center gap-6 border-b border-neutral-100 pb-2">
                                        {["Full", "3/4", "1/2", "1/4", "Reserva"].map((level) => (
                                            <button
                                                key={level}
                                                type="button"
                                                onClick={() => setGasolina(level)}
                                                className={`pb-1 text-xs transition-colors border-b-2 -mb-[9px] ${gasolina === level
                                                    ? "border-neutral-900 text-neutral-900 font-medium"
                                                    : "border-transparent text-neutral-400 hover:text-neutral-700"
                                                    }`}
                                            >
                                                {level === "Reserva" ? "Res" : level}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5 col-span-2">
                                    <Label className="text-xs font-medium text-neutral-500">Conductor (Auto-asignado)</Label>
                                    <Input
                                        value={conductor}
                                        readOnly
                                        className="text-neutral-500 cursor-not-allowed"
                                        placeholder="Cargando identidad..."
                                    />
                                </div>

                                <div className="space-y-1.5 col-span-2">
                                    <Label className="text-xs font-medium text-neutral-500">Departamento / Uso</Label>
                                    <CustomDropdown
                                        value={departamento}
                                        onChange={setDepartamento}
                                        placeholder="Seleccione el destino"
                                        options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                                    />
                                </div>
                            </div>

                            {/* Checks section */}
                            <div className="space-y-6 pt-2">
                                {/* TÉCNICO */}
                                <div>
                                    <h4 className="text-xs font-medium text-neutral-400 mb-2">
                                        Chequeo técnico
                                    </h4>
                                    <div className="divide-y divide-neutral-100">
                                        <div className="flex items-center justify-between py-2.5">
                                            <Label htmlFor="aceite" className="text-sm font-normal text-neutral-700 cursor-pointer">Nivel de aceite</Label>
                                            <Switch id="aceite" checked={checks.aceite} onCheckedChange={() => toggleCheck('aceite')} />
                                        </div>
                                        <div className="flex items-center justify-between py-2.5">
                                            <Label htmlFor="luces" className="text-sm font-normal text-neutral-700 cursor-pointer">Sistema de iluminación</Label>
                                            <Switch id="luces" checked={checks.luces} onCheckedChange={() => toggleCheck('luces')} />
                                        </div>
                                        <div className="flex items-center justify-between py-2.5">
                                            <Label htmlFor="frenos" className="text-sm font-normal text-neutral-700 cursor-pointer">Sistema de frenos</Label>
                                            <Switch id="frenos" checked={checks.frenos} onCheckedChange={() => toggleCheck('frenos')} />
                                        </div>
                                        <div className="flex items-center justify-between gap-4 py-2.5">
                                            <Label htmlFor="estado_cauchos" className="text-sm font-normal text-neutral-700 shrink-0">Estado de cauchos</Label>
                                            <div className="w-[210px]">
                                                <CustomDropdown
                                                    id="estado_cauchos"
                                                    value={estadoCauchos}
                                                    onChange={setEstadoCauchos}
                                                    placeholder="Seleccionar"
                                                    align="end"
                                                    options={[
                                                        { value: "100% al 80% Estado Óptimo", label: "100% al 80% Estado Óptimo" },
                                                        { value: "79% al 50% Desgaste Medio", label: "79% al 50% Desgaste Medio" },
                                                        { value: "49% al 20% Planificar Cambio", label: "49% al 20% Planificar Cambio" },
                                                        { value: "19% al 1% Riesgo Crítico", label: "19% al 1% Riesgo Crítico" },
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2.5">
                                            <Label htmlFor="corneta" className="text-sm font-normal text-neutral-700 cursor-pointer">Corneta</Label>
                                            <Switch id="corneta" checked={checks.corneta} onCheckedChange={() => toggleCheck('corneta')} />
                                        </div>
                                        {!isMoto && (
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="agua" className="text-sm font-normal text-neutral-700 cursor-pointer">Agua / Refrigerante</Label>
                                                <Switch id="agua" checked={checks.agua} onCheckedChange={() => toggleCheck('agua')} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* SEGURIDAD - CARROS */}
                                {!isMoto && (
                                    <div className="pt-4 border-t border-neutral-100">
                                        <h4 className="text-xs font-medium text-neutral-400 mb-2">
                                            Seguridad y herramientas
                                        </h4>
                                        <div className="divide-y divide-neutral-100">
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="cinturones" className="text-sm font-normal text-neutral-700 cursor-pointer">Cinturones de seguridad</Label>
                                                <Switch id="cinturones" checked={checks.cinturones} onCheckedChange={() => toggleCheck('cinturones')} />
                                            </div>
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="conos" className="text-sm font-normal text-neutral-700 cursor-pointer">Conos de tráfico</Label>
                                                <Switch id="conos" checked={checks.conos} onCheckedChange={() => toggleCheck('conos')} />
                                            </div>
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="extintor" className="text-sm font-normal text-neutral-700 cursor-pointer">Extintor de incendios</Label>
                                                <Switch id="extintor" checked={checks.extintor} onCheckedChange={() => toggleCheck('extintor')} />
                                            </div>
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="botiquin" className="text-sm font-normal text-neutral-700 cursor-pointer">Botiquín de primeros auxilios</Label>
                                                <Switch id="botiquin" checked={checks.botiquin} onCheckedChange={() => toggleCheck('botiquin')} />
                                            </div>
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="gato" className="text-sm font-normal text-neutral-700 cursor-pointer">Gato hidráulico</Label>
                                                <Switch id="gato" checked={checks.gato} onCheckedChange={() => toggleCheck('gato')} />
                                            </div>
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="cruz" className="text-sm font-normal text-neutral-700 cursor-pointer">Llave cruz</Label>
                                                <Switch id="cruz" checked={checks.cruz} onCheckedChange={() => toggleCheck('cruz')} />
                                            </div>
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="triangulo" className="text-sm font-normal text-neutral-700 cursor-pointer">Triángulo</Label>
                                                <Switch id="triangulo" checked={checks.triangulo} onCheckedChange={() => toggleCheck('triangulo')} />
                                            </div>
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="caucho" className="text-sm font-normal text-neutral-700 cursor-pointer">Caucho de repuesto</Label>
                                                <Switch id="caucho" checked={checks.caucho} onCheckedChange={() => toggleCheck('caucho')} />
                                            </div>
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="carpeta" className="text-sm font-normal text-neutral-700 cursor-pointer">Carpeta / Permisos</Label>
                                                <Switch id="carpeta" checked={checks.carpeta} onCheckedChange={() => toggleCheck('carpeta')} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SEGURIDAD - MOTO */}
                                {isMoto && (
                                    <div className="pt-4 border-t border-neutral-100">
                                        <h4 className="text-xs font-medium text-neutral-400 mb-2">
                                            Seguridad moto
                                        </h4>
                                        <div className="divide-y divide-neutral-100">
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="casco" className="text-sm font-normal text-neutral-700 cursor-pointer">Casco</Label>
                                                <Switch id="casco" checked={checks.casco} onCheckedChange={() => toggleCheck('casco')} />
                                            </div>
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="herramientas" className="text-sm font-normal text-neutral-700 cursor-pointer">Herramientas básicas</Label>
                                                <Switch id="herramientas" checked={checks.herramientas} onCheckedChange={() => toggleCheck('herramientas')} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* EQUIPOS */}
                                {isEquiposDepartamento && !isMoto && (
                                    <div className="pt-4 border-t border-neutral-100">
                                        <h4 className="text-xs font-medium text-neutral-400 mb-2">
                                            Equipos asignados
                                        </h4>
                                        <div className="divide-y divide-neutral-100">
                                            {departamento === 'Instalación' && (
                                                <div className="flex items-center justify-between py-2.5">
                                                    <Label htmlFor="ups" className="text-sm font-normal text-neutral-700 cursor-pointer">Mini-UPS</Label>
                                                    <Switch id="ups" checked={checks.ups} onCheckedChange={() => toggleCheck('ups')} />
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="escalera" className="text-sm font-normal text-neutral-700 cursor-pointer">Escalera telescópica</Label>
                                                <Switch id="escalera" checked={checks.escalera} onCheckedChange={() => toggleCheck('escalera')} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* EQUIPOS - CARGA */}
                                {isCarga && (
                                    <div className="pt-4 border-t border-neutral-100">
                                        <h4 className="text-xs font-medium text-neutral-400 mb-2">
                                            Equipos de carga
                                        </h4>
                                        <div className="divide-y divide-neutral-100">
                                            <div className="flex items-center justify-between py-2.5">
                                                <Label htmlFor="escalera_tijera" className="text-sm font-normal text-neutral-700 cursor-pointer">Escalera de tijera</Label>
                                                <Switch id="escalera_tijera" checked={checks.escalera_tijera} onCheckedChange={() => toggleCheck('escalera_tijera')} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Explicit Fault Reporting Section */}
                            <div className="pt-4 border-t border-neutral-100 space-y-4">
                                <h4 className="text-xs font-medium text-neutral-500">
                                    Reportar fallas
                                </h4>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={newFaultText}
                                            onChange={(e) => setNewFaultText(e.target.value)}
                                            placeholder="Ej: Luz de freno quemada..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    if (newFaultText.trim()) {
                                                        setFaultsToAdd([...faultsToAdd, newFaultText.trim()])
                                                        setNewFaultText("")
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (newFaultText.trim()) {
                                                    setFaultsToAdd([...faultsToAdd, newFaultText.trim()])
                                                    setNewFaultText("")
                                                }
                                            }}
                                            className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 shrink-0"
                                            aria-label="Agregar falla"
                                        >
                                            <Plus className="w-4 h-4" strokeWidth={1.5} />
                                        </button>
                                    </div>

                                    {faultsToAdd.length > 0 && (
                                        <div className="divide-y divide-neutral-100">
                                            {faultsToAdd.map((fault, idx) => (
                                                <div key={idx} className="group flex items-center justify-between py-2.5">
                                                    <span className="text-sm text-neutral-700">{fault}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFaultsToAdd(prev => prev.filter((_, i) => i !== idx))}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900 p-1"
                                                        aria-label="Eliminar falla"
                                                    >
                                                        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t border-neutral-100 flex-row items-center justify-end gap-5 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="text-xs text-neutral-500 hover:text-neutral-900 transition-all duration-150 active:scale-[0.985] disabled:opacity-40 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-all duration-150 active:scale-[0.985] disabled:opacity-40 cursor-pointer"
                            >
                                {loading ? "Registrando..." : "Confirmar salida"}
                            </button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>

            {/* Conflict Warning Dialog */}
            <DeleteConfirmDialog
                open={conflictAlertOpen}
                onOpenChange={(open) => {
                    setConflictAlertOpen(open)
                    if (!open && !conflictAcceptedRef.current) {
                        setVehiculoId("")
                        setSelectedVehicle(null)
                    }
                    if (!open) {
                        setPendingVehicle(null)
                        conflictAcceptedRef.current = false
                    }
                }}
                title="Advertencia de asignación"
                description="Este vehículo está asignado oficialmente a otro conductor. Usarlo podría generar conflictos en el control de kilometraje y responsabilidad."
                confirmLabel="Asumir responsabilidad"
                cancelLabel="Cancelar"
                destructive={false}
                onConfirm={() => {
                    conflictAcceptedRef.current = true
                    if (pendingVehicle) {
                        commitVehicleChange(pendingVehicle)
                    }
                }}
            />
        </Dialog>
    )
}
