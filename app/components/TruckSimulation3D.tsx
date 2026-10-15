"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ACADEMIC_STORAGE, type AgentState, type SignalState } from "../lib/academic-simulation";
import type { TrafficLevel } from "../lib/routing";

type CameraMode = "follow" | "cab" | "orbit" | "top";
type RoutePoint = { x: number; y: number };

type Props = {
  routePoints: RoutePoint[];
  progress: number;
  running: boolean;
  edgeId: string;
  speed: number;
  signalState?: SignalState;
  trafficLevel?: TrafficLevel;
  agentState?: AgentState;
};

function makeRoadGeometry(curve: THREE.CatmullRomCurve3, width: number) {
  const segments = 180;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3().crossVectors(up, tangent).normalize().multiplyScalar(width / 2);
    const left = point.clone().add(side);
    const right = point.clone().sub(side);
    positions.push(left.x, 0.06, left.z, right.x, 0.06, right.z);
    uvs.push(0, t * 12, 1, t * 12);
    if (index < segments) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createTruck() {
  const truck = new THREE.Group();
  truck.name = "truck-agent";
  const white = new THREE.MeshPhysicalMaterial({ color: 0xe9f0ef, roughness: 0.3, metalness: 0.15, clearcoat: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101d21, roughness: 0.65, metalness: 0.35 });
  const green = new THREE.MeshStandardMaterial({ color: 0x18b978, roughness: 0.35, metalness: 0.15 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x102f3a, roughness: 0.05, metalness: 0.2, transmission: 0.15 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe9544d, emissive: 0x8c120c, emissiveIntensity: 1.2 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.26, 7.5), dark);
  chassis.position.y = 0.68;
  chassis.castShadow = true;
  truck.add(chassis);

  const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.75, 5.25), white);
  trailer.position.set(0, 2.15, 1.55);
  trailer.castShadow = true;
  trailer.receiveShadow = true;
  truck.add(trailer);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.18, 5.28), green);
  stripe.position.set(0, 1.25, 1.55);
  truck.add(stripe);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.35, 2.05), white);
  cab.position.set(0, 1.78, -2.45);
  cab.castShadow = true;
  truck.add(cab);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.45), white);
  roof.position.set(0, 3.05, -2.25);
  roof.rotation.x = -0.08;
  truck.add(roof);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.78, 0.05), glass);
  windshield.position.set(0, 2.26, -3.5);
  windshield.rotation.x = -0.12;
  truck.add(windshield);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 0.08), dark);
  grille.position.set(0, 1.25, -3.5);
  truck.add(grille);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, 0.25), dark);
  bumper.position.set(0, 0.7, -3.52);
  truck.add(bumper);

  const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xe9ffff, emissive: 0xbfefff, emissiveIntensity: 3 });
  for (const x of [-0.85, 0.85]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.08), headlightMaterial);
    light.position.set(x, 1.1, -3.56);
    truck.add(light);
  }

  for (const x of [-1.27, 1.27]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.24), dark);
    mirror.position.set(x, 2.28, -3.05);
    truck.add(mirror);
  }

  const wheelGeometry = new THREE.CylinderGeometry(0.46, 0.46, 0.32, 24);
  for (const z of [-2.35, 1.75, 2.95]) {
    for (const x of [-1.28, 1.28]) {
      const wheel = new THREE.Mesh(wheelGeometry, dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.58, z);
      wheel.castShadow = true;
      truck.add(wheel);
    }
  }

  for (const x of [-0.82, 0.82]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.08), red);
    tail.position.set(x, 1.1, 4.2);
    truck.add(tail);
  }
  return truck;
}

function createTrafficAgent(color: number) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 3.5), new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.22 }));
  body.position.y = 0.72;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.65, 1.45), new THREE.MeshStandardMaterial({ color: 0xbad8dc, roughness: 0.2, metalness: 0.3 }));
  cabin.position.set(0, 1.25, -0.25);
  group.add(cabin);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x0a1012, roughness: 0.9 });
  for (const z of [-1.15, 1.15]) for (const x of [-0.92, 0.92]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14), wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.38, z);
    group.add(wheel);
  }
  group.scale.setScalar(0.8);
  return group;
}

