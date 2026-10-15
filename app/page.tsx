"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AcademicEvaluationPanel from "./components/AcademicEvaluationPanel";
import AcademicSessionGate, { type AcademicSession } from "./components/AcademicSessionGate";
import GooglePhotorealistic3D from "./components/GooglePhotorealistic3D";
import MapCredentialsPanel, {
  MAP_STORAGE_KEYS,
  type MapCredentials,
} from "./components/MapCredentialsPanel";
import TruckSimulation3D from "./components/TruckSimulation3D";
import {
  edgeMidpoint,
  edgeFor,
  findRoute,
  findRouteAlternatives,
  nearestNode,
  nodeFor,
  PILOT_DATASET_METADATA,
  routeGeoWaypoints,
  roadNodes,
  type NodeId,
  type RouteResult,
  type RoutePreference,
  type TrafficLevel,
  type Vehicle,
} from "./lib/routing";
import {
  ACADEMIC_STORAGE,
  createAcademicIncident,
  createTrafficSnapshot,
  interpolateGeoPath,
  signalStateForTick,
  trafficLabel,
  type AcademicRoadEvent,
  type AgentState,
} from "./lib/academic-simulation";

type Tab = "operacion" | "vehiculo" | "restricciones" | "entorno" | "diagnostico" | "ayuda";

const presets: Array<{ id: string; label: string; detail: string; vehicle: Vehicle }> = [
  { id: "c2", label: "Camión C2", detail: "Rígido · 18 t", vehicle: { height: 3.6, width: 2.5, length: 10.5, weight: 18, axles: 2, turnRadius: 8.5, fuelConsumption: 26, cargoType: "general", authorizedPrivateZones: false } },
  { id: "t3s2", label: "Tractocamión", detail: "T3-S2 · 42 t", vehicle: { height: 4.25, width: 2.6, length: 18.5, weight: 42, axles: 5, turnRadius: 12.5, fuelConsumption: 38, cargoType: "general", authorizedPrivateZones: false } },
  { id: "doble", label: "Doble remolque", detail: "T3-S2-R4 · 60 t", vehicle: { height: 4.35, width: 2.6, length: 31, weight: 60, axles: 9, turnRadius: 15.5, fuelConsumption: 52, cargoType: "general", authorizedPrivateZones: false } },
];

const dimensionFields = ["height", "width", "length", "weight", "axles", "turnRadius", "fuelConsumption"] as const;

const defaultVehicle = presets[1].vehicle;
const initialRoute = { ...findRoute("uam", "logistico", defaultVehicle, [], { preference: "corta" }), calculationMs: 0 };
const environmentMapCredentials: MapCredentials = {
  cesiumToken: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim() ?? "",
  googleApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "",
  provider: process.env.NEXT_PUBLIC_GOOGLE_MAPS_3D === "true" ? "google" : "cesium",
};

type SavedVehicleProfile = { id: string; name: string; vehicle: Vehicle };
type RouteHistoryItem = { id: string; start: string; goal: string; distance: number; minutes: number; completedAt: string };

function smoothStep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function motionFactor(progress: number) {
  const acceleration = 0.28 + 0.72 * smoothStep(progress / 0.09);
  const braking = 0.2 + 0.8 * smoothStep((1 - progress) / 0.13);
  return Math.min(acceleration, braking);
}

function vehicleFieldLabel(field: keyof Vehicle) {
  return { height: "Altura", width: "Ancho", length: "Longitud", weight: "Peso", axles: "Número de ejes", turnRadius: "Radio de giro", fuelConsumption: "Consumo", cargoType: "Tipo de carga", authorizedPrivateZones: "Zonas privadas" }[field];
}

