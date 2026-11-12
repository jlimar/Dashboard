"use client";

import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, UploadCloud, Loader2, MessageCircle, Download, History } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { generateEquipmentWhatsAppMessage } from "@/lib/whatsappFormatter";
import * as XLSX from "xlsx";

interface EquipmentFormProps {
  usuarioActual: {
    id: string;
    nombre: string;
  };
}

const KIT_FTTH = ["Cleaver", "Stripper", "Pela Drop", "Power Meter", "Bolso Tolsen", "Alicate/Piqueta", "VFL"];
const EPP = ["Casco", "Botas", "Chaleco", "Guantes", "Lentes"];
const HERRAMIENTAS = ["Taladro", "Mecha", "Destornillador E", "Destornillador P", "Destornillador E/P", "Arnés", "Escalera telescópica", "Escalera de Tijera", "Zinchas", "Martillo", "Eslinga", "Extensión Eléctrica"];
const ESTADOS = ["Operativo", "Dañado", "En Reparación", "Extraviado", "No Aplica"];

const ESTADO_OPTIONS = ESTADOS.map((e) => ({ value: e, label: e }));

const inputClass =
  "w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 disabled:opacity-50 disabled:text-neutral-400";
const labelClass = "text-xs text-neutral-500 font-normal mb-1 block";
const sectionClass = "py-6 border-b border-neutral-100";

const ItemRow = ({ title, namePrefix, control }: any) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-2.5 border-b border-neutral-100 last:border-b-0 gap-3">
      <label className="text-sm text-neutral-800 w-full sm:w-1/2 flex-shrink-0">{title}</label>
      <div className="w-full sm:w-1/2 flex-grow">
        <Controller
          control={control}
          name={namePrefix}
          defaultValue="No Aplica"
          render={({ field }) => (
            <CustomDropdown
              value={field.value || "No Aplica"}
              onChange={field.onChange}
              options={ESTADO_OPTIONS}
              placeholder="Estado..."
            />
          )}
        />
      </div>
    </div>
  );
};

