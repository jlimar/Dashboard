"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Loader2, AlertCircle, ChevronDown, ChevronUp, Calendar, User } from "lucide-react"
import { CustomDropdown } from "@/components/ui/custom-dropdown"

type Report = {
  id: string
  date: string
  equipo_nombre: string
  tecnico_lider: string
  tecnico_auxiliar: string | null
  supervisor_id: string
  report_data: any
}

const getSupervisorName = async (supabase: any, id: string) => {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", id)
    .single()
  if (!data) return "Desconocido"
  return `${data.first_name || ""} ${data.last_name || ""}`.trim() || "Desconocido"
}

export default function EquipmentHistoryViewer() {
  const supabase = createClient()
  const [reports, setReports] = useState<Report[]>([])
  const [supervisors, setSupervisors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // Filters
  const [dateFilter, setDateFilter] = useState("")
  const [equipoFilter, setEquipoFilter] = useState("")
  const [tecnicoFilter, setTecnicoFilter] = useState("")
  const [criticalFilter, setCriticalFilter] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("equipment_control_reports")
      .select("*")
      .neq("equipo_nombre", "DRAFT")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })

    if (data) {
      setReports(data)

      // Fetch unique supervisors
      const supIds = Array.from(new Set(data.map((r) => r.supervisor_id)))
      const supMap: Record<string, string> = {}
      for (const id of supIds) {
        supMap[id] = await getSupervisorName(supabase, id)
      }
      setSupervisors(supMap)
    }
    setLoading(false)
  }

  // Check if a report contains any critical issue
  const hasCriticalIssue = (reportData: any) => {
    let hasCritical = false
    const checkGroup = (group: any) => {
      if (!group) return
      Object.values(group).forEach((v: any) => {
        const estado = typeof v === "object" ? v.estado : v
        if (estado === "Extraviado" || estado === "Dañado") hasCritical = true
      })
    }
    checkGroup(reportData.kit_lider)
    checkGroup(reportData.epp_lider)
    checkGroup(reportData.kit_auxiliar)
    checkGroup(reportData.epp_auxiliar)
    checkGroup(reportData.herramientas)
    return hasCritical
  }

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (dateFilter && r.date !== dateFilter) return false
      if (
        equipoFilter &&
        !r.equipo_nombre.toLowerCase().includes(equipoFilter.toLowerCase())
      )
        return false
      if (tecnicoFilter) {
        const term = tecnicoFilter.toLowerCase()
        const lider = (r.tecnico_lider || "").toLowerCase()
        const aux = (r.tecnico_auxiliar || "").toLowerCase()
        if (!lider.includes(term) && !aux.includes(term)) return false
      }
      if (criticalFilter && !hasCriticalIssue(r.report_data)) return false
      return true
    })
  }, [reports, dateFilter, equipoFilter, tecnicoFilter, criticalFilter])

  const uniqueEquipos = Array.from(new Set(reports.map((r) => r.equipo_nombre)))
  const equipoOptions = [
    { value: "", label: "Todos los equipos" },
    ...uniqueEquipos.map((eq) => ({ value: eq, label: eq })),
  ]

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const renderGroup = (group: any, title: string) => {
    if (!group || Object.keys(group).length === 0) return null

    const items = Object.entries(group).filter(([_, v]: any) => {
      const e = typeof v === "object" ? v.estado : v
      return e && e !== "No Aplica"
    })

    if (items.length === 0) return null

    return (
      <div className="mb-5">
        <h4 className="text-xs font-medium text-neutral-400 mb-2 pb-1 border-b border-neutral-100">
          {title}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          {items.map(([item, v]: any) => {
            const estado = typeof v === "object" ? v.estado : v
            return (
              <div
                key={item}
                className="flex justify-between items-center py-2 border-b border-neutral-100 last:border-b-0 text-sm"
              >
                <span className="text-neutral-700">{item}</span>
                <span
                  className={
                    estado === "Extraviado"
                      ? "text-red-600 font-medium"
                      : estado === "Dañado"
                        ? "text-neutral-900 font-medium"
                        : estado === "Operativo"
                          ? "text-neutral-600"
                          : "text-neutral-400"
                  }
                >
                  {estado}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="pb-6 mb-6 border-b border-neutral-100">
        <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight mb-1">
          Historial de auditorías
        </h1>
        <p className="text-sm text-neutral-500">
          Revisa el estado histórico de los equipos y herramientas.
        </p>
      </div>

      {/* FILTERS */}
      <div className="pb-6 mb-4 border-b border-neutral-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Fecha</label>
            <div className="relative">
              <Calendar
                className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5"
                strokeWidth={1.5}
              />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-5 bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Equipo</label>
            <CustomDropdown
              value={equipoFilter}
              onChange={setEquipoFilter}
              options={equipoOptions}
              placeholder="Todos los equipos"
              searchable
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Técnico</label>
            <div className="relative">
              <User
                className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5"
                strokeWidth={1.5}
              />
              <input
                type="text"
                placeholder="Buscar nombre..."
                value={tecnicoFilter}
                onChange={(e) => setTecnicoFilter(e.target.value)}
                className="w-full pl-5 bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 pb-1.5">
            <button
              type="button"
              onClick={() => setCriticalFilter(!criticalFilter)}
              className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
                criticalFilter
                  ? "text-red-600 font-medium"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              {criticalFilter ? "Solo críticos" : "Mostrar críticos"}
            </button>

            {(dateFilter || equipoFilter || tecnicoFilter || criticalFilter) && (
              <button
                type="button"
                onClick={() => {
                  setDateFilter("")
                  setEquipoFilter("")
                  setTecnicoFilter("")
                  setCriticalFilter(false)
                }}
                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RESULTS LIST */}
      <div className="divide-y divide-neutral-100">
        {filteredReports.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-400">
            No se encontraron auditorías con estos filtros.
          </div>
        ) : (
          filteredReports.map((report) => {
            const isExpanded = expandedId === report.id
            const isCritical = hasCriticalIssue(report.report_data)
            const rd = report.report_data

            return (
              <div key={report.id} className="py-4 transition-colors">
                {/* ROW HEADER (Clickable) */}
                <div
                  onClick={() => toggleExpand(report.id)}
                  className="cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 py-1 hover:bg-neutral-50/50 px-1 transition-colors"
                >
                  <div>
                    <p className="text-xs text-neutral-400 mb-0.5">
                      {report.date.split("-").reverse().join("/")}
                    </p>
                    <h3 className="font-medium text-neutral-900 text-base flex items-center gap-2.5">
                      {report.equipo_nombre}
                      {isCritical && (
                        <span className="text-xs font-medium text-red-600">
                          Con fallas
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="flex-1 md:px-8 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-neutral-400">Técnicos</p>
                      <p className="text-neutral-700 truncate">
                        {report.tecnico_lider}{" "}
                        <span className="text-neutral-300">/</span>{" "}
                        {report.tecnico_auxiliar}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-400">Auditor</p>
                      <p className="text-neutral-700 truncate">
                        {supervisors[report.supervisor_id]}
                      </p>
                    </div>
                  </div>

                  <div className="text-neutral-400 flex items-center justify-end">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
                    ) : (
                      <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </div>
                </div>

                {/* ROW BODY (Expanded) */}
                {isExpanded && (
                  <div className="pt-5 pb-2 pl-2 border-t border-neutral-100 mt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                      <div>
                        <h3 className="text-sm font-medium text-neutral-900 pb-1.5 mb-3 border-b border-neutral-100">
                          Líder: {report.tecnico_lider}
                        </h3>
                        {renderGroup(rd.kit_lider, "Kit FTTH líder")}
                        {renderGroup(rd.epp_lider, "EPP líder")}
                      </div>

                      {report.tecnico_auxiliar && (
                        <div>
                          <h3 className="text-sm font-medium text-neutral-900 pb-1.5 mb-3 border-b border-neutral-100">
                            Auxiliar: {report.tecnico_auxiliar}
                          </h3>
                          {renderGroup(rd.kit_auxiliar, "Kit FTTH auxiliar")}
                          {renderGroup(rd.epp_auxiliar, "EPP auxiliar")}
                        </div>
                      )}

                      <div className="md:col-span-2 mt-2">
                        <h3 className="text-sm font-medium text-neutral-900 pb-1.5 mb-3 border-b border-neutral-100">
                          Herramientas del equipo
                        </h3>
                        {renderGroup(rd.herramientas, "Inventario compartido")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
