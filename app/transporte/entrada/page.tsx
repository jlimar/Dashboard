"use client"

import { useState, useEffect, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { Car, ArrowLeft, Plus, CheckCircle, Send, X } from "lucide-react"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { getActiveFaults, submitEntryReport } from "@/app/transporte/actions"
import { TireConditionSelector } from "@/components/tire-condition-selector"

type Reporte = {
    id: string
    vehiculo_id: string
    km_salida: number
    conductor: string
    departamento: string
    created_at: string
    vehiculos: {
        modelo: string
        placa: string
        codigo: string
        tipo: string
        department?: string
        odometro_averiado?: boolean
        kilometraje?: number
    }
}

function EntradaContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialVehicleId = searchParams.get('vehicle_id') || ""

    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [reportes, setReportes] = useState<Reporte[]>([])
    const [reporteId, setReporteId] = useState("")
    const [kmEntrada, setKmEntrada] = useState("")
    const [estadoCauchos, setEstadoCauchos] = useState<string>('')
    const [selectedReport, setSelectedReport] = useState<Reporte | null>(null)
    const [gasolina, setGasolina] = useState("Full")
    const [observaciones, setObservaciones] = useState("")
    const [faultsToAdd, setFaultsToAdd] = useState<string[]>([])
    const [activeFaults, setActiveFaults] = useState<any[]>([])
    const [newFaultText, setNewFaultText] = useState("")
    const [usePlainText, setUsePlainText] = useState(false)
    const [step, setStep] = useState<'form' | 'success'>('form')
    const [whatsappText, setWhatsappText] = useState("")
    const [anomalyConfirmOpen, setAnomalyConfirmOpen] = useState(false)
    const [pendingKmDiff, setPendingKmDiff] = useState(0)

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
        casco: false,
        luces: false,
        herramientas: false,
        caucho: false,
        onu: false
    })

    useEffect(() => {
        loadPendingReports().then((data) => {
            if (initialVehicleId && data) {
                const matchingReport = data.find((r: any) => r.vehiculo_id === initialVehicleId)
                if (matchingReport) {
                    handleReportChange(matchingReport.id, data)
                }
            }
            setInitialLoading(false)
        })
    }, [initialVehicleId])

    useEffect(() => {
        if (selectedReport && selectedReport.vehiculo_id) {
            getActiveFaults(selectedReport.vehiculo_id)
                .then((faults: any[]) => {
                    if (faults) setActiveFaults(faults)
                })
                .catch((err: any) => console.error("Error loading faults:", err))
        } else {
            setActiveFaults([])
        }
    }, [selectedReport])

    async function loadPendingReports() {
        const supabase = createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return []
        }

        // Fetch Profile and Pending Reports in PARALLEL
        const [profileRes, reportesRes] = await Promise.all([
            supabase
                .from('profiles')
                .select('plain_text_reports')
                .eq('id', user.id)
                .single(),
            supabase
                .from('reportes')
                .select(`
                    id, 
                    vehiculo_id,
                    km_salida, 
                    conductor,
                    departamento,
                    created_at,
                    vehiculos ( modelo, placa, codigo, tipo, department, odometro_averiado, kilometraje )
                `)
                .is('km_entrada', null)
                .order('created_at', { ascending: false })
        ])

        const profile = profileRes.data
        const data = reportesRes.data

        setUsePlainText(!!profile?.plain_text_reports)

        if (data) {
            // @ts-ignore
            setReportes(data)
            return data
        }
        return []
    }

    const handleReportChange = (value: string, reportList?: Reporte[]) => {
        setReporteId(value)
        const list = reportList || reportes
        const report = list.find(r => r.id === value) || null
        setSelectedReport(report)

        setChecks({
            aceite: false, agua: false, gato: false, cruz: false,
            triangulo: false, carpeta: false,
            cinturones: false, conos: false, extintor: false, botiquin: false,
            frenos: false, corneta: false,
            onu: false, ups: false, escalera: false, escalera_tijera: false,
            casco: false, luces: false, herramientas: false, caucho: false
        })
    }

    const toggleCheck = (key: keyof typeof checks) => {
        setChecks(prev => ({ ...prev, [key]: !prev[key] }))
    }

    async function handleSubmit() {
        if (!reporteId) {
            toast.error("Seleccione el viaje o vehículo a cerrar")
            return
        }
        if (!kmEntrada) {
            toast.error("Ingrese el kilometraje de llegada")
            return
        }
        if (!estadoCauchos) {
            toast.error("Por favor seleccione el estado de los cauchos")
            return
        }

        const km = parseInt(kmEntrada)
        const isOdometerBroken = (selectedReport?.vehiculos as any)?.odometro_averiado

        if (!isOdometerBroken) {
            const minKm = Math.max(selectedReport?.km_salida || 0, (selectedReport?.vehiculos as any)?.kilometraje || 0)
            if (km <= minKm) {
                toast.error(`El kilometraje de entrada (${km}) no puede ser menor o igual al último registrado (${minKm} km). Verifique el tablero.`)
                return
            }
        }

        const diff = selectedReport ? km - selectedReport.km_salida : 0
        if (diff > 1000 && !isOdometerBroken) {
            setPendingKmDiff(diff)
            setAnomalyConfirmOpen(true)
            return
        }

        await executeSubmit(km)
    }

    async function executeSubmit(km: number) {
        setLoading(true)
        try {
            const result = await submitEntryReport({
                reporte_id: reporteId,
                vehiculo_id: selectedReport?.vehiculo_id,
                km_entrada: km,
                gasolina_entrada: gasolina,

                aceite_entrada: checks.aceite,
                agua_entrada: checks.agua,
                frenos_entrada: checks.frenos,
                estado_cauchos_entrada: estadoCauchos,
                corneta_entrada: checks.corneta,

                gato_entrada: checks.gato,
                cruz_entrada: checks.cruz,
                triangulo_entrada: checks.triangulo,
                carpeta_entrada: checks.carpeta,
                cinturones_entrada: checks.cinturones,
                conos_entrada: checks.conos,
                extintor_entrada: checks.extintor,
                botiquin_entrada: checks.botiquin,
                caucho_entrada: checks.caucho,

                casco_entrada: checks.casco,
                luces_entrada: checks.luces,
                herramientas_entrada: checks.herramientas,

                onu_entrada: checks.onu,
                ups_entrada: checks.ups,
                escalera_entrada: checks.escalera,
                escalera_tijera_entrada: checks.escalera_tijera,

                faults: faultsToAdd
            })

            if (!result.success) {
                throw new Error(result.error)
            }

            toast.success("Entrada registrada correctamente")

            if (selectedReport) {
                const text = formatEntradaText({
                    km_entrada: km,
                    gasolina_entrada: gasolina,
                    observaciones_entrada: observaciones,
                    aceite_entrada: checks.aceite,
                    agua_entrada: checks.agua,
                    frenos_entrada: checks.frenos,
                    estado_cauchos_entrada: estadoCauchos,
                    corneta_entrada: checks.corneta,
                    gato_entrada: checks.gato,
                    cruz_entrada: checks.cruz,
                    triangulo_entrada: checks.triangulo,
                    carpeta_entrada: checks.carpeta,
                    cinturones_entrada: checks.cinturones,
                    conos_entrada: checks.conos,
                    extintor_entrada: checks.extintor,
                    botiquin_entrada: checks.botiquin,
                    casco_entrada: checks.casco,
                    luces_entrada: checks.luces,
                    herramientas_entrada: checks.herramientas,
                    caucho_entrada: checks.caucho,
                    escalera_tijera_entrada: checks.escalera_tijera,
                    ups_entrada: checks.ups ? 1 : 0,
                    escalera_entrada: checks.escalera
                }, selectedReport)

                setWhatsappText(text)
                setStep('success')
            }

        } catch (error) {
            console.error(error)
            toast.error("Error al registrar entrada: " + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const formatEntradaText = (entradaData: any, reporteOriginal: Reporte) => {
        const check = (val: boolean | number) => usePlainText ? (val ? '[SI]' : '[NO]') : (val ? '✅' : '❌')
        const bulletWarning = usePlainText ? '!' : '⚠️'
        const bulletError = usePlainText ? '-' : '❌'

        const fechaSalidaObj = new Date(reporteOriginal.created_at)
        const fechaEntradaObj = new Date()

        const fechaEntrada = fechaEntradaObj.toLocaleDateString()
        const horaSalida = fechaSalidaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const horaEntrada = fechaEntradaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

        // @ts-ignore
        const vData = reporteOriginal.vehiculos
        const vehiculo = Array.isArray(vData) ? vData[0] : vData

        const vehiculoNombre = vehiculo ? vehiculo.modelo : 'Desconocido'
        const kmRecorrido = Number(entradaData.km_entrada) - Number(reporteOriginal.km_salida)
        const isMoto = vehiculo?.codigo?.startsWith('M-') || vehiculo?.tipo === 'Moto' || vehiculo?.modelo?.toLowerCase().includes('moto') || false

        let msg = `*Reporte de Entrada*\n\n`
        msg += `Fecha (Entrada): ${fechaEntrada}\n`
        msg += `Hora (Salida): ${horaSalida}\n`
        msg += `Hora (Entrada): ${horaEntrada}\n\n`

        msg += `Conductor: ${reporteOriginal.conductor}\n`
        msg += `Departamento: ${reporteOriginal.departamento}\n\n`

        msg += `Vehículo: ${vehiculoNombre}\n`
        if (vehiculo?.placa) msg += `Placa: ${vehiculo.placa}\n`
        msg += `Kilometraje (Salida): ${reporteOriginal.km_salida}\n`
        msg += `Kilometraje (Entrada): ${entradaData.km_entrada}\n`
        msg += `Kilometraje Recorrido: ${kmRecorrido}\n`
        msg += `Nivel de Gasolina: ${entradaData.gasolina_entrada}\n\n`

        msg += `*Chequeo Técnico:*\n`
        msg += `Chequeo de Aceite: ${check(entradaData.aceite_entrada)}\n`
        msg += `Sistema de iluminación: ${check(entradaData.luces_entrada)}\n`
        msg += `Sistema de frenos: ${check(entradaData.frenos_entrada)}\n`
        msg += `Cauchos: ${entradaData.estado_cauchos_entrada || 'No especificado'}\n`
        msg += `Corneta: ${check(entradaData.corneta_entrada)}\n`
        if (!isMoto) {
            msg += `Agua / Refrigerante: ${check(entradaData.agua_entrada)}\n\n`
        } else {
            msg += `\n`
        }

        if (!isMoto) {
            msg += `*Herramientas y Seguridad:*\n`
            msg += `Cinturones de seguridad: ${check(entradaData.cinturones_entrada)}\n`
            msg += `Conos de tráfico: ${check(entradaData.conos_entrada)}\n`
            msg += `Extintor de incendios: ${check(entradaData.extintor_entrada)}\n`
            msg += `Botiquín de primeros auxilios: ${check(entradaData.botiquin_entrada)}\n`
            msg += `Gato: ${check(entradaData.gato_entrada)}\n`
            msg += `Llave Cruz: ${check(entradaData.cruz_entrada)}\n`
            msg += `Triángulo: ${check(entradaData.triangulo_entrada)}\n`
            msg += `Caucho de repuesto: ${check(entradaData.caucho_entrada)}\n`
            msg += `Carpeta de Permisos: ${check(entradaData.carpeta_entrada)}\n`
        } else {
            msg += `*Herramientas y Seguridad (Moto):*\n`
            msg += `Casco: ${check(entradaData.casco_entrada)}\n`
            msg += `Herramientas: ${check(entradaData.herramientas_entrada)}\n`
        }

        const isEquiposOriginal = reporteOriginal.departamento === 'Instalación' || reporteOriginal.departamento === 'Distribución' || reporteOriginal.departamento === 'Afectaciones'
        const isEquiposEntrada = entradaData.departamento === 'Instalación' || entradaData.departamento === 'Distribución' || entradaData.departamento === 'Afectaciones'

        if ((vehiculo?.department === 'Instalación' || vehiculo?.department === 'Distribución' || vehiculo?.department === 'Afectaciones' || isEquiposOriginal || isEquiposEntrada) && !isMoto) {
            msg += `\n*Equipos Asignados:*\n`
            if (reporteOriginal.departamento === 'Instalación' || entradaData.departamento === 'Instalación') {
                msg += `Mini-UPS: ${check(entradaData.ups_entrada)}\n`
            }
            msg += `Escalera telescópica: ${check(entradaData.escalera_entrada)}\n`
        }

        const isCarga = vehiculo?.tipo?.toLowerCase() === 'carga' || vehiculo?.modelo?.toLowerCase().includes('carga')
        if (isCarga) {
            msg += `\n*Equipos de Carga:*\n`
            msg += `Escalera de Tijera: ${check(entradaData.escalera_tijera_entrada)}\n`
        }

        if (activeFaults.length > 0) {
            msg += `\n*Fallas Pendientes (Anteriores):*\n`
            activeFaults.forEach(f => msg += `${bulletWarning} ${f.descripcion.replace('[Reporte Salida] ', '').replace('[Reporte Entrada] ', '')}\n`)
        }

        if (faultsToAdd.length > 0) {
            msg += `\n*Nuevas Fallas Reportadas:*\n`
            faultsToAdd.forEach(f => msg += `${bulletError} ${f}\n`)
        }

        return msg
    }

    const v = selectedReport?.vehiculos
    const isMoto = v?.codigo?.startsWith('M-') || v?.tipo === 'Moto' || v?.modelo?.toLowerCase().includes('moto')
    const isEquiposDepartamento = selectedReport?.departamento === 'Instalación' || selectedReport?.departamento === 'Distribución' || selectedReport?.departamento === 'Afectaciones'
    const isCarga = v?.tipo?.toLowerCase() === 'carga' || v?.modelo?.toLowerCase().includes('carga')

    if (initialLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">
                Cargando formulario de entrada...
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
                            Entrada registrada con éxito
                        </h1>
                        <p className="text-sm text-neutral-500">
                            La unidad ha completado su recorrido y fue liberada en el sistema.
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
                            Registrar entrada
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500">
                            Cierre de ruta, comprobación de kilometraje e inspección final.
                        </p>
                    </div>
                </header>

                {/* FORM CONTENT */}
                <div className="space-y-10">

                    {/* SECTION 1: VIAJE ACTIVO Y DATOS DE ENTRADA */}
                    <section className="space-y-6 pb-8 border-b border-neutral-100">
                        <div className="space-y-1">
                            <h2 className="text-sm font-medium text-neutral-900">Viaje en ruta</h2>
                            <p className="text-xs text-neutral-500">Seleccione la salida abierta para asentar el retorno.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                            {/* Viaje activo selector */}
                            <div className="sm:col-span-2 space-y-2">
                                <Label className="text-xs text-neutral-400">Viaje activo</Label>
                                {reportes.length === 0 ? (
                                    <div className="py-4 text-xs text-neutral-400 border-b border-neutral-100 italic">
                                        No hay viajes activos pendientes por registrar entrada.
                                    </div>
                                ) : initialVehicleId && selectedReport ? (
                                    <div className="py-2.5 flex items-center justify-between border-b border-neutral-200">
                                        <div className="flex items-center gap-3">
                                            <Car className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.25} />
                                            <div>
                                                <p className="text-sm font-medium text-neutral-900">{selectedReport.vehiculos.modelo}</p>
                                                <p className="text-xs font-mono text-neutral-500 mt-0.5">
                                                    {selectedReport.vehiculos.placa} · Salida: {selectedReport.km_salida.toLocaleString()} km
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-neutral-500">{selectedReport.conductor}</span>
                                    </div>
                                ) : (
                                    <CustomDropdown
                                        value={reporteId}
                                        onChange={(val) => handleReportChange(val)}
                                        placeholder="Seleccionar viaje pendiente"
                                        options={reportes.map((r) => ({
                                            value: r.id,
                                            label: `${r.vehiculos.modelo} (${r.vehiculos.placa}) - Salida: ${r.km_salida} km · ${r.conductor}`
                                        }))}
                                    />
                                )}
                            </div>

                            {/* Kilometraje de entrada */}
                            <div className="space-y-1.5">
                                <Label htmlFor="km_entrada" className="text-xs text-neutral-400">Kilometraje de llegada</Label>
                                <input
                                    id="km_entrada"
                                    type="number"
                                    value={kmEntrada}
                                    onChange={e => setKmEntrada(e.target.value)}
                                    placeholder={selectedReport ? `> ${selectedReport.km_salida}` : "0"}
                                    className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors font-mono tabular-nums"
                                />
                                {selectedReport && kmEntrada && parseInt(kmEntrada) >= selectedReport.km_salida && (
                                    <p className="text-xs text-neutral-400 font-mono mt-1">
                                        Recorrido en este viaje: {(parseInt(kmEntrada) - selectedReport.km_salida).toLocaleString()} km
                                    </p>
                                )}
                            </div>

                            {/* Nivel de combustible al retornar */}
                            <div className="space-y-2">
                                <Label className="text-xs text-neutral-400">Nivel de combustible final</Label>
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
                        </div>
                    </section>

                    {/* SECTION 2: CHEQUEO TÉCNICO AL REGRESO */}
                    <section className="space-y-4 pb-8 border-b border-neutral-100">
                        <div className="space-y-1">
                            <h2 className="text-sm font-medium text-neutral-900">Inspección de retorno</h2>
                            <p className="text-xs text-neutral-500">Verifique las condiciones al finalizar la ruta.</p>
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

                            {/* ESTADO DE CAUCHOS / NEUMÁTICOS - DESTACADO Y ACCESIBLE */}
                            <TireConditionSelector
                                id="estado_cauchos"
                                value={estadoCauchos}
                                onChange={setEstadoCauchos}
                            />

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
                            <p className="text-xs text-neutral-500">Confirmación de inventario al regresar.</p>
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

                    {/* SECTION 4: EQUIPOS ESPECIALES */}
                    {(isEquiposDepartamento || isCarga) && (
                        <section className="space-y-4 pb-8 border-b border-neutral-100">
                            <div className="space-y-1">
                                <h2 className="text-sm font-medium text-neutral-900">Equipamiento adicional</h2>
                                <p className="text-xs text-neutral-500">Verificación de equipos retornados.</p>
                            </div>

                            <div className="divide-y divide-neutral-100">
                                {selectedReport?.departamento === 'Instalación' && !isMoto && (
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

                    {/* SECTION 5: FALLAS ACTIVAS Y NUEVAS NOVEDADES */}
                    <section className="space-y-4 pb-8 border-b border-neutral-100">
                        <div className="space-y-1">
                            <h2 className="text-sm font-medium text-neutral-900">Novedades y fallas detectadas</h2>
                            <p className="text-xs text-neutral-500">Historial de fallas y reporte de nuevas incidencias al regreso.</p>
                        </div>

                        {activeFaults.length > 0 && (
                            <div className="space-y-2 pb-4 border-b border-neutral-100">
                                <Label className="text-xs text-neutral-400">Fallas previas pendientes en taller</Label>
                                <div className="space-y-1.5">
                                    {activeFaults.map((f, i) => (
                                        <p key={i} className="text-xs text-amber-600 font-mono">
                                            · {f.descripcion.replace('[Reporte Salida] ', '').replace('[Reporte Entrada] ', '')}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={newFaultText}
                                    onChange={(e) => setNewFaultText(e.target.value)}
                                    placeholder="Ej: Falla en embrague, ruido en suspensión..."
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
                                    aria-label="Agregar falla"
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
                            disabled={loading || reportes.length === 0}
                            className="text-xs sm:text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-all duration-150 active:scale-[0.985] disabled:opacity-40 cursor-pointer"
                        >
                            {loading ? "Registrando entrada..." : "Confirmar entrada"}
                        </button>
                    </div>

                </div>

            </div>

            {/* Anomaly Confirm Dialog */}
            <DeleteConfirmDialog
                open={anomalyConfirmOpen}
                onOpenChange={setAnomalyConfirmOpen}
                title="Advertencia de kilometraje inusual"
                description={`El recorrido ingresado (${pendingKmDiff.toLocaleString()} km) es muy superior al promedio por viaje. ¿Confirma que la lectura del odómetro es correcta?`}
                confirmLabel="Confirmar lectura"
                cancelLabel="Revisar"
                destructive={false}
                onConfirm={() => {
                    setAnomalyConfirmOpen(false)
                    if (kmEntrada) {
                        executeSubmit(parseInt(kmEntrada))
                    }
                }}
            />
        </main>
    )
}

export default function EntradaPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">Cargando formulario...</div>}>
            <EntradaContent />
        </Suspense>
    )
}

