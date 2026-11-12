"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, PenLine, Loader2, Save, X, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { CustomDropdown } from "@/components/ui/custom-dropdown"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"

export default function CuadrillasManager() {
  const supabase = createClient()
  const [cuadrillas, setCuadrillas] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<"equipos" | "tecnicos">("equipos")

  // State for Cuadrillas
  const [isAdding, setIsAdding] = useState(false)
  const [newNombre, setNewNombre] = useState("")
  const [newLider, setNewLider] = useState<string>("none")
  const [newAuxiliar, setNewAuxiliar] = useState<string>("none")

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState("")
  const [editLider, setEditLider] = useState<string>("none")
  const [editAuxiliar, setEditAuxiliar] = useState<string>("none")

  // State for Tecnicos
  const [isAddingTecnico, setIsAddingTecnico] = useState(false)
  const [newTecnicoNombre, setNewTecnicoNombre] = useState("")

  const [editingTecnicoId, setEditingTecnicoId] = useState<string | null>(null)
  const [editTecnicoNombre, setEditTecnicoNombre] = useState("")

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "tecnico" | "cuadrilla"
    id: string
    label: string
  } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)

    // Fetch tecnicos
    const { data: tecData } = await supabase
      .from("tecnicos")
      .select("*")
      .order("nombre_completo", { ascending: true })
    if (tecData) {
      setTecnicos(tecData)
    }

    // Fetch cuadrillas
    const { data: cuadData } = await supabase
      .from("cuadrillas")
      .select("*")
      .order("created_at", { ascending: false })
    if (cuadData) {
      setCuadrillas(cuadData)
    }

    setIsLoading(false)
  }

  // --- TECNICOS CRUD ---
  const handleAddTecnico = async () => {
    if (!newTecnicoNombre.trim()) {
      toast.error("Ingresa el nombre del técnico")
      return
    }
    try {
      const { error } = await supabase
        .from("tecnicos")
        .insert({ nombre_completo: newTecnicoNombre.trim() })
      if (error) throw error
      toast.success("Técnico registrado")
      setNewTecnicoNombre("")
      setIsAddingTecnico(false)
      loadData()
    } catch (err) {
      toast.error("Error al registrar técnico")
    }
  }

  const confirmDeleteTarget = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === "tecnico") {
      try {
        const { error } = await supabase
          .from("tecnicos")
          .delete()
          .eq("id", deleteTarget.id)
        if (error) throw error
        toast.success("Técnico eliminado")
        loadData()
      } catch (err) {
        toast.error("Error al eliminar técnico")
      }
    } else {
      try {
        const { error } = await supabase
          .from("cuadrillas")
          .delete()
          .eq("id", deleteTarget.id)
        if (error) throw error
        toast.success("Cuadrilla eliminada")
        loadData()
      } catch (err) {
        toast.error("Error al eliminar")
      }
    }
  }

  const startEditingTecnico = (t: any) => {
    setEditingTecnicoId(t.id)
    setEditTecnicoNombre(t.nombre_completo)
  }

  const handleSaveTecnicoEdit = async () => {
    if (!editTecnicoNombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    try {
      const { error } = await supabase
        .from("tecnicos")
        .update({ nombre_completo: editTecnicoNombre.trim() })
        .eq("id", editingTecnicoId)
      if (error) throw error
      toast.success("Técnico actualizado")
      setEditingTecnicoId(null)
      loadData()
    } catch (err) {
      toast.error("Error al actualizar técnico")
    }
  }

  // --- CUADRILLAS CRUD ---
  const handleAdd = async () => {
    if (!newNombre.trim()) {
      toast.error("El nombre de la cuadrilla es obligatorio")
      return
    }

    try {
      const { error } = await supabase.from("cuadrillas").insert({
        nombre: newNombre.trim(),
        lider_id: newLider && newLider !== "none" ? newLider : null,
        auxiliar_id: newAuxiliar && newAuxiliar !== "none" ? newAuxiliar : null,
      })

      if (error) throw error
      toast.success("Cuadrilla creada")
      setNewNombre("")
      setNewLider("none")
      setNewAuxiliar("none")
      setIsAdding(false)
      loadData()
    } catch (err) {
      toast.error("Error al crear cuadrilla")
    }
  }

  const startEditing = (c: any) => {
    setEditingId(c.id)
    setEditNombre(c.nombre)
    setEditLider(c.lider_id || "none")
    setEditAuxiliar(c.auxiliar_id || "none")
  }

  const handleSaveEdit = async () => {
    if (!editNombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }

    try {
      const { error } = await supabase
        .from("cuadrillas")
        .update({
          nombre: editNombre.trim(),
          lider_id: editLider && editLider !== "none" ? editLider : null,
          auxiliar_id: editAuxiliar && editAuxiliar !== "none" ? editAuxiliar : null,
        })
        .eq("id", editingId)

      if (error) throw error
      toast.success("Cuadrilla actualizada")
      setEditingId(null)
      loadData()
    } catch (err) {
      toast.error("Error al actualizar")
    }
  }

  const getTecnicoName = (id: string) => {
    return tecnicos.find((t) => t.id === id)?.nombre_completo || "No asignado"
  }

  const tecnicoOptions = [
    { value: "none", label: "Sin asignar" },
    ...tecnicos.map((t) => ({
      value: t.id,
      label: t.nombre_completo,
    })),
  ]

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* TABS NAVIGATION */}
      <div className="flex items-center justify-center gap-8 border-b border-neutral-100 w-full max-w-sm mx-auto">
        <button
          type="button"
          onClick={() => setActiveTab("equipos")}
          className={`pb-2.5 text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "equipos"
              ? "border-neutral-900 text-neutral-900 font-medium"
              : "border-transparent text-neutral-400 hover:text-neutral-700"
          }`}
        >
          Equipos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tecnicos")}
          className={`pb-2.5 text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "tecnicos"
              ? "border-neutral-900 text-neutral-900 font-medium"
              : "border-transparent text-neutral-400 hover:text-neutral-700"
          }`}
        >
          Técnicos
        </button>
      </div>

      {activeTab === "tecnicos" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-end pb-4 border-b border-neutral-100">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">
                Directorio de técnicos
              </h2>
              <p className="text-neutral-500 text-sm mt-0.5">
                Administra el personal operativo.
              </p>
            </div>
            {!isAddingTecnico && (
              <button
                type="button"
                onClick={() => setIsAddingTecnico(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} /> Nuevo técnico
              </button>
            )}
          </div>

          {isAddingTecnico && (
            <div className="pb-6 border-b border-neutral-100 flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-neutral-500 mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={newTecnicoNombre}
                  onChange={(e) => setNewTecnicoNombre(e.target.value)}
                  className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400"
                  placeholder="Ej. Douglas Mayobre"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleAddTecnico}
                  className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" strokeWidth={1.5} /> Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingTecnico(false)}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          <div>
            {tecnicos.length === 0 ? (
              <div className="text-center py-10 text-sm text-neutral-400">
                No hay técnicos registrados.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {tecnicos.map((t) => (
                  <li
                    key={t.id}
                    className="py-3.5 px-2 hover:bg-neutral-50/50 flex items-center justify-between group transition-colors"
                  >
                    {editingTecnicoId === t.id ? (
                      <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <input
                          type="text"
                          value={editTecnicoNombre}
                          onChange={(e) => setEditTecnicoNombre(e.target.value)}
                          className="w-full sm:w-1/2 bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                          autoFocus
                        />
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={handleSaveTecnicoEdit}
                            className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" strokeWidth={1.5} /> Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTecnicoId(null)}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-neutral-400 w-6">
                            {t.nombre_completo.substring(0, 2)}
                          </span>
                          <span className="text-sm font-medium text-neutral-900">
                            {t.nombre_completo}
                          </span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEditingTecnico(t)}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors"
                            title="Editar"
                          >
                            <PenLine className="w-3.5 h-3.5" strokeWidth={1.25} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: "tecnico",
                                id: t.id,
                                label: t.nombre_completo,
                              })
                            }
                            className="text-neutral-400 hover:text-neutral-900 transition-colors"
                            title="Eliminar"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === "equipos" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-end pb-4 border-b border-neutral-100">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">
                Listado de equipos
              </h2>
              <p className="text-neutral-500 text-sm mt-0.5">
                Organiza a los técnicos en cuadrillas.
              </p>
            </div>
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Nueva cuadrilla
              </button>
            )}
          </div>

          {/* REGISTRAR CUADRILLA FORM */}
          {isAdding && (
            <div className="pb-6 border-b border-neutral-100 grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
              <div className="md:col-span-4">
                <h3 className="text-sm font-medium text-neutral-900">
                  Crear nuevo equipo
                </h3>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  Nombre del equipo *
                </label>
                <input
                  type="text"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400"
                  placeholder="Ej. Cuadrilla 1"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  Técnico líder
                </label>
                <CustomDropdown
                  value={newLider}
                  onChange={setNewLider}
                  options={tecnicoOptions}
                  placeholder="Seleccionar..."
                  searchable
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  Técnico auxiliar
                </label>
                <CustomDropdown
                  value={newAuxiliar}
                  onChange={setNewAuxiliar}
                  options={tecnicoOptions}
                  placeholder="Seleccionar..."
                  searchable
                />
              </div>
              <div className="flex items-center gap-4 justify-end pb-1">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" strokeWidth={1.5} /> Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-neutral-400 hover:text-neutral-900 transition-colors"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-neutral-100">
            {cuadrillas.length === 0 && !isAdding && (
              <div className="text-center py-10 text-sm text-neutral-400">
                No hay cuadrillas registradas.
              </div>
            )}

            {cuadrillas.map((c) => (
              <div
                key={c.id}
                className="py-5 px-2 flex flex-col md:flex-row gap-6 md:items-center justify-between group hover:bg-neutral-50/50 transition-colors"
              >
                {editingId === c.id ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5 flex-1 items-end">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">
                        Nombre del equipo
                      </label>
                      <input
                        type="text"
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">
                        Técnico líder
                      </label>
                      <CustomDropdown
                        value={editLider}
                        onChange={setEditLider}
                        options={tecnicoOptions}
                        placeholder="Seleccionar..."
                        searchable
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">
                        Técnico auxiliar
                      </label>
                      <CustomDropdown
                        value={editAuxiliar}
                        onChange={setEditAuxiliar}
                        options={tecnicoOptions}
                        placeholder="Seleccionar..."
                        searchable
                      />
                    </div>
                    <div className="flex items-center gap-4 justify-end pb-1">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" strokeWidth={1.5} /> Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-neutral-400 hover:text-neutral-900 transition-colors"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-neutral-400 mb-0.5">Equipo</p>
                        <p className="text-sm font-medium text-neutral-900">{c.nombre}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400 mb-0.5">Líder</p>
                        <p className="text-sm text-neutral-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 inline-block" />
                          {getTecnicoName(c.lider_id)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400 mb-0.5">Auxiliar</p>
                        <p className="text-sm text-neutral-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 inline-block" />
                          {getTecnicoName(c.auxiliar_id)}
                        </p>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startEditing(c)}
                        className="text-neutral-400 hover:text-neutral-900 transition-colors"
                        title="Editar"
                      >
                        <PenLine className="w-3.5 h-3.5" strokeWidth={1.25} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: "cuadrilla",
                            id: c.id,
                            label: c.nombre,
                          })
                        }
                        className="text-neutral-400 hover:text-neutral-900 transition-colors"
                        title="Eliminar"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget?.type === "tecnico"
            ? "Eliminar técnico"
            : "Eliminar cuadrilla"
        }
        description={
          deleteTarget?.type === "tecnico"
            ? `¿Seguro que deseas eliminar a "${deleteTarget?.label}"? Si pertenece a un equipo, su espacio quedará como 'Sin asignar'.`
            : `¿Seguro que deseas eliminar la cuadrilla "${deleteTarget?.label}"?`
        }
        onConfirm={confirmDeleteTarget}
      />
    </div>
  )
}
