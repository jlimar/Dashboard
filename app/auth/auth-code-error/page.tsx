import Link from "next/link"
import Image from "next/image"

export default function AuthCodeErrorPage() {
    return (
        <main className="min-h-screen w-full flex items-center justify-center px-6 py-12 bg-background">
            <div className="w-full max-w-sm space-y-8 text-center">
                <div className="flex flex-col items-center space-y-4">
                    <Image src="/logo.png" alt="Logo" width={48} height={48} className="w-12 h-12 object-contain" />
                    <div className="space-y-1">
                        <h1 className="text-xl font-light tracking-tight text-neutral-900">
                            Error de autenticación
                        </h1>
                        <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                            No se pudo completar el inicio de sesión. Por favor, intenta de nuevo o contacta al administrador.
                        </p>
                    </div>
                </div>

                <div className="pt-2">
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center text-xs text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                        Volver a iniciar sesión
                    </Link>
                </div>
            </div>
        </main>
    )
}

