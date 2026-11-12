"use client"

import { useState, useEffect, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, Car, CheckCircle } from "lucide-react"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"

function ReportarFallaContent() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [pageLoading, setPageLoading] = useState(true)
    const [vehicle, setVehicle] = useState<any>(null)
    const [descripcion, setDescripcion] = useState("")
    const [tipo, setTipo] = useState("Mecánica")
    const [prioridad, setPrioridad] = useState("Media")
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            router.push('/login')
            return
        }

        const { data: vehicleData } = await supabase
            .from('vehiculos')
            .select('*')
            .eq('assigned_driver_id', user.id)
            .single()

        if (vehicleData) {
            setVehicle(vehicleData)
        }

        setPageLoading(false)
    }

    async function handleSubmit() {
        if (!descripcion.trim()) {
            toast.error("Por favor describe la falla")
            return
        }

        if (!vehicle) {
            toast.error("No tienes un vehículo asignado para reportar falla")
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('fallas')
                .insert({
                    vehiculo_id: vehicle.id,
                    descripcion: descripcion.trim(),
                    tipo_falla: tipo,
                    prioridad: prioridad,
                    estado: 'Pendiente'
                })

            if (error) throw error

            toast.success("Falla reportada correctamente al taller")
            setSubmitted(true)
        } catch (error) {
            console.error("Error reporting fault:", error)
            toast.error("Error al reportar la falla")
        } finally {
            setLoading(false)
        }
    }

    if (pageLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">
                Cargando formulario...
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center justify-center">
                <div className="max-w-md w-full text-center space-y-6">
                    <CheckCircle className="w-10 h-10 text-neutral-900 mx-auto" strokeWidth={1.25} />
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-light tracking-tight text-neutral-900">
                            Falla reportada
                        </h1>
                        <p className="text-sm text-neutral-500">
                            La avería fue notificada al equipo de taller mecánico para su revisión.
                        </p>
                    </div>

                    <div className="pt-6 border-t border-neutral-100 flex flex-col items-center gap-4">
                        <Link
                            href="/chofer"
                            className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            Volver al panel del conductor
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-12">
            <div className="max-w-2xl w-full mx-auto space-y-8 sm:space-y-10">

                {/* HEADER */}
                <header className="pb-6 border-b border-neutral-100 space-y-4">
                    <Link
                        href="/chofer"
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
                        Volver al panel
                    </Link>

                    <div className="space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900">
                            Reportar falla mecánica
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500">
                            Notifica cualquier avería o anomalía en tu unidad asignada.
                        </p>
                    </div>
                </header>

                {/* VEHICLE INFO */}
                {vehicle ? (
                    <div className="space-y-8">
                        <div className="pb-6 border-b border-neutral-100 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Car className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.25} />
                                <div>
                                    <p className="text-sm font-medium text-neutral-900">{vehicle.modelo}</p>
                                    <p className="text-xs font-mono text-neutral-500 mt-0.5">{vehicle.placa}</p>
                                </div>
                            </div>
                        </div>

                        {/* FORM */}
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-neutral-400">Tipo de falla</Label>
                                <CustomDropdown
                                    value={tipo}
                                    onChange={setTipo}
                                    options={[
                                        { value: "Mecánica", label: "Mecánica (Motor, caja, embrague)" },
                                        { value: "Eléctrica", label: "Eléctrica (Batería, alternador, luces)" },
                                        { value: "Cauchos", label: "Cauchos y suspensión" },
                                        { value: "Frenos", label: "Sistema de frenos" },
                                        { value: "Carrocería", label: "Carrocería y accesorios" },
                                        { value: "Otro", label: "Otro tipo de novedad" },
                                    ]}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-neutral-400">Prioridad</Label>
                                <CustomDropdown
                                    value={prioridad}
                                    onChange={setPrioridad}
                                    options={[
                                        { value: "Baja", label: "Baja (Puede operar)" },
                                        { value: "Media", label: "Media (Requiere atención pronta)" },
                                        { value: "Alta", label: "Alta (Vehículo inoperativo o en riesgo)" },
                                    ]}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="descripcion" className="text-xs text-neutral-400">Descripción detallada de la avería</Label>
                                <textarea
                                    id="descripcion"
                                    rows={4}
                                    value={descripcion}
                                    onChange={(e) => setDescripcion(e.target.value)}
                                    placeholder="Detalla lo que sucede (ej. chirrido al frenar, luz indicadora encendida, pérdida de potencia...)"
                                    className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-2 text-sm text-neutral-900 outline-none transition-colors resize-none"
                                />
                            </div>
                        </div>

                        {/* ACTION BAR */}
                        <div className="pt-4 border-t border-neutral-100 flex items-center justify-between gap-4">
                            <Link
                                href="/chofer"
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
                                {loading ? "Enviando reporte..." : "Enviar reporte"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center text-sm text-neutral-400">
                        No tienes ningún vehículo asignado actualmente para reportar una falla.
                    </div>
                )}

            </div>
        </main>
    )
}

export default function ReportarFallaPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">Cargando...</div>}>
            <ReportarFallaContent />
        </Suspense>
    )
}

