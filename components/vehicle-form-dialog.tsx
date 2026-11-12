"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Upload, Camera } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

type Vehicle = {
    id?: string
    codigo: string
    placa: string
    modelo: string
    año: string
    color: string
    tipo: string
    capacidad_tanque: string
    foto_url?: string
    odometro_averiado?: boolean
}

type VehicleFormDialogProps = {
    isOpen: boolean
    onClose: () => void
    onVehicleSaved: () => void
    vehicleToEdit?: Vehicle | null
}

export function VehicleFormDialog({ isOpen, onClose, onVehicleSaved, vehicleToEdit }: VehicleFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [formData, setFormData] = useState<Vehicle>({
        codigo: "",
        placa: "",
        modelo: "",
        año: "",
        color: "",
        tipo: "Carga",
        capacidad_tanque: "",
        foto_url: "",
        odometro_averiado: false // [NEW] Default
    })

    useEffect(() => {
        if (vehicleToEdit) {
            setFormData({
                id: vehicleToEdit.id,
                codigo: vehicleToEdit.codigo || "",
                placa: vehicleToEdit.placa || "",
                modelo: vehicleToEdit.modelo || "",
                año: vehicleToEdit.año || "",
                color: vehicleToEdit.color || "",
                tipo: vehicleToEdit.tipo || "Carga",
                capacidad_tanque: vehicleToEdit.capacidad_tanque || "",
                foto_url: vehicleToEdit.foto_url || "",
                odometro_averiado: vehicleToEdit.odometro_averiado || false // [NEW]
            })
            if (vehicleToEdit.foto_url) {
                setPhotoPreview(vehicleToEdit.foto_url)
            } else {
                setPhotoPreview(null)
            }
        } else {
            // Reset for new creation
            setFormData({
                codigo: "",
                placa: "",
                modelo: "",
                año: "",
                color: "",
                tipo: "Carga",
                capacidad_tanque: "",
                foto_url: "",
                odometro_averiado: false
            })
            setPhotoPreview(null)
        }
    }, [vehicleToEdit, isOpen])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        })
    }

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            const objectUrl = URL.createObjectURL(file)
            setPhotoPreview(objectUrl)
        }
    }

    const uploadPhoto = async (file: File): Promise<string | null> => {
        try {
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('vehiculos')
                .upload(filePath, file)

            if (uploadError) {
                throw uploadError
            }

            const { data } = supabase.storage.from('vehiculos').getPublicUrl(filePath)
            return data.publicUrl
        } catch (error) {
            console.error('Error uploading photo:', error)
            toast.error('Error al subir la imagen')
            return null
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        try {
            const supabase = createClient()
            let finalFotoUrl = formData.foto_url

            // Upload new photo if selected
            if (fileInputRef.current?.files?.[0]) {
                const url = await uploadPhoto(fileInputRef.current.files[0])
                if (url) finalFotoUrl = url
            }

            const dataToSave = {
                codigo: formData.codigo,
                placa: formData.placa,
                modelo: formData.modelo,
                año: formData.año,
                color: formData.color,
                tipo: formData.tipo,
                capacidad_tanque: formData.capacidad_tanque,
                foto_url: finalFotoUrl,
                odometro_averiado: formData.odometro_averiado // [NEW]
            }

            let vehicleId = vehicleToEdit?.id

            let error;
            if (vehicleToEdit?.id) {
                // Update
                const { error: updateError } = await supabase
                    .from("vehiculos")
                    .update(dataToSave)
                    .eq("id", vehicleToEdit.id)
                error = updateError
            } else {
                // Insert
                const { data: newVehicle, error: insertError } = await supabase
                    .from("vehiculos")
                    .insert(dataToSave)
                    .select('id') // Need ID for fault creation
                    .single()

                if (newVehicle) vehicleId = newVehicle.id
                error = insertError
            }

            if (error) throw error

            // [NEW] Logic: If odometro_averiado is TRUE, create automatic Fault
            if (formData.odometro_averiado && vehicleId) {
                // Check if active fault exists to avoid duplicates
                const { data: existingFaults } = await supabase
                    .from('fallas')
                    .select('id')
                    .eq('vehiculo_id', vehicleId)
                    .eq('descripcion', 'Falla de Odómetro (Reporte Automático)')
                    .in('estado', ['Pendiente', 'En Revisión'])

                if (!existingFaults || existingFaults.length === 0) {
                    await supabase.from('fallas').insert({
                        vehiculo_id: vehicleId,
                        descripcion: 'Falla de Odómetro (Reporte Automático)',
                        tipo_falla: 'Mecánica',
                        prioridad: 'Baja',
                        estado: 'Pendiente',
                        created_at: new Date().toISOString()
                    })
                    toast.warning("Falla de Odómetro registrada automáticamente en Taller")
                }
            }

            toast.success(vehicleToEdit ? "Vehículo actualizado" : "Vehículo creado")
            onVehicleSaved()
            onClose()
        } catch (error) {
            console.error("Error saving vehicle:", error)
            toast.error("Error al guardar el vehículo")
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-neutral-100 shrink-0">
                    <DialogTitle className="text-lg font-medium text-neutral-900">
                        {vehicleToEdit ? "Editar vehículo" : "Nuevo vehículo"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
                    {/* PHOTO UPLOAD */}
                    <div className="flex flex-col items-center justify-center space-y-2 pb-4 border-b border-neutral-100">
                        <div
                            className="relative w-32 h-32 bg-neutral-50 flex items-center justify-center cursor-pointer overflow-hidden group hover:bg-neutral-100 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {photoPreview ? (
                                <Image
                                    src={photoPreview}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="text-center text-neutral-400">
                                    <Camera className="w-6 h-6 mx-auto mb-1" strokeWidth={1.5} />
                                    <span className="text-xs">Subir foto</span>
                                </div>
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-neutral-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="text-white w-5 h-5" strokeWidth={1.5} />
                            </div>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handlePhotoSelect}
                        />
                        <p className="text-xs text-neutral-400">JPG, PNG, WEBP (Máx. 5MB)</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Código</label>
                            <input
                                name="codigo"
                                value={formData.codigo}
                                onChange={handleChange}
                                required
                                placeholder="Ej. C-01"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Placa</label>
                            <input
                                name="placa"
                                value={formData.placa}
                                onChange={handleChange}
                                required
                                placeholder="Ej. AB123CD"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Modelo</label>
                            <input
                                name="modelo"
                                value={formData.modelo}
                                onChange={handleChange}
                                required
                                placeholder="Ej. Toyota Hilux"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Año</label>
                            <input
                                name="año"
                                value={formData.año}
                                onChange={handleChange}
                                placeholder="2024"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Color</label>
                            <input
                                name="color"
                                value={formData.color}
                                onChange={handleChange}
                                placeholder="Blanco"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Capacidad de tanque</label>
                            <input
                                name="capacidad_tanque"
                                value={formData.capacidad_tanque}
                                onChange={handleChange}
                                placeholder="Litros"
                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Tipo de vehículo</label>
                            <CustomDropdown
                                value={formData.tipo}
                                onChange={(val) => setFormData({ ...formData, tipo: val })}
                                options={[
                                    { value: 'Particular', label: 'Particular' },
                                    { value: 'Carga', label: 'Carga' },
                                    { value: 'Moto', label: 'Moto' },
                                ]}
                            />
                        </div>

                        {/* Odometer Status Switch */}
                        <div className="col-span-1 md:col-span-2 py-4 border-t border-neutral-100 flex items-center justify-between gap-4">
                            <div className="space-y-0.5">
                                <div className="text-sm font-medium text-neutral-900">
                                    Odómetro averiado
                                </div>
                                <p className="text-xs text-neutral-500">
                                    Activar si el contador de km no funciona. Esto creará una alerta automática en Taller.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-xs ${formData.odometro_averiado ? 'text-red-600 font-medium' : 'text-neutral-400'}`}>
                                    {formData.odometro_averiado ? "Avería activa" : "Operativo"}
                                </span>
                                <Switch
                                    checked={!!formData.odometro_averiado}
                                    onCheckedChange={(checked) => setFormData({ ...formData, odometro_averiado: checked })}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t border-neutral-100 flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40"
                        >
                            {loading ? "Guardando..." : (vehicleToEdit ? "Guardar cambios" : "Crear vehículo")}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
