export const DEPARTMENTS = [
    "Altos Mandos",
    "Administración",
    "Transporte",
    "Instalación",
    "Afectaciones",
    "Distribución",
    "Comercialización",
    "Operaciones"
] as const

export const JOB_TITLES_BY_DEPARTMENT: Record<string, string[]> = {
    "Altos Mandos": [
        "Presidente",
        "Gerente General",
        "Gerente de Operaciones"
    ],
    "Transporte": [
        "Encomendador",
        "Chofer",
        "Mecánico"
    ],
    "Administración": [
        "Encargado",
        "Supervisor",
        "Atención al Cliente",
        "Taquillero",
        "Call Center"
    ],
    "Instalación": [
        "Técnico de Instalación",
        "Ayudante",
        "Supervisor de Zona"
    ],
    "Afectaciones": [
        "Técnico de Campo",
        "Especialista en Fibra",
        "Liniero"
    ],
    "Distribución": [
        "Logística",
        "Despachador"
    ],
    "Comercialización": [
        "Vendedor",
        "Ejecutivo de Ventas",
        "Asesor Comercial"
    ],
    "Operaciones": [
        "Coordinador",
        "Analista",
        "Inspector"
    ]
}

// Helper to get flat list if needed, though we should prefer hierarchical
export const ALL_JOB_TITLES = Array.from(new Set(
    Object.values(JOB_TITLES_BY_DEPARTMENT).flat()
)).sort()

// Module Feature Flags (Initial State)
export const INITIAL_MODULES_CONFIG = [
    { key: "module_transporte", label: "Reporte vehicular", path: "/transporte", default: true },
    { key: "module_taller", label: "Taller y mantenimiento", path: "/taller", default: true },
    { key: "module_control", label: "Control de combustible", path: "/control", default: true },
    { key: "module_combustible", label: "Control de combustible", path: "/control/combustible", default: true },
] as const
