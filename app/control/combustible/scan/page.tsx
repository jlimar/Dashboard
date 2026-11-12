"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Html5Qrcode } from "html5-qrcode"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function ScanPage() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const mountedRef = useRef(false)
    const [initializing, setInitializing] = useState(true)

    useEffect(() => {
        mountedRef.current = true
        const scannerId = "reader"

        // Cleanup function to handle strict mode double-invoke
        let cleanupFn = () => { }

        const startScanner = async () => {
            try {
                // Wait for element to be present
                await new Promise(r => setTimeout(r, 100))
                if (!mountedRef.current) return

                if (!document.getElementById(scannerId)) {
                    throw new Error("Elemento de video no encontrado")
                }

                // If instance exists, clear it first just in case
                if (scannerRef.current) {
                    try {
                        await scannerRef.current.stop()
                        scannerRef.current.clear()
                    } catch (e) {
                        // ignore stop errors
                    }
                }

                const html5QrCode = new Html5Qrcode(scannerId)
                scannerRef.current = html5QrCode

                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    (decodedText) => {
                        if (!mountedRef.current) return

                        try {
                            const data = JSON.parse(decodedText)
                            if (data.type === 'FUEL_AUTH') {
                                // Stop immediately to prevent duplicate reads
                                html5QrCode.stop().then(() => {
                                    html5QrCode.clear()

                                    const params = new URLSearchParams()
                                    if (data.vehicleId) params.set('vehicleId', data.vehicleId)
                                    if (data.driverName) params.set('driverName', data.driverName)
                                    if (data.driverId) params.set('driverId', data.driverId)

                                    toast.success("Código QR detectado")
                                    router.push(`/control/combustible/new?${params.toString()}`)
                                }).catch(console.error)
                            }
                        } catch (e) {
                            // ignore parsing errors from non-json QRs
                        }
                    },
                    (errorMessage) => {
                        // ignore frame errors
                    }
                )

                if (mountedRef.current) {
                    setInitializing(false)
                }

            } catch (err: any) {
                if (mountedRef.current) {
                    console.error("Scanner Error:", err)
                    // Don't show technical errors to user, just helpful message
                    if (err?.name === 'NotAllowedError' || err?.message?.includes('permission')) {
                        setError("Acceso a cámara denegado. Por favor permite el acceso.")
                    } else if (err?.message?.includes('Found 0 devices')) {
                        setError("No se encontró ninguna cámara.")
                    } else {
                        // Only set generic error if we really failed to start
                        setError("No se pudo iniciar la cámara. Intenta recargar.")
                    }
                    setInitializing(false)
                }
            }
        }

        startScanner()

        // Cleanup
        return () => {
            mountedRef.current = false
            if (scannerRef.current) {
                try {
                    scannerRef.current.stop().then(() => {
                        scannerRef.current?.clear()
                    }).catch(() => {
                        scannerRef.current?.clear()
                    })
                } catch (e) {
                    // ignore
                }
            }
        }
    }, [router])

    return (
        <div className="p-6 max-w-lg mx-auto space-y-6 bg-white min-h-screen text-neutral-900">
            <div className="flex items-center gap-4 pb-4 border-b border-neutral-100">
                <Link href="/control/combustible" className="text-neutral-400 hover:text-neutral-900 transition-colors">
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                </Link>
                <div>
                    <h1 className="text-xl font-light text-neutral-900 tracking-tight">Escanear conductor</h1>
                    <p className="text-xs text-neutral-500 mt-0.5">Escanea el código QR del chofer para autorizar.</p>
                </div>
            </div>

            <div className="overflow-hidden bg-black relative min-h-[300px] flex items-center justify-center">
                {error ? (
                    <div className="text-white p-6 text-center space-y-3">
                        <p className="text-sm font-medium text-red-400">Error</p>
                        <p className="text-sm text-neutral-300">{error}</p>
                        <button
                            type="button"
                            className="text-xs text-neutral-200 hover:text-white transition-colors"
                            onClick={() => window.location.reload()}
                        >
                            Recargar página
                        </button>
                    </div>
                ) : (
                    <>
                        <div id="reader" className="w-full h-full"></div>
                        {initializing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10">
                                <div className="text-center text-neutral-400 text-xs">
                                    <Loader2 className="animate-spin w-6 h-6 mx-auto mb-2" />
                                    <p>Iniciando cámara...</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="text-center text-xs text-neutral-400">
                Asegúrese de tener permisos de cámara habilitados y buena iluminación.
            </div>
        </div>
    )
}
