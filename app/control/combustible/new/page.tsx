"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format, setHours, setMinutes, setSeconds } from "date-fns"
import { CalendarIcon, Loader2, ArrowLeft, Camera } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { LogoutButton } from "@/components/ui/logout-button"

import { createFuelLog, getVehicles, getVehicleDetailsAction, getActiveDriverAction, registerVoidedTicket } from "../actions"

const formSchema = z.object({
    ticket_number: z.string().min(1, "Número de ticket requerido"),
    fuel_date: z.date({
        required_error: "Fecha requerida",
    }),
    vehicle_id: z.string().min(1, "Seleccione un vehículo"),
    driver_name: z.string().min(1, "Nombre del conductor requerido"),
    liters: z.coerce.number().min(0.01, "Litros deben ser mayor a 0"),
    mileage: z.coerce.number().min(0, "Kilometraje requerido"),
    ticket_url: z.string().optional(),
    notes: z.string().optional(),
    is_skipped: z.boolean().default(false),
    is_borrowed: z.boolean().default(false),
    talonario_vehiculo_id: z.string().optional()
}).superRefine((data, ctx) => {
    if (data.is_borrowed && !data.talonario_vehiculo_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Debe seleccionar el vehículo prestamista",
            path: ["talonario_vehiculo_id"],
        });
    }
});

function NewFuelLogContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [vehicles, setVehicles] = useState<any[]>([])
    const [uploading, setUploading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [vehiclesLoaded, setVehiclesLoaded] = useState(false)
    const [scannedVehicle, setScannedVehicle] = useState<any>(null)

    // Sequence Alert State
    const [sequenceAlertOpen, setSequenceAlertOpen] = useState(false)
    const [lastTicketNum, setLastTicketNum] = useState<number | null>(null)

    // Correction Alert State
    const [correctionAlertOpen, setCorrectionAlertOpen] = useState(false)
    const [correctionData, setCorrectionData] = useState<{
        newMileage: number,
        currentSystemKm: number,
        vehicleId: string
    } | null>(null)

    // Void Ticket Alert State
    const [voidTicketDialogOpen, setVoidTicketDialogOpen] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        const loadInitialData = async () => {
            const data = await getVehicles()
            setVehicles(data)
            setVehiclesLoaded(true)
        }
        loadInitialData()
    }, [])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            ticket_number: "",
            driver_name: "",
            liters: 0,
            mileage: 0,
            ticket_url: "",
            notes: "",
            fuel_date: new Date(),
            is_skipped: false,
            is_borrowed: false,
            talonario_vehiculo_id: ""
        },
    })

    // Handle URL Params (SCAN MODE)
    useEffect(() => {
        const pVehicleId = searchParams.get('vehicleId')

        async function loadScannedDetails(id: string) {
            try {
                const details = await getVehicleDetailsAction(id)
                if (details) {
                    setScannedVehicle(details)
                    form.setValue("vehicle_id", details.id)
                    
                    if (details.last_fuel?.ticket_number) {
                        const nextTicket = parseInt(details.last_fuel.ticket_number, 10) + 1;
                        if (!isNaN(nextTicket)) {
                            const nextTicketStr = nextTicket.toString().padStart(details.last_fuel.ticket_number.length, '0');
                            form.setValue("ticket_number", nextTicketStr);
                        }
                    }
                    
                    // Attempt to auto-fill driver from active trip
                    const activeDriver = await getActiveDriverAction(id)
                    if (activeDriver) {
                        form.setValue("driver_name", activeDriver)
                    } else if (details.driver) {
                        const dName = `${details.driver.first_name} ${details.driver.last_name}`
                        form.setValue("driver_name", dName)
                    }
                }
            } catch (err) {
                console.error("Error loading scanned details", err)
            }
        }

        if (pVehicleId) {
            loadScannedDetails(pVehicleId)
        }
    }, [searchParams, form])

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('fuel-receipts')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('fuel-receipts')
                .getPublicUrl(filePath)

            form.setValue("ticket_url", publicUrl)
            toast.success("Imagen cargada correctamente")
        } catch (error: any) {
            console.error(error)
            toast.error("Error subiendo imagen")
        } finally {
            setUploading(false)
        }
    }

    const onSubmit = async (values: z.infer<typeof formSchema>, bypass: boolean = false, forceKm: boolean = false) => {
        setLoading(true)
        try {
            // Adjust fuel_date to have current time
            const now = new Date()
            const adjustedDate = setSeconds(setMinutes(setHours(values.fuel_date, now.getHours()), now.getMinutes()), now.getSeconds())
            
            const payload = { 
                ...values, 
                fuel_date: adjustedDate,
                is_skipped: bypass || values.is_skipped,
                forceCorrection: forceKm 
            }

            const res = await createFuelLog(payload)

            if (res.success) {
                toast.success("Registro guardado correctamente")
                router.push("/control/combustible")
                setSequenceAlertOpen(false)
                setCorrectionAlertOpen(false)
            } else {
                if (res.requiresSequenceBypass) {
                    setLastTicketNum(res.lastTicket)
                    setSequenceAlertOpen(true)
                } else if (res.requiresCorrection) {
                    setCorrectionData({
                        newMileage: values.mileage,
                        currentSystemKm: res.currentSystemKm,
                        vehicleId: values.vehicle_id
                    })
                    setCorrectionAlertOpen(true)
                } else {
                    toast.error("Error: " + res.error)
                }
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setLoading(false)
        }
    }

    const vehicleOptions = vehicles.map((v) => ({
        value: v.id,
        label: v.modelo,
        description: [v.placa, v.codigo].filter(Boolean).join(" · "),
    }))

    return (
        <main className="min-h-screen bg-white pb-20 font-sans text-neutral-900">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-neutral-100 px-4 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/control/combustible" className="text-neutral-400 hover:text-neutral-900 transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-light text-neutral-900 leading-none tracking-tight">Nuevo ticket</h1>
                            <p className="text-xs text-neutral-500 mt-1">Registro de combustible</p>
                        </div>
                    </div>
                    <LogoutButton />
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-4 mt-8 space-y-8">
                {/* Vehicle Summary (if scanned) */}
                {scannedVehicle && (
                    <div className="pb-6 border-b border-neutral-100 space-y-4">
                        <div>
                            <h2 className="text-xl font-light tracking-tight text-neutral-900">{scannedVehicle.modelo}</h2>
                            <p className="text-neutral-500 font-mono text-xs mt-0.5">{scannedVehicle.placa} · {scannedVehicle.codigo}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-6 pt-3 border-t border-neutral-100">
                            <div className="flex flex-col">
                                <span className="text-xs text-neutral-500">Km actual</span>
                                <span className="text-xl font-light text-neutral-900 tabular-nums mt-0.5">
                                    {scannedVehicle.kilometraje?.toLocaleString() || 0} <span className="text-xs text-neutral-400">km</span>
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-neutral-500">Último ticket</span>
                                <span className="text-xl font-light text-neutral-900 tabular-nums mt-0.5">
                                    #{scannedVehicle.last_fuel?.ticket_number || '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => onSubmit(v))} className="space-y-8">
                        {/* Vehicle & Driver */}
                        {!scannedVehicle && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormField
                                    control={form.control}
                                    name="vehicle_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-neutral-500 font-normal">Vehículo</FormLabel>
                                            <FormControl>
                                                <CustomDropdown
                                                    value={field.value}
                                                    onChange={async (id) => {
                                                        const v = vehicles.find((veh) => veh.id === id)
                                                        if (!v) {
                                                            field.onChange("")
                                                            return
                                                        }
                                                        field.onChange(v.id)

                                                        let details: any = null
                                                        if (!form.getValues("is_borrowed")) {
                                                            details = await getVehicleDetailsAction(v.id)
                                                            if (details && details.last_fuel?.ticket_number) {
                                                                const nextTicket = parseInt(details.last_fuel.ticket_number, 10) + 1
                                                                if (!isNaN(nextTicket)) {
                                                                    const nextTicketStr = nextTicket.toString().padStart(details.last_fuel.ticket_number.length, '0')
                                                                    form.setValue("ticket_number", nextTicketStr)
                                                                    toast.info(`Siguiente ticket sugerido: #${nextTicketStr}`)
                                                                }
                                                            }
                                                        }

                                                        // Auto-fill mileage from vehicle state
                                                        if (v.kilometraje !== undefined && v.kilometraje !== null) {
                                                            form.setValue("mileage", v.kilometraje)
                                                        } else if (details?.kilometraje !== undefined && details?.kilometraje !== null) {
                                                            form.setValue("mileage", details.kilometraje)
                                                        }

                                                        // Auto-detect driver
                                                        const activeDriver = await getActiveDriverAction(v.id)
                                                        if (activeDriver) {
                                                            form.setValue("driver_name", activeDriver)
                                                            toast.info(`Chofer detectado: ${activeDriver}`)
                                                        } else if (details?.driver) {
                                                            form.setValue("driver_name", `${details.driver.first_name} ${details.driver.last_name}`)
                                                        }
                                                    }}
                                                    options={vehicleOptions}
                                                    searchable
                                                    placeholder="Seleccionar vehículo..."
                                                    searchPlaceholder="Buscar placa, modelo o código..."
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="driver_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-neutral-500 font-normal">Conductor responsable</FormLabel>
                                            <FormControl>
                                                <input
                                                    type="text"
                                                    placeholder="Nombre completo"
                                                    className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="col-span-full py-4 border-y border-neutral-100 space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-sm font-medium text-neutral-900">¿Usaste un talonario prestado?</FormLabel>
                                            <p className="text-xs text-neutral-500">Activa esto si el ticket pertenece a la chequera de otro vehículo.</p>
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="is_borrowed"
                                            render={({ field }) => (
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={(val) => {
                                                        field.onChange(val)
                                                        if (!val) form.setValue("talonario_vehiculo_id", "")
                                                    }} />
                                                </FormControl>
                                            )}
                                        />
                                    </div>

                                    {form.watch("is_borrowed") && (
                                        <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                                            <FormField
                                                control={form.control}
                                                name="talonario_vehiculo_id"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs text-neutral-500 font-normal">Selecciona el vehículo dueño del talonario</FormLabel>
                                                        <FormControl>
                                                            <CustomDropdown
                                                                value={field.value || ""}
                                                                onChange={async (id) => {
                                                                    const v = vehicles.find((veh) => veh.id === id)
                                                                    if (!v) {
                                                                        field.onChange("")
                                                                        return
                                                                    }
                                                                    field.onChange(v.id)

                                                                    const details = await getVehicleDetailsAction(v.id)
                                                                    if (details && details.last_fuel?.ticket_number) {
                                                                        const nextTicket = parseInt(details.last_fuel.ticket_number, 10) + 1
                                                                        if (!isNaN(nextTicket)) {
                                                                            const nextTicketStr = nextTicket.toString().padStart(details.last_fuel.ticket_number.length, '0')
                                                                            form.setValue("ticket_number", nextTicketStr)
                                                                            toast.info(`Ticket sugerido del talonario prestado: #${nextTicketStr}`)
                                                                        }
                                                                    }
                                                                }}
                                                                options={vehicleOptions}
                                                                searchable
                                                                placeholder="Seleccionar vehículo..."
                                                                searchPlaceholder="Buscar placa, modelo o código..."
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {scannedVehicle && !form.watch("driver_name") && (
                            <FormField
                                control={form.control}
                                name="driver_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-neutral-500 font-normal">Conductor responsable</FormLabel>
                                        <FormControl>
                                            <input
                                                type="text"
                                                placeholder="Nombre completo"
                                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Ticket Number & Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField
                                control={form.control}
                                name="ticket_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-neutral-500 font-normal">N# de ticket</FormLabel>
                                        <FormControl>
                                            <input
                                                type="text"
                                                placeholder="Generado automáticamente"
                                                readOnly={true}
                                                className="w-full bg-transparent border-b border-neutral-200 py-1.5 text-sm text-neutral-500 outline-none cursor-not-allowed tabular-nums"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="fuel_date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-neutral-500 font-normal">Fecha de carga</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            "w-full flex items-center gap-2 bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-left outline-none transition-colors",
                                                            field.value ? "text-neutral-900" : "text-neutral-400"
                                                        )}
                                                    >
                                                        <CalendarIcon className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.5} />
                                                        {field.value ? format(field.value, "PPP") : <span>Seleccionar fecha</span>}
                                                    </button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => date > new Date()}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Data Input */}
                        <div className="grid grid-cols-2 gap-8">
                            <FormField
                                control={form.control}
                                name="liters"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-neutral-500 font-normal">Litros cargados</FormLabel>
                                        <FormControl>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors tabular-nums"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="mileage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-neutral-500 font-normal">Nuevo kilometraje (km)</FormLabel>
                                        <FormControl>
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors tabular-nums"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Image Upload */}
                        <div className="space-y-2">
                            <FormLabel className="text-xs text-neutral-500 font-normal">Evidencia (foto del ticket)</FormLabel>
                            <div className="relative group">
                                {form.watch("ticket_url") ? (
                                    <div className="space-y-2">
                                        <div className="relative w-full aspect-video overflow-hidden bg-neutral-50">
                                            <img src={form.getValues("ticket_url")} alt="Ticket" className="object-cover w-full h-full" />
                                        </div>
                                        <button
                                            type="button"
                                            className="text-xs text-red-600 hover:text-red-700 transition-colors"
                                            onClick={() => form.setValue("ticket_url", "")}
                                        >
                                            Eliminar y repetir
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative border-b border-dashed border-neutral-200 py-8 flex flex-col items-center gap-2 hover:border-neutral-400 transition-colors cursor-pointer">
                                        <Camera className="w-5 h-5 text-neutral-400" strokeWidth={1.25} />
                                        <div className="text-center">
                                            <p className="text-sm text-neutral-700">Tomar foto del ticket</p>
                                            <p className="text-xs text-neutral-400">Usa la cámara o sube desde la galería</p>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={onUpload}
                                            disabled={uploading}
                                        />
                                    </div>
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center z-10">
                                        <Loader2 className="animate-spin text-neutral-700 w-5 h-5" />
                                        <p className="text-xs text-neutral-500 mt-2">Subiendo...</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-6 border-t border-neutral-100 flex items-center justify-between gap-4">
                            <button
                                type="button"
                                className="text-xs text-red-600 hover:text-red-700 transition-colors"
                                onClick={() => {
                                    if (!form.getValues("ticket_number") || !form.getValues("vehicle_id")) {
                                        toast.error("Selecciona un vehículo e indica el número de ticket a anular")
                                        return
                                    }
                                    setVoidTicketDialogOpen(true)
                                }}
                            >
                                Anular N# {form.watch("ticket_number") || ""}
                            </button>

                            <button
                                type="submit"
                                className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                                disabled={loading || uploading}
                            >
                                {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando...</> : "Guardar registro"}
                            </button>
                        </div>
                    </form>
                </Form>
            </div>

            {/* SEQUENCE ALERT */}
            <AlertDialog open={sequenceAlertOpen} onOpenChange={setSequenceAlertOpen}>
                <AlertDialogContent className="max-w-sm bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm p-6 animate-in fade-in zoom-in-95 duration-150">
                    <AlertDialogHeader className="text-left space-y-1.5">
                        <AlertDialogTitle className="text-base font-medium text-neutral-900">Salto de secuencia</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-neutral-500 leading-relaxed">
                            El último ticket registrado es el <strong>#{lastTicketNum}</strong>. Estás intentando registrar el <strong>#{form.getValues("ticket_number")}</strong>. ¿Deseas registrar este salto con una nota explicativa?
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="mt-4">
                        <input
                            type="text"
                            placeholder="Motivo del salto (ej. Hoja dañada)"
                            className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                            onChange={(e) => form.setValue("notes", e.target.value)}
                        />
                    </div>

                    <AlertDialogFooter className="mt-6 flex flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={() => setSequenceAlertOpen(false)}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Corregir número
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!form.getValues("notes")) {
                                    toast.error("Debes indicar el motivo del salto")
                                    return
                                }
                                onSubmit(form.getValues(), true)
                            }}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                        >
                            Saltar y guardar
                        </button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* MILEAGE CORRECTION ALERT */}
            <AlertDialog open={correctionAlertOpen} onOpenChange={setCorrectionAlertOpen}>
                <AlertDialogContent className="max-w-sm bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm p-6 animate-in fade-in zoom-in-95 duration-150">
                    <AlertDialogHeader className="text-left space-y-1.5">
                        <AlertDialogTitle className="text-base font-medium text-neutral-900">Kilometraje incongruente</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-neutral-500 leading-relaxed">
                            Registramos <strong>{correctionData?.currentSystemKm?.toLocaleString()} km</strong> en sistema, pero indicas <strong>{correctionData?.newMileage?.toLocaleString()} km</strong>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <p className="text-xs text-red-600 mt-2">
                        ¿Deseas corregir el sistema con tu valor actual?
                    </p>
                    <AlertDialogFooter className="mt-6 flex flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={() => setCorrectionAlertOpen(false)}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onSubmit(form.getValues(), false, true)
                            }}
                            className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                        >
                            Sí, corregir y guardar
                        </button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* VOID TICKET ALERT */}
            <AlertDialog open={voidTicketDialogOpen} onOpenChange={setVoidTicketDialogOpen}>
                <AlertDialogContent className="max-w-sm bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm p-6 animate-in fade-in zoom-in-95 duration-150">
                    <AlertDialogHeader className="text-left space-y-1.5">
                        <AlertDialogTitle className="text-base font-medium text-neutral-900">Anular ticket físico</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-neutral-500 leading-relaxed">
                            Se registrará el ticket <strong>#{form.getValues("ticket_number")}</strong> como anulado en el sistema. Por favor indica el motivo de la anulación:
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="mt-4">
                        <input
                            type="text"
                            placeholder="Motivo (ej. Error de escritura, dañado)"
                            className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                            onChange={(e) => form.setValue("notes", e.target.value)}
                        />
                    </div>

                    <AlertDialogFooter className="mt-6 flex flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={() => {
                                setVoidTicketDialogOpen(false)
                                form.setValue("notes", "")
                            }}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                const notes = form.getValues("notes")
                                if (!notes) {
                                    toast.error("Debes indicar el motivo")
                                    return
                                }
                                setLoading(true)
                                try {
                                    const res = await registerVoidedTicket({
                                        ticket_number: form.getValues("ticket_number"),
                                        vehicle_id: form.getValues("vehicle_id"),
                                        notes: notes
                                    })
                                    if (res.success) {
                                        toast.success("Ticket anulado exitosamente")
                                        setVoidTicketDialogOpen(false)
                                        // Avanzar al siguiente número de ticket
                                        const current = parseInt(form.getValues("ticket_number").replace(/\D/g, ''), 10)
                                        if (!isNaN(current)) {
                                            const nextTicketStr = (current + 1).toString().padStart(form.getValues("ticket_number").length, '0')
                                            form.setValue("ticket_number", nextTicketStr)
                                            form.setValue("notes", "")
                                        }
                                    } else {
                                        toast.error(res.error || "Error al anular")
                                    }
                                } finally {
                                    setLoading(false)
                                }
                            }}
                            className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                        >
                            Confirmar anulación
                        </button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    )
}

export default function NewFuelLogPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-400">Cargando...</div>}>
            <NewFuelLogContent />
        </Suspense>
    )
}
