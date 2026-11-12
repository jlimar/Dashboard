"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowLeft, Fuel, Plus, FileSpreadsheet, Filter, QrCode, Truck, X, Image as ImageIcon, RotateCcw, Send } from "lucide-react"
import { DateRange } from "react-day-picker"
import { DailyReportDialog } from "./daily-report-dialog"
import * as XLSX from "xlsx"

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Calendar } from "@/components/ui/calendar"
import { LogoutButton } from "@/components/ui/logout-button"

import { getFuelLogs, getVehicles, getTodayStats, annulFuelLog, getDailyReports } from "./actions"

export default function FuelControlPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [vehicles, setVehicles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isMounted, setIsMounted] = useState(false)

    // Filters
    const [selectedVehicle, setSelectedVehicle] = useState("all")
    const [dateRange, setDateRange] = useState<DateRange | undefined>()
    const [selectedLog, setSelectedLog] = useState<any | null>(null)
    const [todayStats, setTodayStats] = useState({ totalLiters: 0, count: 0 })
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
    const [activePreset, setActivePreset] = useState<string | null>(null)
    
    // Reports State
    const [dailyReports, setDailyReports] = useState<any[]>([])
    const [selectedDailyReport, setSelectedDailyReport] = useState<any | null>(null)
    
    // Annulment State
    const [annulDialogOpen, setAnnulDialogOpen] = useState(false)
    const [annulReason, setAnnulReason] = useState("")
    const [logToAnnul, setLogToAnnul] = useState<string | null>(null)
    const [annulling, setAnnulling] = useState(false)

    // Tab State
    const [activeTab, setActiveTab] = useState("logs")

    useEffect(() => {
        setIsMounted(true)
        loadInitialData()
    }, [])

    async function loadInitialData() {
        setLoading(true)
        try {
            const [vehData, logData, statsData, reportData] = await Promise.all([
                getVehicles(),
                getFuelLogs(),
                getTodayStats(format(new Date(), "yyyy-MM-dd")),
                getDailyReports()
            ])
            setVehicles(vehData || [])
            setLogs(logData || [])
            setTodayStats(statsData || { totalLiters: 0, count: 0 })
            setDailyReports(reportData || [])
        } catch (error) {
            toast.error("Error cargando datos")
        } finally {
            setLoading(false)
        }
    }

    if (!isMounted) return null

    const handleFilter = async (vId?: string, range?: DateRange) => {
        const vehicleId = vId ?? selectedVehicle
        const dr = range ?? dateRange
        setLoading(true)
        const data = await getFuelLogs({
            vehicleId,
            startDate: dr?.from ? format(dr.from, "yyyy-MM-dd") : undefined,
            endDate: dr?.to ? format(dr.to, "yyyy-MM-dd") : undefined
        })
        setLogs(data || [])
        setLoading(false)
        setFilterDrawerOpen(false)
    }

    const applyPreset = (preset: string) => {
        const today = new Date()
        let range: DateRange | undefined
        if (preset === "today") {
            range = { from: today, to: today }
        } else if (preset === "week") {
            range = { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) }
        } else if (preset === "month") {
            range = { from: startOfMonth(today), to: endOfMonth(today) }
        }
        setDateRange(range)
        setActivePreset(preset)
        handleFilter(undefined, range)
    }

    const clearFilters = () => {
        setSelectedVehicle("all")
        setDateRange(undefined)
        setActivePreset(null)
        setFilterDrawerOpen(false)
        handleFilter("all", undefined)
    }

    const hasActiveFilters = selectedVehicle !== "all" || !!dateRange
    const activeFilterCount = (selectedVehicle !== "all" ? 1 : 0) + (dateRange ? 1 : 0)
    const selectedVehicleName = vehicles.find(v => v.id === selectedVehicle)

    const handleAnnul = async () => {
        if (!logToAnnul || !annulReason) {
            toast.error("Debes indicar un motivo")
            return
        }
        setAnnulling(true)
        try {
            const res = await annulFuelLog(logToAnnul, annulReason)
            if (res.success) {
                toast.success("Ticket anulado correctamente")
                setAnnulDialogOpen(false)
                setLogToAnnul(null)
                setAnnulReason("")
                loadInitialData()
            } else {
                toast.error("Error: " + res.error)
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setAnnulling(false)
        }
    }

    const exportToExcel = () => {
        if (logs.length === 0) return
        
        // Sort logs by Vehicle and then by Date
        const sortedLogs = [...logs].sort((a, b) => {
            const vA = a.vehicle?.codigo || ""
            const vB = b.vehicle?.codigo || ""
            if (vA < vB) return -1
            if (vA > vB) return 1
            return new Date(a.fuel_date).getTime() - new Date(b.fuel_date).getTime()
        })

        const excelData = sortedLogs.map(log => {
            const date = new Date(log.fuel_date)
            const motivo = [log.notes, log.void_reason].filter(Boolean).join(" - ")
            
            let talonarioInfo = "Propio";
            if (log.talonario_vehiculo_id && log.talonario_vehiculo_id !== log.vehicle_id) {
                const owner = vehicles.find(v => v.id === log.talonario_vehiculo_id);
                talonarioInfo = owner ? `Prestado de: ${owner.codigo}` : "Prestado";
            }

            return {
                "ID": log.id,
                "Ticket": log.ticket_number,
                "Talonario": talonarioInfo,
                "Fecha": format(date, "yyyy-MM-dd"),
                "Hora": format(date, "HH:mm"),
                "Vehículo": log.vehicle?.modelo || "N/A",
                "Placa": log.vehicle?.placa || "N/A",
                "Conductor": log.driver_name,
                "Litros": log.liters,
                "Kilometraje": log.mileage,
                "Supervisor": `${log.supervisor?.first_name || ''} ${log.supervisor?.last_name || ''}`.trim(),
                "Estado": log.status || 'active',
                "Motivo/Observaciones": motivo,
                "Enlace Foto": log.ticket_url || "Sin Foto"
            }
        })

        const worksheet = XLSX.utils.json_to_sheet(excelData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Combustible")
        
        // Generate buffer and trigger download
        XLSX.writeFile(workbook, `combustible_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
    }

    const vehicleOptions = [
        { value: "all", label: "Toda la flota" },
        ...vehicles.map((v) => ({
            value: v.id,
            label: v.modelo,
            description: v.codigo,
        })),
    ]

    return (
        <main className="min-h-screen bg-white pb-24 md:pb-12 font-sans text-neutral-900">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-neutral-100 px-4 py-4">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="text-neutral-400 hover:text-neutral-900 transition-colors">
                            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-light text-neutral-900 leading-none tracking-tight">Combustible</h1>
                            <p className="text-xs text-neutral-500 mt-1">Control de cargas</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/control/combustible/new"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span className="hidden sm:inline">Nuevo ticket</span>
                            <span className="sm:hidden">Nuevo</span>
                        </Link>
                        <LogoutButton />
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 mt-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {/* Stats Summary Row (Open Canvas) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pb-6 border-b border-neutral-100 mb-6">
                        <div className="flex flex-col">
                            <span className="text-xs text-neutral-500 font-normal">Litros hoy</span>
                            <span className="text-2xl font-light tracking-tight text-neutral-900 mt-0.5 tabular-nums">
                                {todayStats.totalLiters.toFixed(1)} L
                            </span>
                            <span className="text-xs text-neutral-400 mt-1">{todayStats.count} cargas</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-neutral-500 font-normal">Actividad</span>
                            <span className="text-2xl font-light tracking-tight text-neutral-900 mt-0.5">En línea</span>
                            <span className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                Supervisor activo
                            </span>
                        </div>
                        <div className="flex flex-col justify-center">
                            <Link
                                href="/control/combustible/scan"
                                className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                            >
                                <QrCode className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                                <span>Escanear QR</span>
                            </Link>
                        </div>
                        <div className="flex flex-col justify-center">
                            <button
                                type="button"
                                onClick={exportToExcel}
                                className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-900 transition-colors text-left"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                                <span>Exportar Excel</span>
                            </button>
                        </div>
                    </div>

                    <TabsList className="flex w-full justify-start gap-6 bg-transparent border-b border-neutral-100 p-0 rounded-none h-auto mb-6">
                        <TabsTrigger
                            value="logs"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 px-0 text-sm font-normal text-neutral-400 data-[state=active]:text-neutral-900 data-[state=active]:font-medium transition-colors gap-2"
                        >
                            <Fuel className="w-3.5 h-3.5 hidden sm:inline" strokeWidth={1.5} />
                            Historial de cargas
                        </TabsTrigger>
                        <TabsTrigger
                            value="reports"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 px-0 text-sm font-normal text-neutral-400 data-[state=active]:text-neutral-900 data-[state=active]:font-medium transition-colors gap-2"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 hidden sm:inline" strokeWidth={1.5} />
                            Cierres y reportes
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="logs" className="mt-0 space-y-6 outline-none">
                        {/* Filter Trigger + Quick Presets */}
                        <div className="flex items-center justify-between gap-4 pb-3 border-b border-neutral-100">
                            <div className="flex items-center gap-5">
                                <button
                                    type="button"
                                    onClick={() => setFilterDrawerOpen(true)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 text-xs transition-colors",
                                        hasActiveFilters ? "text-neutral-900 font-medium" : "text-neutral-500 hover:text-neutral-900"
                                    )}
                                >
                                    <Filter className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    <span>Filtros</span>
                                    {activeFilterCount > 0 && (
                                        <span className="text-[11px] text-neutral-500 tabular-nums">({activeFilterCount})</span>
                                    )}
                                </button>

                                <div className="flex items-center gap-4">
                                    {[{ id: "today", label: "Hoy" }, { id: "week", label: "Semana" }, { id: "month", label: "Mes" }].map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => activePreset === p.id ? clearFilters() : applyPreset(p.id)}
                                            className={cn(
                                                "text-xs transition-colors pb-0.5 border-b",
                                                activePreset === p.id
                                                    ? "text-neutral-900 font-medium border-neutral-900"
                                                    : "text-neutral-400 hover:text-neutral-700 border-transparent"
                                            )}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    <span className="hidden sm:inline">Limpiar</span>
                                </button>
                            )}
                        </div>

                        {/* Active Filter Chips */}
                        {hasActiveFilters && (
                            <div className="flex flex-wrap gap-4 text-xs text-neutral-600">
                                {selectedVehicle !== "all" && selectedVehicleName && (
                                    <span className="inline-flex items-center gap-1.5 border-b border-neutral-200 pb-0.5">
                                        <span>{selectedVehicleName.codigo}</span>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedVehicle("all"); handleFilter("all") }}
                                            className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                        >
                                            <X className="w-3 h-3" strokeWidth={1.5} />
                                        </button>
                                    </span>
                                )}
                                {dateRange?.from && (
                                    <span className="inline-flex items-center gap-1.5 border-b border-neutral-200 pb-0.5" suppressHydrationWarning>
                                        <span>
                                            {format(dateRange.from, "dd MMM", { locale: es })}
                                            {dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime() && ` - ${format(dateRange.to, "dd MMM", { locale: es })}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => { setDateRange(undefined); setActivePreset(null); handleFilter(undefined, undefined) }}
                                            className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                        >
                                            <X className="w-3 h-3" strokeWidth={1.5} />
                                        </button>
                                    </span>
                                )}
                            </div>
                        )}

                        {/* FILTER DRAWER */}
                        <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
                            <DrawerContent className="max-h-[85vh] bg-white/95 backdrop-blur-xs border-t border-neutral-200/70">
                                <DrawerHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <DrawerTitle className="text-base font-medium text-neutral-900">Filtros</DrawerTitle>
                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                onClick={clearFilters}
                                                className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
                                            >
                                                <RotateCcw className="w-3 h-3" strokeWidth={1.5} /> Limpiar
                                            </button>
                                        )}
                                    </div>
                                </DrawerHeader>
                                <div className="px-4 pb-6 space-y-6 overflow-y-auto">
                                    {/* Vehicle Selection with CustomDropdown */}
                                    <div className="space-y-1.5">
                                        <p className="text-xs text-neutral-500">Vehículo</p>
                                        <CustomDropdown
                                            value={selectedVehicle}
                                            onChange={(val) => setSelectedVehicle(val)}
                                            options={vehicleOptions}
                                            searchable
                                            placeholder="Toda la flota"
                                            searchPlaceholder="Buscar vehículo..."
                                        />
                                    </div>

                                    {/* Date Presets */}
                                    <div className="space-y-3">
                                        <p className="text-xs text-neutral-500">Período</p>
                                        <div className="flex items-center gap-6 pb-2 border-b border-neutral-100">
                                            {[{ id: "today", label: "Hoy" }, { id: "week", label: "Esta semana" }, { id: "month", label: "Este mes" }].map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (activePreset === p.id) {
                                                            setDateRange(undefined)
                                                            setActivePreset(null)
                                                        } else {
                                                            const today = new Date()
                                                            let range: DateRange | undefined
                                                            if (p.id === "today") range = { from: today, to: today }
                                                            else if (p.id === "week") range = { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) }
                                                            else if (p.id === "month") range = { from: startOfMonth(today), to: endOfMonth(today) }
                                                            setDateRange(range)
                                                            setActivePreset(p.id)
                                                        }
                                                    }}
                                                    className={cn(
                                                        "text-xs pb-1 border-b transition-colors",
                                                        activePreset === p.id
                                                            ? "text-neutral-900 font-medium border-neutral-900"
                                                            : "text-neutral-400 hover:text-neutral-700 border-transparent"
                                                    )}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Calendar for custom range */}
                                        <div className="flex justify-center pt-2">
                                            <Calendar
                                                mode="range"
                                                selected={dateRange}
                                                onSelect={(range) => { setDateRange(range); setActivePreset(null) }}
                                                numberOfMonths={1}
                                                locale={es}
                                                disabled={(date) => date > new Date()}
                                            />
                                        </div>
                                    </div>

                                    {/* Apply Action */}
                                    <div className="flex justify-end pt-2 border-t border-neutral-100">
                                        <button
                                            type="button"
                                            onClick={() => handleFilter()}
                                            className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                                        >
                                            Aplicar filtros
                                        </button>
                                    </div>
                                </div>
                            </DrawerContent>
                        </Drawer>

                        {loading ? (
                            <div className="py-20 text-center text-sm text-neutral-400">
                                <Loader2 className="animate-spin w-5 h-5 mx-auto mb-2" />
                                Cargando registros...
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="py-20 text-center">
                                <Fuel className="w-6 h-6 mx-auto text-neutral-300 mb-2" strokeWidth={1.25} />
                                <p className="text-sm text-neutral-400">No hay registros de carga encontrados.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-neutral-100">
                                {logs.map((log) => (
                                    <div
                                        key={log.id}
                                        className={cn(
                                            "group py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 transition-colors px-1",
                                            log.status === 'annulled' && "opacity-60"
                                        )}
                                        onClick={() => setSelectedLog(log)}
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <Fuel className="w-4 h-4 text-neutral-400 mt-1 shrink-0" strokeWidth={1.5} />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-medium text-sm text-neutral-900 truncate">{log.vehicle?.modelo}</h3>
                                                    {log.status === 'annulled' && (
                                                        <span className="text-xs text-red-600 font-medium">Anulado</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                                                    {log.vehicle?.placa} · Ticket #{log.ticket_number}
                                                </p>
                                                <p className="text-xs text-neutral-400 mt-1">
                                                    {log.driver_name} · Por: {log.supervisor?.first_name}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-8 pl-7 sm:pl-0">
                                            <div className="flex flex-col sm:items-end">
                                                <span className="text-xs text-neutral-400">Litros</span>
                                                <span className="text-base font-light text-emerald-600 tabular-nums">{log.liters} L</span>
                                            </div>
                                            <div className="flex flex-col sm:items-end">
                                                <span className="text-xs text-neutral-400">Kilometraje</span>
                                                <span className="text-base font-light text-neutral-900 tabular-nums">
                                                    {log.mileage?.toLocaleString()} <span className="text-xs text-neutral-400">km</span>
                                                </span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs text-neutral-400" suppressHydrationWarning>
                                                    {format(new Date(log.fuel_date), "dd MMM", { locale: es })}
                                                </p>
                                                <p className="text-xs text-neutral-600 tabular-nums" suppressHydrationWarning>
                                                    {format(new Date(log.fuel_date), "HH:mm")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="reports" className="mt-0 outline-none space-y-8">
                        <div className="py-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-base font-medium text-neutral-900">Nuevo cierre diario</h2>
                                <p className="text-xs text-neutral-500 mt-1">Genera o actualiza el resumen oficial de consumos para la fecha seleccionada.</p>
                            </div>
                            <DailyReportDialog onSuccess={() => loadInitialData()} />
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                                <h4 className="text-xs font-medium text-neutral-500">Historial de reportes</h4>
                                <button
                                    type="button"
                                    onClick={() => loadInitialData()}
                                    className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                                >
                                    <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
                                    Refrescar
                                </button>
                            </div>
                            {dailyReports.length === 0 ? (
                                <div className="py-12 text-center">
                                    <p className="text-sm text-neutral-400">No hay reportes archivados aún.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-neutral-100">
                                    {dailyReports.map((report) => (
                                        <div
                                            key={report.id}
                                            className="py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 transition-colors px-1"
                                            onClick={() => setSelectedDailyReport(report)}
                                        >
                                            <div>
                                                <h3 className="font-medium text-sm text-neutral-900 capitalize" suppressHydrationWarning>
                                                    {format(new Date(report.report_date + 'T12:00:00'), "EEEE dd 'de' MMMM yyyy", { locale: es })}
                                                </h3>
                                                <p className="text-xs text-neutral-400 mt-1">
                                                    {report.details?.length || 0} vehículos · {report.supervisor?.first_name}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-xs text-neutral-400 block">Total litros</span>
                                                <span className="text-lg font-light text-emerald-600 tabular-nums">
                                                    {Number(report.total_liters).toFixed(1)} L
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* DETAIL DIALOG */}
            <AlertDialog open={!!selectedLog} onOpenChange={(val) => !val && setSelectedLog(null)}>
                <AlertDialogContent className="max-w-md bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm p-6 animate-in fade-in zoom-in-95 duration-150">
                    <div className="space-y-5 max-h-[80vh] overflow-y-auto">
                        <AlertDialogHeader className="text-left space-y-1">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <AlertDialogTitle className="text-base font-medium text-neutral-900">Detalle de ticket</AlertDialogTitle>
                                    <AlertDialogDescription className="text-xs text-neutral-500 mt-0.5">
                                        N# {selectedLog?.ticket_number}
                                    </AlertDialogDescription>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedLog(null)}
                                    className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                    aria-label="Cerrar"
                                >
                                    <X className="w-4 h-4" strokeWidth={1.5} />
                                </button>
                            </div>
                        </AlertDialogHeader>

                        {/* Image Section */}
                        <div className="w-full bg-neutral-50 h-56 flex items-center justify-center overflow-hidden">
                            {selectedLog?.ticket_url ? (
                                <img
                                    src={selectedLog.ticket_url}
                                    alt="Ticket"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-neutral-300 flex flex-col items-center gap-1.5">
                                    <ImageIcon className="w-8 h-8" strokeWidth={1.25} />
                                    <span className="text-xs text-neutral-400">Sin foto adjunta</span>
                                </div>
                            )}
                        </div>

                        {selectedLog?.status === 'annulled' && (
                            <div className="border-l-2 border-red-500 pl-3 py-0.5">
                                <p className="text-xs font-medium text-red-600">Motivo de anulación</p>
                                <p className="text-sm text-neutral-700 italic mt-0.5">"{selectedLog.void_reason}"</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6 py-3 border-y border-neutral-100">
                            <div>
                                <p className="text-xs text-neutral-400">Fecha</p>
                                <p className="text-sm font-medium text-neutral-900 mt-0.5">
                                    {selectedLog && format(new Date(selectedLog.fuel_date), "dd/MM/yyyy")}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-neutral-400">Hora</p>
                                <p className="text-sm font-medium text-neutral-900 mt-0.5">
                                    {selectedLog && format(new Date(selectedLog.fuel_date), "HH:mm")}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-xs text-neutral-400">Vehículo</p>
                                <p className="text-sm font-medium text-neutral-900 mt-0.5">{selectedLog?.vehicle?.modelo}</p>
                                <p className="text-xs text-neutral-500 font-mono">{selectedLog?.vehicle?.placa}</p>
                            </div>
                            <div>
                                <p className="text-xs text-neutral-400">Conductor</p>
                                <p className="text-sm font-medium text-neutral-900 mt-0.5">{selectedLog?.driver_name}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-3 border-t border-neutral-100">
                            <div>
                                <p className="text-xs text-neutral-400">Litros</p>
                                <p className="text-2xl font-light text-emerald-600 tabular-nums mt-0.5">{selectedLog?.liters}</p>
                            </div>
                            <div>
                                <p className="text-xs text-neutral-400">Kilometraje</p>
                                <p className="text-2xl font-light text-neutral-900 tabular-nums mt-0.5">{selectedLog?.mileage?.toLocaleString()}</p>
                            </div>
                        </div>

                        {selectedLog?.notes && (
                            <div className="border-t border-neutral-100 pt-3">
                                <p className="text-xs text-neutral-400">Notas</p>
                                <p className="text-sm text-neutral-700 mt-0.5">{selectedLog.notes}</p>
                            </div>
                        )}
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            {/* DAILY REPORT DETAIL DIALOG */}
            <AlertDialog open={!!selectedDailyReport} onOpenChange={(val) => !val && setSelectedDailyReport(null)}>
                <AlertDialogContent className="max-w-md bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm p-6 animate-in fade-in zoom-in-95 duration-150">
                    <AlertDialogHeader className="text-left pb-3 border-b border-neutral-100">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <AlertDialogTitle className="text-base font-medium text-neutral-900">Resumen diario</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-neutral-500 mt-0.5 capitalize" suppressHydrationWarning>
                                    {selectedDailyReport && format(new Date(selectedDailyReport.report_date + 'T12:00:00'), "PPPP", { locale: es })}
                                </AlertDialogDescription>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDailyReport(null)}
                                className="text-neutral-400 hover:text-neutral-900 transition-colors"
                                aria-label="Cerrar"
                            >
                                <X className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                        </div>
                    </AlertDialogHeader>

                    <div className="space-y-5 max-h-[60vh] overflow-y-auto py-2">
                        <div className="pb-4 border-b border-neutral-100">
                            <p className="text-xs text-neutral-500">Consumo total</p>
                            <p className="text-2xl font-light text-neutral-900 tabular-nums mt-0.5">
                                {Number(selectedDailyReport?.total_liters).toFixed(1)} L
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-xs text-neutral-500">Desglose por vehículo</h4>
                            <div className="divide-y divide-neutral-100">
                                {selectedDailyReport?.details?.map((item: any, idx: number) => (
                                    <div key={idx} className="py-3 flex items-center justify-between gap-4">
                                        <div>
                                            <h5 className="text-sm font-medium text-neutral-900">{item.model}</h5>
                                            <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5">
                                                <span>{item.count} cargas</span>
                                                <span>·</span>
                                                <span className="tabular-nums">{item.startKm?.toLocaleString()} - {item.endKm?.toLocaleString()} km</span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-medium text-emerald-600 tabular-nums shrink-0">
                                            {item.liters.toFixed(1)} L
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter className="pt-3 border-t border-neutral-100 flex flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={() => setSelectedDailyReport(null)}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
                            onClick={() => {
                                const vehiclesList = selectedDailyReport.details?.map((v: any, index: number) =>
                                    `${index + 1}. ${v.model} / ${v.liters.toFixed(2)} L (${v.startKm}-${v.endKm} km)`
                                ).join("\n")

                                const message = `*Reporte de Combustible Diario*\n\n*Fecha:* ${selectedDailyReport.report_date}\n*Supervisor:* ${selectedDailyReport.supervisor?.first_name || "N/A"}\n\n*Vehículos:*\n${vehiclesList}\n\n*Total:* ${Number(selectedDailyReport.total_liters).toFixed(2)} L`

                                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
                            }}
                        >
                            <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                            Compartir resumen
                        </button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ANNUL DIALOG */}
            <AlertDialog open={annulDialogOpen} onOpenChange={setAnnulDialogOpen}>
                <AlertDialogContent className="max-w-sm bg-white/95 backdrop-blur-xs border border-neutral-200/70 shadow-sm p-6 animate-in fade-in zoom-in-95 duration-150">
                    <AlertDialogHeader className="text-left space-y-1.5">
                        <AlertDialogTitle className="text-base font-medium text-neutral-900">Anular ticket</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-neutral-500 leading-relaxed">
                            ¿Estás seguro de que deseas anular este registro? Esta acción no se puede deshacer y quedará auditada.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="mt-4">
                        <input
                            type="text"
                            placeholder="Indique el motivo de la anulación..."
                            className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                            value={annulReason}
                            onChange={(e) => setAnnulReason(e.target.value)}
                        />
                    </div>

                    <AlertDialogFooter className="mt-6 flex flex-row items-center justify-end gap-5">
                        <button
                            type="button"
                            onClick={() => {
                                setAnnulDialogOpen(false)
                                setLogToAnnul(null)
                                setAnnulReason("")
                            }}
                            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleAnnul}
                            disabled={annulling}
                            className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                        >
                            {annulling ? "Anulando..." : "Sí, anular ticket"}
                        </button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    )
}

function Loader2({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("animate-spin", className)}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}
