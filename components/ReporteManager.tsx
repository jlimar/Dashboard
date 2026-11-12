'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { crearSalida, registrarEntrada } from '@/app/transporte/actions';
import { Sun, Moon, ArrowLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { CustomDropdown } from '@/components/ui/custom-dropdown';

type Vehiculo = { id: string; placa: string; modelo: string; codigo: string; tipo?: string };

type VehiculoRel = {
    codigo: string;
    placa: string;
    modelo: string;
    tipo?: string;
};

type Reporte = {
    id: string;
    created_at: string;
    conductor: string;
    departamento: string;
    km_salida: number;
    vehiculo_id: string;
    // Soporte para array o objeto (Supabase a veces devuelve array si no se detecta la relación 1:1)
    vehiculos: VehiculoRel | VehiculoRel[];
};

const DEPARTAMENTO_OPTIONS = [
    { value: 'Instalación', label: 'Instalación' },
    { value: 'Afectaciones', label: 'Afectaciones' },
    { value: 'Distribución', label: 'Distribución' },
    { value: 'Comercialización', label: 'Comercialización' },
    { value: 'Transporte', label: 'Transporte' },
    { value: 'Operaciones', label: 'Operaciones' },
];

const GASOLINA_OPTIONS = [
    { value: 'Full', label: 'Full' },
    { value: '3/4', label: '3/4' },
    { value: '1/2', label: '1/2' },
    { value: '1/4', label: '1/4' },
    { value: 'Reserva', label: 'Reserva' },
];

const CAUCHOS_OPTIONS = [
    { value: '100% al 80% Estado Óptimo', label: '100% al 80% Estado Óptimo' },
    { value: '79% al 50% Desgaste Medio', label: '79% al 50% Desgaste Medio' },
    { value: '49% al 20% Planificar Cambio', label: '49% al 20% Planificar Cambio' },
    { value: '19% al 1% Riesgo Crítico', label: '19% al 1% Riesgo Crítico' },
];

const inputClass =
    'w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400';
const labelClass = 'block text-xs text-neutral-500 mb-1';

export default function ReporteManager({
    vehiculos,
    pendientes,
    lastKmMap = {}
}: {
    vehiculos: Vehiculo[],
    pendientes: Reporte[],
    lastKmMap?: Record<string, number>
}) {
    const [modo, setModo] = useState<'salida' | 'entrada' | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [usePlainText, setUsePlainText] = useState(false);

    useEffect(() => {
        const fetchUserPrefs = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('plain_text_reports')
                    .eq('id', user.id)
                    .single();
                setUsePlainText(!!profile?.plain_text_reports);
            }
        };
        fetchUserPrefs();
    }, []);

    // Estado para la lógica condicional en SALIDA
    const [vehiculoId, setVehiculoId] = useState<string>('');
    const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<Vehiculo | null>(null);
    const [departamento, setDepartamento] = useState<string>('');
    const [gasolinaSalida, setGasolinaSalida] = useState<string>('Full');
    const [estadoCauchosSalida, setEstadoCauchosSalida] = useState<string>('');
    const [ultimoKm, setUltimoKm] = useState<number>(0);
    const [errorKmSalida, setErrorKmSalida] = useState<string | null>(null);

    // Estado para lógica condicional en ENTRADA (leemos del reporte pendiente)
    const [reporteEntradaId, setReporteEntradaId] = useState<string>('');
    const [reporteEntrada, setReporteEntrada] = useState<Reporte | null>(null);
    const [gasolinaEntrada, setGasolinaEntrada] = useState<string>('Full');
    const [estadoCauchosEntrada, setEstadoCauchosEntrada] = useState<string>('');
    const [errorKm, setErrorKm] = useState<string | null>(null);

    // Helpers para detectar tipo
    const esMoto = (v: { codigo: string; modelo: string } | null | undefined) => v?.codigo.startsWith('M-') || v?.modelo.includes('MOTO');
    const esInstalacionODistribucion = (d: string) => d === 'Instalación' || d === 'Distribución' || d === 'Afectaciones';

    const resetModo = () => {
        setModo(null);
        setVehiculoId('');
        setVehiculoSeleccionado(null);
        setDepartamento('');
        setGasolinaSalida('Full');
        setEstadoCauchosSalida('');
        setUltimoKm(0);
        setErrorKmSalida(null);
        setReporteEntradaId('');
        setReporteEntrada(null);
        setGasolinaEntrada('Full');
        setEstadoCauchosEntrada('');
        setErrorKm(null);
    };

    // --- GENERADORES DE TEXTO (PLAIN TEXT) ---
    const formatSalidaText = (data: any, vehiculoObj: Vehiculo | null | undefined) => {
        const check = (val: boolean | number) => usePlainText ? (val ? '[SI]' : '[NO]') : (val ? '✅' : '❌');
        // Only Model name, no plate
        const vehiculoNombre = vehiculoObj ? vehiculoObj.modelo : 'Desconocido';

        const fecha = new Date().toLocaleDateString();
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let msg = `*Reporte de Salida*\n\n`;
        msg += `Fecha: ${fecha}\n`;
        msg += `Hora: ${hora}\n\n`;

        msg += `Conductor: ${data.conductor}\n`;
        msg += `Departamento: ${data.departamento}\n\n`;

        msg += `Vehículo: ${vehiculoNombre}\n`;
        msg += `Kilometraje (Salida): ${data.km_salida}\n`;
        msg += `Nivel de Gasolina: ${data.gasolina_salida}\n\n`;

        msg += `*Chequeo Técnico:*\n`;
        msg += `Chequeo de Aceite: ${check(data.aceite_salida)}\n`;
        msg += `Sistema de iluminación: ${check(data.luces_salida)}\n`;
        msg += `Sistema de frenos: ${check(data.frenos_salida)}\n`;
        msg += `Cauchos: ${data.estado_cauchos_salida || 'No especificado'}\n`;
        msg += `Corneta: ${check(data.corneta_salida)}\n`;
        msg += `Chequeo de Agua/Refrigerante: ${check(data.agua_salida)}\n\n`;

        msg += `*Seguridad:*\n`;
        msg += `Cinturones de seguridad: ${check(data.cinturones_salida)}\n`;
        msg += `Conos de tráfico: ${check(data.conos_salida)}\n`;
        msg += `Extintor de incendios: ${check(data.extintor_salida)}\n`;
        msg += `Botiquín de primeros auxilios: ${check(data.botiquin_salida)}\n`;
        msg += `Gato: ${check(data.gato_salida)}\n`;
        msg += `Llave Cruz: ${check(data.cruz_salida)}\n`;
        msg += `Triángulo: ${check(data.triangulo_salida)}\n`;
        msg += `Caucho de repuesto: ${check(data.caucho_salida)}\n`;
        msg += `Carpeta de Permisos: ${check(data.carpeta_salida)}\n\n`;

        msg += `*Equipos Asignados:*\n`;
        if (esInstalacionODistribucion(data.departamento)) {
            if (data.departamento === 'Instalación') {
                msg += `Mini-UPS: ${check(data.ups_salida)}\n`;
            }
            msg += `Escalera telescópica: ${check(data.escalera_salida)}\n\n`;
        } else {
            msg += `N/A\n\n`;
        }

        if (vehiculoObj?.tipo?.toLowerCase() === 'carga' || vehiculoObj?.modelo?.toLowerCase().includes('carga')) {
            msg += `*Equipos de Carga:*\n`;
            msg += `Escalera de Tijera: ${check(data.escalera_tijera_salida)}\n\n`;
        }

        msg += `Observaciones: ${data.observaciones_salida || 'Ninguna'}`;
        return msg;
    };

    const formatEntradaText = (entradaData: any, reporteOriginal: Reporte) => {
        const check = (val: boolean | number) => usePlainText ? (val ? '[SI]' : '[NO]') : (val ? '✅' : '❌');

        // Calcular fechas y horas
        const fechaSalidaObj = new Date(reporteOriginal.created_at);
        const fechaEntradaObj = new Date(); // Asumimos tiempo actual del cliente al enviar

        const fechaEntrada = fechaEntradaObj.toLocaleDateString();
        const horaSalida = fechaSalidaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const horaEntrada = fechaEntradaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const vehiculo = Array.isArray(reporteOriginal.vehiculos) ? reporteOriginal.vehiculos[0] : reporteOriginal.vehiculos;
        const vehiculoNombre = vehiculo ? vehiculo.modelo : 'Desconocido';
        const kmRecorrido = Number(entradaData.km_entrada) - Number(reporteOriginal.km_salida);

        let msg = `*Reporte de Entrada*\n\n`;

        msg += `Fecha (Entrada): ${fechaEntrada}\n`;
        msg += `Hora (Salida): ${horaSalida}\n`;
        msg += `Hora (Entrada): ${horaEntrada}\n\n`;

        msg += `Conductor: ${reporteOriginal.conductor}\n`;
        msg += `Departamento: ${reporteOriginal.departamento}\n\n`;

        msg += `Vehículo: ${vehiculoNombre}\n`;
        msg += `Kilometraje (Salida): ${reporteOriginal.km_salida}\n`;
        msg += `Kilometraje (Entrada): ${entradaData.km_entrada}\n`;
        msg += `Kilometraje Recorrido: ${kmRecorrido}\n`;
        msg += `Nivel de Gasolina: ${entradaData.gasolina_entrada}\n\n`;

        msg += `*Chequeo Técnico:*\n`;
        msg += `Chequeo de Aceite: ${check(entradaData.aceite_entrada)}\n`;
        msg += `Sistema de iluminación: ${check(entradaData.luces_entrada)}\n`;
        msg += `Sistema de frenos: ${check(entradaData.frenos_entrada)}\n`;
        msg += `Cauchos: ${entradaData.estado_cauchos_entrada || 'No especificado'}\n`;
        msg += `Corneta: ${check(entradaData.corneta_entrada)}\n`;
        msg += `Chequeo de Agua/Refrigerante: ${check(entradaData.agua_entrada)}\n\n`;

        msg += `*Seguridad:*\n`;
        msg += `Cinturones de seguridad: ${check(entradaData.cinturones_entrada)}\n`;
        msg += `Conos de tráfico: ${check(entradaData.conos_entrada)}\n`;
        msg += `Extintor de incendios: ${check(entradaData.extintor_entrada)}\n`;
        msg += `Botiquín de primeros auxilios: ${check(entradaData.botiquin_entrada)}\n`;
        msg += `Gato: ${check(entradaData.gato_entrada)}\n`;
        msg += `Llave Cruz: ${check(entradaData.cruz_entrada)}\n`;
        msg += `Triángulo: ${check(entradaData.triangulo_entrada)}\n`;
        msg += `Caucho de repuesto: ${check(entradaData.caucho_entrada)}\n`;
        msg += `Carpeta de Permisos: ${check(entradaData.carpeta_entrada)}\n\n`;

        msg += `*Equipos Asignados:*\n`;
        if (esInstalacionODistribucion(reporteOriginal.departamento)) {
            if (reporteOriginal.departamento === 'Instalación') {
                msg += `Mini-UPS: ${check(entradaData.ups_entrada)}\n`;
            }
            msg += `Escalera telescópica: ${check(entradaData.escalera_entrada)}\n\n`;
        } else {
            msg += `N/A\n\n`;
        }

        if (vehiculo?.tipo?.toLowerCase() === 'carga' || vehiculo?.modelo?.toLowerCase().includes('carga')) {
            msg += `*Equipos de Carga:*\n`;
            msg += `Escalera de Tijera: ${check(entradaData.escalera_tijera_entrada)}\n\n`;
        }

        msg += `Observaciones: ${entradaData.observaciones_entrada || 'Ninguna'}`;
        return msg;
    };

    // --- HANDLERS UNIFICADOS ---

    const handleSalidaSubmit = async (formData: FormData) => {
        if (!vehiculoId) {
            toast.error('Selecciona un vehículo');
            return;
        }
        if (!departamento) {
            toast.error('Selecciona un departamento');
            return;
        }
        if (!estadoCauchosSalida) {
            toast.error('Selecciona el estado de los cauchos');
            return;
        }

        setSubmitting(true);
        const res = await crearSalida(formData);

        if (res?.success) {
            // 1. Preparar datos para el mensaje
            // Convertimos formData a objeto plano para facilitar
            const raw: any = {};
            formData.forEach((value, key) => raw[key] = value);

            // Re-procesar checkboxes y numeros como lo hace el server (aproximado para el msg)
            const processed = {
                ...raw,
                aceite_salida: raw.aceite_salida === 'on',
                agua_salida: raw.agua_salida === 'on',
                // ...otros booleanos
                luces_salida: raw.luces_salida === 'on',
                frenos_salida: raw.frenos_salida === 'on',
                corneta_salida: raw.corneta_salida === 'on',
                cinturones_salida: raw.cinturones_salida === 'on',
                conos_salida: raw.conos_salida === 'on',
                extintor_salida: raw.extintor_salida === 'on',
                botiquin_salida: raw.botiquin_salida === 'on',
                gato_salida: raw.gato_salida === 'on',
                cruz_salida: raw.cruz_salida === 'on',
                triangulo_salida: raw.triangulo_salida === 'on',
                caucho_salida: raw.caucho_salida === 'on',
                carpeta_salida: raw.carpeta_salida === 'on',
                ups_salida: raw.ups_salida === 'on',
                escalera_salida: raw.escalera_salida === 'on',
                escalera_tijera_salida: raw.escalera_tijera_salida === 'on',
            };

            const vehiculoObj = vehiculos.find(v => v.id === processed.vehiculo_id);
            const text = formatSalidaText(processed, vehiculoObj);

            // 2. Abrir WhatsApp
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');

            // 3. Reset UI
            resetModo();
            toast.success('Salida registrada con éxito. Se ha abierto WhatsApp.');
        } else {
            toast.error('Error al guardar: ' + res?.error);
        }
        setSubmitting(false);
    };

    const handleEntradaSubmit = async (formData: FormData) => {
        if (!reporteEntradaId || !reporteEntrada) {
            toast.error('Selecciona el vehículo en ruta');
            return;
        }
        if (!estadoCauchosEntrada) {
            toast.error('Selecciona el estado de los cauchos');
            return;
        }

        setSubmitting(true);
        const res = await registrarEntrada(formData);

        if (res?.success) {
            const raw: any = {};
            formData.forEach((value, key) => raw[key] = value);

            const processed = {
                ...raw,
                aceite_entrada: raw.aceite_entrada === 'on',
                agua_entrada: raw.agua_entrada === 'on',
                luces_entrada: raw.luces_entrada === 'on',
                frenos_entrada: raw.frenos_entrada === 'on',
                corneta_entrada: raw.corneta_entrada === 'on',
                cinturones_entrada: raw.cinturones_entrada === 'on',
                conos_entrada: raw.conos_entrada === 'on',
                extintor_entrada: raw.extintor_entrada === 'on',
                botiquin_entrada: raw.botiquin_entrada === 'on',
                gato_entrada: raw.gato_entrada === 'on',
                cruz_entrada: raw.cruz_entrada === 'on',
                triangulo_entrada: raw.triangulo_entrada === 'on',
                caucho_entrada: raw.caucho_entrada === 'on',
                carpeta_entrada: raw.carpeta_entrada === 'on',
                ups_entrada: raw.ups_entrada === 'on',
                escalera_entrada: raw.escalera_entrada === 'on',
                escalera_tijera_entrada: raw.escalera_tijera_entrada === 'on',
            };

            const text = formatEntradaText(processed, reporteEntrada);
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');

            resetModo();
            toast.success('Entrada registrada con éxito. Se ha abierto WhatsApp.');
        } else {
            toast.error('Error al guardar: ' + res?.error);
        }
        setSubmitting(false);
    };

    const vehiculoOptions = vehiculos.map(v => ({
        value: v.id,
        label: `${v.modelo} - ${v.placa}`,
    }));

    const pendienteOptions = pendientes.map(p => {
        const v = Array.isArray(p.vehiculos) ? p.vehiculos[0] : p.vehiculos;
        const label = v ? `${v.modelo} - ${v.placa}` : `Vehículo (ID: ${p.vehiculo_id})`;
        return { value: p.id, label };
    });

    const vehiculoEntradaObj = reporteEntrada
        ? (Array.isArray(reporteEntrada.vehiculos) ? reporteEntrada.vehiculos[0] : reporteEntrada.vehiculos)
        : null;

    return (
        <div className="w-full max-w-lg mx-auto pb-20">

            {/* PESTAÑAS (Solo visibles si no hay modo seleccionado) */}
            {!modo && (
                <div className="divide-y divide-neutral-100 mt-6">
                    <button
                        type="button"
                        onClick={() => setModo('salida')}
                        className="w-full py-5 flex items-center justify-between text-left group hover:bg-neutral-50/50 px-1 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <Sun className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors" strokeWidth={1.5} />
                            <div>
                                <span className="block text-base font-medium text-neutral-900">Mañana (Salida)</span>
                                <span className="text-neutral-500 text-xs">Registrar inicio de ruta</span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-900 transition-colors" strokeWidth={1.5} />
                    </button>

                    <button
                        type="button"
                        onClick={() => setModo('entrada')}
                        className="w-full py-5 flex items-center justify-between text-left group hover:bg-neutral-50/50 px-1 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <Moon className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors" strokeWidth={1.5} />
                            <div>
                                <span className="block text-base font-medium text-neutral-900">Tarde (Entrada)</span>
                                <span className="text-neutral-500 text-xs">Cerrar ruta y novedades</span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-900 transition-colors" strokeWidth={1.5} />
                    </button>
                </div>
            )}

            {(modo === 'salida' || modo === 'entrada') && (
                <div className="mb-6">
                    <button
                        type="button"
                        onClick={resetModo}
                        className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center gap-1.5"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Volver al menú
                    </button>
                </div>
            )}

            <div>

                {/* ---------------- FORMULARIO SALIDA ---------------- */}
                {modo === 'salida' && (
                    <form action={handleSalidaSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="pb-4 border-b border-neutral-100">
                            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Salida</h2>
                            <p className="text-neutral-500 text-sm mt-0.5">Complete los datos de la mañana.</p>
                        </div>

                        {/* GRUPO 1 INFO */}
                        <div className="space-y-5 pb-6 border-b border-neutral-100">
                            <div>
                                <label className={labelClass}>Vehículo</label>
                                <CustomDropdown
                                    name="vehiculo_id"
                                    required
                                    searchable
                                    value={vehiculoId}
                                    onChange={(val) => {
                                        setVehiculoId(val);
                                        const v = vehiculos.find(x => x.id === val);
                                        setVehiculoSeleccionado(v || null);
                                        if (v && lastKmMap[v.id]) {
                                            setUltimoKm(lastKmMap[v.id]);
                                        } else {
                                            setUltimoKm(0);
                                        }
                                    }}
                                    options={vehiculoOptions}
                                    placeholder="Seleccionar vehículo..."
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Conductor</label>
                                <input name="conductor" required type="text" className={inputClass} placeholder="Su nombre completo" />
                            </div>
                            <div>
                                <label className={labelClass}>Departamento</label>
                                <CustomDropdown
                                    name="departamento"
                                    required
                                    value={departamento}
                                    onChange={setDepartamento}
                                    options={DEPARTAMENTO_OPTIONS}
                                    placeholder="Seleccionar departamento..."
                                />
                            </div>
                        </div>

                        <div className="space-y-5 pb-6 border-b border-neutral-100">
                            <div>
                                <label className={labelClass}>Kilometraje actual</label>
                                <input
                                    name="km_salida"
                                    required
                                    type="number"
                                    className={`${inputClass} ${errorKmSalida ? 'border-red-500 focus:border-red-600' : ''}`}
                                    defaultValue={ultimoKm > 0 ? ultimoKm : ''}
                                    min={ultimoKm}
                                    placeholder="0"
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        if (ultimoKm > 0) {
                                            if (val < ultimoKm) {
                                                setErrorKmSalida(`Error: Menor al último (${ultimoKm})`);
                                            } else if (val > ultimoKm + 10) {
                                                setErrorKmSalida(`Error: Mayor a límite permitido (${ultimoKm + 10})`);
                                            } else {
                                                setErrorKmSalida(null);
                                            }
                                        }
                                    }}
                                />
                                {ultimoKm > 0 && <p className="text-xs text-neutral-400 mt-1.5">Último cierre: <strong className="font-medium text-neutral-600">{ultimoKm} km</strong></p>}
                                {errorKmSalida && <p className="text-xs text-red-600 mt-1">{errorKmSalida}</p>}
                            </div>
                            <div>
                                <label className={labelClass}>Nivel de gasolina</label>
                                <CustomDropdown
                                    name="gasolina_salida"
                                    value={gasolinaSalida}
                                    onChange={setGasolinaSalida}
                                    options={GASOLINA_OPTIONS}
                                    placeholder="Seleccionar..."
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-base font-medium text-neutral-900">Chequeos</h3>

                            {/* TÉCNICO */}
                            <div>
                                <h4 className="text-xs font-medium text-neutral-400 pb-2 border-b border-neutral-100">Técnico</h4>
                                <div className="divide-y divide-neutral-100">
                                    <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                        <span className="text-sm text-neutral-900">Nivel de aceite</span>
                                        <input name="aceite_salida" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                    </label>
                                    <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                        <span className="text-sm text-neutral-900">Sistema de iluminación</span>
                                        <input name="luces_salida" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                    </label>
                                    <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                        <span className="text-sm text-neutral-900">Sistema de frenos</span>
                                        <input name="frenos_salida" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                    </label>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-3">
                                        <span className="text-sm text-neutral-900">Cauchos</span>
                                        <div className="w-full sm:w-56">
                                            <CustomDropdown
                                                name="estado_cauchos_salida"
                                                required
                                                value={estadoCauchosSalida}
                                                onChange={setEstadoCauchosSalida}
                                                options={CAUCHOS_OPTIONS}
                                                placeholder="Seleccionar"
                                            />
                                        </div>
                                    </div>
                                    <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                        <span className="text-sm text-neutral-900">Corneta</span>
                                        <input name="corneta_salida" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                    </label>
                                    <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                        <span className="text-sm text-neutral-900">Agua / Refrigerante</span>
                                        <input name="agua_salida" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                    </label>
                                </div>
                            </div>

                            {/* SEGURIDAD */}
                            {!esMoto(vehiculoSeleccionado) && (
                                <div>
                                    <h4 className="text-xs font-medium text-neutral-400 pb-2 border-b border-neutral-100">Seguridad</h4>
                                    <div className="divide-y divide-neutral-100">
                                        {[
                                            { k: 'cinturones_salida', l: 'Cinturones de seguridad' },
                                            { k: 'conos_salida', l: 'Conos de tráfico' },
                                            { k: 'extintor_salida', l: 'Extintor de incendios' },
                                            { k: 'botiquin_salida', l: 'Botiquín de primeros auxilios' },
                                            { k: 'gato_salida', l: 'Gato' },
                                            { k: 'cruz_salida', l: 'Llave cruz' },
                                            { k: 'triangulo_salida', l: 'Triángulo' },
                                            { k: 'caucho_salida', l: 'Caucho de repuesto' },
                                            { k: 'carpeta_salida', l: 'Carpeta de permisos' }
                                        ].map((item) => (
                                            <label key={item.k} className="flex items-center justify-between py-3.5 cursor-pointer">
                                                <span className="text-sm text-neutral-900">{item.l}</span>
                                                <input name={item.k} type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* EQUIPOS */}
                            {esInstalacionODistribucion(departamento) && (
                                <div>
                                    <h4 className="text-xs font-medium text-neutral-400 pb-2 border-b border-neutral-100">Equipos</h4>
                                    <div className="divide-y divide-neutral-100">
                                        {departamento === 'Instalación' && (
                                            <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                                <span className="text-sm text-neutral-900">Mini-UPS</span>
                                                <input name="ups_salida" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                            </label>
                                        )}
                                        <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                            <span className="text-sm text-neutral-900">Escalera telescópica</span>
                                            <input name="escalera_salida" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {(vehiculoSeleccionado?.tipo?.toLowerCase() === 'carga' || vehiculoSeleccionado?.modelo?.toLowerCase().includes('carga')) && (
                                <div>
                                    <h4 className="text-xs font-medium text-neutral-400 pb-2 border-b border-neutral-100">Equipos de carga</h4>
                                    <div className="divide-y divide-neutral-100">
                                        <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                            <span className="text-sm text-neutral-900">Escalera de tijera</span>
                                            <input name="escalera_tijera_salida" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <label className={labelClass}>Observaciones</label>
                            <textarea
                                name="observaciones_salida"
                                rows={3}
                                className={`${inputClass} resize-none`}
                                placeholder="Golpes, rayones..."
                            ></textarea>
                        </div>

                        <div className="pt-4 pb-12 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting || !!errorKmSalida}
                                className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Enviando...' : 'Enviar reporte'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ---------------- FORMULARIO ENTRADA ---------------- */}
                {modo === 'entrada' && (
                    <form action={handleEntradaSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="pb-4 border-b border-neutral-100">
                            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Entrada</h2>
                            <p className="text-neutral-500 text-sm mt-0.5">Cierre de ruta y novedades.</p>
                        </div>

                        <div className="pb-6 border-b border-neutral-100">
                            <label className={labelClass}>Vehículo en ruta</label>
                            <CustomDropdown
                                name="reporte_id"
                                required
                                searchable
                                value={reporteEntradaId}
                                onChange={(val) => {
                                    setReporteEntradaId(val);
                                    const r = pendientes.find(p => p.id === val);
                                    setReporteEntrada(r || null);
                                }}
                                options={pendienteOptions}
                                placeholder="Seleccionar vehículo..."
                            />
                        </div>

                        {reporteEntrada && (
                            <>
                                <div className="space-y-5 pb-6 border-b border-neutral-100">
                                    <div>
                                        <label className={labelClass}>Kilometraje llegada</label>
                                        <input
                                            name="km_entrada"
                                            required
                                            type="number"
                                            className={`${inputClass} ${errorKm ? 'border-red-500 focus:border-red-600' : ''}`}
                                            placeholder={reporteEntrada.km_salida.toString()}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                const min = reporteEntrada.km_salida;
                                                const max = min + 600;

                                                if (val < min) {
                                                    setErrorKm(`Error: Menor a salida (${min})`);
                                                } else if (val > max) {
                                                    setErrorKm('Alerta: Kilometraje excesivo');
                                                } else {
                                                    setErrorKm(null);
                                                }
                                            }}
                                        />
                                        {errorKm && <p className="text-xs text-red-600 mt-1">{errorKm}</p>}
                                    </div>
                                    <div>
                                        <label className={labelClass}>Nivel gasolina</label>
                                        <CustomDropdown
                                            name="gasolina_entrada"
                                            value={gasolinaEntrada}
                                            onChange={setGasolinaEntrada}
                                            options={GASOLINA_OPTIONS}
                                            placeholder="Seleccionar..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-base font-medium text-neutral-900">Estado llegada</h3>

                                    {/* TÉCNICO */}
                                    <div>
                                        <h4 className="text-xs font-medium text-neutral-400 pb-2 border-b border-neutral-100">Técnico</h4>
                                        <div className="divide-y divide-neutral-100">
                                            <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                                <span className="text-sm text-neutral-900">Nivel de aceite</span>
                                                <input name="aceite_entrada" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                            </label>
                                            <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                                <span className="text-sm text-neutral-900">Sistema de iluminación</span>
                                                <input name="luces_entrada" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                            </label>
                                            <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                                <span className="text-sm text-neutral-900">Sistema de frenos</span>
                                                <input name="frenos_entrada" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                            </label>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-3">
                                                <span className="text-sm text-neutral-900">Cauchos</span>
                                                <div className="w-full sm:w-56">
                                                    <CustomDropdown
                                                        name="estado_cauchos_entrada"
                                                        required
                                                        value={estadoCauchosEntrada}
                                                        onChange={setEstadoCauchosEntrada}
                                                        options={CAUCHOS_OPTIONS}
                                                        placeholder="Seleccionar"
                                                    />
                                                </div>
                                            </div>
                                            <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                                <span className="text-sm text-neutral-900">Corneta</span>
                                                <input name="corneta_entrada" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                            </label>
                                            <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                                <span className="text-sm text-neutral-900">Agua / Refrigerante</span>
                                                <input name="agua_entrada" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                            </label>
                                        </div>
                                    </div>

                                    {/* SEGURIDAD */}
                                    {!esMoto(vehiculoEntradaObj) && (
                                        <div>
                                            <h4 className="text-xs font-medium text-neutral-400 pb-2 border-b border-neutral-100">Herramientas</h4>
                                            <div className="divide-y divide-neutral-100">
                                                {[
                                                    { k: 'cinturones_entrada', l: 'Cinturones de seguridad' },
                                                    { k: 'conos_entrada', l: 'Conos de tráfico' },
                                                    { k: 'extintor_entrada', l: 'Extintor de incendios' },
                                                    { k: 'botiquin_entrada', l: 'Botiquín de primeros auxilios' },
                                                    { k: 'gato_entrada', l: 'Gato' },
                                                    { k: 'cruz_entrada', l: 'Llave cruz' },
                                                    { k: 'triangulo_entrada', l: 'Triángulo' },
                                                    { k: 'caucho_entrada', l: 'Caucho de repuesto' },
                                                    { k: 'carpeta_entrada', l: 'Carpeta de permisos' }
                                                ].map((item) => (
                                                    <label key={item.k} className="flex items-center justify-between py-3.5 cursor-pointer">
                                                        <span className="text-sm text-neutral-900">{item.l}</span>
                                                        <input name={item.k} type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* EQUIPOS */}
                                    {esInstalacionODistribucion(reporteEntrada.departamento) && (
                                        <div>
                                            <h4 className="text-xs font-medium text-neutral-400 pb-2 border-b border-neutral-100">Equipos</h4>
                                            <div className="divide-y divide-neutral-100">
                                                {reporteEntrada.departamento === 'Instalación' && (
                                                    <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                                        <span className="text-sm text-neutral-900">Mini-UPS</span>
                                                        <input name="ups_entrada" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                                    </label>
                                                )}
                                                <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                                    <span className="text-sm text-neutral-900">Escalera telescópica</span>
                                                    <input name="escalera_entrada" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* EQUIPOS CARGA */}
                                    {(vehiculoEntradaObj?.tipo?.toLowerCase() === 'carga' || vehiculoEntradaObj?.modelo?.toLowerCase().includes('carga')) && (
                                        <div>
                                            <h4 className="text-xs font-medium text-neutral-400 pb-2 border-b border-neutral-100">Equipos de carga</h4>
                                            <div className="divide-y divide-neutral-100">
                                                <label className="flex items-center justify-between py-3.5 cursor-pointer">
                                                    <span className="text-sm text-neutral-900">Escalera de tijera</span>
                                                    <input name="escalera_tijera_entrada" type="checkbox" className="w-4 h-4 accent-neutral-900 cursor-pointer" />
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2">
                                    <label className={labelClass}>Observaciones</label>
                                    <textarea
                                        name="observaciones_entrada"
                                        rows={3}
                                        className={`${inputClass} resize-none`}
                                        placeholder="Novedades..."
                                    ></textarea>
                                </div>

                                <div className="pt-4 pb-12 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={!!errorKm || submitting}
                                        className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Enviando...' : 'Enviar reporte'}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
