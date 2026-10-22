"use client";

/* Google Maps 3D is loaded dynamically and its web components are not typed by this project. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoPoint } from "../lib/routing";
import { nodeFor, roadWaypointsForLocations, routeLocationMarkers } from "../lib/routing";
import { fetchOpenRoadGeometry } from "../lib/road-geometry";
import type { MapProvider } from "./MapCredentialsPanel";
import CesiumRoadMap3D from "./CesiumRoadMap3D";
import { DEFAULT_TRUCK, truckModelUrl, type TruckConfiguration } from "../lib/truck-configuration";

type RestrictionMarker = { id: string; label: string; reason: string; position: GeoPoint };
type Props = {
  truckConfig?: TruckConfiguration;
  routeWaypoints: GeoPoint[];
  restrictions: RestrictionMarker[];
  progress: number;
  running: boolean;
  edgeId: string;
  speed: number;
  recenterKey?: number;
  compact?: boolean;
  googleApiKey?: string;
  cesiumToken?: string;
  provider?: MapProvider;
  geometryMode?: "road" | "graph";
};
type GoogleStatus = "missing-key" | "loading" | "ready" | "error";

declare global {
  interface Window {
    google?: any;
    __rutaCargaGooglePromise?: Promise<any>;
    __rutaCargaGoogleInit?: () => void;
  }
}

const GOOGLE_SCRIPT_ID = "google-maps-3d-js";
const TRUCK_MODEL_HEADING_OFFSET = 90;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (window.__rutaCargaGooglePromise) return window.__rutaCargaGooglePromise;
  window.__rutaCargaGooglePromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google?.maps));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.async = true;
    window.__rutaCargaGoogleInit = () => resolve(window.google?.maps);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=maps3d,routes&loading=async&callback=__rutaCargaGoogleInit`;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return window.__rutaCargaGooglePromise;
}

function normalizePoint(point: any): GeoPoint {
  const lat = typeof point.lat === "function" ? point.lat() : point.lat;
  const lng = typeof point.lng === "function" ? point.lng() : point.lng;
  return { lat: Number(lat), lng: Number(lng) };
}

function interpolatePath(path: GeoPoint[], progress: number) {
  if (path.length < 2) return path[0] ?? nodeFor("uam");
  const distances = path.slice(0, -1).map((point, index) => {
    const next = path[index + 1];
    const latScale = Math.cos(((point.lat + next.lat) * Math.PI) / 360);
    return Math.hypot((next.lng - point.lng) * latScale, next.lat - point.lat);
  });
  const total = distances.reduce((sum, value) => sum + value, 0) || 1;
  let remaining = Math.max(0, Math.min(1, progress)) * total;
  for (let index = 0; index < distances.length; index += 1) {
    if (remaining <= distances[index] || index === distances.length - 1) {
      const ratio = distances[index] ? Math.min(1, remaining / distances[index]) : 0;
      return {
        lat: path[index].lat + (path[index + 1].lat - path[index].lat) * ratio,
        lng: path[index].lng + (path[index + 1].lng - path[index].lng) * ratio,
      };
    }
    remaining -= distances[index];
  }
  return path[path.length - 1];
}

function bearing(from: GeoPoint, to: GeoPoint) {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const delta = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(delta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function averagePoint(points: GeoPoint[]) {
  const safe = points.length ? points : [nodeFor("uam")];
  return {
    lat: safe.reduce((sum, point) => sum + point.lat, 0) / safe.length,
    lng: safe.reduce((sum, point) => sum + point.lng, 0) / safe.length,
  };
}

async function roadSnapRoute(waypoints: GeoPoint[]) {
  const roadPoints = roadWaypointsForLocations(waypoints);
  if (roadPoints.length < 2) return { points: roadPoints, source: "astar" as const };
  try {
    const { Route } = await window.google.maps.importLibrary("routes");
    const { routes } = await Route.computeRoutes({
      origin: roadPoints[0],
      destination: roadPoints[roadPoints.length - 1],
      intermediates: roadPoints.slice(1, -1).map((location) => ({ location, via: true })),
      travelMode: "DRIVING",
      routingPreference: "TRAFFIC_AWARE",
      polylineQuality: "HIGH_QUALITY",
      fields: ["path"],
    });
    const snapped = routes?.[0]?.path
      ?.map(normalizePoint)
      .filter((point: GeoPoint) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    if (!snapped || snapped.length < 2) throw new Error("Google no devolvió geometría vial.");
    return { points: snapped as GeoPoint[], source: "google" as const };
  } catch {
    return { points: await fetchOpenRoadGeometry(waypoints), source: "osm" as const };
  }
}

export default function GooglePhotorealistic3D({
  routeWaypoints, restrictions, progress, running, edgeId, speed, recenterKey = 0, compact = false,
  googleApiKey, cesiumToken, provider,
  geometryMode = "road",
  truckConfig = DEFAULT_TRUCK,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const truckRef = useRef<any>(null);
  const truckMarkerRef = useRef<any>(null);
  const pathRef = useRef<GeoPoint[]>(routeWaypoints);
  const progressRef = useRef(progress);
  const runningRef = useRef(running);
  const lastCameraAtRef = useRef(0);
  const [status, setStatus] = useState<GoogleStatus>("loading");
  const [routeSource, setRouteSource] = useState<"google" | "osm" | "astar">("astar");
  const [fallbackOnError, setFallbackOnError] = useState(false);
  const useCesiumFallback = (provider ? provider === "cesium" : process.env.NEXT_PUBLIC_GOOGLE_MAPS_3D !== "true") || fallbackOnError;
  const apiKey = useMemo(
    () => googleApiKey?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "",
    [googleApiKey],
  );

  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (useCesiumFallback) return;
    if (!apiKey) return;

    let disposed = false;
    let frame = 0;
    const children: any[] = [];
    queueMicrotask(() => setStatus("loading"));

    loadGoogleMaps(apiKey).then(async () => {
      if (disposed || !hostRef.current) return;
      const { Map3DElement, Polyline3DElement, Model3DElement, Marker3DElement } =
        await window.google.maps.importLibrary("maps3d");
      const geometry = geometryMode === "road" ? await roadSnapRoute(routeWaypoints) : { points: routeWaypoints, source: "astar" as const };
      const snappedPath = geometry.points;
      if (disposed || !hostRef.current) return;
      pathRef.current = snappedPath;
      setRouteSource(geometry.source);

      const center = averagePoint(snappedPath);
      const map = new Map3DElement({
        center: { ...center, altitude: 0 },
        range: compact ? 5600 : 7600,
        tilt: compact ? 58 : 62,
        heading: 38,
        mode: "HYBRID",
        gestureHandling: "COOPERATIVE",
      });
      map.className = "google-map-element";
      map.setAttribute("aria-label", "Mapa 3D fotorealista de Google con ruta segura para camiones");
      mapRef.current = map;
      map.addEventListener("gmp-error", () => setFallbackOnError(true), { once: true });
      hostRef.current.replaceChildren(map);

      const routeLine = new Polyline3DElement({
        path: snappedPath,
        altitudeMode: "CLAMP_TO_GROUND",
        strokeColor: "#18d486",
        strokeWidth: compact ? 8 : 10,
        outerColor: "#ffffff",
        outerWidth: 0.32,
        drawsOccludedSegments: false,
        geodesic: true,
        zIndex: 12,
      });
      map.append(routeLine);
      children.push(routeLine);

      for (const location of routeLocationMarkers(routeWaypoints)) {
        const marker = new Marker3DElement({
          position: location.position, label: location.label, altitudeMode: "CLAMP_TO_GROUND",
          collisionBehavior: "REQUIRED", sizePreserved: true, zIndex: location.endpoint ? 30 : 20,
        });
        map.append(marker);
        children.push(marker);
      }

      for (const restriction of restrictions.slice(0, 6)) {
        const marker = new Marker3DElement({
          position: restriction.position,
          label: `⚠ ${restriction.label}`,
          altitudeMode: "CLAMP_TO_GROUND",
          collisionBehavior: "REQUIRED",
          drawsWhenOccluded: true,
          sizePreserved: true,
          zIndex: 24,
        });
        marker.title = `${restriction.label}: ${restriction.reason}`;
        map.append(marker);
        children.push(marker);
      }

      const start = interpolatePath(snappedPath, progressRef.current);
      const truck = new Model3DElement({
        src: truckModelUrl(truckConfig.kind),
        position: start,
        orientation: { heading: TRUCK_MODEL_HEADING_OFFSET, tilt: 0, roll: 0 },
        scale: 1,
        altitudeMode: "CLAMP_TO_GROUND",
      });
      truckRef.current = truck;
      map.append(truck);
      children.push(truck);

      const truckMarker = new Marker3DElement({
        position: { ...start, altitude: 8 }, label: "CAMIÓN", altitudeMode: "RELATIVE_TO_GROUND",
        collisionBehavior: "REQUIRED", drawsWhenOccluded: true, sizePreserved: true, zIndex: 80,
      });
      truckMarkerRef.current = truckMarker;
      map.append(truckMarker);
      children.push(truckMarker);
      const initialNext = interpolatePath(snappedPath, Math.min(1, progressRef.current + 0.004));
      let smoothedHeading = bearing(start, initialNext);

      const animate = (time: number) => {
        if (disposed || !truckRef.current || !mapRef.current) return;
        const current = interpolatePath(pathRef.current, progressRef.current);
        const next = interpolatePath(pathRef.current, Math.min(1, progressRef.current + 0.004));
        const heading = bearing(current, next);
        const headingDelta = ((heading - smoothedHeading + 540) % 360) - 180;
        smoothedHeading += headingDelta * 0.08;
        truckRef.current.position = current;
        truckRef.current.orientation = { heading: smoothedHeading + TRUCK_MODEL_HEADING_OFFSET, tilt: 0, roll: 0 };
        truckMarkerRef.current.position = { ...current, altitude: 8 };
        if (runningRef.current && time - lastCameraAtRef.current > 120) {
          mapRef.current.center = { ...current, altitude: 0 };
          mapRef.current.heading = smoothedHeading;
          mapRef.current.tilt = 67;
          mapRef.current.range = compact ? 520 : 680;
          lastCameraAtRef.current = time;
        }
        frame = window.requestAnimationFrame(animate);
      };
      frame = window.requestAnimationFrame(animate);
      setStatus("ready");
    }).catch(() => { if (!disposed) setFallbackOnError(true); });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      children.forEach((child) => child.remove?.());
      mapRef.current?.remove?.();
      mapRef.current = null;
      truckRef.current = null;
      truckMarkerRef.current = null;
      host.replaceChildren();
    };
  }, [apiKey, compact, geometryMode, restrictions, routeWaypoints, useCesiumFallback, truckConfig.kind]);

  useEffect(() => {
    if (!mapRef.current || pathRef.current.length < 2) return;
    const center = averagePoint(pathRef.current);
    mapRef.current.center = { ...center, altitude: 0 };
    mapRef.current.range = compact ? 5600 : 7600;
    mapRef.current.tilt = compact ? 58 : 62;
    mapRef.current.heading = 38;
  }, [recenterKey, compact]);

  if (useCesiumFallback) {
    return <CesiumRoadMap3D truckConfig={truckConfig} routeWaypoints={routeWaypoints} restrictions={restrictions} progress={progress} running={running} edgeId={edgeId} speed={speed} recenterKey={recenterKey} accessToken={cesiumToken} geometryMode={geometryMode} />;
  }

  const displayStatus: GoogleStatus = apiKey ? status : "missing-key";

  return (
    <div className={`google3d-shell ${compact ? "is-compact" : ""}`}>
      <div className="google3d-canvas" ref={hostRef} />
      {displayStatus !== "ready" && (
        <div className={`google3d-overlay ${displayStatus === "error" ? "is-error" : ""}`}>
          {displayStatus === "missing-key" ? (
            <><strong>Falta configurar Google Maps</strong><small>Abre el botón Claves y agrega una API key, o configúrala en `.env.local`.</small></>
          ) : displayStatus === "error" ? (
            <><strong>No se pudo cargar Google Maps 3D</strong><small>Activa Maps JavaScript API, Routes API y la facturación en el proyecto de Google Cloud asociado a la clave.</small></>
          ) : (
            <><span /><strong>Cargando Google Maps fotorealista</strong><small>Ajustando la ruta A* a las calles y preparando el agente 3D.</small></>
          )}
        </div>
      )}
      <div className="google3d-badge"><b>Google</b> Photorealistic 3D · {geometryMode === "road" ? "ajuste visual vial" : "grafo exacto"}</div>
      <div className="google3d-hud">
        <span><small>RUTA</small><strong>{routeSource === "google" ? "A* + calles Google" : routeSource === "osm" ? "A* + calles OSM" : "Grafo A* exacto"}</strong></span>
        <span><small>TRAMO</small><strong>{edgeId || "-"}</strong></span>
        <span><small>VELOCIDAD</small><strong>{running ? speed : 0}<em> km/h</em></strong></span>
      </div>
    </div>
  );
}
