"use client";

import { useState } from "react";

const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(value);

export default function TripEstimate({ distance, minutes, consumption, available }: { distance: number; minutes: number; consumption: number; available: boolean }) {
  const [diesel, setDiesel] = useState(26);
  const [wear, setWear] = useState(4);
  const [hourly, setHourly] = useState(100);
  const [fixed, setFixed] = useState(150);
  const [margin, setMargin] = useState(15);
  const [returnTrip, setReturnTrip] = useState(false);
  const factor = returnTrip ? 2 : 1;
  const km = distance * factor;
  const fuel = km * consumption / 100 * diesel;
  const maintenance = km * wear;
  const operator = minutes / 60 * factor * hourly;
  const total = fuel + maintenance + operator + fixed;
  const fields = [
    { label: "Diésel · MXN/L", value: diesel, setter: setDiesel },
    { label: "Desgaste y mantenimiento · MXN/km", value: wear, setter: setWear },
    { label: "Operador · MXN/h", value: hourly, setter: setHourly },
    { label: "Gastos fijos · MXN/viaje", value: fixed, setter: setFixed },
    { label: "Recargo sobre costo · %", value: margin, setter: setMargin },
  ];
  return <section className="trip-estimate" id="costos" aria-labelledby="estimate-title">
    <div className="estimate-intro"><p className="eyebrow">03 / ESTIMA TU VIAJE</p><h2 id="estimate-title">Cada kilómetro,<br />con las cuentas claras.</h2><p>Ajusta tus costos para explorar cuánto cobrar por el recorrido seleccionado.</p><span className="estimate-tag">Sin casetas ni peajes</span><p className="estimate-disclaimer">Valores iniciales de ejemplo. No incluye impuestos. El retorno usa la misma distancia, duración y consumo de ida; no calcula una ruta de regreso.</p></div>
    <div className="estimate-inputs">{fields.map(({ label, value, setter }) => <label key={label}>{label}<input type="number" min="0" max="1000000" step="0.01" value={value} onChange={(event) => setter(Math.min(1000000, Math.max(0, Number(event.target.value) || 0)))} /></label>)}<label className="estimate-return"><input type="checkbox" checked={returnTrip} onChange={(event) => setReturnTrip(event.target.checked)} /> Incluir retorno estimado</label></div>
    <div className="estimate-result"><span>ESTIMACIÓN DEL RECORRIDO</span><strong>{available ? money(total * (1 + margin / 100)) : "Sin ruta"}</strong><p>{available ? `${km.toFixed(1)} km presupuestados · con recargo de ${margin}%` : "Calcula una ruta disponible para estimar costos."}</p><dl>{[["Combustible", fuel], ["Desgaste y mantenimiento", maintenance], ["Tiempo del operador", operator], ["Gastos fijos", fixed], ["Costo base", total]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{available ? money(Number(value)) : "—"}</dd></div>)}</dl></div>
  </section>;
}
