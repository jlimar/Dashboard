"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { Car, ArrowLeft, Plus, CheckCircle, Send, X } from "lucide-react"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { VehicleSelector, Vehicle } from "@/components/vehicle-selector"
import { submitExitReport } from "@/app/transporte/actions"
import { DEPARTMENTS } from "@/lib/constants"

interface Vehiculo extends Vehicle {
    department?: string
    assigned_driver_id?: string | null
    odometro_averiado?: boolean
}

function SalidaContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialVehicleId = searchParams.get('vehicle_id') || ""

    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
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

    // Fault Reporting State
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

    useEffect(() => {
        loadVehicles().then(async ({ vehicles, userId }) => {
            if (initialVehicleId) {
                let found = vehicles?.find(v => v.id === initialVehicleId)

                // Fallback: If vehicle is not in 'available', fetch it directly
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
            setInitialLoading(false)
        })
    }, [initialVehicleId])

    async function loadVehicles() {
        const supabase = createClient()

        // 1. Get User Profile
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return { vehicles: [], userId: null }
        }

        setCurrentUserId(user.id)

        const { data: profile } = await supabase
            .from('profiles')
            .select('department, roles, first_name, last_name, plain_text_reports')
            .eq('id', user.id)
            .single()

        setUsePlainText(!!profile?.plain_text_reports)

        const userDept = profile?.department

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
            if (busyIds.has(v.id)) return false
            return true
        }).map(v => ({
            ...v,
            kilometraje: kData?.find(k => k.vehiculo_id === v.id)?.ultimo_kilometraje || 0
        })) || []

        setVehiculos(available)

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
        const veh = selected as Vehiculo
        if (veh.assigned_driver_id && userIdToCheck && veh.assigned_driver_id !== userIdToCheck) {
            setPendingVehicle(veh)
            setConflictAlertOpen(true)
            return
        }

        commitVehicleChange(veh)
    }

    async function commitVehicleChange(selected: Vehiculo) {
        const value = selected.id
        setVehiculoId(value)
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

        if (!selectedVehicle?.odometro_averiado) {
            if (lastKm !== null && lastKm > 0 && km < lastKm) {
                toast.error(`El kilometraje (${km}) no puede ser menor al histórico (${lastKm} km). Verifique el tablero.`)
                return
            }
        }

        setLoading(true)
        try {
            const result = await submitExitReport({
                vehiculo_id: vehiculoId,
                conductor,
                departamento,
                km_salida: km,
                gasolina_salida: gasolina,
                observaciones_salida: observaciones,

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

                ups_salida: checks.ups ? 1 : 0,
                escalera_salida: checks.escalera,
                escalera_tijera_salida: checks.escalera_tijera,

                casco_salida: checks.casco,
                luces_salida: checks.luces,
                herramientas_salida: checks.herramientas,

                faults: faultsToAdd
            })

            if (!result.success) {
                throw new Error(result.error)
            }

            toast.success("Salida registrada correctamente")

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

        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Error al registrar salida")
        } finally {
            setLoading(false)
        }
    }

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

        if (faultsToAdd.length > 0) {
            msg += `*Fallas Reportadas:*\n`
            faultsToAdd.forEach(f => msg += `${bullet} ${f}\n`)
            msg += `\n`
        }

        return msg
    }

    const isMoto = selectedVehicle?.codigo?.startsWith('M-') || selectedVehicle?.tipo === 'Moto' || selectedVehicle?.modelo?.toLowerCase().includes('moto')
    const isEquiposDepartamento = departamento === 'Instalación' || departamento === 'Distribución' || departamento === 'Afectaciones'
    const isCarga = selectedVehicle?.tipo?.toLowerCase() === 'carga' || selectedVehicle?.modelo?.toLowerCase().includes('carga')

    if (initialLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">
                Cargando formulario de salida...
            </div>
        )
    }

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center justify-center">
                <div className="max-w-md w-full text-center space-y-6">
                    <CheckCircle className="w-10 h-10 text-neutral-900 mx-auto" strokeWidth={1.25} />
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-light tracking-tight text-neutral-900">
                            Salida registrada con éxito
                        </h1>
                        <p className="text-sm text-neutral-500">
                            La unidad ha sido despachada y la pre-operación quedó asentada en el sistema.
                        </p>
                    </div>

                    <div className="pt-6 border-t border-neutral-100 flex flex-col items-center gap-4">
                        <button
                            type="button"
                            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, '_blank')}
                            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors active:scale-[0.985] cursor-pointer"
                        >
                            <Send className="w-4 h-4" strokeWidth={1.25} />
                            Compartir reporte en WhatsApp
                        </button>
                        <Link
                            href="/transporte"
                            className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            Volver al panel de transporte
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-12">
            <div className="max-w-3xl w-full mx-auto space-y-8 sm:space-y-10">

                {/* HEADER */}
                <header className="pb-6 border-b border-neutral-100 space-y-4">
                    <Link
                        href="/transporte"
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
                        Volver a transporte
                    </Link>

                    <div className="space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900">
                            Registrar salida
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500">
                            Formulario de pre-operación e inspección vehicular.
                        </p>
                    </div>
                </header>

                {/* FORM CONTENT */}
                <div className="space-y-10">

                    {/* SECTION 1: VEHÍCULO Y OPERACIÓN */}
                    <section className="space-y-6 pb-8 border-b border-neutral-100">
                        <div className="space-y-1">
                            <h2 className="text-sm font-medium text-neutral-900">Información del vehículo y ruta</h2>
                            <p className="text-xs text-neutral-500">Datos operativos antes de iniciar el recorrido.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                            {/* Vehículo */}
                            <div className="sm:col-span-2 space-y-2">
                                <Label className="text-xs text-neutral-400">Vehículo asignado</Label>
                                {initialVehicleId && selectedVehicle ? (
                                    <div className="py-2.5 flex items-center justify-between border-b border-neutral-200">
                                        <div className="flex items-center gap-3">
                                            <Car className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.25} />
                                            <div>
                                                <p className="text-sm font-medium text-neutral-900">{selectedVehicle.modelo}</p>
                                                <p className="text-xs font-mono text-neutral-500 mt-0.5">
                                                    {selectedVehicle.placa} {selectedVehicle.codigo && `· ${selectedVehicle.codigo}`}
                                                </p>
                                            </div>
                                        </div>
                                        {lastKm !== null && (
                                            <span className="text-xs text-neutral-400 font-mono tabular-nums">
                                                Anterior: {lastKm.toLocaleString()} km
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <VehicleSelector
                                            vehicles={vehiculos}
                                            selectedVehicleId={vehiculoId}
                                            onSelect={handleVehicleChange}
                                            label="Seleccionar unidad"
                                        />
                                        {lastKm !== null && (
                                            <p className="text-xs text-neutral-400 font-mono text-right tabular-nums">
                                                Último registro: {lastKm.toLocaleString()} km
                                            </p>
                                        )}
                                    </div>
                                )}
                                {selectedVehicle?.odometro_averiado && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        Odómetro reportado con avería. Registre el valor visible en el tablero.
                                    </p>
                                )}
                            </div>

                            {/* Kilometraje de salida */}
                            <div className="space-y-1.5">
                                <Label htmlFor="km_salida" className="text-xs text-neutral-400">Kilometraje actual</Label>
                                <input
                                    id="km_salida"
                                    type="number"
                                    value={kmSalida}
                                    onChange={e => setKmSalida(e.target.value)}
                                    placeholder={lastKm ? `> ${lastKm}` : "0"}
                                    className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors font-mono tabular-nums"
                                />
                            </div>

                            {/* Nivel de combustible */}
                            <div className="space-y-2">
                                <Label className="text-xs text-neutral-400">Nivel de combustible</Label>
                                <div className="flex items-center gap-5 border-b border-neutral-200 pb-2 pt-1">
                                    {["Full", "3/4", "1/2", "1/4", "Reserva"].map((level) => (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => setGasolina(level)}
                                            className={`text-xs pb-1 transition-colors border-b-2 -mb-[9px] cursor-pointer ${
                                                gasolina === level
                                                    ? "border-neutral-900 text-neutral-900 font-medium"
                                                    : "border-transparent text-neutral-400 hover:text-neutral-700"
                                            }`}
                                        >
                                            {level === "Reserva" ? "Res" : level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Conductor */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-neutral-400">Conductor</Label>
                                <input
                                    value={conductor}
                                    readOnly
                                    className="w-full bg-transparent border-b border-neutral-200 py-1.5 text-sm text-neutral-600 outline-none cursor-not-allowed"
                                    placeholder="Identidad de conductor"
                                />
                            </div>

                            {/* Departamento / Uso */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-neutral-400">Departamento de uso</Label>
                                <CustomDropdown
                                    value={departamento}
                                    onChange={setDepartamento}
                                    placeholder="Seleccionar departamento"
                                    options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                                />
                            </div>
                        </div>
                    </section>

                    {/* SECTION 2: CHEQUEO TÉCNICO */}
                    <section className="space-y-4 pb-8 border-b border-neutral-100">
                        <div className="space-y-1">
                            <h2 className="text-sm font-medium text-neutral-900">Chequeo técnico</h2>
                            <p className="text-xs text-neutral-500">Verifique el estado operativo de los componentes clave.</p>
                        </div>

                        <div className="divide-y divide-neutral-100">
                            <div className="flex items-center justify-between py-3">
                                <Label htmlFor="aceite" className="text-sm text-neutral-700 font-normal cursor-pointer">
                                    Nivel de aceite de motor
                                </Label>
                                <Switch id="aceite" checked={checks.aceite} onCheckedChange={() => toggleCheck('aceite')} />
                            </div>

                            <div className="flex items-center justify-between py-3">
                                <Label htmlFor="luces" className="text-sm text-neutral-700 font-normal cursor-pointer">
                                    Sistema de luces e iluminación
                                </Label>
                                <Switch id="luces" checked={checks.luces} onCheckedChange={() => toggleCheck('luces')} />
                            </div>

                            <div className="flex items-center justify-between py-3">
                                <Label htmlFor="frenos" className="text-sm text-neutral-700 font-normal cursor-pointer">
                                    Sistema de frenos
                                </Label>
                                <Switch id="frenos" checked={checks.frenos} onCheckedChange={() => toggleCheck('frenos')} />
                            </div>

                            <div className="flex items-center justify-between gap-4 py-3">
                                <Label htmlFor="estado_cauchos" className="text-sm text-neutral-700 font-normal shrink-0">
                                    Estado de cauchos / neumáticos
                                </Label>
                                <div className="w-56 sm:w-64">
                                    <CustomDropdown
                                        id="estado_cauchos"
                                        value={estadoCauchos}
                                        onChange={setEstadoCauchos}
                                        placeholder="Seleccionar estado"
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

                            <div className="flex items-center justify-between py-3">
                                <Label htmlFor="corneta" className="text-sm text-neutral-700 font-normal cursor-pointer">
                                    Bocina / corneta
                                </Label>
                                <Switch id="corneta" checked={checks.corneta} onCheckedChange={() => toggleCheck('corneta')} />
                            </div>

                            {!isMoto && (
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="agua" className="text-sm text-neutral-700 font-normal cursor-pointer">
                                        Nivel de refrigerante / agua
                                    </Label>
                                    <Switch id="agua" checked={checks.agua} onCheckedChange={() => toggleCheck('agua')} />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECTION 3: SEGURIDAD Y HERRAMIENTAS */}
                    <section className="space-y-4 pb-8 border-b border-neutral-100">
                        <div className="space-y-1">
                            <h2 className="text-sm font-medium text-neutral-900">Seguridad y herramientas</h2>
                            <p className="text-xs text-neutral-500">Elementos reglamentarios a bordo.</p>
                        </div>

                        {!isMoto ? (
                            <div className="divide-y divide-neutral-100">
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="cinturones" className="text-sm text-neutral-700 font-normal cursor-pointer">Cinturones de seguridad</Label>
                                    <Switch id="cinturones" checked={checks.cinturones} onCheckedChange={() => toggleCheck('cinturones')} />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="conos" className="text-sm text-neutral-700 font-normal cursor-pointer">Conos de tráfico</Label>
                                    <Switch id="conos" checked={checks.conos} onCheckedChange={() => toggleCheck('conos')} />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="extintor" className="text-sm text-neutral-700 font-normal cursor-pointer">Extintor de incendios</Label>
                                    <Switch id="extintor" checked={checks.extintor} onCheckedChange={() => toggleCheck('extintor')} />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="botiquin" className="text-sm text-neutral-700 font-normal cursor-pointer">Botiquín de primeros auxilios</Label>
                                    <Switch id="botiquin" checked={checks.botiquin} onCheckedChange={() => toggleCheck('botiquin')} />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="gato" className="text-sm text-neutral-700 font-normal cursor-pointer">Gato hidráulico</Label>
                                    <Switch id="gato" checked={checks.gato} onCheckedChange={() => toggleCheck('gato')} />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="cruz" className="text-sm text-neutral-700 font-normal cursor-pointer">Llave cruz</Label>
                                    <Switch id="cruz" checked={checks.cruz} onCheckedChange={() => toggleCheck('cruz')} />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="triangulo" className="text-sm text-neutral-700 font-normal cursor-pointer">Triángulo de seguridad</Label>
                                    <Switch id="triangulo" checked={checks.triangulo} onCheckedChange={() => toggleCheck('triangulo')} />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="caucho" className="text-sm text-neutral-700 font-normal cursor-pointer">Caucho de repuesto</Label>
                                    <Switch id="caucho" checked={checks.caucho} onCheckedChange={() => toggleCheck('caucho')} />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="carpeta" className="text-sm text-neutral-700 font-normal cursor-pointer">Carpeta y documentos del vehículo</Label>
                                    <Switch id="carpeta" checked={checks.carpeta} onCheckedChange={() => toggleCheck('carpeta')} />
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y divide-neutral-100">
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="casco" className="text-sm text-neutral-700 font-normal cursor-pointer">Casco reglamentario</Label>
                                    <Switch id="casco" checked={checks.casco} onCheckedChange={() => toggleCheck('casco')} />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <Label htmlFor="herramientas" className="text-sm text-neutral-700 font-normal cursor-pointer">Kit básico de herramientas</Label>
                                    <Switch id="herramientas" checked={checks.herramientas} onCheckedChange={() => toggleCheck('herramientas')} />
                                </div>
                            </div>
                        )}
                    </section>

                    {/* SECTION 4: EQUIPOS ESPECIALES (SI APLICA) */}
                    {(isEquiposDepartamento || isCarga) && (
                        <section className="space-y-4 pb-8 border-b border-neutral-100">
                            <div className="space-y-1">
                                <h2 className="text-sm font-medium text-neutral-900">Equipamiento adicional</h2>
                                <p className="text-xs text-neutral-500">Herramientas asignadas por departamento o tipo de unidad.</p>
                            </div>

                            <div className="divide-y divide-neutral-100">
                                {departamento === 'Instalación' && !isMoto && (
                                    <div className="flex items-center justify-between py-3">
                                        <Label htmlFor="ups" className="text-sm text-neutral-700 font-normal cursor-pointer">Mini-UPS</Label>
                                        <Switch id="ups" checked={checks.ups} onCheckedChange={() => toggleCheck('ups')} />
                                    </div>
                                )}
                                {isEquiposDepartamento && !isMoto && (
                                    <div className="flex items-center justify-between py-3">
                                        <Label htmlFor="escalera" className="text-sm text-neutral-700 font-normal cursor-pointer">Escalera telescópica</Label>
                                        <Switch id="escalera" checked={checks.escalera} onCheckedChange={() => toggleCheck('escalera')} />
                                    </div>
                                )}
                                {isCarga && (
                                    <div className="flex items-center justify-between py-3">
                                        <Label htmlFor="escalera_tijera" className="text-sm text-neutral-700 font-normal cursor-pointer">Escalera de tijera</Label>
                                        <Switch id="escalera_tijera" checked={checks.escalera_tijera} onCheckedChange={() => toggleCheck('escalera_tijera')} />
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* SECTION 5: REPORTAR FALLAS O NOVEDADES */}
                    <section className="space-y-4 pb-8 border-b border-neutral-100">
                        <div className="space-y-1">
                            <h2 className="text-sm font-medium text-neutral-900">Reportar fallas o novedades</h2>
                            <p className="text-xs text-neutral-500">Agregue observaciones o averías detectadas antes de salir.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={newFaultText}
                                    onChange={(e) => setNewFaultText(e.target.value)}
                                    placeholder="Ej: Luz de freno derecha inoperativa..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            if (newFaultText.trim()) {
                                                setFaultsToAdd([...faultsToAdd, newFaultText.trim()])
                                                setNewFaultText("")
                                            }
                                        }
                                    }}
                                    className="flex-1 bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newFaultText.trim()) {
                                            setFaultsToAdd([...faultsToAdd, newFaultText.trim()])
                                            setNewFaultText("")
                                        }
                                    }}
                                    className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 shrink-0 cursor-pointer active:scale-[0.985]"
                                    aria-label="Agregar observación"
                                >
                                    <Plus className="w-4 h-4" strokeWidth={1.25} />
                                </button>
                            </div>

                            {faultsToAdd.length > 0 && (
                                <div className="divide-y divide-neutral-100 pt-1">
                                    {faultsToAdd.map((fault, idx) => (
                                        <div key={idx} className="group flex items-center justify-between py-2.5">
                                            <span className="text-sm text-neutral-700">{fault}</span>
                                            <button
                                                type="button"
                                                onClick={() => setFaultsToAdd(prev => prev.filter((_, i) => i !== idx))}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900 p-1 cursor-pointer"
                                                aria-label="Eliminar falla"
                                            >
                                                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ACTION BAR */}
                    <div className="pt-2 flex items-center justify-between gap-4">
                        <Link
                            href="/transporte"
                            className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="text-xs sm:text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-all duration-150 active:scale-[0.985] disabled:opacity-40 cursor-pointer"
                        >
                            {loading ? "Registrando salida..." : "Confirmar salida"}
                        </button>
                    </div>

                </div>

            </div>

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
        </main>
    )
}

export default function SalidaPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">Cargando formulario...</div>}>
            <SalidaContent />
        </Suspense>
    )
}

