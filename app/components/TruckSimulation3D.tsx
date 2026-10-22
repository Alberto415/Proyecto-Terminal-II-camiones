"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ACADEMIC_STORAGE, type AgentState, type SignalState } from "../lib/academic-simulation";
import { routeGeoWaypoints, type GeoPoint, type TrafficLevel } from "../lib/routing";
import { fetchOpenRoadGeometry } from "../lib/road-geometry";
import { buildSimulationRoute, sampleRoute, upcomingTurn, type SimulationRoute } from "../lib/simulation-route";
import { createSimulationWorld, type CameraMode, type WorldSnapshot, type WorldStats } from "../lib/simulation-world";
import { DEFAULT_TRUCK, type TruckConfiguration } from "../lib/truck-configuration";
import GooglePhotorealistic3D from "./GooglePhotorealistic3D";
import type { MapCredentials } from "./MapCredentialsPanel";
import "./simulation-ui.css";

type Props = {
  truckConfig?: TruckConfiguration;
  mapCredentials?: MapCredentials;
  routeWaypoints: GeoPoint[];
  progress: number;
  running: boolean;
  edgeId: string;
  speed: number;
  signalState?: SignalState;
  trafficLevel?: TrafficLevel;
  agentState?: AgentState;
  canPlay?: boolean;
  onToggleRunning?: () => void;
  onSeek?: (progress: number) => void;
  onTrafficHold?: (hold: boolean) => void;
};

const DEMO_ROUTES = [
  { id: "demo-mexicana", name: "Demo 1 · UAM → La Mexicana", points: routeGeoWaypoints(["uam", "vasco"]) },
  { id: "demo-santa-fe", name: "Demo 2 · UAM → Centro Santa Fe", points: routeGeoWaypoints(["uam", "santa-fe"]) },
  { id: "demo-observatorio", name: "Demo 3 · Terminal Poniente → Observatorio", points: routeGeoWaypoints(["logistico", "observatorio"]) },
];
const CAMERAS: Array<{ id: CameraMode; name: string }> = [
  { id: "follow", name: "Seguimiento" }, { id: "cab", name: "Cabina" },
  { id: "front", name: "Frontal" }, { id: "side", name: "Lateral" },
  { id: "top", name: "Cenital" }, { id: "orbit", name: "Órbita" },
  { id: "overview", name: "Ruta completa" }, { id: "tour", name: "Tour de sectores" },
];
const INITIAL_STATS: WorldStats = { progress: 0, vehicles: 0, signal: "verde", waiting: false, speed: 0 };
const EMPTY_RESTRICTIONS: [] = [];

