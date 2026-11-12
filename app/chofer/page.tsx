"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { FileText, QrCode, AlertTriangle, Car, ArrowRight } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import QRCode from "react-qr-code"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ChoferPage() {
    const [profile, setProfile] = useState<any>(null)
    const [vehicle, setVehicle] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [qrOpen, setQrOpen] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            router.push('/login')
            return
        }

        // Fetch Profile
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        setProfile(profileData)

        // Fetch Assigned Vehicle
        // We look for a vehicle where assigned_driver_id matches
        const { data: vehicleData } = await supabase
            .from('vehiculos')
            .select('*')
            .eq('assigned_driver_id', user.id)
            .single()

        if (vehicleData) {
            setVehicle(vehicleData)
        }

        setLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-white text-sm text-neutral-400">Cargando panel...</div>
    }

    const qrData = JSON.stringify({
        type: 'FUEL_AUTH',
        driverId: profile?.id,
        vehicleId: vehicle?.id,
        placa: vehicle?.placa,
        driverName: `${profile?.first_name} ${profile?.last_name}`
    })

    return (
        <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans pb-10">
            {/* Header */}
            <header className="bg-white/95 backdrop-blur-xs sticky top-0 z-50 border-b border-neutral-100 pt-10 pb-4 px-6 flex justify-between items-center">
                <div>
                    <p className="text-xs text-neutral-400">Panel de control</p>
                    <h1 className="text-2xl font-light text-neutral-900 tracking-tight">Hola, {profile?.first_name || 'Conductor'}</h1>
                </div>
                <LogoutButton />
            </header>

            {/* Main Content */}
            <div className="flex-1 max-w-lg w-full mx-auto px-6 py-8 space-y-8">
                {vehicle ? (
                    <>
                        {/* Vehicle Info Section (Open Canvas) */}
                        <section className="pb-6 border-b border-neutral-100 space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`h-2 w-2 rounded-full ${vehicle.falla_activa ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                                    <span className={`text-xs font-medium ${vehicle.falla_activa ? "text-red-600" : "text-emerald-600"}`}>
                                        {vehicle.falla_activa ? "Mantenimiento" : "Operativo"}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-light text-neutral-900 tracking-tight leading-tight">{vehicle.modelo}</h2>
                                <p className="text-neutral-500 font-mono text-sm mt-0.5">{vehicle.placa}</p>
                            </div>

                            {/* Pure Typographic Metrics */}
                            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-neutral-100">
                                <div className="flex flex-col">
                                    <span className="text-xs text-neutral-500 font-normal">Combustible</span>
                                    <span className="text-2xl font-light tracking-tight text-neutral-900 mt-0.5 tabular-nums">
                                        {vehicle.current_fuel_level || 0}%
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs text-neutral-500 font-normal">Kilometraje</span>
                                    <span className="text-2xl font-light tracking-tight text-neutral-900 mt-0.5 tabular-nums">
                                        {(vehicle.kilometraje || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* Actions List */}
                        <div className="divide-y divide-neutral-100">
                            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                                <DialogTrigger asChild>
                                    <button
                                        type="button"
                                        className="w-full py-4 flex items-center justify-between text-left text-neutral-900 hover:text-neutral-600 transition-colors"
                                    >
                                        <span className="flex items-center gap-3 text-sm font-medium">
                                            <QrCode className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                                            Mi código QR
                                        </span>
                                        <ArrowRight className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-sm bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm p-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
                                    <DialogTitle className="text-center text-base font-medium text-neutral-900">Código de carga</DialogTitle>
                                    <DialogDescription className="text-center text-xs text-neutral-500 mt-1 mb-6 max-w-[220px]">
                                        Muestra este código al supervisor para autorizar combustible.
                                    </DialogDescription>

                                    <div className="p-4 bg-white mb-4 w-full max-w-[240px]">
                                        <div style={{ height: "auto", margin: "0 auto", width: "100%" }}>
                                            <QRCode
                                                size={256}
                                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                value={qrData}
                                                viewBox={`0 0 256 256`}
                                            />
                                        </div>
                                    </div>
                                    <p className="font-mono text-xs font-medium text-neutral-900 tracking-wider">{vehicle.placa}</p>
                                </DialogContent>
                            </Dialog>

                            <Link
                                href={`/transporte?action=salida&vehicle_id=${vehicle.id}`}
                                className="w-full py-4 flex items-center justify-between text-neutral-900 hover:text-neutral-600 transition-colors"
                            >
                                <span className="flex items-center gap-3 text-sm font-medium">
                                    <FileText className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                                    Registrar salida
                                </span>
                                <ArrowRight className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                            </Link>

                            <Link
                                href={`/transporte?action=entrada&vehicle_id=${vehicle.id}`}
                                className="w-full py-4 flex items-center justify-between text-neutral-900 hover:text-neutral-600 transition-colors"
                            >
                                <span className="flex items-center gap-3 text-sm font-medium">
                                    <LogOut className="w-4 h-4 text-neutral-400 scale-x-[-1]" strokeWidth={1.5} />
                                    Registrar entrada
                                </span>
                                <ArrowRight className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                            </Link>

                            <Link
                                href="/chofer/reportar"
                                className="w-full py-4 flex items-center justify-between text-red-600 hover:text-red-700 transition-colors"
                            >
                                <span className="flex items-center gap-3 text-sm font-medium">
                                    <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
                                    Reportar falla mecánica
                                </span>
                                <ArrowRight className="w-4 h-4 opacity-60" strokeWidth={1.5} />
                            </Link>
                        </div>
                    </>
                ) : (
                    <div className="py-24 flex flex-col items-center justify-center text-center">
                        <Car className="w-8 h-8 text-neutral-300 mb-3" strokeWidth={1.25} />
                        <h2 className="text-base font-medium text-neutral-900 mb-1">Sin vehículo asignado</h2>
                        <p className="text-xs text-neutral-500 max-w-[220px]">Contacta a supervisión para que te asignen una unidad.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
