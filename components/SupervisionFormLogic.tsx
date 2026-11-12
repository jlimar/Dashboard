"use client";

import React, { useState, useEffect } from "react";
import { useForm, useFieldArray, useWatch, Controller } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Loader2, Plus, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { generateWhatsAppMessage } from "@/lib/whatsappFormatter";
import Link from "next/link";

export type ActivityKey =
  | "instalacion"
  | "soporte"
  | "materiales"
  | "combustible"
  | "sst"
  | "factibilidad";

interface SupervisionFormProps {
  usuarioActual: {
    id: string;
    nombre: string;
  };
}

const ACTIVITIES = [
  { id: "instalacion", title: "Inspección de instalación / alta nueva", desc: "Metraje, atenuación y ONT instalada" },
  { id: "soporte", title: "Apoyo en soporte técnico", desc: "Tickets RUPBI, diagnóstico y acciones" },
  { id: "materiales", title: "Control de materiales (retorno)", desc: "Metraje consumido y carretes devueltos" },
  { id: "combustible", title: "Combustible y flota", desc: "Kilometraje, litros y estado vehicular" },
  { id: "sst", title: "Auditoría SST (seguridad)", desc: "EPP, arnés, conos y señalización" },
  { id: "factibilidad", title: "Factibilidad (nuevas rutas)", desc: "Coordenadas, distancia y potencial" }
];

const CONFORMIDAD_OPTIONS = [
  { value: "Conforme", label: "Conforme" },
  { value: "No Conforme", label: "No Conforme" }
];

const inputClass =
  "w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 disabled:opacity-50";
const labelClass = "text-xs text-neutral-500 font-normal mb-1 block";
const sectionClass = "py-6 border-b border-neutral-100";
const cardClass = "py-5 border-b border-neutral-100 last:border-b-0 relative group";

// --- SUBCOMPONENTE DE CASCADA ---
const LocationSelector = ({ control, setValue, index, namespace, zonas }: any) => {
  const estadoPath = `${namespace}.${index}.estado`;
  const municipioPath = `${namespace}.${index}.municipio`;
  const parroquiaPath = `${namespace}.${index}.parroquia`;
  const sectorPath = `${namespace}.${index}.sector`;

  const estado = useWatch({ control, name: estadoPath });
  const municipio = useWatch({ control, name: municipioPath });
  const parroquia = useWatch({ control, name: parroquiaPath });
  const sector = useWatch({ control, name: sectorPath });

  const estados = Array.from(new Set(zonas.map((z: any) => z.estado))).map((e: any) => ({
    value: e,
    label: e
  }));
  const municipios = Array.from(
    new Set(zonas.filter((z: any) => z.estado === estado).map((z: any) => z.municipio))
  ).map((m: any) => ({ value: m, label: m }));
  const parroquias = Array.from(
    new Set(
      zonas
        .filter((z: any) => z.estado === estado && z.municipio === municipio)
        .map((z: any) => z.parroquia)
    )
  ).map((p: any) => ({ value: p, label: p }));
  const sectores = Array.from(
    new Set(
      zonas
        .filter(
          (z: any) =>
            z.estado === estado && z.municipio === municipio && z.parroquia === parroquia
        )
        .map((z: any) => z.sector)
    )
  ).map((s: any) => ({ value: s, label: s }));

  return (
    <div className="md:col-span-2 pb-4 border-b border-neutral-100 space-y-3">
      <p className="text-xs font-medium text-neutral-500">Ubicación operativa</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className={labelClass}>Estado *</label>
          <CustomDropdown
            value={estado || ""}
            onChange={(val) => {
              setValue(estadoPath, val);
              setValue(municipioPath, "");
              setValue(parroquiaPath, "");
              setValue(sectorPath, "");
            }}
            options={estados}
            placeholder="Seleccione..."
            searchable
          />
        </div>
        <div>
          <label className={labelClass}>Municipio *</label>
          <CustomDropdown
            disabled={!estado}
            value={municipio || ""}
            onChange={(val) => {
              setValue(municipioPath, val);
              setValue(parroquiaPath, "");
              setValue(sectorPath, "");
            }}
            options={municipios}
            placeholder="Seleccione..."
            searchable
          />
        </div>
        <div>
          <label className={labelClass}>Parroquia *</label>
          <CustomDropdown
            disabled={!municipio}
            value={parroquia || ""}
            onChange={(val) => {
              setValue(parroquiaPath, val);
              setValue(sectorPath, "");
            }}
            options={parroquias}
            placeholder="Seleccione..."
            searchable
          />
        </div>
        <div>
          <label className={labelClass}>Sector *</label>
          <CustomDropdown
            disabled={!parroquia}
            value={sector || ""}
            onChange={(val) => setValue(sectorPath, val)}
            options={sectores}
            placeholder="Seleccione..."
            searchable
          />
        </div>
      </div>
    </div>
  );
};

