"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateUserRoles(userId: string, newRoles: string[]) {
    // ... existing logic if needed or reimplemented
}

export async function updateProfileDetails(userId: string, department: string, jobTitle: string) {
    const supabase = await createClient()

    // Verify if requester is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", user.id)
        .single()

    const roles = requesterProfile?.roles || []
    if (!roles.includes("admin")) return { error: "No tienes permisos de administrador" }

    try {
        const { error } = await supabase
            .from("profiles")
            .update({
                department: department,
                job_title: jobTitle
            })
            .eq("id", userId)

        if (error) throw error

        revalidatePath("/admin/usuarios")
        return { success: true }
    } catch (error) {
        console.error("Error updating profile details:", error)
        return { error: "Error al actualizar datos" }
    }
}

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export async function impersonateUserAction(email: string) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Check if key is available (it might be undefined in client bundle but this is server action)
    if (!serviceRoleKey) {
        return { error: "Falta SUPABASE_SERVICE_ROLE_KEY. Configurala en .env.local" }
    }

    try {
        const adminClient = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const { data, error } = await adminClient.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        })

        if (error) throw error

        return { success: true, url: data.properties?.action_link }
    } catch (error: any) {
        console.error("Impersonation Error:", error)
        return { error: error.message || "Error al generar enlace" }
    }
}

export async function createUserAction(data: {
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: string
}) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return { error: "Falta Service Role Key" }

    const supabase = await createClient()

    // Check Admin Permissions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    // Double check admin role in DB
    const { data: requester } = await supabase.from("profiles").select("roles").eq("id", user.id).single()
    if (!requester?.roles?.includes("admin")) return { error: "No tienes permisos de administrador" }

    try {
        const adminClient = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                first_name: data.firstName,
                last_name: data.lastName,
            }
        })

        if (createError) throw createError
        if (!newUser.user) throw new Error("No se pudo crear el usuario")

        // Set Initial Role if provided (defaulting to basic if not)
        const initialRole = data.role || "tecnico"

        // Update roles
        const { error: profileError } = await adminClient
            .from("profiles")
            .update({ roles: [initialRole] })
            .eq("id", newUser.user.id)

        revalidatePath("/admin/usuarios")
        return { success: true, userId: newUser.user.id }

    } catch (error: any) {
        console.error("Create User Error:", error)
        return { error: error.message || "Error al crear usuario" }
    }
}

export async function adminResetPassword(userId: string, newPassword: string) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return { error: "Falta Service Role Key" }

    const supabase = await createClient()

    // Check Admin Permissions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    const { data: requester } = await supabase.from("profiles").select("roles").eq("id", user.id).single()
    if (!requester?.roles?.includes("admin")) return { error: "No tienes permisos de administrador" }

    if (newPassword.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres" }

    try {
        const adminClient = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
            password: newPassword
        })

        if (error) throw error

        return { success: true }
    } catch (error: any) {
        console.error("Admin Reset Password Error:", error)
        return { error: error.message || "Error al restablecer la contraseña" }
    }
}

export async function deleteUserAction(userId: string) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return { error: "Falta Service Role Key" }

    const supabase = await createClient()

    // Check Admin Permissions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    const { data: requester } = await supabase.from("profiles").select("roles").eq("id", user.id).single()
    if (!requester?.roles?.includes("admin")) return { error: "No tienes permisos de administrador" }

    if (user.id === userId) {
        return { error: "No puedes eliminar tu propia cuenta de administrador" }
    }

    try {
        const adminClient = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // 1. Desasignar cualquier vehículo asignado a este conductor
        await adminClient
            .from("vehiculos")
            .update({ assigned_driver_id: null })
            .eq("assigned_driver_id", userId)

        // 2. Limpiar referencias en tablas relacionadas
        await adminClient
            .from("technician_reports")
            .update({ user_id: null })
            .eq("user_id", userId)

        await adminClient
            .from("reportes")
            .update({ user_id: null })
            .eq("user_id", userId)

        await adminClient
            .from("fuel_logs")
            .update({ supervisor_id: null })
            .eq("supervisor_id", userId)

        await adminClient
            .from("user_devices")
            .delete()
            .eq("user_id", userId)

        // 3. Eliminar de profiles
        const { error: profileError } = await adminClient
            .from("profiles")
            .delete()
            .eq("id", userId)

        if (profileError) throw profileError

        // 4. Eliminar de auth.users
        const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
        if (authError) {
            console.warn("Advertencia al eliminar de auth.users:", authError.message)
        }

        revalidatePath("/admin/usuarios")
        return { success: true }
    } catch (error: any) {
        console.error("Delete User Error:", error)
        return { error: error.message || "Error al eliminar el usuario" }
    }
}