export default function EquipmentControlFormLogic({ usuarioActual }: EquipmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [finalReportData, setFinalReportData] = useState<any>(null);

  const [cuadrillas, setCuadrillas] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);

  const supabase = createClient();

  const { control, handleSubmit, reset, watch, setValue, register } = useForm({
    defaultValues: {
      equipo_id: "",
      equipo_nombre: "",
      tecnico_lider: "",
      tecnico_auxiliar: "",
      kit_lider: {},
      kit_auxiliar: {},
      epp_lider: {},
      epp_auxiliar: {},
      herramientas: {}
    }
  });

  const selectedEquipoId = watch("equipo_id");
  const liderName = watch("tecnico_lider");
  const auxiliarName = watch("tecnico_auxiliar");

  useEffect(() => {
    const fetchMasterData = async () => {
      // Fetch tecnicos
      const { data: tecData } = await supabase.from("tecnicos").select("id, nombre_completo");
      if (tecData) setTecnicos(tecData);

      // Fetch cuadrillas
      const { data: cuadData } = await supabase.from("cuadrillas").select("*");
      if (cuadData) setCuadrillas(cuadData);
    };

    fetchMasterData();
  }, [supabase]);

  useEffect(() => {
    if (selectedEquipoId && cuadrillas.length > 0 && tecnicos.length > 0) {
      const c = cuadrillas.find((x) => x.id === selectedEquipoId);
      if (c) {
        setValue("equipo_nombre", c.nombre);

        const lider = tecnicos.find((t) => t.id === c.lider_id);
        setValue("tecnico_lider", lider ? lider.nombre_completo : "Sin asignar");

        const auxiliar = tecnicos.find((t) => t.id === c.auxiliar_id);
        setValue("tecnico_auxiliar", auxiliar ? auxiliar.nombre_completo : "Sin asignar");
      }
    }
  }, [selectedEquipoId, cuadrillas, tecnicos, setValue]);

  useEffect(() => {
    // Check for draft
    const initData = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: draft } = await supabase
        .from("equipment_control_reports")
        .select("*")
        .eq("supervisor_id", usuarioActual.id)
        .eq("date", today)
        .eq("equipo_nombre", "DRAFT")
        .maybeSingle();

      if (draft && draft.report_data) {
        reset(draft.report_data);
      }
      setLoadingInitial(false);
    };
    initData();
  }, [usuarioActual.id, supabase, reset]);

  const onSubmit = async (data: any) => {
    if (!data.equipo_nombre || !data.tecnico_lider) {
      toast.error("Debes seleccionar una cuadrilla.");
      return;
    }

    setIsSubmitting(true);
    toast.loading("Finalizando auditoría...", { id: "submit" });

    try {
      const today = new Date().toISOString().split("T")[0];

      // Delete old draft if exists
      await supabase
        .from("equipment_control_reports")
        .delete()
        .eq("supervisor_id", usuarioActual.id)
        .eq("date", today)
        .eq("equipo_nombre", "DRAFT");

      // Insert final report
      await supabase.from("equipment_control_reports").insert({
        supervisor_id: usuarioActual.id,
        date: today,
        equipo_nombre: data.equipo_nombre,
        tecnico_lider: data.tecnico_lider,
        tecnico_auxiliar: data.tecnico_auxiliar,
        report_data: data
      });

      toast.success("¡Auditoría enviada exitosamente!", { id: "submit" });
      setFinalReportData(data);
      setIsSuccess(true);
    } catch (error) {
      toast.error("Hubo un error al enviar el reporte", { id: "submit" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      toast.loading("Generando Excel...", { id: "excel" });
      const { data: allReports, error } = await supabase
        .from("equipment_control_reports")
        .select("date, equipo_nombre, tecnico_lider, tecnico_auxiliar, report_data")
        .neq("equipo_nombre", "DRAFT")
        .order("date", { ascending: false });

      if (error) throw error;

      const rows: any[] = [];

      allReports.forEach((report) => {
        const { date, equipo_nombre, tecnico_lider, tecnico_auxiliar, report_data } = report;
        const rd = report_data as any;

        const processGroup = (group: any, tipo: string, responsable: string) => {
          if (!group) return;
          Object.entries(group).forEach(([item, estadoValue]: [string, any]) => {
            // Compatibility layer: Handle old `{ check: boolean, estado: string }` objects or new simple string state
            const estado =
              typeof estadoValue === "object"
                ? estadoValue.estado || "No definido"
                : estadoValue || "No definido";
            if (estado !== "No Aplica") {
              rows.push({
                Fecha: date,
                Equipo: equipo_nombre,
                "Técnico Líder": tecnico_lider,
                "Técnico Auxiliar": tecnico_auxiliar,
                Responsable: responsable,
                Categoría: tipo,
                Ítem: item,
                Estado: estado
              });
            }
          });
        };

        processGroup(rd.kit_lider, "Kit FTTH", "Líder");
        processGroup(rd.epp_lider, "EPP", "Líder");
        processGroup(rd.kit_auxiliar, "Kit FTTH", "Auxiliar");
        processGroup(rd.epp_auxiliar, "EPP", "Auxiliar");
        processGroup(rd.herramientas, "Herramientas Compartidas", "Equipo Compartido");
      });

      // Crear y exportar archivo Excel
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Auditorías Equipamiento");

      XLSX.writeFile(workbook, "Control_Equipamiento.xlsx");

      toast.success("Descarga completada", { id: "excel" });
    } catch (err) {
      console.error(err);
      toast.error("Error exportando datos", { id: "excel" });
    }
  };

  const cuadrillaOptions = cuadrillas.map((c) => ({
    value: c.id,
    label: c.nombre
  }));

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (isSuccess && finalReportData) {
    const today = new Date().toISOString().split("T")[0];
    const waUrl = `https://wa.me/?text=${generateEquipmentWhatsAppMessage(finalReportData, usuarioActual.nombre, today)}`;

    return (
      <div className="w-full max-w-3xl mx-auto py-16 px-6 text-center space-y-6">
        <CheckCircle2 className="w-8 h-8 text-neutral-900 mx-auto" strokeWidth={1.5} />
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">
            Auditoría completada
          </h2>
          <p className="text-sm text-neutral-500">
            El control de equipamiento ha sido registrado exitosamente.
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

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <Download className="w-4 h-4" strokeWidth={1.5} />
            Exportar a Excel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      <div className="pb-6 mb-4 border-b border-neutral-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">
            Control de equipamiento
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Auditor: <span className="font-medium text-neutral-900">{usuarioActual.nombre}</span>
          </p>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/supervision/control-equipamiento/historial"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <History className="w-3.5 h-3.5" strokeWidth={1.5} /> Ver historial
          </Link>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} /> Exportar a Excel
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className={sectionClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Seleccionar cuadrilla *</label>
              <Controller
                control={control}
                name="equipo_id"
                render={({ field }) => (
                  <CustomDropdown
                    value={field.value || ""}
                    onChange={field.onChange}
                    options={cuadrillaOptions}
                    placeholder="Elige un equipo..."
                    searchable
                  />
                )}
              />
            </div>
            <div>
              <label className={labelClass}>Fecha de auditoría</label>
              <input
                type="text"
                value={new Date().toLocaleDateString()}
                disabled
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Técnico líder</label>
              <input
                type="text"
                {...register("tecnico_lider")}
                disabled
                className={inputClass}
                placeholder="Se autocompleta..."
              />
            </div>
            <div>
              <label className={labelClass}>Técnico auxiliar</label>
              <input
                type="text"
                {...register("tecnico_auxiliar")}
                disabled
                className={inputClass}
                placeholder="Se autocompleta..."
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* LIDER */}
          <div className={sectionClass}>
            <div className="mb-5 pb-3 border-b border-neutral-100">
              <h3 className="text-base font-medium text-neutral-900">Técnico líder</h3>
              {liderName && liderName !== "Sin asignar" && (
                <p className="text-xs text-neutral-500 mt-0.5">{liderName}</p>
              )}
            </div>

            <h4 className="text-xs font-medium text-neutral-400 mb-2">Kit FTTH</h4>
            <div className="mb-6">
              {KIT_FTTH.map((item) => (
                <ItemRow
                  key={`lider-kit-${item}`}
                  title={item}
                  namePrefix={`kit_lider.${item}`}
                  control={control}
                />
              ))}
            </div>

            <h4 className="text-xs font-medium text-neutral-400 mt-6 mb-2">
              Equipos de protección (EPP)
            </h4>
            <div>
              {EPP.map((item) => (
                <ItemRow
                  key={`lider-epp-${item}`}
                  title={item}
                  namePrefix={`epp_lider.${item}`}
                  control={control}
                />
              ))}
            </div>
          </div>

          {/* AUXILIAR */}
          <div className={sectionClass}>
            <div className="mb-5 pb-3 border-b border-neutral-100">
              <h3 className="text-base font-medium text-neutral-900">Técnico auxiliar</h3>
              {auxiliarName && auxiliarName !== "Sin asignar" && (
                <p className="text-xs text-neutral-500 mt-0.5">{auxiliarName}</p>
              )}
            </div>

            <h4 className="text-xs font-medium text-neutral-400 mb-2">Kit FTTH</h4>
            <div className="mb-6">
              {KIT_FTTH.map((item) => (
                <ItemRow
                  key={`aux-kit-${item}`}
                  title={item}
                  namePrefix={`kit_auxiliar.${item}`}
                  control={control}
                />
              ))}
            </div>

            <h4 className="text-xs font-medium text-neutral-400 mt-6 mb-2">
              Equipos de protección (EPP)
            </h4>
            <div>
              {EPP.map((item) => (
                <ItemRow
                  key={`aux-epp-${item}`}
                  title={item}
                  namePrefix={`epp_auxiliar.${item}`}
                  control={control}
                />
              ))}
            </div>
          </div>
        </div>

        {/* HERRAMIENTAS DE EQUIPO */}
        <div className={sectionClass}>
          <div className="mb-5 pb-3 border-b border-neutral-100">
            <h3 className="text-base font-medium text-neutral-900">
              Herramientas compartidas (equipo)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8">
            {HERRAMIENTAS.map((item) => (
              <ItemRow
                key={`herramienta-${item}`}
                title={item}
                namePrefix={`herramientas.${item}`}
                control={control}
              />
            ))}
          </div>
        </div>

        <div className="pt-6 pb-20 md:pb-6 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40 inline-flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                Guardar auditoría <UploadCloud className="w-4 h-4" strokeWidth={1.5} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
