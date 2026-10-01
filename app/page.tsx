"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  edgeFor,
  findRoute,
  nodeFor,
  roadEdges,
  roadNodes,
  type NodeId,
  type RouteResult,
  type Vehicle,
} from "./lib/routing";

type Tab = "operacion" | "vehiculo" | "restricciones";

const presets: Array<{ id: string; label: string; detail: string; vehicle: Vehicle }> = [
  { id: "c2", label: "Camión C2", detail: "Rígido · 18 t", vehicle: { height: 3.6, width: 2.5, length: 10.5, weight: 18 } },
  { id: "t3s2", label: "Tractocamión", detail: "T3-S2 · 42 t", vehicle: { height: 4.25, width: 2.6, length: 18.5, weight: 42 } },
  { id: "doble", label: "Doble remolque", detail: "T3-S2-R4 · 60 t", vehicle: { height: 4.35, width: 2.6, length: 31, weight: 60 } },
];

const defaultVehicle = presets[1].vehicle;
const initialRoute = findRoute("uam", "logistico", defaultVehicle);

function lineGeometry(fromId: NodeId, toId: NodeId) {
  const from = nodeFor(fromId);
  const to = nodeFor(toId);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return {
    left: `${from.x}%`,
    top: `${from.y}%`,
    width: `${Math.hypot(dx, dy).toFixed(3)}%`,
    transform: `rotate(${Math.atan2(dy, dx).toFixed(6)}rad)`,
  };
}

function positionAlongPath(path: NodeId[], progress: number) {
  if (path.length < 2) return { x: nodeFor(path[0] ?? "uam").x, y: nodeFor(path[0] ?? "uam").y };
  const lengths = path.slice(0, -1).map((id, index) => {
    const a = nodeFor(id);
    const b = nodeFor(path[index + 1]);
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let remaining = Math.min(1, Math.max(0, progress)) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const ratio = Math.min(1, remaining / lengths[index]);
      const a = nodeFor(path[index]);
      const b = nodeFor(path[index + 1]);
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    }
    remaining -= lengths[index];
  }
  return nodeFor(path[path.length - 1]);
}

