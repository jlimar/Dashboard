"use client"

import { createClient } from "@/lib/supabase/client"
import { Chrome } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"



export default function LoginPage() {
    const [loading, setLoading] = useState(false)

    const router = useRouter()
    const [isRegistering, setIsRegistering] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    const handleLogin = async () => {
        setLoading(true)
        try {
            const supabase = createClient()
            const redirectTo = `${window.location.origin}/auth/callback`
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo },
            })
            if (error) throw error
        } catch (error: any) {
            console.error("Error logging in:", error)
            const errorMessage = error?.message || error?.error?.message || "Error desconocido"
            toast.error(`Error Google: ${errorMessage}`)
            setLoading(false)
        }
    }

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()

        const getVirtualEmail = (user: string) => {
            if (user.includes('@')) return user;
            return `${user.toLowerCase().trim()}@dashboard.local`;
        }

        const virtualEmail = getVirtualEmail(username);

        if (isRegistering) {
            // REGISTRO
            const { error } = await supabase.auth.signUp({
                email: virtualEmail,
                password,
                options: {
                    data: {
                        username: username.toLowerCase().trim(),
                    }
                }
            })

            if (error) {
                toast.error("Error al registrar: " + error.message)
                setLoading(false)
            } else {
                toast.success("Registro exitoso. Iniciando sesión...")
                // Auto login or redirect
                router.push("/")
                router.refresh()
            }
        } else {
            // LOGIN
            const { error } = await supabase.auth.signInWithPassword({
                email: virtualEmail,
                password
            })

            if (error) {
                toast.error("Error: " + error.message)
                setLoading(false)
            } else {
                toast.success("Bienvenido")
                router.push("/")
                router.refresh()
            }
        }
    }

    return (
        <main className="min-h-screen w-full flex items-center justify-center px-6 py-12 bg-background">
            <div className="w-full max-w-sm space-y-10">
                <div className="flex flex-col items-center text-center space-y-4">
                    <Image src="/logo.png" alt="Logo" width={48} height={48} className="w-12 h-12 object-contain" />
                    <div className="space-y-1">
                        <h1 className="text-2xl font-light tracking-tight text-neutral-900">
                            {isRegistering ? "Crear cuenta" : "Bienvenido"}
                        </h1>
                        <p className="text-xs text-neutral-500">
                            {isRegistering ? "Elige un nombre de usuario y contraseña" : "Acceso seguro restringido"}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-6">
                    <div className="space-y-1 text-left">
                        <Label className="text-xs text-neutral-500 font-normal">Usuario</Label>
                        <Input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="usuario.ejemplo"
                            required
                        />
                    </div>
                    <div className="space-y-1 text-left">
                        <Label className="text-xs text-neutral-500 font-normal">Contraseña</Label>
                        <Input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <div className="flex flex-col items-center gap-4 pt-2">
                        <button
                            type="submit"
                            className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                            disabled={loading || !username || !password}
                        >
                            {loading ? "Procesando..." : (isRegistering ? "Registrarse" : "Iniciar sesión")}
                        </button>

                        {!isRegistering && (
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!username) {
                                        toast.error("Ingresa tu Usuario primero para recuperar la contraseña");
                                        return;
                                    }
                                    setLoading(true);
                                    try {
                                        const { recoverPassword } = await import("./actions");
                                        const result = await recoverPassword(username);
                                        if (result.success) {
                                            toast.success(result.message, { duration: 8000 });
                                        } else {
                                            toast.error(result.message, { duration: 8000 });
                                        }
                                    } catch (e) {
                                        toast.error("Error al procesar la solicitud");
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                                disabled={loading}
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsRegistering(!isRegistering)}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate aquí"}
                        </button>
                    </div>
                </form>

                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-transparent via-neutral-200 to-transparent h-[1px]" />

                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={handleLogin}
                            className="inline-flex items-center gap-2 text-xs text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-40"
                            disabled={loading}
                        >
                            <Chrome className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                            <span>{loading ? "Conectando..." : "Continuar con Google"}</span>
                        </button>
                    </div>

                    <p className="text-[11px] text-center text-neutral-400">
                        Acceso seguro restringido a personal autorizado
                    </p>
                </div>
            </div>
        </main>
    )
}
