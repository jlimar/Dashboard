"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
    ArrowLeft,
    PenLine,
    Shield,
    LogIn,
    Key,
    Plus,
    X,
    Loader2,
    LayoutDashboard,
    Truck,
    Wrench,
    ClipboardCheck,
    FileText,
    User as UserIcon,
    Lock,
    MapPin,
} from "lucide-react"
import Link from "next/link"
import { updateProfileDetails, impersonateUserAction, createUserAction, adminResetPassword, deleteUserAction, deduplicateUsersAction } from "./user-actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { DEPARTMENTS, JOB_TITLES_BY_DEPARTMENT } from "@/lib/constants"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"

type Profile = {
    id: string
    email: string
    roles: string[]
    created_at: string
    first_name?: string
    last_name?: string
    department?: string
    job_title?: string
    plain_text_reports?: boolean
    national_id?: string
}

const ROLE_OPTIONS = [
    { value: "tecnico", label: "Técnico" },
    { value: "mecanico", label: "Mecánico" },
    { value: "admin", label: "Administrador" },
    { value: "gerencia", label: "Gerencia" },
    { value: "supervisor", label: "Supervisor" },
    { value: "reportes", label: "Supervisión" },
    { value: "chofer", label: "Chofer" },
    { value: "geodata", label: "Zonas operativas" },
    { value: "invitado", label: "Invitado" },
]

// DEFINING MODULE ACCESS GROUPS
const MODULE_ACCESS = [
    {
        title: "Módulos principales",
        items: [
            {
                role: 'gerencia',
                label: 'Gerencia',
                description: 'Acceso al módulo de Gerencia (Dashboard y Métricas).',
                icon: LayoutDashboard,
            },
            {
                role: 'transporte',
                label: 'Transporte',
                description: 'Acceso al módulo de Transporte (Salidas y Vehículos).',
                icon: Truck,
            },
            {
                role: 'taller',
                label: 'Taller',
                description: 'Acceso al módulo de Taller (Fallas y Preventivos).',
                icon: Wrench,
            },
            {
                role: 'supervisor',
                label: 'Control',
                description: 'Acceso al módulo de Control (Combustible y Auditorías).',
                icon: ClipboardCheck,
            },
            {
                role: 'reportes',
                label: 'Supervisión',
                description: 'Acceso al módulo de Supervisión (Reportes Diarios y Equipamiento).',
                icon: FileText,
            },
        ]
    },
    {
        title: "Roles específicos",
        items: [
            {
                role: 'mecanico',
                label: 'Mecánico',
                description: 'Rol para visualizar reparaciones asignadas en Taller.',
                icon: Wrench,
            },
            {
                role: 'tecnico',
                label: 'Técnico',
                description: 'Rol para técnicos de campo (App móvil/Soporte).',
                icon: UserIcon,
            },
        ]
    },
    {
        title: "Administración",
        items: [
            {
                role: 'admin',
                label: 'Administrador',
                description: 'Acceso total a configuración y gestión de usuarios.',
                icon: Lock,
            },
            {
                role: 'geodata',
                label: 'Zonas operativas',
                description: 'Gestión global de ubicaciones (Geodata) para los selectores.',
                icon: MapPin,
            }
        ]
    }
]

