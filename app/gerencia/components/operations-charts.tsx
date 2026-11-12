"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function OperationsCharts({ data }: { data: any[] }) {
    return (
        <div className="h-full flex flex-col">
            <div className="pb-3 mb-4 border-b border-neutral-100">
                <h2 className="text-base font-medium text-neutral-900">Rendimiento semanal</h2>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F5" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#737373', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#737373', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '6px', border: '1px solid #E5E5E5', boxShadow: 'none' }}
                            cursor={{ fill: '#FAFAFA' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar
                            dataKey="Instalaciones"
                            fill="#171717"
                            radius={[4, 4, 0, 0]}
                            barSize={40}
                        />
                        <Bar
                            dataKey="Soportes"
                            fill="#A3A3A3"
                            radius={[4, 4, 0, 0]}
                            barSize={40}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

export function VehicleStatusChart({ stats }: { stats: any }) {
    const data = [
        { name: 'Operativos', value: stats.operational, fill: '#22C55E' }, // Green
        { name: 'En taller', value: stats.maintenance, fill: '#F59E0B' }, // Amber
        { name: 'Críticos (fallas)', value: stats.critical, fill: '#EF4444' }, // Red
    ]

    return (
        <div className="h-full flex flex-col">
            <div className="pb-3 mb-4 border-b border-neutral-100">
                <h2 className="text-base font-medium text-neutral-900">Estado de flota</h2>
            </div>
            <div className="flex flex-col divide-y divide-neutral-100">
                {data.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                            <span className="text-sm text-neutral-600">{item.name}</span>
                        </div>
                        <span className="text-base font-light text-neutral-900 tabular-nums">{item.value}</span>
                    </div>
                ))}

                <div className="pt-4 mt-1 flex items-center justify-between text-sm text-neutral-500">
                    <span>Total vehículos</span>
                    <span className="font-medium text-neutral-900 tabular-nums">{stats.total}</span>
                </div>
            </div>
        </div>
    )
}