export default function TruckSimulation3D({
  truckConfig = DEFAULT_TRUCK,
  mapCredentials,
  routeWaypoints, progress, running, edgeId, speed, signalState = "verde",
  trafficLevel = "fluido", agentState = "planeando", canPlay = false,
  onToggleRunning, onSeek, onTrafficHold,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const demoProgressRef = useRef(0);
  const [source, setSource] = useState("active");
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoTraffic, setDemoTraffic] = useState<TrafficLevel>("moderado");
  const [rate, setRate] = useState(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  const [sector, setSector] = useState(0);
  const [model, setModel] = useState<SimulationRoute | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [stats, setStats] = useState<WorldStats>(INITIAL_STATS);
  const [scenery, setScenery] = useState("Entorno recreado");
  const [view, setView] = useState<"street" | "geographic">("street");
  const demo = source !== "active";
  const sceneRunning = demo ? demoRunning : running;
  const sceneProgress = demo ? stats.progress : progress;
  const points = useMemo(() => source === "active" ? routeWaypoints : DEMO_ROUTES.find((route) => route.id === source)!.points, [source, routeWaypoints]);
  const live = useRef<WorldSnapshot>({ progress, running, demo: false, rate: 1, camera: "follow", sector: 0, signal: signalState, traffic: trafficLevel });
  live.current = { progress, running: sceneRunning, demo, rate: demo ? rate : 1, camera: cameraMode, sector, signal: signalState, traffic: demo ? demoTraffic : trafficLevel };
  const callbacks = useRef({ onTrafficHold });
  callbacks.current = { onTrafficHold };

  useEffect(() => {
    const saved = localStorage.getItem(ACADEMIC_STORAGE.camera);
    if (CAMERAS.some((camera) => camera.id === saved)) queueMicrotask(() => setCameraMode(saved as CameraMode));
  }, []);
  useEffect(() => { localStorage.setItem(ACADEMIC_STORAGE.camera, cameraMode); }, [cameraMode]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { setStatus("loading"); setError(""); setModel(null); });
    fetchOpenRoadGeometry(points).then((geometry) => {
      if (disposed) return;
      const next = buildSimulationRoute(geometry);
      if (next.points.length < 2 || next.length < 1) throw new Error("Selecciona una ruta con origen y destino distintos.");
      setModel(next);
    }).catch((reason: unknown) => {
      if (!disposed) { setStatus("error"); setError(reason instanceof Error ? reason.message : "No se pudo consultar el recorrido vial."); }
    });
    return () => { disposed = true; };
  }, [points, retry]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !model) return;
    try {
      const dispose = createSimulationWorld(host, model, () => ({
        ...live.current, progress: live.current.demo ? demoProgressRef.current : live.current.progress,
      }), {
        onScenery: (message) => queueMicrotask(() => setScenery(message)),
        onDemoProgress: (next) => { demoProgressRef.current = next; },
        onTrafficHold: (hold) => { callbacks.current.onTrafficHold?.(hold); },
        onStats: (next) => {
          setStats(next);
          if (next.progress >= 1 && live.current.demo) setDemoRunning(false);
        },
      }, truckConfig);
      queueMicrotask(() => setStatus("ready"));
      return dispose;
    } catch (reason) {
      queueMicrotask(() => { setStatus("error"); setError(reason instanceof Error ? reason.message : "No se pudo iniciar WebGL."); });
    }
  }, [model, truckConfig]);

  function changeSource(next: string) {
    demoProgressRef.current = 0;
    setDemoRunning(false); setStats(INITIAL_STATS); setSector(0); setSource(next);
    setCameraMode("overview"); onTrafficHold?.(false);
  }
  function seek(value: number) {
    if (demo) { demoProgressRef.current = value; setStats((previous) => ({ ...previous, progress: value })); setDemoRunning(false); }
    else onSeek?.(value);
  }
  function togglePlayback() {
    if (demo) {
      if (demoProgressRef.current >= 1) demoProgressRef.current = 0;
      setDemoRunning((previous) => !previous);
      if (cameraMode === "overview" || cameraMode === "sector") setCameraMode("follow");
    } else onToggleRunning?.();
  }
  async function toggleFullscreen() {
    if (!shellRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shellRef.current.requestFullscreen();
    } catch { setError("El navegador no permite ampliar esta vista."); }
  }

  const miniMap = useMemo(() => {
    if (!model) return { points: "", x: (x: number) => x, z: (z: number) => z };
    const { bounds } = model;
    const scale = 116 / Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 1);
    const x = (value: number) => 7 + (value - bounds.minX) * scale;
    const z = (value: number) => 7 + (value - bounds.minZ) * scale;
    return { points: model.points.map((point) => `${x(point.x)},${z(point.z)}`).join(" "), x, z };
  }, [model]);
  const current = model ? sampleRoute(model, sceneProgress) : { x: 0, z: 0 };
  const currentSector = model ? Math.min(model.sectors.length - 1, Math.floor(sceneProgress * model.sectors.length)) : 0;
  const maneuver = model ? upcomingTurn(model, sceneProgress) : null;

  return (
    <div className="simulation-experience" ref={shellRef}>
      <div className="simulation-view-picker" role="group" aria-label="Tipo de escenario 3D"><button aria-pressed={view === "street"} onClick={() => setView("street")}>Simulación de conducción</button><button aria-pressed={view === "geographic"} onClick={() => setView("geographic")}>Mapa geográfico 3D</button><span>{view === "geographic" ? "Terreno y edificios del proveedor de mapas" : "Remolques articulados · tráfico académico"}</span></div>
      <div className="simulation-console">
        <label>Recorrido<select aria-label="Recorrido de simulación" value={source} onChange={(event) => changeSource(event.target.value)}>
          <option value="active">Ruta activa del planificador</option>
          {DEMO_ROUTES.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
        </select></label>
        <div className="simulation-playback">
          <button className="simulation-play" onClick={togglePlayback} disabled={status !== "ready" || (!demo && !canPlay)}>{sceneRunning ? "Ⅱ Pausar" : sceneProgress >= 1 ? "↻ Repetir" : "▶ Reproducir"}</button>
          <button onClick={() => seek(0)} disabled={status !== "ready"} aria-label="Reiniciar recorrido 3D">↺ Reiniciar</button>
          {demo && <label>Tiempo<select aria-label="Velocidad de reproducción" value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={1}>×1</option><option value={2}>×2</option><option value={4}>×4</option></select></label>}
        </div>
        <label>Tráfico simulado<select aria-label="Densidad del tráfico 3D" disabled={!demo} value={demo ? demoTraffic : trafficLevel} onChange={(event) => setDemoTraffic(event.target.value as TrafficLevel)}>
          <option value="fluido">Fluido</option><option value="moderado">Moderado</option><option value="intenso">Intenso</option>
        </select></label>
      </div>
      <div className="simulation-route-caption">
        <span>{truckConfig.label} · {truckConfig.length} m · {truckConfig.axles} ejes · {model ? `${(model.length / 1000).toFixed(2)} km de geometría vial` : "Consultando calles…"}</span>
        <span>{sceneRunning ? "● EN MOVIMIENTO" : "● EN PAUSA"}</span>
      </div>
      {!demo && !canPlay && <p className="simulation-instruction">Confirma la ruta en el planificador para reproducirla, o elige uno de los tres recorridos de demostración.</p>}
      {maneuver && <div className="simulation-guidance"><div><strong>{maneuver.text}</strong><br /><small>Referencia de la geometría · {maneuver.meters} m</small></div><small>{Math.max(0, ((model?.length ?? 0) * (1-sceneProgress))/1000).toFixed(2)} km restantes · {truckConfig.label}</small></div>}
      {view === "geographic" && <div className="simulation-geographic"><GooglePhotorealistic3D routeWaypoints={points} restrictions={EMPTY_RESTRICTIONS} progress={sceneProgress} running={sceneRunning} edgeId={edgeId} speed={demo ? stats.speed : speed} truckConfig={truckConfig} googleApiKey={mapCredentials?.googleApiKey} cesiumToken={mapCredentials?.cesiumToken} provider={mapCredentials?.provider} geometryMode="road" /></div>}
      <div className="three-shell" style={view === "geographic" ? { display: "none" } : undefined}>
        <div className="three-canvas" ref={hostRef} />
        {status === "loading" && <div className="three-loading"><span /> Construyendo el recorrido completo…</div>}
        {status === "error" && <div className="three-error"><strong>No se pudo preparar el recorrido</strong><small>{error}</small><button onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div>}
        <div className="three-toolbar" aria-label="Controles de cámara">
          {CAMERAS.map((camera) => <button key={camera.id} aria-pressed={cameraMode === camera.id} className={cameraMode === camera.id ? "active" : ""} onClick={() => setCameraMode(camera.id)}>{camera.name}</button>)}
          <button className="fullscreen-button" onClick={toggleFullscreen}>⛶ Ampliar</button>
        </div>
        <div className="simulation-minimap">
          <span>RECORRIDO COMPLETO</span>
          <svg viewBox="0 0 130 130" role="img" aria-label="Vista general de la ruta completa y posición del camión">
            <polyline points={miniMap.points} fill="none" stroke="#35e7a0" strokeWidth="3" strokeLinejoin="round" />
            <circle cx={miniMap.x(current.x)} cy={miniMap.z(current.z)} r="5" fill="#ffffff" stroke="#116246" strokeWidth="2" />
          </svg>
          <small>Camión · sector {currentSector + 1} / {model?.sectors.length ?? "—"}</small>
        </div>
        <div className="three-hud">
          <span><small>VELOCIDAD</small><strong>{sceneRunning ? Math.round(demo ? stats.speed : speed) : 0}<em> km/h</em></strong></span>
          <span><small>{demo ? "VEHÍCULOS" : "TRAMO ACTUAL"}</small><strong>{demo ? stats.vehicles : edgeId || "—"}</strong></span>
          <span><small>RECORRIDO</small><strong>{Math.round(sceneProgress * 100)}<em>%</em></strong></span>
          <span><small>SEMÁFORO</small><strong className={`signal-${stats.signal}`}>{stats.signal.toUpperCase()}</strong></span>
          <span className="sensor-status"><i />{stats.waiting ? "Cediendo el paso" : demo ? `${stats.vehicles} vehículos · tráfico simulado` : agentState.replaceAll("-", " ")}</span>
        </div>
        {cameraMode === "orbit" && <div className="three-help">Arrastra para girar · rueda para acercar</div>}
      </div>
      <div className="simulation-sectors" aria-label="Inspeccionar sectores del recorrido">
        {model?.sectors.map((part, index) => <button key={index} aria-pressed={cameraMode === "sector" && sector === index} className={cameraMode === "sector" && sector === index ? "selected" : currentSector === index ? "current" : ""} onClick={() => { setSector(index); setCameraMode("sector"); }}>
          <span>{String(index + 1).padStart(2, "0")}</span><strong>{part.name}</strong><small>{Math.round(part.start * model.length)}–{Math.round(part.end * model.length)} m</small>
        </button>)}
      </div>
      <label className="simulation-scrubber"><span>Explorar recorrido</span><input aria-label="Posición del recorrido 3D" type="range" min={0} max={100} step={0.1} value={sceneProgress * 100} disabled={!model} onChange={(event) => seek(Number(event.target.value) / 100)} /><output>{Math.round(sceneProgress * (model?.length ?? 0))} / {Math.round(model?.length ?? 0)} m</output></label>
      <p className="simulation-provenance" role="status">{scenery}. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>. Conducción: terreno plano, alturas estimadas donde faltan datos, carriles y semáforos recreados; hasta ocho zonas OSM. Mapa geográfico: terreno/edificios del proveedor y vehículo sin articulación dinámica. Restricciones académicas; no verifica gálibos reales.</p>
    </div>
  );
}
