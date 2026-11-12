import { LucideIcon } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import { Home as HomeIcon } from "lucide-react"

interface DepartmentPageProps {
    title: string
    description: string
    icon: LucideIcon
    colorClass: string
}

export function DepartmentPageLayout({ title, description, icon: Icon }: DepartmentPageProps) {
    return (
        <main className="min-h-screen bg-background pb-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12">
                {/* HEADER */}
                <div className="flex justify-between items-end pb-8 mb-10 border-b border-neutral-100">
                    <div>
                        <h1 className="text-3xl font-light text-neutral-900 tracking-tight">{title}</h1>
                        <p className="text-neutral-500 text-sm mt-1">{description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <a
                            href="/"
                            className="text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center"
                            title="Ir al inicio"
                        >
                            <HomeIcon className="w-4 h-4" strokeWidth={1.5} />
                        </a>
                        <LogoutButton />
                    </div>
                </div>

                {/* CONTENT PLACEHOLDER */}
                <div className="py-16 border-b border-neutral-100 text-center space-y-3">
                    <Icon className="w-6 h-6 mx-auto text-neutral-400" strokeWidth={1.25} />
                    <h2 className="text-lg font-medium text-neutral-900">Panel de {title}</h2>
                    <p className="text-sm text-neutral-500 max-w-md mx-auto">
                        Este módulo está habilitado para el departamento de {title}. Las funciones específicas estarán disponibles pronto.
                    </p>
                </div>
            </div>
        </main>
    )
}
