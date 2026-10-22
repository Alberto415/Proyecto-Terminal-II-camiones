"use client";

/* The CDN build exposes a runtime-only global without a bundled TypeScript declaration. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoPoint } from "../lib/routing";
import { nodeFor, routeLocationMarkers } from "../lib/routing";
import { fetchOpenRoadGeometry, pointAlongRoad } from "../lib/road-geometry";
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
  accessToken?: string;
  geometryMode?: "road" | "graph";
};

declare global { interface Window { Cesium?: any } }

const SCRIPT_ID = "cesium-js";
const CSS_ID = "cesium-css";
const JS_URL = "https://ajax.googleapis.com/ajax/libs/cesiumjs/1.105/Build/Cesium/Cesium.js";
const CSS_URL = "https://ajax.googleapis.com/ajax/libs/cesiumjs/1.105/Build/Cesium/Widgets/widgets.css";
// El GLB está modelado con el frente hacia -Z; Cesium aplica el rumbo sobre el eje longitudinal X.
const TRUCK_MODEL_HEADING_OFFSET = Math.PI / 2;

function estimatedGroundHeight(lng: number) {
  // El poniente de CDMX sube aproximadamente 450 m entre Tacubaya y Cuajimalpa.
  const westRatio = Math.max(0, Math.min(1, (-99.18 - lng) / 0.1));
  return 2260 + westRatio * 470;
}

function loadCesium() {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (!document.getElementById(CSS_ID)) {
    const link = document.createElement("link");
    link.id = CSS_ID;
    link.rel = "stylesheet";
    link.href = CSS_URL;
    document.head.appendChild(link);
  }
  return new Promise<any>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Cesium));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = JS_URL;
    script.async = true;
    script.onload = () => resolve(window.Cesium);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function pointAt(path: GeoPoint[], progress: number) {
  return pointAlongRoad(path, progress) ?? nodeFor("uam");
}

export default function CesiumRoadMap3D({ routeWaypoints, restrictions, progress, running, edgeId, speed, recenterKey = 0, accessToken, geometryMode = "road", truckConfig = DEFAULT_TRUCK }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const truckRef = useRef<any>(null);
  const routeEntityRef = useRef<any>(null);
  const pathRef = useRef<GeoPoint[]>(routeWaypoints);
  const progressRef = useRef(progress);
  const runningRef = useRef(running);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "missing-key">("loading");
  const token = useMemo(
    () => accessToken?.trim() || process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim() || "",
    [accessToken],
  );

  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!token) return;
    let disposed = false;
    let frame = 0;
    let lastCamera = 0;
    queueMicrotask(() => setStatus("loading"));

    loadCesium().then(async (Cesium) => {
      if (disposed || !hostRef.current) return;
      Cesium.Ion.defaultAccessToken = token;
      const terrainProvider = await Cesium.createWorldTerrainAsync();
      if (disposed || !hostRef.current) return;
      hostRef.current.replaceChildren();
      const viewer = new Cesium.Viewer(hostRef.current, {
        animation: false, baseLayerPicker: false, fullscreenButton: false, geocoder: false,
        homeButton: false, infoBox: false, sceneModePicker: false, selectionIndicator: false,
        timeline: false, navigationHelpButton: false, requestRenderMode: false,
        terrainProvider,
      });
      viewerRef.current = viewer;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 40;

      try {
        const buildings = await Cesium.createOsmBuildingsAsync();
        if (!disposed) viewer.scene.primitives.add(buildings);
      } catch { /* El terreno y la ruta siguen funcionando sin edificios. */ }

      const snappedPath = geometryMode === "road" ? await fetchOpenRoadGeometry(routeWaypoints) : routeWaypoints;
      if (disposed) return;
      pathRef.current = snappedPath;
      const positions = Cesium.Cartesian3.fromDegreesArray(snappedPath.flatMap((point) => [point.lng, point.lat]));
      const routeEntity = viewer.entities.add({
        name: geometryMode === "road" ? "Representación vial de la ruta A*" : "Geometría exacta del grafo A*",
        polyline: {
          positions,
          width: 8,
          clampToGround: true,
          material: new Cesium.PolylineGlowMaterialProperty({
            color: Cesium.Color.fromCssColorString("#18d486"), glowPower: 0.16,
          }),
        },
      });
      routeEntityRef.current = routeEntity;

      for (const location of routeLocationMarkers(routeWaypoints)) {
        viewer.entities.add({
          name: location.label,
          position: Cesium.Cartesian3.fromDegrees(location.position.lng, location.position.lat),
          point: { pixelSize: location.endpoint ? 13 : 9, color: Cesium.Color.fromCssColorString(location.endpoint ? "#36cfff" : "#ffffff"), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: location.label, font: "700 12px sans-serif", fillColor: Cesium.Color.WHITE, showBackground: true, backgroundColor: Cesium.Color.fromCssColorString("#06242d").withAlpha(0.9), pixelOffset: new Cesium.Cartesian2(0, -25), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        });
      }

      for (const restriction of restrictions.slice(0, 6)) {
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(restriction.position.lng, restriction.position.lat),
          point: { pixelSize: 15, color: Cesium.Color.fromCssColorString("#f1a72c"), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
          label: { text: restriction.label, font: "700 13px sans-serif", fillColor: Cesium.Color.WHITE, showBackground: true, backgroundColor: Cesium.Color.fromCssColorString("#5f3900").withAlpha(0.86), pixelOffset: new Cesium.Cartesian2(0, -27), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        });
      }

      const start = pointAt(snappedPath, progressRef.current);
      const truck = viewer.entities.add({
        name: "Agente camión",
        position: Cesium.Cartesian3.fromDegrees(start.lng, start.lat),
        model: { uri: truckModelUrl(truckConfig.kind), scale: 1, minimumPixelSize: 44, maximumScale: 8, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, runAnimations: false },
        label: { text: "CAMIÓN · AGENTE", font: "800 15px sans-serif", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.fromCssColorString("#05232d"), outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, showBackground: true, backgroundColor: Cesium.Color.fromCssColorString("#06242d").withAlpha(0.94), pixelOffset: new Cesium.Cartesian2(0, -70), heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      });
      truckRef.current = truck;

      const initialNext = pointAt(snappedPath, Math.min(1, progressRef.current + 0.004));
      const initialHeading = Cesium.Math.toRadians(90) - Math.atan2(initialNext.lat - start.lat, initialNext.lng - start.lng);
      const initialPosition = Cesium.Cartesian3.fromDegrees(start.lng, start.lat, estimatedGroundHeight(start.lng) + 400);
      viewer.camera.lookAt(
        initialPosition,
        new Cesium.HeadingPitchRange(initialHeading + Math.PI, Cesium.Math.toRadians(-50), 1000),
      );
      let smoothedHeading = initialHeading;
      let terrainSamples: any[] = [];
      const samples = Array.from({ length: 48 }, (_, index) => { const p = pointAt(snappedPath,index/47); return Cesium.Cartographic.fromDegrees(p.lng,p.lat); });
      void Cesium.sampleTerrainMostDetailed(terrainProvider, samples).then((values: any[]) => {
        if(disposed) return;
        terrainSamples = values;
        const p=pointAt(snappedPath,progressRef.current);
        const index=Math.min(47,Math.round(progressRef.current*47));
        if(Number.isFinite(values[index]?.height)) {
          const target=Cesium.Cartesian3.fromDegrees(p.lng,p.lat,values[index].height+8);
          viewer.camera.lookAt(target,new Cesium.HeadingPitchRange(smoothedHeading+Math.PI,Cesium.Math.toRadians(-65),1500));
        }
      }).catch(() => { /* Keep a safely elevated overview if sampling is unavailable. */ });

      const animate = (time: number) => {
        if (disposed || !viewerRef.current || !truckRef.current) return;
        const current = pointAt(pathRef.current, progressRef.current);
        const next = pointAt(pathRef.current, Math.min(1, progressRef.current + 0.004));
        const position = Cesium.Cartesian3.fromDegrees(current.lng, current.lat);
        const cartographic = Cesium.Cartographic.fromDegrees(current.lng,current.lat);
        const sampleIndex=Math.min(47,Math.max(0,progressRef.current*47));
        const low=Math.floor(sampleIndex), high=Math.min(47,low+1);
        const sampledHeight=terrainSamples[low]?.height*(1-(sampleIndex-low))+terrainSamples[high]?.height*(sampleIndex-low);
        const loadedHeight=viewer.scene.globe.getHeight(cartographic);
        const height=Number.isFinite(loadedHeight) ? loadedHeight : Number.isFinite(sampledHeight) ? sampledHeight : estimatedGroundHeight(current.lng)+400;
        const cameraTarget = Cesium.Cartesian3.fromDegrees(current.lng, current.lat, height + 8);
        const heading = Cesium.Math.toRadians(90) - Math.atan2(next.lat - current.lat, next.lng - current.lng);
        const headingDelta = Math.atan2(Math.sin(heading - smoothedHeading), Math.cos(heading - smoothedHeading));
        smoothedHeading += headingDelta * 0.08;
        truckRef.current.position = position;
        truckRef.current.orientation = Cesium.Transforms.headingPitchRollQuaternion(
          position,
          new Cesium.HeadingPitchRoll(smoothedHeading + TRUCK_MODEL_HEADING_OFFSET, 0, 0),
        );
        if (runningRef.current && time - lastCamera > 120) {
          viewerRef.current.camera.lookAt(cameraTarget, new Cesium.HeadingPitchRange(smoothedHeading + Math.PI, Cesium.Math.toRadians(-50), Math.max(280,truckConfig.length*8)));
          lastCamera = time;
        }
        frame = window.requestAnimationFrame(animate);
      };
      frame = window.requestAnimationFrame(animate);
      setStatus("ready");
    }).catch(() => { if (!disposed) setStatus("error"); });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      viewerRef.current?.destroy?.();
      viewerRef.current = null;
      truckRef.current = null;
      routeEntityRef.current = null;
      host.replaceChildren();
    };
  }, [geometryMode, token, restrictions, routeWaypoints, truckConfig.kind, truckConfig.length]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !routeEntityRef.current) return;
    viewer.flyTo(routeEntityRef.current, { duration: 0 }).catch(() => undefined);
  }, [recenterKey]);

  const displayStatus = token ? status : "missing-key";

  return (
    <div className="google3d-shell cesium-fallback">
      <div className="google3d-canvas" ref={hostRef} />
      {displayStatus !== "ready" && <div className={`google3d-overlay ${displayStatus === "error" ? "is-error" : ""}`}>
        {displayStatus === "missing-key" ? <><strong>Falta el token de Cesium ion</strong><small>Abre el botón Claves y agrega un token, o configúralo en `.env.local`.</small></> : displayStatus === "error" ? <><strong>No se pudo cargar el mapa 3D</strong><small>Revisa el token de Cesium ion y tu conexión.</small></> : <><span /><strong>Cargando mapa 3D alternativo</strong><small>Google requiere facturación; preparando terreno y edificios OSM con Cesium.</small></>}
      </div>}
      <div className="google3d-badge"><b>Cesium</b> OSM 3D · {geometryMode === "road" ? "ajuste visual vial" : "grafo exacto"}</div>
      <div className="provider-notice">Google Maps 3D requiere facturación activa</div>
      <div className="google3d-hud">
        <span><small>RUTA</small><strong>{geometryMode === "road" ? "A* + calles OSM" : "Grafo A* exacto"}</strong></span>
        <span><small>TRAMO</small><strong>{edgeId || "-"}</strong></span>
        <span><small>VELOCIDAD</small><strong>{running ? speed : 0}<em> km/h</em></strong></span>
      </div>
    </div>
  );
}