function createClearanceSign(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f1a72c";
  context.beginPath();
  context.roundRect(8, 8, 240, 112, 22);
  context.fill();
  context.strokeStyle = "#1c2426";
  context.lineWidth = 10;
  context.stroke();
  context.fillStyle = "#10191c";
  context.font = "900 52px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 128, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true }));
  sprite.scale.set(3.4, 1.7, 1);
  return sprite;
}

function addBuilding(scene: THREE.Scene, x: number, z: number, width: number, depth: number, height: number, color: number) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.06 }));
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x8adfc3, emissive: 0x277b67, emissiveIntensity: 0.65 });
  const floors = Math.max(2, Math.floor(height / 2.5));
  for (let floor = 1; floor < floors; floor += 1) {
    const windows = new THREE.Mesh(new THREE.BoxGeometry(width * 0.76, 0.12, depth + 0.025), windowMaterial);
    windows.position.y = (height / floors) * floor;
    group.add(windows);
  }
  group.position.set(x, 0, z);
  scene.add(group);
}

export default function TruckSimulation3D({ routePoints, progress, running, edgeId, speed, signalState = "verde", trafficLevel = "fluido", agentState = "planeando" }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(progress);
  const modeRef = useRef<CameraMode>("follow");
  const signalRef = useRef(signalState);
  const trafficRef = useRef(trafficLevel);
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { signalRef.current = signalState; }, [signalState]);
  useEffect(() => { trafficRef.current = trafficLevel; }, [trafficLevel]);
  useEffect(() => {
    modeRef.current = cameraMode;
    localStorage.setItem(ACADEMIC_STORAGE.camera, cameraMode);
  }, [cameraMode]);
  useEffect(() => {
    const saved = localStorage.getItem(ACADEMIC_STORAGE.camera) as CameraMode | null;
    if (saved && ["follow", "cab", "orbit", "top"].includes(saved)) {
      queueMicrotask(() => setCameraMode(saved));
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || routePoints.length < 2) return;
    queueMicrotask(() => {
      setReady(false);
      setError(false);
    });
    let animationFrame = 0;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      queueMicrotask(() => setError(true));
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-label", "Simulación tridimensional interactiva de un camión sobre la ruta calculada");
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071a24);
    scene.fog = new THREE.Fog(0x071a24, 52, 135);
    const camera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, 0.1, 300);
    camera.position.set(22, 18, 28);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2.12;
    controls.minDistance = 7;
    controls.maxDistance = 72;

    scene.add(new THREE.HemisphereLight(0xbde8ff, 0x163528, 2.15));
    const sun = new THREE.DirectionalLight(0xfff1cf, 3.5);
    sun.position.set(-28, 45, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(170, 130), new THREE.MeshStandardMaterial({ color: 0x142d2b, roughness: 0.95, metalness: 0.02 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(150, 50, 0x225c51, 0x183d38);
    grid.position.y = 0.01;
    scene.add(grid);

    const converted = routePoints.map((point) => new THREE.Vector3((point.x - 50) * 0.7, 0, (point.y - 55) * 0.62));
    const curve = new THREE.CatmullRomCurve3(converted, false, "centripetal", 0.45);
    const road = new THREE.Mesh(makeRoadGeometry(curve, 7.4), new THREE.MeshStandardMaterial({ color: 0x26383d, roughness: 0.93, metalness: 0.08, side: THREE.DoubleSide }));
    road.receiveShadow = true;
    scene.add(road);
    const routeGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(220).map((point) => point.clone().setY(0.15)));
    scene.add(new THREE.Line(routeGeometry, new THREE.LineBasicMaterial({ color: 0x35df99, transparent: true, opacity: 0.92 })));

    const dashMaterial = new THREE.MeshStandardMaterial({ color: 0xdde8df, emissive: 0x526e60, emissiveIntensity: 0.35 });
    for (let step = 0.03; step < 0.98; step += 0.045) {
      const point = curve.getPoint(step);
      const tangent = curve.getTangent(step).normalize();
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 1.45), dashMaterial);
      dash.position.copy(point).setY(0.12);
      dash.rotation.y = Math.atan2(tangent.x, tangent.z);
      scene.add(dash);
    }

    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0x6e8686, roughness: 0.75 });
    for (let step = 0.04; step < 0.98; step += 0.07) {
      const point = curve.getPoint(step);
      const tangent = curve.getTangent(step).normalize();
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();
      for (const direction of [-1, 1]) {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), shoulderMaterial);
        marker.position.copy(point).add(side.clone().multiplyScalar(4.2 * direction));
        marker.position.y = 0.25;
        marker.castShadow = true;
        scene.add(marker);
      }
    }

    const buildingSpecs = [
      [-35, -20, 8, 8, 16, 0x29454b], [-23, -31, 10, 9, 25, 0x203c44], [-8, -34, 8, 7, 19, 0x31535a],
      [13, -33, 11, 9, 30, 0x24464d], [30, -25, 8, 8, 20, 0x38575b], [39, -8, 10, 10, 27, 0x1f3c43],
      [-39, 8, 9, 10, 23, 0x2b4b4e], [-30, 26, 12, 10, 29, 0x1d3a42], [-12, 31, 9, 8, 17, 0x35565a],
      [10, 32, 12, 9, 25, 0x24464d], [29, 26, 8, 8, 18, 0x31525a], [41, 11, 12, 11, 31, 0x1d3b43],
    ] as const;
    buildingSpecs.forEach((values) => addBuilding(scene, ...values));

    const bridgePoint = curve.getPoint(0.58);
    const bridgeTangent = curve.getTangent(0.58).normalize();
    const bridge = new THREE.Group();
    const concrete = new THREE.MeshStandardMaterial({ color: 0x607174, roughness: 0.87 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(11, 0.75, 1.25), concrete);
    beam.position.y = 5.8;
    beam.castShadow = true;
    bridge.add(beam);
    for (const x of [-4.6, 4.6]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.7, 1.25), concrete);
      pillar.position.set(x, 2.85, 0);
      pillar.castShadow = true;
      bridge.add(pillar);
    }
    const sign = createClearanceSign("4.6 m");
    sign.position.set(0, 7.2, 0);
    bridge.add(sign);
    bridge.position.copy(bridgePoint);
    bridge.rotation.y = Math.atan2(bridgeTangent.x, bridgeTangent.z);
    scene.add(bridge);

    const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x20383d, metalness: 0.65, roughness: 0.4 });
    const lampGlow = new THREE.MeshStandardMaterial({ color: 0xcfffe8, emissive: 0x70ffd0, emissiveIntensity: 3 });
    for (let step = 0.12; step < 0.95; step += 0.17) {
      const point = curve.getPoint(step);
      const tangent = curve.getTangent(step).normalize();
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();
      const position = point.clone().add(side.multiplyScalar(step % 0.3 > 0.15 ? 5 : -5));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 10), lampMaterial);
      pole.position.copy(position).setY(2.3);
      scene.add(pole);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), lampGlow);
      glow.position.copy(position).setY(4.6);
      scene.add(glow);
      if (step < 0.7) {
        const pointLight = new THREE.PointLight(0x8fffd4, 18, 13, 2);
        pointLight.position.copy(position).setY(4.5);
        scene.add(pointLight);
      }
    }

    const truck = createTruck();
    scene.add(truck);
    const trafficAgents = [0xffc857, 0x3f8efc, 0xe95d5d, 0xb77bff, 0x55d6be].map((color, index) => {
      const agent = createTrafficAgent(color);
      agent.userData.offset = (index + 1) / 6;
      agent.userData.lane = index % 2 === 0 ? -1.9 : 1.9;
      scene.add(agent);
      return agent;
    });

    const signalHeads: THREE.Mesh[] = [];
    for (const step of [0.33, 0.68]) {
      const point = curve.getPoint(step);
      const tangent = curve.getTangent(step).normalize();
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();
      const polePosition = point.clone().add(side.multiplyScalar(4.8));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 4.8, 10), lampMaterial);
      pole.position.copy(polePosition).setY(2.4);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.35, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a2629, roughness: 0.65 }));
      head.position.copy(polePosition).setY(4.45);
      scene.add(head);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: 0x35d67a, emissive: 0x35d67a, emissiveIntensity: 3 }));
      bulb.position.copy(polePosition).setY(4.45).add(tangent.clone().multiplyScalar(-0.28));
      scene.add(bulb);
      signalHeads.push(bulb);
    }
    const initial = curve.getPoint(Math.max(0, Math.min(1, progressRef.current)));
    camera.position.copy(initial).add(new THREE.Vector3(15, 10, 18));
    controls.target.copy(initial);
    queueMicrotask(() => setReady(true));
    const lookTarget = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();

    function animate() {
      const value = Math.max(0, Math.min(0.999, progressRef.current));
      const point = curve.getPoint(value);
      const tangent = curve.getTangent(value).normalize();
      truck.position.copy(point).setY(0.08);
      truck.rotation.y = Math.atan2(-tangent.x, -tangent.z);
      const densityFactor = trafficRef.current === "intenso" ? 0.18 : trafficRef.current === "moderado" ? 0.32 : 0.48;
      trafficAgents.forEach((agent, index) => {
        const agentProgress = (value * densityFactor + agent.userData.offset + performance.now() * 0.000008 * (index + 2)) % 0.99;
        const agentPoint = curve.getPoint(agentProgress);
        const agentTangent = curve.getTangent(agentProgress).normalize();
        const laneSide = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), agentTangent).normalize().multiplyScalar(agent.userData.lane);
        agent.position.copy(agentPoint).add(laneSide).setY(0.06);
        agent.rotation.y = Math.atan2(-agentTangent.x, -agentTangent.z);
      });
      const signalColor = signalRef.current === "rojo" ? 0xff3d3d : signalRef.current === "amarillo" ? 0xffc53d : 0x35d67a;
      signalHeads.forEach((bulb) => {
        const material = bulb.material as THREE.MeshStandardMaterial;
        material.color.setHex(signalColor);
        material.emissive.setHex(signalColor);
      });
      const mode = modeRef.current;
      controls.enabled = mode === "orbit";
      if (mode === "follow") {
        desiredCamera.copy(point).add(tangent.clone().multiplyScalar(-13)).add(new THREE.Vector3(0, 7.5, 0));
        lookTarget.copy(point).add(tangent.clone().multiplyScalar(5)).add(new THREE.Vector3(0, 1.8, 0));
        camera.position.lerp(desiredCamera, 0.085);
        controls.target.lerp(lookTarget, 0.12);
      } else if (mode === "cab") {
        desiredCamera.copy(point).add(tangent.clone().multiplyScalar(2.5)).add(new THREE.Vector3(0, 2.9, 0));
        lookTarget.copy(point).add(tangent.clone().multiplyScalar(24)).add(new THREE.Vector3(0, 2.2, 0));
        camera.position.lerp(desiredCamera, 0.2);
        controls.target.lerp(lookTarget, 0.2);
      } else if (mode === "top") {
        desiredCamera.copy(point).add(new THREE.Vector3(0, 35, 0.01));
        camera.position.lerp(desiredCamera, 0.09);
        controls.target.lerp(point, 0.14);
      }
      controls.update();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ("map" in material && material.map instanceof THREE.Texture) material.map.dispose();
            material.dispose();
          });
        }
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, [routePoints]);

  async function toggleFullscreen() {
    if (!shellRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shellRef.current.requestFullscreen();
  }

  return (
    <div className="three-shell" ref={shellRef}>
      <div className="three-canvas" ref={hostRef} />
      {!ready && !error && <div className="three-loading"><span /> Preparando entorno 3D…</div>}
      {error && <div className="three-error"><strong>No se pudo iniciar WebGL</strong><small>Activa la aceleración gráfica del navegador.</small></div>}
      <div className="three-toolbar" aria-label="Controles de cámara">
        {(["follow", "cab", "orbit", "top"] as CameraMode[]).map((mode) => (
          <button key={mode} className={cameraMode === mode ? "active" : ""} onClick={() => setCameraMode(mode)}>
            {{ follow: "Seguimiento", cab: "Cabina", orbit: "Órbita", top: "Cenital" }[mode]}
          </button>
        ))}
        <button className="fullscreen-button" onClick={toggleFullscreen}>⛶ Ampliar</button>
      </div>
      <div className="three-hud">
        <span><small>VELOCIDAD</small><strong>{running ? speed : 0}<em> km/h</em></strong></span>
        <span><small>TRAMO ACTUAL</small><strong>{edgeId || "—"}</strong></span>
        <span><small>PROGRESO</small><strong>{Math.round(progress * 100)}<em>%</em></strong></span>
        <span><small>SEMÁFORO</small><strong className={`signal-${signalState}`}>{signalState.toUpperCase()}</strong></span>
        <span className="sensor-status"><i /> {agentState.replaceAll("-", " ")} · {trafficLevel}</span>
      </div>
      {cameraMode === "orbit" && <div className="three-help">Arrastra para girar · rueda para acercar</div>}
      <div className="three-vignette" />
    </div>
  );
}