export async function deduplicateUsersAction() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return { error: "Falta Service Role Key" }

    const supabase = await createClient()

    // Check Admin Permissions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    const { data: requester } = await supabase.from("profiles").select("roles").eq("id", user.id).single()
    if (!requester?.roles?.includes("admin")) return { error: "No tienes permisos de administrador" }

    try {
        const adminClient = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data: allProfiles, error: fetchError } = await adminClient
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: true })

        if (fetchError || !allProfiles) throw fetchError || new Error("No se pudieron cargar los perfiles")

        // Agrupar por cédula numérica limpia
        const groups: Record<string, typeof allProfiles> = {}
        for (const p of allProfiles) {
            if (!p.national_id) continue
            const clean = p.national_id.replace(/\D/g, "")
            if (!clean) continue
            if (!groups[clean]) groups[clean] = []
            groups[clean].push(p)
        }

        let mergedCount = 0

        for (const [cleanId, usersGroup] of Object.entries(groups)) {
            if (usersGroup.length <= 1) continue

            // Conservar el que tenga roles asignados no-invitado (o más antiguo)
            usersGroup.sort((a, b) => {
                const aRoles = (a.roles || []).filter((r: string) => r !== "invitado").length
                const bRoles = (b.roles || []).filter((r: string) => r !== "invitado").length
                if (bRoles !== aRoles) return bRoles - aRoles
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            })

            const primary = usersGroup[0]
            const duplicates = usersGroup.slice(1)

            const prefix = (primary.national_id || "").toUpperCase().startsWith("E") ? "E-" : "V-"
            const normalizedId = `${prefix}${cleanId}`

            // Fusionar roles
            const allRoles = Array.from(new Set([
                ...(primary.roles || []),
                ...duplicates.flatMap(d => d.roles || [])
            ]))
            const finalRoles = allRoles.length > 1 && allRoles.some(r => r !== "invitado")
                ? allRoles.filter(r => r !== "invitado")
                : allRoles

            await adminClient
                .from("profiles")
                .update({ 
                    national_id: normalizedId,
                    roles: finalRoles
                })
                .eq("id", primary.id)

            for (const dup of duplicates) {
                // Migrar vehículos
                await adminClient
                    .from("vehiculos")
                    .update({ assigned_driver_id: primary.id })
                    .eq("assigned_driver_id", dup.id)

                // Migrar reportes
                await adminClient
                    .from("reportes")
                    .update({ user_id: primary.id })
                    .eq("user_id", dup.id)

                // Migrar technician_reports
                await adminClient
                    .from("technician_reports")
                    .update({ user_id: primary.id })
                    .eq("user_id", dup.id)

                // Migrar fuel_logs
                await adminClient
                    .from("fuel_logs")
                    .update({ supervisor_id: primary.id })
                    .eq("supervisor_id", dup.id)

                // Limpiar sesiones/dispositivos
                await adminClient
                    .from("user_devices")
                    .delete()
                    .eq("user_id", dup.id)

                // Eliminar perfil duplicado
                await adminClient.from("profiles").delete().eq("id", dup.id)

                // Eliminar auth user
                await adminClient.auth.admin.deleteUser(dup.id)

                mergedCount++
            }
        }

        revalidatePath("/admin/usuarios")
        return { success: true, mergedCount }
    } catch (error: any) {
        console.error("Deduplication error:", error)
        return { error: error.message || "Error al fusionar usuarios" }
    }
}

