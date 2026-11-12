"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle, Send, Plus, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { VehicleSelector } from "@/components/vehicle-selector"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getActiveFaults, submitEntryReport } from "@/app/transporte/actions" // [UPDATED]

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
        odometro_averiado?: boolean
        kilometraje?: number
    }
}

type EntradaFormDialogProps = {
    isOpen: boolean
    onClose: () => void
    initialVehicleId?: string
    onSuccess?: () => void
}

export function EntradaFormDialog({ isOpen, onClose, initialVehicleId, onSuccess }: EntradaFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [reportes, setReportes] = useState<Reporte[]>([])
    const [reporteId, setReporteId] = useState("")
    const [kmEntrada, setKmEntrada] = useState("")
    const [estadoCauchos, setEstadoCauchos] = useState<string>('')
    const [selectedReport, setSelectedReport] = useState<Reporte | null>(null)
    const [gasolina, setGasolina] = useState("Full")
    const [observaciones, setObservaciones] = useState("")
    const [faultsToAdd, setFaultsToAdd] = useState<string[]>([]) // [NEW] Explicit faults
    const [activeFaults, setActiveFaults] = useState<any[]>([]) // [NEW] Existing active faults from DB
    const [newFaultText, setNewFaultText] = useState("")
    const [usePlainText, setUsePlainText] = useState(false)
    const [step, setStep] = useState<'form' | 'success'>('form')
    const [whatsappText, setWhatsappText] = useState("")
    const [anomalyConfirmOpen, setAnomalyConfirmOpen] = useState(false)
    const [pendingKmDiff, setPendingKmDiff] = useState(0)
    const router = useRouter()

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

    // [FIX] Effect 1: Load Reports on Open (Initial Load Only)
    useEffect(() => {
        if (isOpen) {
            setStep('form') // Reset step
            loadPendingReports().then((data) => {
                if (initialVehicleId && data) {
                    const matchingReport = data.find((r: any) => r.vehiculo_id === initialVehicleId)
                    if (matchingReport) {
                        setReporteId(matchingReport.id)
                        // Supabase sometimes returns single relation as array or object depending on query
                        // @ts-ignore
                        setSelectedReport(matchingReport) // [FIX] TS Error ignored as structure is compatible at runtime

                        setChecks({
                            aceite: false, agua: false, gato: false, cruz: false,
                            triangulo: false, carpeta: false,
                            cinturones: false, conos: false, extintor: false, botiquin: false,
                            frenos: false, corneta: false,
                            onu: false, ups: false, escalera: false,
                            casco: false, luces: false, herramientas: false
                        })
                    }
                }
            })
        }
    }, [isOpen, initialVehicleId])

    // [FIX] Effect 2: Fetch Active Faults when Selected Report Changes
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
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('plain_text_reports')
                .eq('id', user.id)
                .single()
            setUsePlainText(!!profile?.plain_text_reports)
        }

        const { data } = await supabase
            .from('reportes')
            .select(`
                id, 
                vehiculo_id,
                km_salida, 
                conductor,
                departamento,
                created_at,
                created_at,
                vehiculos ( modelo, placa, codigo, tipo, odometro_averiado, kilometraje )
            `)
            .is('km_entrada', null)
            .order('created_at', { ascending: false })

        // @ts-ignore
        if (data) setReportes(data)
        return data
    }

    const handleReportChange = async (value: string) => {
        setReporteId(value)
        const report = reportes.find(r => r.id === value) || null
        setSelectedReport(report)
        // Reset checks on change
        setChecks({
            aceite: false, agua: false, gato: false, cruz: false,
            triangulo: false, carpeta: false,
            cinturones: false, conos: false, extintor: false, botiquin: false,
            frenos: false, corneta: false,
            onu: false, ups: false, escalera: false,
            casco: false, luces: false, herramientas: false
        })

        // [NEW] Fetch Active Faults via Server Action
        if (report && report.vehiculo_id) {
            getActiveFaults(report.vehiculo_id)
                .then(faults => {
                    if (faults) setActiveFaults(faults)
                })
                .catch(err => console.error("Error loading faults:", err))
        } else {
            setActiveFaults([])
        }
    }

    const toggleCheck = (key: keyof typeof checks) => {
        setChecks(prev => ({ ...prev, [key]: !prev[key] }))
    }

    async function handleSubmit() {
        if (!reporteId || !kmEntrada || !estadoCauchos) {
            toast.error("Complete todos los campos obligatorios")
            return
        }

        const km = parseInt(kmEntrada)


        // [FIX] Strict Validation
        // Bypass if odometer broken
        const isOdometerBroken = (selectedReport?.vehiculos as any)?.odometro_averiado

        if (!isOdometerBroken) {
            const minKm = Math.max(selectedReport?.km_salida || 0, (selectedReport?.vehiculos as any)?.kilometraje || 0)
            if (km <= minKm) {
                toast.error(`Error Crítico: El KM de entrada (${km}) NO puede ser menor o igual al último registrado (${minKm}). Verifique el tablero.`)
                return
            }
        }

        // [NEW] Anomaly Detection (Warning)
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
            // [NEW] Use Unified Server Action
            const result = await submitEntryReport({
                reporte_id: reporteId,
                vehiculo_id: selectedReport?.vehiculo_id, // Passed implicitly via report association but good for reference if needed

                km_entrada: km,
                gasolina_entrada: gasolina,

                // Chequeo Técnico
                aceite_entrada: checks.aceite,
                agua_entrada: checks.agua,
                frenos_entrada: checks.frenos,
                estado_cauchos_entrada: estadoCauchos,
                corneta_entrada: checks.corneta,

                // Car specific
                gato_entrada: checks.gato,
                cruz_entrada: checks.cruz,
                triangulo_entrada: checks.triangulo,
                carpeta_entrada: checks.carpeta,
                cinturones_entrada: checks.cinturones,
                conos_entrada: checks.conos,
                extintor_entrada: checks.extintor,
                botiquin_entrada: checks.botiquin,

                // Moto specific
                casco_entrada: checks.casco,
                luces_entrada: checks.luces,
                herramientas_entrada: checks.herramientas,

                onu_entrada: checks.onu,
                ups_entrada: checks.ups,
                escalera_entrada: checks.escalera,
                escalera_tijera_entrada: checks.escalera_tijera,

                // Explicit Faults
                faults: faultsToAdd
            })

            if (!result.success) {
                throw new Error(result.error)
            }

            toast.success("Entrada registrada correctamente")

            // --- WhatsApp Integration ---
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

            // Trigger background refresh
            router.refresh()
            if (onSuccess) onSuccess()

            // Reset form fields
            setReporteId("")
            setKmEntrada("")
            // setSelectedReport(null) // Keep selectedReport for success view formatting
            setGasolina("Full")
            setFaultsToAdd([])
            setNewFaultText("")
            setActiveFaults([])
            setChecks({
                aceite: false, agua: false, gato: false, cruz: false,
                triangulo: false, carpeta: false,
                cinturones: false, conos: false, extintor: false, botiquin: false,
                frenos: false, corneta: false,
                ups: false, escalera: false, escalera_tijera: false,
                casco: false, luces: false, herramientas: false
            })
            setObservaciones("")
            setEstadoCauchos("")

        } catch (error) {
            console.error(error)
            toast.error("Error al registrar entrada: " + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    // Helpers
    const formatEntradaText = (entradaData: any, reporteOriginal: Reporte) => {
        const check = (val: boolean | number) => usePlainText ? (val ? '[SI]' : '[NO]') : (val ? '✅' : '❌')
        const bulletWarning = usePlainText ? '!' : '⚠️'
        const bulletError = usePlainText ? '-' : '❌'

        // Calcular fechas y horas
        const fechaSalidaObj = new Date(reporteOriginal.created_at)
        const fechaEntradaObj = new Date()

        const fechaEntrada = fechaEntradaObj.toLocaleDateString()
        const horaSalida = fechaSalidaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const horaEntrada = fechaEntradaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

        // vehiculos is an object in Reporte type based on our interface, but Supabase may return an array if not 1:1 strictly enforced in types
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

    // Helpers conditions
    // Note: In Entrada, we use selectedReport.vehiculos which is an object
    const v = selectedReport?.vehiculos
    const isMoto = v?.codigo?.startsWith('M-') || v?.tipo === 'Moto' || v?.modelo?.toLowerCase().includes('moto')
    const isEquiposDepartamento = selectedReport?.departamento === 'Instalación' || selectedReport?.departamento === 'Distribución' || selectedReport?.departamento === 'Afectaciones'
    const isCarga = v?.tipo?.toLowerCase() === 'carga' || v?.modelo?.toLowerCase().includes('carga')


    return (
        <>
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
                                <h2 className="text-lg font-medium text-neutral-900">¡Entrada registrada!</h2>
                                <p className="text-neutral-500 text-sm">El vehículo ha sido recibido correctamente.</p>
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
                                <DialogTitle className="text-lg font-medium text-neutral-900">Registrar entrada</DialogTitle>
                                <DialogDescription className="text-xs text-neutral-500">Cierre de ruta y novedades</DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2 col-span-2">
                                        <VehicleSelector
                                            vehicles={reportes.map(r => ({
                                                id: r.vehiculo_id,
                                                placa: r.vehiculos.placa,
                                                modelo: r.vehiculos.modelo,
                                                codigo: r.vehiculos.codigo,
                                                tipo: r.vehiculos.tipo,
                                            }))}
                                            selectedVehicleId={selectedReport?.vehiculo_id}
                                            onSelect={(v) => {
                                                if (v) {
                                                    const r = reportes.find(rep => rep.vehiculo_id === v.id)
                                                    if (r) handleReportChange(r.id)
                                                } else {
                                                    setReporteId("")
                                                    setSelectedReport(null)
                                                    setActiveFaults([])
                                                }
                                            }}
                                            label="Vehículo en ruta"
                                        />
                                        {selectedReport && (
                                            <div className="mt-2 space-y-1">
                                                {(selectedReport.vehiculos as any)?.odometro_averiado && (
                                                    <p className="text-xs text-neutral-600">
                                                        <span className="font-medium text-red-600">Odómetro averiado:</span> Se permite ingresar el mismo kilometraje de salida.
                                                    </p>
                                                )}
                                                <p className="text-xs text-neutral-500 text-right">
                                                    Conductor: {selectedReport.conductor} · Salida: {selectedReport.km_salida.toLocaleString()} km
                                                    {selectedReport.vehiculos?.kilometraje && selectedReport.vehiculos.kilometraje > selectedReport.km_salida && (
                                                        <span className="text-neutral-900 font-medium block mt-0.5">
                                                            Posición actual: {selectedReport.vehiculos.kilometraje.toLocaleString()} km
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5 col-span-2">
                                        <Label className="text-xs font-medium text-neutral-500">Kilometraje llegada</Label>
                                        <Input
                                            type="number"
                                            value={kmEntrada}
                                            onChange={e => setKmEntrada(e.target.value)}
                                            placeholder={selectedReport ? `> ${Math.max(selectedReport.km_salida, selectedReport.vehiculos?.kilometraje || 0)}` : "0"}
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
                                </div>

                                {/* Checks section */}
                                <div className="space-y-6 pt-2">
                                    {/* TÉCNICO */}
                                    <div>
                                        <h4 className="text-xs font-medium text-neutral-400 mb-2">
                                            Chequeo técnico (Llegada)
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
                                    {!isMoto && selectedReport && (
                                        <div className="pt-4 border-t border-neutral-100">
                                            <h4 className="text-xs font-medium text-neutral-400 mb-2">
                                                Herramientas (Verificar devolución)
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
                                    {isMoto && selectedReport && (
                                        <div className="pt-4 border-t border-neutral-100">
                                            <h4 className="text-xs font-medium text-neutral-400 mb-2">
                                                Seguridad moto (Verificar devolución)
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
                                                {selectedReport?.departamento === 'Instalación' && (
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

                                    {activeFaults.length > 0 && (
                                        <div className="space-y-1 text-xs text-neutral-500">
                                            <p className="font-medium text-neutral-700">
                                                Ya reportado (No duplicar):
                                            </p>
                                            <ul className="space-y-0.5">
                                                {activeFaults.map((f, i) => (
                                                    <li key={i} className="flex items-start gap-1.5">
                                                        <span>·</span>
                                                        <span className="line-clamp-1">{f.descripcion.replace('[Reporte Salida] ', '').replace('[Reporte Entrada] ', '')}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

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
                                    {loading ? "Registrando..." : "Confirmar entrada"}
                                </button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <DeleteConfirmDialog
                open={anomalyConfirmOpen}
                onOpenChange={setAnomalyConfirmOpen}
                title="Advertencia de recorrido"
                description={`Estás reportando un recorrido de ${pendingKmDiff.toLocaleString()} kilómetros en un solo viaje. ¿Es esto correcto?`}
                confirmLabel="Confirmar y registrar"
                cancelLabel="Cancelar"
                destructive={false}
                onConfirm={async () => {
                    const km = parseInt(kmEntrada)
                    if (!isNaN(km)) {
                        await executeSubmit(km)
                    }
                }}
            />
        </>
    )
}
