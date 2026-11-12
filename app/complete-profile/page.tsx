"use client"

import { useState } from "react"

import { updateProfile } from "./actions"
import { toast } from "sonner"

export default function CompleteProfilePage() {
    const [loading, setLoading] = useState(false)


    return (
        <main className="min-h-screen w-full flex items-center justify-center px-6 py-12 bg-background">
            <div className="w-full max-w-sm space-y-8">
                <div className="space-y-1 text-left border-b border-neutral-100 pb-6">
                    <h1 className="text-2xl font-light tracking-tight text-neutral-900">
                        Configuración inicial
                    </h1>
                    <p className="text-xs text-neutral-500">
                        Registra tus datos personales para continuar
                    </p>
                </div>

                <form
                    action={async (formData) => {
                        setLoading(true)
                        try {
                            const result = await updateProfile(formData)
                            if (result?.error) {
                                toast.error(result.error)
                                setLoading(false)
                            }
                        } catch (error) {
                            // If it's a redirect error, re-throw it so Next.js handles it
                            if ((error as Error).message.includes('NEXT_REDIRECT') || (error as any).digest?.includes('NEXT_REDIRECT')) {
                                throw error
                            }
                            console.error(error)
                            toast.error("Error inesperado")
                            setLoading(false)
                        }
                    }}
                    className="w-full space-y-6 text-left"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-neutral-500 font-normal">
                                Nombre
                            </label>
                            <input
                                name="first_name"
                                type="text"
                                required
                                placeholder="Juan"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-neutral-500 font-normal">
                                Apellido
                            </label>
                            <input
                                name="last_name"
                                type="text"
                                required
                                placeholder="Pérez"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="national_id" className="text-xs text-neutral-500 font-normal">
                            Cédula de identidad
                        </label>
                        <input
                            id="national_id"
                            name="national_id"
                            type="text"
                            required
                            placeholder="V-12345678"
                            className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="phone" className="text-xs text-neutral-500 font-normal">
                            Teléfono móvil
                        </label>
                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            required
                            placeholder="0414-1234567"
                            className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-all duration-150 active:scale-[0.985] disabled:opacity-40 cursor-pointer"
                            disabled={loading}
                        >
                            {loading ? "Habilitando funciones..." : "Activar y continuar"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    )
}
