"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { addGeodata, deleteGeodata } from "./actions";
import { ArrowLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { LogoutButton } from "@/components/ui/logout-button";

interface Geodata {
  estado: string;
  municipio: string;
  parroquia: string;
  sector: string;
}

export default function GeodataManagement() {
  const [data, setData] = useState<Geodata[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(0); // 0: Estado, 1: Municipio, 2: Parroquia, 3: Sector
  const [selection, setSelection] = useState({ estado: "", municipio: "", parroquia: "", sector: "" });
  const [newItemName, setNewItemName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = async () => {
    setLoading(true);
    const { data: zonas, error } = await supabase.from('zonas_operativas').select('*');
    if (!error && zonas) setData(zonas as Geodata[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const items = useMemo(() => {
    let filtered = data;
    if (level > 0) filtered = filtered.filter(item => item.estado === selection.estado);
    if (level > 1) filtered = filtered.filter(item => item.municipio === selection.municipio);
    if (level > 2) filtered = filtered.filter(item => item.parroquia === selection.parroquia);

    const key = level === 0 ? 'estado' : level === 1 ? 'municipio' : level === 2 ? 'parroquia' : 'sector';

    // Extraer únicos y evitar vacíos
    const uniqueVals = Array.from(new Set(filtered.map(item => item[key as keyof Geodata]))).filter(Boolean);
    return uniqueVals.sort();
  }, [data, level, selection]);

  const handleNavigate = (val: string) => {
    if (level === 0) setSelection({ estado: val, municipio: "", parroquia: "", sector: "" });
    else if (level === 1) setSelection({ ...selection, municipio: val, parroquia: "", sector: "" });
    else if (level === 2) setSelection({ ...selection, parroquia: val, sector: "" });

    if (level < 3) setLevel(level + 1);
  };

  const handleBreadcrumbClick = (targetLevel: number) => {
    setLevel(targetLevel);
    if (targetLevel === 0) setSelection({ estado: "", municipio: "", parroquia: "", sector: "" });
    else if (targetLevel === 1) setSelection({ ...selection, municipio: "", parroquia: "", sector: "" });
    else if (targetLevel === 2) setSelection({ ...selection, parroquia: "", sector: "" });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        estado: level === 0 ? newItemName.trim() : selection.estado,
        municipio: level === 1 ? newItemName.trim() : (level > 0 ? selection.municipio : ""),
        parroquia: level === 2 ? newItemName.trim() : (level > 1 ? selection.parroquia : ""),
        sector: level === 3 ? newItemName.trim() : (level > 2 ? selection.sector : "")
      };

      await addGeodata(payload);
      toast.success("Añadido correctamente");
      setNewItemName("");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Error al añadir");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!deletingItem) return;

    try {
      await deleteGeodata(level, selection, deletingItem);
      toast.success("Eliminado correctamente");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar");
    } finally {
      setDeletingItem(null);
    }
  };

  const levelName = level === 0 ? "Estado" : level === 1 ? "Municipio" : level === 2 ? "Parroquia" : "Sector";

  return (
    <div className="min-h-screen bg-white text-neutral-900 px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* HEADER UNIFORME */}
        <header className="pb-6 border-b border-neutral-100 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
              Volver al panel
            </Link>
            <LogoutButton />
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm overflow-x-auto">
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(0)}
              className={`whitespace-nowrap transition-colors ${level === 0 ? 'text-neutral-900 font-medium' : 'text-neutral-400 hover:text-neutral-900'}`}
            >
              Zonas operativas
            </button>
            {level > 0 && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" strokeWidth={1.25} />
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(1)}
                  className={`whitespace-nowrap transition-colors ${level === 1 ? 'text-neutral-900 font-medium' : 'text-neutral-400 hover:text-neutral-900'}`}
                >
                  {selection.estado}
                </button>
              </>
            )}
            {level > 1 && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" strokeWidth={1.25} />
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(2)}
                  className={`whitespace-nowrap transition-colors ${level === 2 ? 'text-neutral-900 font-medium' : 'text-neutral-400 hover:text-neutral-900'}`}
                >
                  {selection.municipio}
                </button>
              </>
            )}
            {level > 2 && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" strokeWidth={1.25} />
                <span className="text-neutral-900 font-medium whitespace-nowrap">
                  {selection.parroquia}
                </span>
              </>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Lado Izquierdo: Creación */}
          <div className="lg:col-span-1 space-y-6">
            <div>
              <h2 className="text-sm font-medium text-neutral-900 mb-3">
                Añadir {levelName.toLowerCase()}
              </h2>
              <form onSubmit={handleAdd} className="space-y-4">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={`Nombre del ${levelName.toLowerCase()}`}
                  className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newItemName.trim()}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.25} />
                  ) : (
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.25} />
                  )}
                  Guardar
                </button>
              </form>
            </div>

            <div className="pt-4 border-t border-neutral-100 text-xs text-neutral-400 leading-relaxed">
              Estás gestionando el nivel de <span className="text-neutral-600 font-medium">{levelName.toLowerCase()}</span>.
              Cualquier elemento eliminado borrará en cascada todas las zonas que dependan internamente de él.
            </div>
          </div>

          {/* Lado Derecho: Lista abierta */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-300" strokeWidth={1.25} />
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center border-t border-b border-neutral-100">
                <p className="text-neutral-400 text-sm">No hay datos en este nivel</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100">
                {items.map((val) => (
                  <div
                    key={val}
                    onClick={() => handleNavigate(val)}
                    className="group flex items-center justify-between py-3 px-2 -mx-2 hover:bg-neutral-50/50 transition-colors cursor-pointer"
                  >
                    <span className="text-sm text-neutral-900 truncate">{val}</span>

                    <div className="flex items-center gap-3 shrink-0">
                      {level < 3 && (
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-600 transition-colors" strokeWidth={1.25} />
                      )}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingItem(val);
                          }}
                          title={`Eliminar ${val}`}
                          className="text-neutral-400 hover:text-neutral-900 transition-colors p-0.5"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title={`¿Eliminar "${deletingItem}"?`}
        description="Se eliminará este elemento y todo su contenido interno de forma permanente."
        confirmLabel="Eliminar"
        onConfirm={executeDelete}
      />
    </div>
  );
}