export default function AdminUsersPage() {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)

    // Edit Details State
    const [editingUser, setEditingUser] = useState<Profile | null>(null)
    const [editForm, setEditForm] = useState({ department: "", job_title: "" })
    const [saving, setSaving] = useState(false)

    // Permissions State
    const [permissionsUser, setPermissionsUser] = useState<Profile | null>(null)

    // Create User State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [createForm, setCreateForm] = useState({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "tecnico"
    })
    const [creating, setCreating] = useState(false)

    // Reset Password State
    const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null)
    const [resetPasswordValue, setResetPasswordValue] = useState("")
    const [resettingPassword, setResettingPassword] = useState(false)

    // Impersonate Confirm State
    const [impersonateEmail, setImpersonateEmail] = useState<string | null>(null)

    // Delete User State
    const [userToDelete, setUserToDelete] = useState<Profile | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [deduplicating, setDeduplicating] = useState(false)

    useEffect(() => {
        loadProfiles()
    }, [])

    const loadProfiles = async () => {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false })

            if (error) throw error
            setProfiles(data || [])
        } catch (error) {
            console.error("Error loading profiles:", error)
            toast.error("Error al cargar usuarios")
        } finally {
            setLoading(false)
        }
    }

    const startEditing = (profile: Profile) => {
        setEditingUser(profile)
        setEditForm({
            department: profile.department || "",
            job_title: profile.job_title || ""
        })
    }

    const handleSaveDetails = async () => {
        if (!editingUser) return
        setSaving(true)
        const result = await updateProfileDetails(editingUser.id, editForm.department, editForm.job_title)
        setSaving(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Datos actualizados")
            setEditingUser(null)
            loadProfiles()
        }
    }

    const handleRoleToggle = async (userId: string, currentRoles: string[], roleToToggle: string) => {
        try {
            const supabase = createClient()

            let newRoles: string[]
            if (currentRoles.includes(roleToToggle)) {
                newRoles = currentRoles.filter(r => r !== roleToToggle)
            } else {
                newRoles = [...currentRoles, roleToToggle]
            }

            const { error } = await supabase
                .from("profiles")
                .update({ roles: newRoles })
                .eq("id", userId)

            if (error) throw error

            const updatedProfile = { ...(permissionsUser || profiles.find(p => p.id === userId)!), roles: newRoles }

            if (permissionsUser?.id === userId) {
                setPermissionsUser(updatedProfile)
            }

            setProfiles(prev => prev.map(p => p.id === userId ? updatedProfile : p))

            toast.success("Permiso actualizado")
        } catch (error) {
            toast.error("Error al actualizar permisos")
        }
    }

    const handleTogglePlainText = async (userId: string, currentValue: boolean) => {
        try {
            const supabase = createClient()
            const newValue = !currentValue

            const { error } = await supabase
                .from("profiles")
                .update({ plain_text_reports: newValue })
                .eq("id", userId)

            if (error) throw error

            const updatedProfile = { ...(permissionsUser || profiles.find(p => p.id === userId)!), plain_text_reports: newValue }

            if (permissionsUser?.id === userId) {
                setPermissionsUser(updatedProfile)
            }

            setProfiles(prev => prev.map(p => p.id === userId ? updatedProfile : p))
            toast.success("Configuración actualizada")
        } catch (error) {
            toast.error("Error al actualizar configuración")
        }
    }

    const handleResetPassword = async () => {
        if (!resetPasswordUser || !resetPasswordValue) return
        setResettingPassword(true)
        const result = await adminResetPassword(resetPasswordUser.id, resetPasswordValue)
        setResettingPassword(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Contraseña actualizada exitosamente")
            setResetPasswordUser(null)
            setResetPasswordValue("")
        }
    }

    const executeImpersonate = async () => {
        if (!impersonateEmail) return

        toast.loading("Generando acceso seguro...")
        const result = await impersonateUserAction(impersonateEmail)

        if (result.success && result.url) {
            window.location.href = result.url
        } else {
            toast.dismiss()
            toast.error(result.error || "Error desconocido")
        }
    }

    const handleCreateUser = async () => {
        if (!createForm.email || !createForm.password || !createForm.firstName) {
            toast.error("Complete los campos obligatorios")
            return
        }

        setCreating(true)
        const result = await createUserAction({
            email: createForm.email,
            password: createForm.password,
            firstName: createForm.firstName,
            lastName: createForm.lastName,
            role: createForm.role
        })
        setCreating(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Usuario creado exitosamente")
            setIsCreateOpen(false)
            setCreateForm({ email: "", password: "", firstName: "", lastName: "", role: "tecnico" })
            loadProfiles()
        }
    }

    const handleDeleteUser = async () => {
        if (!userToDelete) return
        setDeleting(true)
        const result = await deleteUserAction(userToDelete.id)
        setDeleting(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Usuario eliminado exitosamente")
            setUserToDelete(null)
            loadProfiles()
        }
    }

    const handleDeduplicate = async () => {
        setDeduplicating(true)
        const result = await deduplicateUsersAction()
        setDeduplicating(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(`Se fusionaron ${result.mergedCount} registros duplicados`)
            loadProfiles()
        }
    }

    const duplicateCountByCleanId = profiles.reduce<Record<string, number>>((acc, p) => {
        const clean = p.national_id?.replace(/\D/g, "")
        if (clean) acc[clean] = (acc[clean] || 0) + 1
        return acc
    }, {})

    const hasDuplicates = Object.values(duplicateCountByCleanId).some((count) => count > 1)

    const departmentOptions = DEPARTMENTS.map((dept) => ({ value: dept, label: dept }))
    const jobTitleOptions = editForm.department
        ? (JOB_TITLES_BY_DEPARTMENT[editForm.department] || []).map((title) => ({ value: title, label: title }))
        : []

    return (
        <div className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-10">
            <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
                {/* HEADER UNIFORME */}
                <header className="pb-6 border-b border-neutral-100 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
                            Inicio
                        </Link>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-light tracking-tight text-neutral-900">
                                Gestión de usuarios
                            </h1>
                            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                                Administra los permisos y roles del personal.
                            </p>
                        </div>
                        <div className="flex items-center gap-4 self-start sm:self-auto">
                            {hasDuplicates && (
                                <button
                                    type="button"
                                    onClick={handleDeduplicate}
                                    disabled={deduplicating}
                                    className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-40"
                                >
                                    {deduplicating ? "Fusionando duplicados..." : "Fusionar duplicados"}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsCreateOpen(true)}
                                className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                            >
                                + Nuevo usuario
                            </button>
                        </div>
                    </div>
                </header>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-neutral-200/60 hover:bg-transparent">
                                <TableHead className="text-xs font-normal text-neutral-400 pl-0">Empleado</TableHead>
                                <TableHead className="text-xs font-normal text-neutral-400">Datos laborales</TableHead>
                                <TableHead className="text-xs font-normal text-neutral-400">Roles asignados</TableHead>
                                <TableHead className="text-xs font-normal text-neutral-400">Fecha registro</TableHead>
                                <TableHead className="text-right text-xs font-normal text-neutral-400 pr-0">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-neutral-100">
                            {loading ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={5} className="text-center h-32 text-xs text-neutral-400">
                                        Cargando usuarios...
                                    </TableCell>
                                </TableRow>
                            ) : profiles.map((profile) => {
                                const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ")
                                const roles = profile.roles || []
                                const cleanId = profile.national_id?.replace(/\D/g, "")
                                const isDuplicate = !!cleanId && (duplicateCountByCleanId[cleanId] || 0) > 1

                                return (
                                    <TableRow key={profile.id} className="group hover:bg-neutral-50/50 transition-colors border-b border-neutral-100">
                                        <TableCell className="pl-0 py-3.5">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-neutral-900">
                                                        {fullName || "Sin nombre"}
                                                    </span>
                                                    {profile.national_id && (
                                                        <span className="text-xs font-mono text-neutral-400 font-normal">
                                                            {profile.national_id}
                                                        </span>
                                                    )}
                                                    {isDuplicate && (
                                                        <span className="text-[10px] text-amber-600 font-normal">
                                                            (Cédula repetida)
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-neutral-400 mt-0.5">
                                                    {profile.email}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3.5">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-neutral-700 font-medium">
                                                    {profile.job_title || "Sin cargo"}
                                                </span>
                                                <span className="text-xs text-neutral-400 mt-0.5">
                                                    {profile.department || "Sin departamento"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3.5">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 max-w-[220px]">
                                                {roles.slice(0, 3).map((role, idx) => (
                                                    <span key={role} className="text-xs text-neutral-600 capitalize">
                                                        {role}{idx < Math.min(roles.length, 3) - 1 ? "," : ""}
                                                    </span>
                                                ))}
                                                {roles.length > 3 && (
                                                    <span className="text-xs text-neutral-400">
                                                        +{roles.length - 3}
                                                    </span>
                                                )}
                                                {roles.length === 0 && (
                                                    <span className="text-neutral-400 text-xs italic">Sin roles</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3.5">
                                            <span className="text-neutral-500 text-xs font-mono tabular-nums">
                                                {new Date(profile.created_at).toLocaleDateString()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right pr-0 py-3.5">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-end gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => startEditing(profile)}
                                                    className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                                    title="Editar datos"
                                                >
                                                    <PenLine className="w-3.5 h-3.5" strokeWidth={1.25} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setResetPasswordUser(profile)}
                                                    className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                                    title="Cambiar contraseña"
                                                >
                                                    <Key className="w-3.5 h-3.5" strokeWidth={1.25} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setImpersonateEmail(profile.email)}
                                                    className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                                    title="Iniciar sesión como..."
                                                >
                                                    <LogIn className="w-3.5 h-3.5" strokeWidth={1.25} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setPermissionsUser(profile)}
                                                    className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Shield className="w-3.5 h-3.5" strokeWidth={1.25} />
                                                    <span className="hidden sm:inline">Permisos</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setUserToDelete(profile)}
                                                    className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                                    title="Eliminar usuario"
                                                >
                                                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* EDIT DETAILS DIALOG */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-medium text-neutral-900">
                            Editar datos laborales
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs text-neutral-500 block">Departamento</label>
                            <CustomDropdown
                                value={editForm.department}
                                onChange={(value) => setEditForm({ department: value, job_title: "" })}
                                options={departmentOptions}
                                placeholder="Seleccionar departamento"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs text-neutral-500 block">Cargo / Título</label>
                            <CustomDropdown
                                value={editForm.job_title}
                                onChange={(value) => setEditForm({ ...editForm, job_title: value })}
                                options={jobTitleOptions}
                                placeholder={editForm.department ? "Seleccionar cargo" : "Primero selecciona un dpto."}
                                disabled={!editForm.department}
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={() => setEditingUser(null)}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveDetails}
                            disabled={saving}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                        >
                            {saving ? "Guardando..." : "Guardar cambios"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PERMISSIONS MANAGER DIALOG */}
            <Dialog open={!!permissionsUser} onOpenChange={(open) => !open && setPermissionsUser(null)}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-medium text-neutral-900">
                            Gestionar acceso a módulos
                        </DialogTitle>
                        <DialogDescription className="text-xs text-neutral-500">
                            Configuración de permisos para <span className="font-medium text-neutral-900">{permissionsUser?.email}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-2">
                        {MODULE_ACCESS.map((group) => (
                            <div key={group.title} className="space-y-2">
                                <h4 className="font-medium text-xs text-neutral-400">
                                    {group.title}
                                </h4>
                                <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100">
                                    {group.items.map((item) => {
                                        const isChecked = (permissionsUser?.roles || []).includes(item.role)
                                        const Icon = item.icon || Shield

                                        return (
                                            <div
                                                key={item.role}
                                                className="flex items-start gap-3 py-3.5"
                                            >
                                                <Icon className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                                                <div className="flex-1 space-y-0.5">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <label
                                                            htmlFor={`role-${item.role}`}
                                                            className="text-sm font-medium text-neutral-900 cursor-pointer"
                                                        >
                                                            {item.label}
                                                        </label>
                                                        <Switch
                                                            id={`role-${item.role}`}
                                                            checked={isChecked}
                                                            onCheckedChange={() => permissionsUser && handleRoleToggle(permissionsUser.id, permissionsUser.roles || [], item.role)}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-neutral-500 leading-snug pr-8">
                                                        {item.description}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="space-y-2">
                            <h4 className="font-medium text-xs text-neutral-400">
                                Configuración especial
                            </h4>
                            <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100">
                                <div className="py-3.5">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center justify-between gap-4">
                                            <label htmlFor="plain-text" className="text-sm font-medium text-neutral-900 cursor-pointer">
                                                WhatsApp sin emojis
                                            </label>
                                            <Switch
                                                id="plain-text"
                                                checked={!!permissionsUser?.plain_text_reports}
                                                onCheckedChange={() => permissionsUser && handleTogglePlainText(permissionsUser.id, !!permissionsUser.plain_text_reports)}
                                            />
                                        </div>
                                        <p className="text-xs text-neutral-500 leading-snug pr-8">
                                            Usa [SI]/[NO] en vez de emojis en reportes para dispositivos antiguos.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-4">
                        <button
                            type="button"
                            onClick={() => setPermissionsUser(null)}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                        >
                            Guardar y cerrar
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CREATE USER DIALOG */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-medium text-neutral-900">
                            Crear nuevo usuario
                        </DialogTitle>
                        <DialogDescription className="text-xs text-neutral-500">
                            Crea una cuenta con contraseña definida manualmente. El usuario podrá iniciar sesión inmediatamente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-neutral-500 block">Nombre</label>
                                <input
                                    type="text"
                                    value={createForm.firstName}
                                    onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })}
                                    placeholder="Ej: Juan"
                                    className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-neutral-500 block">Apellido</label>
                                <input
                                    type="text"
                                    value={createForm.lastName}
                                    onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })}
                                    placeholder="Ej: Pérez"
                                    className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-neutral-500 block">Correo electrónico</label>
                            <input
                                type="email"
                                value={createForm.email}
                                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                                placeholder="usuario@empresa.com"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-neutral-500 block">Contraseña inicial</label>
                            <input
                                type="text"
                                value={createForm.password}
                                onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                                placeholder="Clave segura..."
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                            <p className="text-[11px] text-neutral-400">Mínimo 6 caracteres.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs text-neutral-500 block">Rol inicial</label>
                            <CustomDropdown
                                value={createForm.role}
                                onChange={v => setCreateForm({ ...createForm, role: v })}
                                options={ROLE_OPTIONS}
                                placeholder="Seleccionar rol"
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={() => setIsCreateOpen(false)}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateUser}
                            disabled={creating}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                        >
                            {creating ? "Creando..." : "Crear cuenta"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* RESET PASSWORD DIALOG */}
            <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-medium text-neutral-900">
                            Cambiar contraseña
                        </DialogTitle>
                        <DialogDescription className="text-xs text-neutral-500">
                            Asigna una nueva contraseña a <span className="font-medium text-neutral-900">{resetPasswordUser?.email}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <label className="text-xs text-neutral-500 block">Nueva contraseña temporal</label>
                            <input
                                type="text"
                                value={resetPasswordValue}
                                onChange={e => setResetPasswordValue(e.target.value)}
                                placeholder="Ej: Temporal123"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={() => setResetPasswordUser(null)}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleResetPassword}
                            disabled={resettingPassword}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                        >
                            {resettingPassword ? "Guardando..." : "Guardar clave"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* IMPERSONATE CONFIRM DIALOG */}
            <DeleteConfirmDialog
                open={!!impersonateEmail}
                onOpenChange={(open) => !open && setImpersonateEmail(null)}
                title="Iniciar sesión como este usuario"
                description={
                    <>
                        Tu sesión de administrador actual se cerrará al ingresar como{" "}
                        <span className="font-medium text-neutral-900">{impersonateEmail}</span>.
                        Deberás volver a iniciar sesión para regresar al panel de administración.
                    </>
                }
                confirmLabel="Continuar"
                destructive={false}
                onConfirm={executeImpersonate}
            />

            {/* DELETE USER CONFIRM DIALOG */}
            <DeleteConfirmDialog
                open={!!userToDelete}
                onOpenChange={(open) => !open && setUserToDelete(null)}
                title="Eliminar usuario"
                description={
                    <>
                        ¿Estás seguro de que deseas eliminar permanentemente a{" "}
                        <span className="font-medium text-neutral-900">
                            {[userToDelete?.first_name, userToDelete?.last_name].filter(Boolean).join(" ") || userToDelete?.email}
                        </span>{" "}
                        ({userToDelete?.email})? Se liberarán sus asignaciones de vehículos y se eliminará su cuenta de acceso.
                    </>
                }
                confirmLabel={deleting ? "Eliminando..." : "Eliminar usuario"}
                destructive={true}
                onConfirm={handleDeleteUser}
            />
        </div>
    )
}
