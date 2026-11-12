import Link from "next/link"
import { Lock } from "lucide-react"

export default function UnauthorizedPage() {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-background px-6 gap-5">
            <Lock className="w-5 h-5 text-neutral-400" strokeWidth={1.25} />
            <div className="text-center space-y-1.5">
                <h1 className="text-2xl font-light text-neutral-900 tracking-tight">Acceso restringido</h1>
                <p className="text-sm text-neutral-500 max-w-md measure-copy">
                    No tienes permisos asignados para acceder a esta sección. Si consideras que es un error, consulta con la administración.
                </p>
            </div>
            <Link
                href="/"
                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
            >
                ← Volver al inicio
            </Link>
        </div>
    )
}
