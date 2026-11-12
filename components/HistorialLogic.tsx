"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateWhatsAppMessage } from "@/lib/whatsappFormatter";
import { Loader2, MessageCircle, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function HistorialLogic({ usuarioActual }: { usuarioActual: { id: string; nombre: string } }) {
  const [reportes, setReportes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const fetchReportes = async () => {
      const { data, error } = await supabase
        .from("daily_activities_reports")
        .select("*")
        .eq("supervisor_id", usuarioActual.id)
        .order("date", { ascending: false });

      if (!error && data) {
        setReportes(data);
      }
      setLoading(false);
    };
    fetchReportes();
  }, [usuarioActual.id, supabase]);

  const handleWhatsApp = (report: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const waUrl = `https://wa.me/?text=${generateWhatsAppMessage(report.report_data, usuarioActual.nombre, report.date)}`;
    window.open(waUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto pb-12 relative">
      <div className="pb-6 mb-4 border-b border-neutral-100">
        <div className="mb-3">
          <Link
            href="/supervision/reporte-diario"
            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} /> Volver al formulario
          </Link>
        </div>
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">
          Historial de reportes
        </h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Supervisor: <span className="font-medium text-neutral-900">{usuarioActual.nombre}</span>
        </p>
      </div>

      {reportes.length === 0 ? (
        <div className="py-16 text-center space-y-1.5">
          <h3 className="text-base font-medium text-neutral-900">
            No hay reportes enviados
          </h3>
          <p className="text-sm text-neutral-500">
            Aún no has generado ningún reporte diario.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {reportes.map((report) => {
            const isSelected = selectedReport?.id === report.id;
            const dateFormatted = format(
              new Date(report.date + "T12:00:00Z"),
              "EEEE, d 'de' MMMM yyyy",
              { locale: es }
            );

            return (
              <div
                key={report.id}
                onClick={() => setSelectedReport(isSelected ? null : report)}
                className="py-5 px-1 transition-colors cursor-pointer hover:bg-neutral-50/50"
              >
                <div className="flex justify-between items-center gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-medium text-neutral-900 capitalize">
                        {dateFormatted}
                      </h3>
                      <span
                        className={`text-xs ${
                          report.status === "COMPLETED"
                            ? "text-neutral-500"
                            : "text-neutral-400"
                        }`}
                      >
                        {report.status === "COMPLETED" ? "Enviado" : "Borrador"}
                      </span>
                    </div>

                    {(report.selected_activities || []).length > 0 && (
                      <p className="text-xs text-neutral-400 capitalize truncate">
                        {(report.selected_activities || []).join(" · ")}
                      </p>
                    )}
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${
                      isSelected ? "rotate-90 text-neutral-900" : ""
                    }`}
                    strokeWidth={1.5}
                  />
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-neutral-100 animate-in slide-in-from-top-2">
                    <div className="text-[13px] text-neutral-600 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed mb-4">
                      {decodeURIComponent(
                        generateWhatsAppMessage(
                          report.report_data,
                          usuarioActual.nombre,
                          report.date
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleWhatsApp(report, e)}
                      disabled={report.status !== "COMPLETED"}
                      className="inline-flex items-center gap-2 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {report.status === "COMPLETED"
                        ? "Reenviar a WhatsApp"
                        : "Termina el reporte para enviarlo"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