export default function SupervisionFormLogic({ usuarioActual }: SupervisionFormProps) {
  const [zonas, setZonas] = useState<any[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<ActivityKey[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [finalReportData, setFinalReportData] = useState<any>(null);

  const supabase = createClient();

  const { register, control, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: {
      actividades: [] as string[],
      instalaciones: [],
      soportes: [],
      materiales: [],
      combustibles: [],
      ssts: [],
      factibilidades: []
    } as Record<string, any>
  });

  // Arreglos dinámicos para cada actividad
  const instArr = useFieldArray({ control, name: "instalaciones" });
  const sopArr = useFieldArray({ control, name: "soportes" });
  const matArr = useFieldArray({ control, name: "materiales" });
  const comArr = useFieldArray({ control, name: "combustibles" });
  const sstArr = useFieldArray({ control, name: "ssts" });
  const facArr = useFieldArray({ control, name: "factibilidades" });

  useEffect(() => {
    const initData = async () => {
      const { data: zonasData } = await supabase
        .from("zonas_operativas")
        .select("*")
        .order("estado");
      if (zonasData) setZonas(zonasData);

      const today = new Date().toISOString().split("T")[0];
      const { data: draft } = await supabase
        .from("daily_activities_reports")
        .select("*")
        .eq("supervisor_id", usuarioActual.id)
        .eq("date", today)
        .maybeSingle();

      if (draft) {
        setSelectedActivities(draft.selected_activities as ActivityKey[]);
        if (draft.report_data) {
          reset(draft.report_data);
        }
      }
      setLoadingInitial(false);
    };
    initData();
  }, [usuarioActual.id, supabase, reset]);

  const toggleActivity = (id: ActivityKey) => {
    setSelectedActivities((prev) => {
      const newActivities = prev.includes(id)
        ? prev.filter((a) => a !== id)
        : [...prev, id];
      setValue("actividades", newActivities);

      if (!prev.includes(id)) {
        if (id === "instalacion" && instArr.fields.length === 0) instArr.append({});
        if (id === "soporte" && sopArr.fields.length === 0) sopArr.append({});
        if (id === "materiales" && matArr.fields.length === 0) matArr.append({});
        if (id === "combustible" && comArr.fields.length === 0) comArr.append({});
        if (id === "sst" && sstArr.fields.length === 0) sstArr.append({});
        if (id === "factibilidad" && facArr.fields.length === 0) facArr.append({});
      }

      autoSave(newActivities, watch());
      return newActivities;
    });
  };

  const autoSave = async (activities: string[], formData: any) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("daily_activities_reports")
        .select("id")
        .eq("supervisor_id", usuarioActual.id)
        .eq("date", today)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("daily_activities_reports")
          .update({ selected_activities: activities, report_data: formData })
          .eq("id", existing.id);
      } else {
        await supabase.from("daily_activities_reports").insert({
          supervisor_id: usuarioActual.id,
          date: today,
          status: "DRAFT",
          selected_activities: activities,
          report_data: formData
        });
      }
    } catch (error) {
      console.error("Autosave error", error);
    }
  };

  const onSubmit = async (data: any) => {
    if (selectedActivities.length === 0) {
      toast.error("Debes seleccionar al menos una actividad.");
      return;
    }

    setIsSubmitting(true);
    toast.loading("Finalizando reporte...", { id: "submit" });

    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("daily_activities_reports")
        .select("id")
        .eq("supervisor_id", usuarioActual.id)
        .eq("date", today)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("daily_activities_reports")
          .update({ status: "COMPLETED", report_data: data })
          .eq("id", existing.id);
      }
      toast.success("¡Reporte enviado exitosamente!", { id: "submit" });
      setFinalReportData(data);
      setIsSuccess(true);
    } catch (error) {
      toast.error("Hubo un error al enviar el reporte", { id: "submit" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastRecordFilled = (arrayName: string) => {
    const items = watch(arrayName);
    if (!items || items.length === 0) return true;
    const last = items[items.length - 1];
    return last && last.estado && last.sector;
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (isSuccess && finalReportData) {
    const today = new Date().toISOString().split("T")[0];
    const waUrl = `https://wa.me/?text=${generateWhatsAppMessage(finalReportData, usuarioActual.nombre, today)}`;

    return (
      <div className="w-full max-w-3xl mx-auto py-16 px-6 text-center space-y-6">
        <CheckCircle2 className="w-8 h-8 text-neutral-900 mx-auto" strokeWidth={1.5} />
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">
            Reporte enviado
          </h2>
          <p className="text-sm text-neutral-500">
            Tu reporte de operaciones ha sido guardado exitosamente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
            Enviar a WhatsApp
          </a>

          <Link
            href="/supervision/historial-reportes"
            className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Ver historial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      <div className="pb-6 mb-4 border-b border-neutral-100">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">
          Reporte de operaciones
        </h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Supervisor: <span className="font-medium text-neutral-900">{usuarioActual.nombre}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* SELECTOR DE ACTIVIDADES */}
        <div className={sectionClass}>
          <h3 className="text-sm font-medium text-neutral-900 mb-4">
            1. ¿Qué tipo de actividades realizaste hoy?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
            {ACTIVITIES.map((act) => {
              const isSelected = selectedActivities.includes(act.id as ActivityKey);
              return (
                <div
                  key={act.id}
                  onClick={() => toggleActivity(act.id as ActivityKey)}
                  className="py-3 border-b border-neutral-100 cursor-pointer transition-colors hover:bg-neutral-50/50 px-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4
                      className={`text-sm leading-tight ${
                        isSelected
                          ? "font-medium text-neutral-900"
                          : "font-normal text-neutral-600"
                      }`}
                    >
                      {act.title}
                    </h4>
                    {isSelected && (
                      <CheckCircle2
                        className="w-4 h-4 text-neutral-900 shrink-0"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                  <p className="text-xs mt-1 text-neutral-400">{act.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 1: INSTALACIÓN */}
        {selectedActivities.includes("instalacion") && (
          <div className={sectionClass}>
            <div className="mb-2">
              <h3 className="text-lg font-medium text-neutral-900">
                Inspección de instalación / alta nueva
              </h3>
            </div>

            {instArr.fields.map((field, index) => (
              <div key={field.id} className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-medium text-neutral-400">
                    Registro #{index + 1}
                  </h4>
                  {instArr.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => instArr.remove(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900"
                      title="Eliminar"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <LocationSelector
                    control={control}
                    setValue={setValue}
                    index={index}
                    namespace="instalaciones"
                    zonas={zonas}
                  />
                  <div>
                    <label className={labelClass}>Cédula / ID cliente *</label>
                    <input
                      type="text"
                      {...register(`instalaciones.${index}.cedula`)}
                      className={inputClass}
                      placeholder="V-12345678"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Nombres cuadrilla</label>
                    <input
                      type="text"
                      {...register(`instalaciones.${index}.tecnicos`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Metraje reportado</label>
                    <input
                      type="number"
                      {...register(`instalaciones.${index}.metrajeReportado`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Metraje físico real</label>
                    <input
                      type="number"
                      {...register(`instalaciones.${index}.metrajeReal`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Atenuación final (dBm)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`instalaciones.${index}.atenuacion`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Serial / MAC ONT</label>
                    <input
                      type="text"
                      {...register(`instalaciones.${index}.serial`)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Observaciones aval / prueba</label>
                    <input
                      type="text"
                      {...register(`instalaciones.${index}.observaciones`)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={!isLastRecordFilled("instalaciones")}
              onClick={() => instArr.append({})}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Añadir otro registro
              {!isLastRecordFilled("instalaciones") && (
                <span className="ml-1 text-neutral-400">
                  (Completa la ubicación del anterior)
                </span>
              )}
            </button>
          </div>
        )}

        {/* 2: SOPORTE */}
        {selectedActivities.includes("soporte") && (
          <div className={sectionClass}>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Inspección en soporte técnico
            </h3>

            {sopArr.fields.map((field, index) => (
              <div key={field.id} className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-medium text-neutral-400">
                    Soporte #{index + 1}
                  </h4>
                  {sopArr.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => sopArr.remove(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900"
                      title="Eliminar"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <LocationSelector
                    control={control}
                    setValue={setValue}
                    index={index}
                    namespace="soportes"
                    zonas={zonas}
                  />
                  <div>
                    <label className={labelClass}>N° Ticket / Cédula *</label>
                    <input
                      type="text"
                      {...register(`soportes.${index}.ticket`)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Nombres de técnicos</label>
                    <input
                      type="text"
                      {...register(`soportes.${index}.tecnicos`)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Diagnóstico encontrado</label>
                    <input
                      type="text"
                      {...register(`soportes.${index}.diagnostico`)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Acción correctiva</label>
                    <input
                      type="text"
                      {...register(`soportes.${index}.accion`)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Observaciones aval / prueba</label>
                    <input
                      type="text"
                      {...register(`soportes.${index}.observaciones`)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={!isLastRecordFilled("soportes")}
              onClick={() => sopArr.append({})}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Añadir otro soporte
              {!isLastRecordFilled("soportes") && (
                <span className="ml-1 text-neutral-400">
                  (Completa la ubicación del anterior)
                </span>
              )}
            </button>
          </div>
        )}

        {/* 3: MATERIALES */}
        {selectedActivities.includes("materiales") && (
          <div className={sectionClass}>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Control de materiales (retorno)
            </h3>

            {matArr.fields.map((field, index) => {
              const dep = watch(`materiales.${index}.despacho`) || 0;
              const ret = watch(`materiales.${index}.retorno`) || 0;

              return (
                <div key={field.id} className={cardClass}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-medium text-neutral-400">
                      Retorno #{index + 1}
                    </h4>
                    {matArr.fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => matArr.remove(index)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900"
                        title="Eliminar"
                      >
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <LocationSelector
                      control={control}
                      setValue={setValue}
                      index={index}
                      namespace="materiales"
                      zonas={zonas}
                    />
                    <div>
                      <label className={labelClass}>Técnicos responsables</label>
                      <input
                        type="text"
                        {...register(`materiales.${index}.tecnicos`)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>ID / Código carrete *</label>
                      <input
                        type="text"
                        {...register(`materiales.${index}.carrete`)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Despacho (AM)</label>
                      <input
                        type="number"
                        {...register(`materiales.${index}.despacho`)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Retorno (PM)</label>
                      <input
                        type="number"
                        {...register(`materiales.${index}.retorno`)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {(dep > 0 || ret > 0) && (
                    <p className="mt-4 text-xs text-neutral-500">
                      Diferencia / Consumo neto:{" "}
                      <span className="font-medium text-neutral-900">
                        {dep - ret} metros
                      </span>
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelClass}>Firma conformidad</label>
                      <input
                        type="text"
                        {...register(`materiales.${index}.firma`)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Observaciones aval</label>
                      <input
                        type="text"
                        {...register(`materiales.${index}.observaciones`)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              disabled={!isLastRecordFilled("materiales")}
              onClick={() => matArr.append({})}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Añadir otro carrete
              {!isLastRecordFilled("materiales") && (
                <span className="ml-1 text-neutral-400">
                  (Completa la ubicación del anterior)
                </span>
              )}
            </button>
          </div>
        )}

        {/* 4: COMBUSTIBLE */}
        {selectedActivities.includes("combustible") && (
          <div className={sectionClass}>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Control de combustible y flota
            </h3>

            {comArr.fields.map((field, index) => (
              <div key={field.id} className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-medium text-neutral-400">
                    Vehículo #{index + 1}
                  </h4>
                  {comArr.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => comArr.remove(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900"
                      title="Eliminar"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <LocationSelector
                    control={control}
                    setValue={setValue}
                    index={index}
                    namespace="combustibles"
                    zonas={zonas}
                  />
                  <div>
                    <label className={labelClass}>Placa / Unidad *</label>
                    <input
                      type="text"
                      {...register(`combustibles.${index}.placa`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Conductor</label>
                    <input
                      type="text"
                      {...register(`combustibles.${index}.conductor`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>KM salida</label>
                    <input
                      type="number"
                      {...register(`combustibles.${index}.kmSalida`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>KM llegada</label>
                    <input
                      type="number"
                      {...register(`combustibles.${index}.kmLlegada`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Litros surtidos / N° ticket</label>
                    <input
                      type="text"
                      {...register(`combustibles.${index}.litros`)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Novedades del vehículo</label>
                    <input
                      type="text"
                      {...register(`combustibles.${index}.novedades`)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Observaciones aval</label>
                    <input
                      type="text"
                      {...register(`combustibles.${index}.observaciones`)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={!isLastRecordFilled("combustibles")}
              onClick={() => comArr.append({})}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Añadir otro vehículo
              {!isLastRecordFilled("combustibles") && (
                <span className="ml-1 text-neutral-400">
                  (Completa la ubicación del anterior)
                </span>
              )}
            </button>
          </div>
        )}

        {/* 5: SST */}
        {selectedActivities.includes("sst") && (
          <div className={sectionClass}>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Auditoría SST en campo
            </h3>

            {sstArr.fields.map((field, index) => (
              <div key={field.id} className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-medium text-neutral-400">
                    Auditoría #{index + 1}
                  </h4>
                  {sstArr.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => sstArr.remove(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900"
                      title="Eliminar"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <LocationSelector
                    control={control}
                    setValue={setValue}
                    index={index}
                    namespace="ssts"
                    zonas={zonas}
                  />
                  <div className="md:col-span-2">
                    <label className={labelClass}>Técnicos auditados *</label>
                    <input
                      type="text"
                      {...register(`ssts.${index}.tecnicos`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Estado de EPP</label>
                    <Controller
                      control={control}
                      name={`ssts.${index}.epp`}
                      render={({ field }) => (
                        <CustomDropdown
                          value={field.value || ""}
                          onChange={field.onChange}
                          options={CONFORMIDAD_OPTIONS}
                          placeholder="Seleccione..."
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Señalización (conos)</label>
                    <Controller
                      control={control}
                      name={`ssts.${index}.senalizacion`}
                      render={({ field }) => (
                        <CustomDropdown
                          value={field.value || ""}
                          onChange={field.onChange}
                          options={CONFORMIDAD_OPTIONS}
                          placeholder="Seleccione..."
                        />
                      )}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Observaciones aval</label>
                    <input
                      type="text"
                      {...register(`ssts.${index}.observaciones`)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={!isLastRecordFilled("ssts")}
              onClick={() => sstArr.append({})}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Añadir otra auditoría SST
              {!isLastRecordFilled("ssts") && (
                <span className="ml-1 text-neutral-400">
                  (Completa la ubicación del anterior)
                </span>
              )}
            </button>
          </div>
        )}

        {/* 6: FACTIBILIDAD */}
        {selectedActivities.includes("factibilidad") && (
          <div className={sectionClass}>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Levantamiento de factibilidad
            </h3>

            {facArr.fields.map((field, index) => (
              <div key={field.id} className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-medium text-neutral-400">
                    Factibilidad #{index + 1}
                  </h4>
                  {facArr.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => facArr.remove(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-neutral-400 hover:text-neutral-900"
                      title="Eliminar"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <LocationSelector
                    control={control}
                    setValue={setValue}
                    index={index}
                    namespace="factibilidades"
                    zonas={zonas}
                  />
                  <div>
                    <label className={labelClass}>Coordenadas GPS</label>
                    <input
                      type="text"
                      {...register(`factibilidades.${index}.coordenadas`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Distancia enlace</label>
                    <input
                      type="number"
                      {...register(`factibilidades.${index}.distancia`)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Estimación abonados</label>
                    <input
                      type="number"
                      {...register(`factibilidades.${index}.abonados`)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Observaciones aval</label>
                    <input
                      type="text"
                      {...register(`factibilidades.${index}.observaciones`)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={!isLastRecordFilled("factibilidades")}
              onClick={() => facArr.append({})}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Añadir otro levantamiento
              {!isLastRecordFilled("factibilidades") && (
                <span className="ml-1 text-neutral-400">
                  (Completa la ubicación del anterior)
                </span>
              )}
            </button>
          </div>
        )}

        {/* --- BOTÓN DE ENVÍO --- */}
        {selectedActivities.length > 0 && (
          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40 inline-flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Finalizando...
                </>
              ) : (
                "Enviar reporte final"
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
