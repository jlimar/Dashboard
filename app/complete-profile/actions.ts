"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateProfile(formData: FormData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect("/login")
    }

    const first_name = (formData.get("first_name") as string)?.trim()
    const last_name = (formData.get("last_name") as string)?.trim()
    const raw_national_id = (formData.get("national_id") as string)?.trim()
    const phone = (formData.get("phone") as string)?.trim()

    if (!raw_national_id || !phone || !first_name || !last_name) {
        return { error: "Todos los campos son obligatorios" }
    }

    const cleanDigits = raw_national_id.replace(/\D/g, "")
    if (cleanDigits.length < 5) {
        return { error: "La cédula debe contener un número válido de al menos 5 dígitos" }
    }

    // Normalizar formato de la cédula (ej. E-81171480 o V-25531617)
    const prefix = raw_national_id.toUpperCase().startsWith("E") ? "E-" : "V-"
    const normalizedNationalId = `${prefix}${cleanDigits}`

    // Validar que no exista otro usuario con la misma cédula
    const { data: existingProfiles, error: checkError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, national_id")
        .neq("id", user.id)

    if (checkError) {
        console.error("Error verificando cédula:", checkError)
        return { error: "Error al validar la cédula. Intenta de nuevo." }
    }

    const duplicate = existingProfiles?.find(
        (p) => p.national_id && p.national_id.replace(/\D/g, "") === cleanDigits
    )

    if (duplicate) {
        const ownerName = `${duplicate.first_name || ""} ${duplicate.last_name || ""}`.trim()
        return {
            error: `La cédula ${normalizedNationalId} ya está registrada a nombre de ${ownerName || "otro usuario"} (${duplicate.email}). No se permiten cédulas duplicadas. Contacta al administrador para fusionar tu cuenta.`
        }
    }

    // Upsert profile to ensure it exists
    const { error } = await supabase
        .from("profiles")
        .upsert({
            id: user.id,
            first_name,
            last_name,
            national_id: normalizedNationalId,
            phone: phone,
            email: user.email, // Ensure email is synchronized
            updated_at: new Date().toISOString()
        })

    if (error) {
        console.error("Error updating profile:", error)
        return { error: `Error: ${error.message} (Code: ${error.code})` }
    }

    revalidatePath("/", "layout")
    redirect("/")
}