function vehicleFieldUnit(field: keyof Vehicle) {
  if (field === "weight") return "t";
  if (field === "axles") return "ejes";
  if (field === "fuelConsumption") return "L/100 km";
  return "m";
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
  const [recenterKey, setRecenterKey] = useState(0);
  const [keyPanelOpen, setKeyPanelOpen] = useState(false);
  const [mapCredentials, setMapCredentials] = useState<MapCredentials>(environmentMapCredentials);
  const [session, setSession] = useState<AcademicSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<SavedVehicleProfile[]>([]);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryItem[]>([]);
  const [preference, setPreference] = useState<RoutePreference>("corta");
  const [trafficSeed, setTrafficSeed] = useState(1);
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [automaticEvents, setAutomaticEvents] = useState(true);
  const [roadEvents, setRoadEvents] = useState<AcademicRoadEvent[]>([]);
  const [alternatives, setAlternatives] = useState<RouteResult[]>([initialRoute]);
  const [selectedAlternative, setSelectedAlternative] = useState(0);
  const [routeConfirmed, setRouteConfirmed] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [geometryMode, setGeometryMode] = useState<"road" | "graph">("road");
  const [gpsFix, setGpsFix] = useState({ lat: nodeFor("uam").lat, lng: nodeFor("uam").lng });
  const [learnedPenalties, setLearnedPenalties] = useState<Record<string, number>>({});
  const [profileName, setProfileName] = useState("");
  const [coordinateDraft, setCoordinateDraft] = useState(`${nodeFor("uam").lat}, ${nodeFor("uam").lng}`);
  const autoIncidentTriggered = useRef(false);
  const [events, setEvents] = useState([
    "Ruta inicial calculada con restricciones activas",
    "Perfil T3-S2 validado para la red de demostración",
  ]);
  const [notice, setNotice] = useState("Ruta segura lista para iniciar");
  const arrivalLogged = useRef(false);

  const trafficByEdge = useMemo(
    () => trafficEnabled ? createTrafficSnapshot(trafficSeed) : {},
    [trafficEnabled, trafficSeed],
  );
  const signalState = signalStateForTick(clockTick);

  useEffect(() => {
    queueMicrotask(() => {
      const storedProvider = localStorage.getItem(MAP_STORAGE_KEYS.provider);
      setMapCredentials({
        cesiumToken: localStorage.getItem(MAP_STORAGE_KEYS.cesium)?.trim() || environmentMapCredentials.cesiumToken,
        googleApiKey: localStorage.getItem(MAP_STORAGE_KEYS.google)?.trim() || environmentMapCredentials.googleApiKey,
        provider: storedProvider === "google" || storedProvider === "cesium"
          ? storedProvider
          : environmentMapCredentials.provider,
      });
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const storedSession = localStorage.getItem(ACADEMIC_STORAGE.session);
        const storedProfiles = localStorage.getItem(ACADEMIC_STORAGE.profiles);
        const storedHistory = localStorage.getItem(ACADEMIC_STORAGE.history);
        const storedLearning = localStorage.getItem(ACADEMIC_STORAGE.learning);
        if (storedSession) setSession(JSON.parse(storedSession));
        if (storedProfiles) setSavedProfiles(JSON.parse(storedProfiles));
        if (storedHistory) setRouteHistory(JSON.parse(storedHistory));
        if (storedLearning) setLearnedPenalties(JSON.parse(storedLearning));
      } catch {
        localStorage.removeItem(ACADEMIC_STORAGE.session);
      } finally {
        setSessionReady(true);
      }
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 1_000);
    const trafficTimer = window.setInterval(() => setTrafficSeed((value) => value + 1), 15_000);
    return () => { window.clearInterval(timer); window.clearInterval(trafficTimer); };
  }, []);

  const routePoints3D = useMemo(
    () => route.path.map((id) => ({ x: nodeFor(id).x, y: nodeFor(id).y })),
    [route.path],
  );
  const routeWaypoints = useMemo(() => routeGeoWaypoints(route.path), [route.path]);
  const restrictionMarkers = useMemo(
    () => [
      ...route.rejected.slice(0, 5).map(({ edge, reason }) => ({
        id: edge.id,
        label: edge.road,
        reason,
        position: edgeMidpoint(edge),
      })),
      ...roadEvents.slice(-3).map((event) => ({
        id: event.id,
        label: event.label,
        reason: `${event.severity.toUpperCase()} · evento académico`,
        position: edgeMidpoint(edgeFor(event.edgeId)),
      })),
    ],
    [roadEvents, route.rejected],
  );
  const activeEdgeId = route.edgeIds[Math.min(route.edgeIds.length - 1, Math.floor(progress * route.edgeIds.length))] ?? "";
  const activeEdge = activeEdgeId.toUpperCase();
  const activeTraffic: TrafficLevel = trafficByEdge[activeEdgeId] ?? "fluido";
  const gpsPoint = interpolateGeoPath(routeWaypoints, progress);
  const gpsLatitude = gpsPoint.lat;
  const gpsLongitude = gpsPoint.lng;
  const nearSignal = route.signalCount > 0 && ([0.33, 0.68].some((point) => Math.abs(progress - point) < 0.018));
  const waitingAtSignal = running && nearSignal && signalState === "rojo";
  const agentState: AgentState = progress >= 1 ? "finalizado" : waitingAtSignal ? "esperando-semaforo" : running ? "en-ruta" : routeConfirmed ? "planeando" : "planeando";
  const simulatedSpeed = running
    ? waitingAtSignal ? 0 : Math.max(7, Math.round((48 + Math.sin(progress * 16) * 4) * motionFactor(progress) * (activeTraffic === "intenso" ? .55 : activeTraffic === "moderado" ? .78 : 1)))
    : 0;
  const simulationDurationMs = Math.min(120_000, Math.max(45_000, route.minutes * 2_000));

  useEffect(() => {
    if (!gpsEnabled) return;
    queueMicrotask(() => setGpsFix({ lat: gpsLatitude, lng: gpsLongitude }));
  }, [gpsEnabled, gpsLatitude, gpsLongitude]);

  useEffect(() => {
    if (!running || route.path.length < 2) return;
    let frame = 0;
    let previous = performance.now();
    const advance = (now: number) => {
      const elapsed = Math.min(100, Math.max(0, now - previous));
      previous = now;
      if (!waitingAtSignal) setProgress((value) => Math.min(1, value + (elapsed / simulationDurationMs) * motionFactor(value)));
      frame = window.requestAnimationFrame(advance);
    };
    frame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frame);
  }, [running, route.path.length, simulationDurationMs, waitingAtSignal]);

  useEffect(() => {
    if (progress < 1 || arrivalLogged.current) return;
    arrivalLogged.current = true;
    setRunning(false);
    setNotice("Recorrido completado sin infringir restricciones");
    setEvents((items) => [`Llegada confirmada · ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`, ...items].slice(0, 5));
    const historyItem: RouteHistoryItem = {
      id: `route-${Date.now()}`,
      start: nodeFor(start).shortLabel,
      goal: nodeFor(goal).shortLabel,
      distance: route.distance,
      minutes: route.minutes,
      completedAt: new Date().toISOString(),
    };
    setRouteHistory((current) => {
      const next = [historyItem, ...current].slice(0, 12);
      localStorage.setItem(ACADEMIC_STORAGE.history, JSON.stringify(next));
      return next;
    });
  }, [goal, progress, route.distance, route.minutes, start]);

  useEffect(() => {
    if (!automaticEvents || !running || progress < 0.38 || autoIncidentTriggered.current || route.edgeIds.length < 2) return;
    const currentIndex = Math.min(route.edgeIds.length - 1, Math.floor(progress * route.edgeIds.length));
    const futureEdges = route.edgeIds.slice(Math.min(route.edgeIds.length - 1, currentIndex + 1));
    const incident = createAcademicIncident(futureEdges, clockTick + route.edgeIds.length);
    if (!incident) return;
    autoIncidentTriggered.current = true;
    queueMicrotask(() => {
      setRoadEvents((current) => [...current.filter((item) => item.expiresAt > Date.now()), incident].slice(-8));
      if (!incident.blocked) {
        setEvents((items) => [`Agente detectó ${incident.label.toLowerCase()}; continúa con precaución`, ...items].slice(0, 7));
        return;
      }

      const nextBlocked = [...new Set([...blocked, incident.edgeId])];
      const currentNodeIndex = Math.min(route.path.length - 2, Math.floor(progress * Math.max(1, route.path.length - 1)));
      const nextStart = route.path[Math.max(0, currentNodeIndex)];
      const rerouted = findRouteAlternatives(nextStart, goal, vehicle, nextBlocked, { trafficByEdge, learnedPenalties, preference });
      setBlocked(nextBlocked);
      setLearnedPenalties((current) => {
        const next = { ...current, [incident.edgeId]: (current[incident.edgeId] ?? 0) + 1.5 };
        localStorage.setItem(ACADEMIC_STORAGE.learning, JSON.stringify(next));
        return next;
      });
      setStart(nextStart);
      setAlternatives(rerouted);
      setSelectedAlternative(0);
      setRoute(rerouted[0]);
      setProgress(0);
      setRouteConfirmed(true);
      setNotice(`Agente detectó un bloqueo y recalculó desde ${nodeFor(nextStart).shortLabel}`);
      setEvents((items) => [`Reacción autónoma: ${incident.label}; A* generó una alternativa`, ...items].slice(0, 7));
    });
  }, [automaticEvents, blocked, clockTick, goal, learnedPenalties, preference, progress, route.edgeIds, route.path, running, trafficByEdge, vehicle]);

  function calculate(nextBlocked = blocked) {
    if (start === goal) {
      setNotice("Selecciona un origen y destino diferentes");
      return;
    }
    const nextAlternatives = findRouteAlternatives(start, goal, vehicle, nextBlocked, {
      trafficByEdge,
      learnedPenalties,
      preference,
    });
    const next = nextAlternatives[0];
    setAlternatives(nextAlternatives);
    setSelectedAlternative(0);
    setRoute(next);
    setProgress(0);
    setRunning(false);
    setRouteConfirmed(false);
    autoIncidentTriggered.current = false;
    arrivalLogged.current = false;
    if (next.path.length) {
      const directRejection = next.rejected.find(({ edge }) => (edge.from === start && edge.to === goal) || (!edge.oneWay && edge.to === start && edge.from === goal));
      setNotice(`Ruta apta: ${next.distance.toFixed(1)} km, ${next.minutes} min${directRejection ? ` · Desvío necesario: ${directRejection.reason}` : ` · ${next.calculationMs.toFixed(2)} ms`}`);
      setEvents((items) => [`A* generó ${nextAlternatives.length} alternativa(s) y exploró ${next.explored} nodos`, ...items].slice(0, 7));
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

  function updateVehiclePolicy(next: Partial<Vehicle>) {
    setPreset("custom");
    setVehicle((current) => ({ ...current, ...next }));
    setNotice("Política de carga actualizada. Recalcula para validar restricciones.");
  }

  function saveVehicleProfile() {
    const name = profileName.trim() || `Perfil ${savedProfiles.length + 1}`;
    const next = [...savedProfiles, { id: `vehicle-${Date.now()}`, name, vehicle }].slice(-8);
    setSavedProfiles(next);
    localStorage.setItem(ACADEMIC_STORAGE.profiles, JSON.stringify(next));
    setProfileName("");
    setNotice(`Vehículo "${name}" guardado en este navegador`);
  }

  function loadVehicleProfile(profile: SavedVehicleProfile) {
    setVehicle({ ...defaultVehicle, ...profile.vehicle });
    setPreset("custom");
    setNotice(`Perfil local "${profile.name}" cargado`);
  }

  function chooseAlternative(index: number) {
    setSelectedAlternative(index);
    setRoute(alternatives[index]);
    setProgress(0);
    setRouteConfirmed(false);
    setNotice(`Alternativa ${index + 1} seleccionada. Confirma antes de iniciar.`);
  }

  function useSimulatedGpsAsOrigin() {
    const node = nearestNode(gpsFix);
    setStart(node.id);
    setNotice(`GPS académico ajustado al nodo más cercano: ${node.shortLabel}`);
  }

  function applyCoordinate(target: "start" | "goal") {
    const [lat, lng] = coordinateDraft.split(",").map((value) => Number(value.trim()));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setNotice("Escribe la coordenada como latitud, longitud");
      return;
    }
    const node = nearestNode({ lat, lng });
    if (target === "start") setStart(node.id); else setGoal(node.id);
    setNotice(`Coordenada enlazada al nodo académico más cercano: ${node.shortLabel}`);
  }

  function addIncident() {
    const candidate = route.edgeIds.find((id, index) => index > 0 && !blocked.includes(id)) ?? route.edgeIds.find((id) => !blocked.includes(id));
    if (!candidate) {
      setNotice("No hay otro tramo disponible para simular un incidente");
      return;
    }
    const incident = createAcademicIncident([candidate], Date.now());
    const nextBlocked = [...blocked, candidate];
    setBlocked(nextBlocked);
    const edge = edgeFor(candidate);
    if (incident) setRoadEvents((current) => [...current, { ...incident, blocked: true }].slice(-8));
    setEvents((items) => [`Cierre reportado en ${edge.road}; ruta recalculada`, ...items].slice(0, 5));
    calculate(nextBlocked);
  }

  function clearIncidents() {
    setBlocked([]);
    setRoadEvents([]);
    setNotice("Incidentes eliminados. Calcula la ruta nuevamente.");
  }

  function toggleSimulation() {
    if (!route.path.length) return;
    if (!routeConfirmed) {
      setNotice("Confirma la ruta seleccionada antes de iniciar el recorrido");
      return;
    }
    if (progress >= 1) {
      setProgress(0);
      arrivalLogged.current = false;
    }
    setRunning((value) => !value);
    setNotice(running ? "Simulación en pausa" : "Agente en recorrido con aceleración y frenado progresivos");
  }

  const rejectionSummary = route.rejected.slice(0, 4);
  const panelCopy: Record<Tab, { title: string; description: string }> = {
    operacion: { title: "Nueva ruta", description: "Calcula, compara y confirma un trayecto compatible con la unidad." },
    vehiculo: { title: "Perfil del vehículo", description: "Define dimensiones, ejes, giro, consumo y políticas de carga." },
    restricciones: { title: "Control vial", description: "Consulta cierres, límites y segmentos descartados por A*." },
    entorno: { title: "Entorno simulado", description: "Controla tráfico, GPS, semáforos y eventos académicos." },
    diagnostico: { title: "Diagnóstico", description: "Revisa el estado de los módulos y las métricas del cálculo." },
    ayuda: { title: "Guía rápida", description: "Sigue el flujo recomendado para ejecutar una simulación completa." },
  };

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
          <div className="operator"><span>{session?.name.slice(0, 2).toUpperCase() || "AG"}</span><div><strong>{session?.name || "Operador académico"}</strong><small>{session?.guest ? "Sesión de invitado" : "Perfil local"}</small></div></div>
          <button className="logout-button" onClick={() => { localStorage.removeItem(ACADEMIC_STORAGE.session); setSession(null); }}>Salir</button>
        </div>
      </header>

      <nav className="rail" aria-label="Navegación principal">
        <button className={activeTab === "operacion" ? "active" : ""} onClick={() => setActiveTab("operacion")}><span>⌁</span><small>Operación</small></button>
        <button className={activeTab === "vehiculo" ? "active" : ""} onClick={() => setActiveTab("vehiculo")}><span>▰</span><small>Vehículo</small></button>
        <button className={activeTab === "restricciones" ? "active" : ""} onClick={() => setActiveTab("restricciones")}><span>⚠</span><small>Restricciones</small></button>
        <button className={activeTab === "entorno" ? "active" : ""} onClick={() => setActiveTab("entorno")}><span>⌁</span><small>Entorno</small></button>
        <button className={activeTab === "diagnostico" ? "active" : ""} onClick={() => setActiveTab("diagnostico")}><span>◫</span><small>Diagnóstico</small></button>
        <div className="rail-spacer" />
        <button className={activeTab === "ayuda" ? "active" : ""} onClick={() => setActiveTab("ayuda")}><span>?</span><small>Ayuda</small></button>
      </nav>

      <section className="workspace">
        <aside className="control-panel">
          <div className="panel-heading">
            <p className="eyebrow">PLANIFICADOR ESPECIALIZADO</p>
            <h1>{panelCopy[activeTab].title}</h1>
            <p>{panelCopy[activeTab].description}</p>
          </div>

          {activeTab === "operacion" && (
            <div className="panel-content">
              <div className="route-selector">
                <span className="route-spine"><i /><i /></span>
                <label>Origen<select value={start} onChange={(event) => setStart(event.target.value as NodeId)}>{roadNodes.map((node) => <option value={node.id} key={node.id}>{node.label}</option>)}</select></label>
                <button className="swap-button" onClick={() => { setStart(goal); setGoal(start); }} aria-label="Intercambiar origen y destino">⇅</button>
                <label>Destino<select value={goal} onChange={(event) => setGoal(event.target.value as NodeId)}>{roadNodes.map((node) => <option value={node.id} key={node.id}>{node.label}</option>)}</select></label>
              </div>

              <div className="location-detail-grid" aria-label="Ubicaciones geográficas seleccionadas">
                {[{ role: "ORIGEN", node: nodeFor(start) }, { role: "DESTINO", node: nodeFor(goal) }].map(({ role, node }) => (
                  <div key={role}>
                    <span>{role} · {node.locationAccuracy === "verified-landmark" ? "LUGAR IDENTIFICADO" : "REFERENCIA VIAL"}</span>
                    <strong>{node.label}</strong>
                    <small>{node.address}</small>
                    <code>{node.lat.toFixed(6)}, {node.lng.toFixed(6)}</code>
                    <small>{node.locationNote}</small>
                    <a href={node.sourceUrl} target="_blank" rel="noreferrer">Fuente: {node.sourceLabel} ↗</a>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${node.lat},${node.lng}`} target="_blank" rel="noreferrer">Ver este punto en Google Maps ↗</a>
                  </div>
                ))}
              </div>

              <div className="academic-location-row">
                <button onClick={useSimulatedGpsAsOrigin}>◎ Usar GPS simulado</button>
                <span>{gpsFix.lat.toFixed(5)}, {gpsFix.lng.toFixed(5)}</span>
              </div>
              <div className="coordinate-picker"><input value={coordinateDraft} onChange={(event) => setCoordinateDraft(event.target.value)} aria-label="Coordenada personalizada" /><button onClick={() => applyCoordinate("start")}>Como origen</button><button onClick={() => applyCoordinate("goal")}>Como destino</button></div>

              <div className="section-label"><span>UNIDAD ASIGNADA</span><button onClick={() => setActiveTab("vehiculo")}>Editar</button></div>
              <button className="vehicle-summary" onClick={() => setActiveTab("vehiculo")}>
                <span className="truck-symbol">▰</span>
                <span><strong>{presets.find((item) => item.id === preset)?.label ?? "Configuración personalizada"}</strong><small>{vehicle.height.toFixed(2)} m alto · {vehicle.length.toFixed(1)} m largo · {vehicle.weight.toFixed(0)} t</small></span>
                <b>›</b>
              </button>

              <div className="restriction-chips"><span>ALTURA {vehicle.height.toFixed(2)} m</span><span>PESO {vehicle.weight.toFixed(0)} t</span><span>{vehicle.cargoType.toUpperCase()}</span></div>
              <label className="route-preference">Preferencia de ruta<select value={preference} onChange={(event) => setPreference(event.target.value as RoutePreference)}><option value="corta">Más corta · menos rodeos</option><option value="balanceada">Balanceada</option><option value="rapida">Más rápida</option><option value="economica">Menor costo</option><option value="segura">Menor riesgo</option></select></label>
              <button className="primary-button" onClick={() => calculate()}>Calcular ruta segura <span>→</span></button>
              <div className={`notice ${route.path.length ? "ok" : "warning"}`}><span>{route.path.length ? "✓" : "!"}</span><p><strong>{notice}</strong><small>{route.rejected.length} segmentos evaluados con restricción</small></p></div>
              {alternatives.length > 0 && <div className="alternative-list"><div className="section-label"><span>ALTERNATIVAS A*</span><em>{alternatives.length}</em></div>{alternatives.map((item, index) => <button key={`${item.edgeIds.join("-")}-${index}`} className={selectedAlternative === index ? "selected" : ""} onClick={() => chooseAlternative(index)}><span><strong>Ruta {index + 1}</strong><small>{item.distance.toFixed(1)} km · {item.minutes} min · riesgo {item.riskScore}</small></span><em>${item.operatingCost.toFixed(0)}</em></button>)}</div>}
              <button className={`confirm-route-button ${routeConfirmed ? "confirmed" : ""}`} disabled={!route.path.length} onClick={() => { setRouteConfirmed(true); setNotice("Ruta confirmada. La simulación puede iniciar."); }}>{routeConfirmed ? "✓ Ruta confirmada" : "Confirmar ruta seleccionada"}</button>
            </div>
          )}

          {activeTab === "vehiculo" && (
            <div className="panel-content">
              <div className="preset-grid">
                {presets.map((item) => <button key={item.id} className={preset === item.id ? "selected" : ""} onClick={() => applyPreset(item.id)}><span>▰</span><strong>{item.label}</strong><small>{item.detail}</small></button>)}
              </div>
              <div className="dimension-grid">
                {dimensionFields.map((field) => <label key={field}>{vehicleFieldLabel(field)}<span><input type="number" min="0" step={field === "axles" ? "1" : "0.05"} value={vehicle[field]} onChange={(event) => updateVehicle(field, event.target.value)} /><em>{vehicleFieldUnit(field)}</em></span></label>)}
              </div>
              <div className="policy-grid">
                <label>Tipo de carga<select value={vehicle.cargoType} onChange={(event) => updateVehiclePolicy({ cargoType: event.target.value as Vehicle["cargoType"] })}><option value="general">Carga general</option><option value="refrigerada">Carga refrigerada</option><option value="peligrosa">Material peligroso</option></select></label>
                <label className="check-policy"><input type="checkbox" checked={vehicle.authorizedPrivateZones} onChange={(event) => updateVehiclePolicy({ authorizedPrivateZones: event.target.checked })} /> Autorización para zonas privadas</label>
              </div>
              <div className="cargo-card"><span>◆</span><div><strong>{vehicle.cargoType === "peligrosa" ? "Protocolo HazMat" : vehicle.cargoType === "refrigerada" ? "Cadena fría" : "Carga general"}</strong><small>{vehicle.cargoType === "peligrosa" ? "Evita pasos inferiores y tramos restringidos" : vehicle.cargoType === "refrigerada" ? "Ruta prioriza continuidad y menor exposición" : "Sin materiales peligrosos · centro de gravedad estándar"}</small></div></div>
              <div className="save-profile-row"><input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Nombre del perfil" /><button onClick={saveVehicleProfile}>Guardar vehículo</button></div>
              {savedProfiles.length > 0 && <div className="saved-profile-list">{savedProfiles.map((profile) => <button key={profile.id} onClick={() => loadVehicleProfile(profile)}><strong>{profile.name}</strong><small>{profile.vehicle.axles ?? "-"} ejes · {profile.vehicle.weight} t</small></button>)}</div>}
              <button className="primary-button" onClick={() => { setActiveTab("operacion"); calculate(); }}>Aplicar y recalcular <span>→</span></button>
            </div>
          )}

          {activeTab === "restricciones" && (
            <div className="panel-content">
              <div className="restriction-summary"><div><strong>{route.rejected.length}</strong><span>tramos descartados</span></div><div><strong>{blocked.length}</strong><span>cierres activos</span></div><div><strong>{route.riskScore}</strong><span>riesgo operativo</span></div></div>
              <div className="rejection-list">
                {rejectionSummary.length ? rejectionSummary.map(({ edge, reason }) => <div key={edge.id}><span className="restriction-icon">!</span><p><strong>{edge.road}</strong><small>{reason}</small></p><em>{edge.id.toUpperCase()}</em></div>) : <p className="empty-state">No hay restricciones incompatibles en el cálculo actual.</p>}
              </div>
              <div className="warning-list">
                {route.warnings.length ? route.warnings.map((warning) => <p key={warning}>{warning}</p>) : <p>Sin advertencias operativas para la ruta actual.</p>}
              </div>
              <button className="secondary-button" onClick={addIncident}>Simular cierre en la ruta</button>
              {blocked.length > 0 && <button className="text-button" onClick={clearIncidents}>Eliminar todos los cierres</button>}
            </div>
          )}

          {activeTab === "entorno" && (
            <div className="panel-content academic-environment">
              <div className="environment-status-grid">
                <div><span>TRÁFICO</span><strong className={`traffic-${activeTraffic}`}>{trafficLabel(activeTraffic)}</strong><small>Actualiza cada 15 s</small></div>
                <div><span>SEMÁFORO</span><strong className={`signal-${signalState}`}>{signalState.toUpperCase()}</strong><small>Ciclo académico de 12 s</small></div>
                <div><span>GPS LOCAL</span><strong>{gpsEnabled ? "ACTIVO" : "PAUSADO"}</strong><small>{gpsFix.lat.toFixed(4)}, {gpsFix.lng.toFixed(4)}</small></div>
                <div><span>AGENTES</span><strong>6</strong><small>1 camión + 5 vehículos</small></div>
              </div>
              <label className="academic-switch"><input aria-label="Activar tráfico simulado" type="checkbox" checked={trafficEnabled} onChange={(event) => setTrafficEnabled(event.target.checked)} /><span><strong>Tráfico simulado</strong><small>Modifica tiempo, velocidad y costo de A*</small></span></label>
              <label className="academic-switch"><input aria-label="Activar eventos automáticos" type="checkbox" checked={automaticEvents} onChange={(event) => setAutomaticEvents(event.target.checked)} /><span><strong>Eventos automáticos</strong><small>El agente detecta un bloqueo futuro y recalcula</small></span></label>
              <label className="academic-switch"><input aria-label="Activar GPS simulado" type="checkbox" checked={gpsEnabled} onChange={(event) => setGpsEnabled(event.target.checked)} /><span><strong>GPS simulado</strong><small>Actualiza coordenadas según el avance</small></span></label>
              <div className="environment-actions"><button onClick={() => setTrafficSeed((value) => value + 1)}>Actualizar tráfico</button><button onClick={addIncident}>Generar bloqueo</button></div>
              <div className="academic-event-list"><div className="section-label"><span>EVENTOS DEL ENTORNO</span><em>{roadEvents.length}</em></div>{roadEvents.length ? roadEvents.slice().reverse().map((event) => <div key={event.id}><span className={`severity-${event.severity}`}>!</span><p><strong>{event.label}</strong><small>{event.blocked ? "Bloquea el tramo" : "Reduce la velocidad"} · vence en simulación</small></p></div>) : <p className="empty-state">No hay eventos activos. Inicia el recorrido o genera uno manualmente.</p>}</div>
              <div className="learning-card"><span>MEMORIA DEL AGENTE</span><strong>{Object.keys(learnedPenalties).length} tramos aprendidos</strong><small>Los incidentes anteriores agregan penalización en cálculos futuros guardados localmente.</small></div>
            </div>
          )}

          {activeTab === "diagnostico" && (
            <div className="panel-content diagnostic-panel">
              <div className="diagnostic-list">
                <div><span>✓</span><p><strong>Motor A*</strong><small>{route.calculationMs.toFixed(3)} ms · {route.explored} nodos</small></p></div>
                <div><span>✓</span><p><strong>Restricciones físicas</strong><small>{route.rejected.length} segmentos descartados</small></p></div>
                <div><span>✓</span><p><strong>Agente reactivo</strong><small>Estado: {agentState.replaceAll("-", " ")}</small></p></div>
                <div><span>✓</span><p><strong>Proveedor 3D</strong><small>{mapCredentials.provider === "google" ? "Google 3D" : "Cesium / OSM"}</small></p></div>
                <div><span>✓</span><p><strong>Datos piloto</strong><small>{PILOT_DATASET_METADATA.name} · {PILOT_DATASET_METADATA.coordinateReference}</small></p></div>
                <div><span>✓</span><p><strong>Persistencia local</strong><small>{savedProfiles.length} vehículos · {routeHistory.length} recorridos</small></p></div>
              </div>
              <div className="cost-summary"><div><span>Combustible</span><strong>{route.fuelLiters.toFixed(2)} L</strong></div><div><span>Peajes</span><strong>${route.tollCost.toFixed(0)}</strong></div><div><span>Costo estimado</span><strong>${route.operatingCost.toFixed(0)}</strong></div></div>
              <button className="secondary-button" onClick={() => document.getElementById("evaluation")?.scrollIntoView({ behavior: "smooth" })}>Abrir evaluación académica</button>
              {routeHistory.length > 0 && <div className="history-list"><div className="section-label"><span>HISTORIAL LOCAL</span><em>{routeHistory.length}</em></div>{routeHistory.slice(0, 4).map((item) => <div key={item.id}><strong>{item.start} → {item.goal}</strong><small>{item.distance} km · {item.minutes} min</small></div>)}</div>}
            </div>
          )}

          {activeTab === "ayuda" && (
            <div className="panel-content help-steps">
              <ol><li><strong>Configura el vehículo</strong><span>Define dimensiones, ejes, radio de giro, consumo y carga.</span></li><li><strong>Selecciona origen y destino</strong><span>Usa los nodos académicos o ajusta el origen con GPS simulado.</span></li><li><strong>Calcula y compara</strong><span>A* presenta hasta tres alternativas con tiempo, riesgo y costo.</span></li><li><strong>Confirma la ruta</strong><span>La simulación permanece bloqueada hasta confirmar.</span></li><li><strong>Inicia el recorrido</strong><span>Observa tráfico, semáforos, otros agentes y recálculo automático.</span></li><li><strong>Evalúa el resultado</strong><span>Ejecuta escenarios controlados y registra una evaluación local.</span></li></ol>
              <div className="academic-disclaimer"><strong>Importante</strong><span>Todos los eventos y límites son datos de demostración. No usar para navegación real.</span></div>
            </div>
          )}

          <footer className="panel-footer"><span>MODELO</span><strong>A* ponderado</strong><small>v2.2.4 · Prototipo académico</small></footer>
        </aside>

        <section className="map-area" aria-label="Mapa de navegación">
          <div className="map-toolbar">
            <div className="mode-switch"><button className="active">Mapa 3D</button><button onClick={() => document.getElementById("simulation")?.scrollIntoView({ behavior: "smooth" })}>Simulación</button><button className={geometryMode === "road" ? "active" : ""} onClick={() => setGeometryMode("road")}>Calles</button><button className={geometryMode === "graph" ? "active" : ""} onClick={() => setGeometryMode("graph")}>Grafo exacto</button></div>
            <div className="map-actions"><button className="key-settings-button" onClick={() => setKeyPanelOpen(true)}>🔑 Claves</button><button onClick={() => { setRecenterKey((value) => value + 1); setNotice("Mapa centrado en la ruta activa"); }}>⌖ Centrar ruta</button><button onClick={addIncident} className="incident-button">+ Incidente</button></div>
          </div>

          <div className="map-canvas">
            <GooglePhotorealistic3D
              routeWaypoints={routeWaypoints}
              restrictions={restrictionMarkers}
              progress={progress}
              running={running}
              edgeId={activeEdge}
              speed={simulatedSpeed}
              recenterKey={recenterKey}
              googleApiKey={mapCredentials.googleApiKey}
              cesiumToken={mapCredentials.cesiumToken}
              provider={mapCredentials.provider}
              geometryMode={geometryMode}
            />
            <div className="map-legend"><span><i className="safe" /> Ruta compatible</span><span><i className="restricted" /> Restricción</span><span><i className="closed" /> Cierre activo</span></div>
            <div className="map-note">{geometryMode === "road" ? "Ajuste visual a calles; la validación se realiza sobre los tramos A*" : "Geometría exacta del grafo académico"} · {trafficLabel(activeTraffic)} · semáforo {signalState}</div>
          </div>

          <div className="route-dashboard">
            <div className="route-title"><span className="success-ring">✓</span><div><p>RUTA RECOMENDADA</p><strong>{route.path.length ? `${nodeFor(start).shortLabel} → ${nodeFor(goal).shortLabel}` : "Sin ruta disponible"}</strong></div></div>
            <div className="metric"><small>DISTANCIA</small><strong>{route.distance.toFixed(1)} <em>km</em></strong></div>
            <div className="metric"><small>TIEMPO EST.</small><strong>{route.minutes} <em>min</em></strong></div>
            <div className="metric"><small>CÁLCULO A*</small><strong>{route.calculationMs.toFixed(2)} <em>ms</em></strong></div>
            <div className="metric"><small>RIESGO</small><strong className={route.riskScore < 45 ? "green" : ""}>{route.riskScore}<em>/100</em></strong></div>
            <button className="start-button" onClick={toggleSimulation} disabled={!route.path.length || !routeConfirmed}>{!routeConfirmed ? "Confirma la ruta" : running ? "Pausar" : progress > 0 && progress < 1 ? "Continuar" : "Iniciar recorrido"} <span>{running ? "Ⅱ" : "▶"}</span></button>
          </div>
        </section>
      </section>

      <section className="lower-deck" id="simulation">
        <div className="simulation-card">
          <div className="card-heading simulation-heading">
            <div><p className="eyebrow">SIMULADOR DE AGENTE</p><h2>Vista operacional 3D</h2></div>
            <div className="simulation-heading-actions">
              <button className="focus-map-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Ver mapa 3D</button>
              <span className={running ? "live" : "paused"}>{running ? "● EN CURSO" : "● EN PAUSA"}</span>
            </div>
          </div>
          <TruckSimulation3D routePoints={routePoints3D} progress={progress} running={running} edgeId={activeEdge} speed={simulatedSpeed} signalState={signalState} trafficLevel={activeTraffic} agentState={agentState} />
        </div>

        <aside className="event-card">
          <div className="card-heading"><div><p className="eyebrow">BITÁCORA</p><h2>Decisiones del agente</h2></div><button onClick={() => setEvents([])}>Limpiar</button></div>
          <div className="event-list">{events.length ? events.map((event, index) => <div key={`${event}-${index}`}><span>{index === 0 ? "●" : "○"}</span><p>{event}<small>{index === 0 ? "Ahora" : `Evento ${events.length - index}`}</small></p></div>) : <p className="empty-state">La bitácora está vacía.</p>}</div>
          <div className="validation-row"><span>Motor de restricciones</span><strong>VALIDADO</strong></div>
        </aside>
      </section>

      <div id="evaluation"><AcademicEvaluationPanel /></div>

      {keyPanelOpen && <MapCredentialsPanel
        open={keyPanelOpen}
        credentials={mapCredentials}
        onClose={() => setKeyPanelOpen(false)}
        onSaved={(next) => {
          setMapCredentials(next);
          setNotice(`Credenciales guardadas en este navegador · proveedor ${next.provider === "google" ? "Google 3D" : "Cesium"}`);
        }}
      />}
      <AcademicSessionGate session={session} ready={sessionReady} onSession={setSession} />
    </main>
  );
}