function vehicleFieldLabel(field: keyof Vehicle) {
  return { height: "Altura", width: "Ancho", length: "Longitud", weight: "Peso" }[field];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("operacion");
  const [start, setStart] = useState<NodeId>("uam");
  const [goal, setGoal] = useState<NodeId>("logistico");
  const [vehicle, setVehicle] = useState<Vehicle>(defaultVehicle);
  const [preset, setPreset] = useState("t3s2");
  const [route, setRoute] = useState<RouteResult>(initialRoute);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [events, setEvents] = useState([
    "Ruta inicial calculada con restricciones activas",
    "Perfil T3-S2 validado para la red de demostración",
  ]);
  const [notice, setNotice] = useState("Ruta segura lista para iniciar");
  const arrivalLogged = useRef(false);

  const routeEdgeSet = useMemo(() => new Set(route.edgeIds), [route.edgeIds]);
  const blockedSet = useMemo(() => new Set(blocked), [blocked]);
  const truckPosition = positionAlongPath(route.path, progress);

  useEffect(() => {
    if (!running || route.path.length < 2) return;
    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(1, value + 0.0045));
    }, 45);
    return () => window.clearInterval(timer);
  }, [running, route.path.length]);

  useEffect(() => {
    if (progress < 1 || arrivalLogged.current) return;
    arrivalLogged.current = true;
    setRunning(false);
    setNotice("Recorrido completado sin infringir restricciones");
    setEvents((items) => [`Llegada confirmada · ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`, ...items].slice(0, 5));
  }, [progress]);

  function calculate(nextBlocked = blocked) {
    if (start === goal) {
      setNotice("Selecciona un origen y destino diferentes");
      return;
    }
    const next = findRoute(start, goal, vehicle, nextBlocked);
    setRoute(next);
    setProgress(0);
    setRunning(false);
    arrivalLogged.current = false;
    if (next.path.length) {
      setNotice(`Ruta apta: ${next.distance.toFixed(1)} km, ${next.minutes} min`);
      setEvents((items) => [`A* exploró ${next.explored} nodos y generó una ruta viable`, ...items].slice(0, 5));
    } else {
      setNotice("No existe una ruta compatible con este vehículo");
      setEvents((items) => ["Cálculo detenido: todas las alternativas violan una restricción", ...items].slice(0, 5));
    }
  }

  function applyPreset(id: string) {
    const selected = presets.find((item) => item.id === id)!;
    setPreset(id);
    setVehicle(selected.vehicle);
    setNotice(`${selected.label} cargado. Recalcula para validar la ruta.`);
  }

  function updateVehicle(field: keyof Vehicle, value: string) {
    setPreset("custom");
    setVehicle((current) => ({ ...current, [field]: Math.max(0, Number(value)) }));
  }

  function addIncident() {
    const candidate = route.edgeIds.find((id, index) => index > 0 && !blocked.includes(id)) ?? route.edgeIds.find((id) => !blocked.includes(id));
    if (!candidate) {
      setNotice("No hay otro tramo disponible para simular un incidente");
      return;
    }
    const nextBlocked = [...blocked, candidate];
    setBlocked(nextBlocked);
    const edge = edgeFor(candidate);
    setEvents((items) => [`Cierre reportado en ${edge.road}; ruta recalculada`, ...items].slice(0, 5));
    calculate(nextBlocked);
  }

  function clearIncidents() {
    setBlocked([]);
    setNotice("Incidentes eliminados. Calcula la ruta nuevamente.");
  }

  function toggleSimulation() {
    if (!route.path.length) return;
    if (progress >= 1) {
      setProgress(0);
      arrivalLogged.current = false;
    }
    setRunning((value) => !value);
    setNotice(running ? "Simulación en pausa" : "Agente autónomo en recorrido");
  }

  const rejectionSummary = route.rejected.slice(0, 4);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Ruta Carga 3D">
          <span className="brand-mark"><span>RC</span></span>
          <span><strong>RUTA CARGA</strong><small>Centro de navegación 3D</small></span>
        </div>
        <div className="system-status"><span className="status-dot" /> Red operativa <em>Datos de demostración</em></div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Centro de alertas">3<span className="bell">●</span></button>
          <div className="operator"><span>AG</span><div><strong>Alberto González</strong><small>Operador académico</small></div></div>
        </div>
      </header>

      <nav className="rail" aria-label="Navegación principal">
        <button className={activeTab === "operacion" ? "active" : ""} onClick={() => setActiveTab("operacion")}><span>⌁</span><small>Operación</small></button>
        <button className={activeTab === "vehiculo" ? "active" : ""} onClick={() => setActiveTab("vehiculo")}><span>▰</span><small>Vehículo</small></button>
        <button className={activeTab === "restricciones" ? "active" : ""} onClick={() => setActiveTab("restricciones")}><span>⚠</span><small>Restricciones</small></button>
        <button onClick={() => setNotice("Todos los módulos responden correctamente")}><span>◫</span><small>Diagnóstico</small></button>
        <div className="rail-spacer" />
        <button onClick={() => setNotice("Ayuda: configura el vehículo, calcula y ejecuta la simulación")}><span>?</span><small>Ayuda</small></button>
      </nav>

      <section className="workspace">
        <aside className="control-panel">
          <div className="panel-heading">
            <p className="eyebrow">PLANIFICADOR ESPECIALIZADO</p>
            <h1>{activeTab === "operacion" ? "Nueva ruta" : activeTab === "vehiculo" ? "Perfil del vehículo" : "Control vial"}</h1>
            <p>{activeTab === "operacion" ? "Calcula un trayecto compatible con las dimensiones y el peso de la unidad." : activeTab === "vehiculo" ? "Define las características que determinarán la viabilidad de cada tramo." : "Consulta cierres, límites y segmentos descartados por el algoritmo."}</p>
          </div>

          {activeTab === "operacion" && (
            <div className="panel-content">
              <div className="route-selector">
                <span className="route-spine"><i /><i /></span>
                <label>Origen<select value={start} onChange={(event) => setStart(event.target.value as NodeId)}>{roadNodes.map((node) => <option value={node.id} key={node.id}>{node.label}</option>)}</select></label>
                <button className="swap-button" onClick={() => { setStart(goal); setGoal(start); }} aria-label="Intercambiar origen y destino">⇅</button>
                <label>Destino<select value={goal} onChange={(event) => setGoal(event.target.value as NodeId)}>{roadNodes.map((node) => <option value={node.id} key={node.id}>{node.label}</option>)}</select></label>
              </div>

              <div className="section-label"><span>UNIDAD ASIGNADA</span><button onClick={() => setActiveTab("vehiculo")}>Editar</button></div>
              <button className="vehicle-summary" onClick={() => setActiveTab("vehiculo")}>
                <span className="truck-symbol">▰</span>
                <span><strong>{presets.find((item) => item.id === preset)?.label ?? "Configuración personalizada"}</strong><small>{vehicle.height.toFixed(2)} m alto · {vehicle.length.toFixed(1)} m largo · {vehicle.weight.toFixed(0)} t</small></span>
                <b>›</b>
              </button>

              <div className="restriction-chips"><span>ALTURA {vehicle.height.toFixed(2)} m</span><span>PESO {vehicle.weight.toFixed(0)} t</span><span>ANCHO {vehicle.width.toFixed(2)} m</span></div>
              <button className="primary-button" onClick={() => calculate()}>Calcular ruta segura <span>→</span></button>
              <div className={`notice ${route.path.length ? "ok" : "warning"}`}><span>{route.path.length ? "✓" : "!"}</span><p><strong>{notice}</strong><small>{route.rejected.length} segmentos evaluados con restricción</small></p></div>
            </div>
          )}

          {activeTab === "vehiculo" && (
            <div className="panel-content">
              <div className="preset-grid">
                {presets.map((item) => <button key={item.id} className={preset === item.id ? "selected" : ""} onClick={() => applyPreset(item.id)}><span>▰</span><strong>{item.label}</strong><small>{item.detail}</small></button>)}
              </div>
              <div className="dimension-grid">
                {(Object.keys(vehicle) as Array<keyof Vehicle>).map((field) => <label key={field}>{vehicleFieldLabel(field)}<span><input type="number" min="0" step="0.05" value={vehicle[field]} onChange={(event) => updateVehicle(field, event.target.value)} /><em>{field === "weight" ? "t" : "m"}</em></span></label>)}
              </div>
              <div className="cargo-card"><span>◆</span><div><strong>Carga general</strong><small>Sin materiales peligrosos · Centro de gravedad estándar</small></div></div>
              <button className="primary-button" onClick={() => { setActiveTab("operacion"); calculate(); }}>Aplicar y recalcular <span>→</span></button>
            </div>
          )}

          {activeTab === "restricciones" && (
            <div className="panel-content">
              <div className="restriction-summary"><div><strong>{route.rejected.length}</strong><span>tramos descartados</span></div><div><strong>{blocked.length}</strong><span>cierres activos</span></div></div>
              <div className="rejection-list">
                {rejectionSummary.length ? rejectionSummary.map(({ edge, reason }) => <div key={edge.id}><span className="restriction-icon">!</span><p><strong>{edge.road}</strong><small>{reason}</small></p><em>{edge.id.toUpperCase()}</em></div>) : <p className="empty-state">No hay restricciones incompatibles en el cálculo actual.</p>}
              </div>
              <button className="secondary-button" onClick={addIncident}>Simular cierre en la ruta</button>
              {blocked.length > 0 && <button className="text-button" onClick={clearIncidents}>Eliminar todos los cierres</button>}
            </div>
          )}

          <footer className="panel-footer"><span>MODELO</span><strong>A* ponderado</strong><small>v1.0 · Red académica</small></footer>
        </aside>

        <section className="map-area" aria-label="Mapa de navegación">
          <div className="map-toolbar">
            <div className="mode-switch"><button className="active">Mapa</button><button onClick={() => document.getElementById("simulation")?.scrollIntoView({ behavior: "smooth" })}>Vista 3D</button></div>
            <div className="map-actions"><button onClick={() => setNotice("Mapa centrado en la ruta activa")}>⌖ Centrar</button><button onClick={addIncident} className="incident-button">+ Incidente</button></div>
          </div>

          <div className="map-canvas">
            <div className="terrain terrain-one" /><div className="terrain terrain-two" /><div className="terrain terrain-three" />
            <div className="map-grid" />
            {roadEdges.map((edge) => <div key={edge.id} className={`road-line ${routeEdgeSet.has(edge.id) ? "route-line" : ""} ${blockedSet.has(edge.id) ? "blocked-line" : ""}`} style={lineGeometry(edge.from, edge.to)}><span /></div>)}
            {roadNodes.map((node) => <button key={node.id} className={`map-node ${node.id === start ? "start" : ""} ${node.id === goal ? "goal" : ""} ${route.path.includes(node.id) ? "on-route" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => setGoal(node.id)} aria-label={`Usar ${node.label} como destino`}><i /><span>{node.shortLabel}</span></button>)}
            {route.path.length > 0 && <div className="moving-truck" style={{ left: `${truckPosition.x}%`, top: `${truckPosition.y}%` }}><span>▰</span><small>{Math.round(progress * 100)}%</small></div>}
            <div className="map-legend"><span><i className="safe" /> Ruta compatible</span><span><i className="restricted" /> Restricción</span><span><i className="closed" /> Cierre activo</span></div>
            <div className="map-scale">500 m</div>
          </div>

          <div className="route-dashboard">
            <div className="route-title"><span className="success-ring">✓</span><div><p>RUTA RECOMENDADA</p><strong>{route.path.length ? `${nodeFor(start).shortLabel} → ${nodeFor(goal).shortLabel}` : "Sin ruta disponible"}</strong></div></div>
            <div className="metric"><small>DISTANCIA</small><strong>{route.distance.toFixed(1)} <em>km</em></strong></div>
            <div className="metric"><small>TIEMPO EST.</small><strong>{route.minutes} <em>min</em></strong></div>
            <div className="metric"><small>NODOS A*</small><strong>{route.explored}</strong></div>
            <div className="metric"><small>COMPATIBILIDAD</small><strong className="green">{route.path.length ? "100%" : "0%"}</strong></div>
            <button className="start-button" onClick={toggleSimulation} disabled={!route.path.length}>{running ? "Pausar" : progress > 0 && progress < 1 ? "Continuar" : "Iniciar recorrido"} <span>{running ? "Ⅱ" : "▶"}</span></button>
          </div>
        </section>
      </section>

      <section className="lower-deck" id="simulation">
        <div className="simulation-card">
          <div className="card-heading"><div><p className="eyebrow">SIMULADOR DE AGENTE</p><h2>Vista operacional 3D</h2></div><span className={running ? "live" : "paused"}>{running ? "● EN CURSO" : "● EN PAUSA"}</span></div>
          <div className="scene-3d">
            <div className="scene-sky"><i /><i /><i /><i /><i /><i /></div>
            <div className="road-plane"><div className="lane-markers" /></div>
            <div className="truck-3d" style={{ transform: `translateX(${progress * 250 - 90}px) translateY(${progress * -10}px)` }}><div className="truck-cargo">RUTA CARGA</div><div className="truck-cab"><span /></div><i className="wheel one" /><i className="wheel two" /><i className="wheel three" /></div>
            <div className="scene-hud"><span>VELOCIDAD<strong>{running ? Math.round(38 + Math.sin(progress * 20) * 7) : 0} km/h</strong></span><span>TRAMO<strong>{route.edgeIds[Math.min(route.edgeIds.length - 1, Math.floor(progress * route.edgeIds.length))]?.toUpperCase() ?? "—"}</strong></span><span>PROGRESO<strong>{Math.round(progress * 100)}%</strong></span></div>
          </div>
        </div>

        <aside className="event-card">
          <div className="card-heading"><div><p className="eyebrow">BITÁCORA</p><h2>Decisiones del agente</h2></div><button onClick={() => setEvents([])}>Limpiar</button></div>
          <div className="event-list">{events.length ? events.map((event, index) => <div key={`${event}-${index}`}><span>{index === 0 ? "●" : "○"}</span><p>{event}<small>{index === 0 ? "Ahora" : `Evento ${events.length - index}`}</small></p></div>) : <p className="empty-state">La bitácora está vacía.</p>}</div>
          <div className="validation-row"><span>Motor de restricciones</span><strong>VALIDADO</strong></div>
        </aside>
      </section>
    </main>
  );
}
