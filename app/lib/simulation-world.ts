import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createTrafficAgent } from "./simulation-assets";
import { createTraffic, driveTruck, sampleRoute, SIGNAL_POSITIONS, stepTraffic, trafficGap, type SimulationRoute } from "./simulation-route";
import { createTruckRig, advanceTrailer } from "./truck-rig";
import { DEFAULT_TRUCK, type TruckConfiguration } from "./truck-configuration";
import { signalStateForTick, type SignalState } from "./academic-simulation";
import type { TrafficLevel } from "./routing";
import { fetchOsmScenery } from "./osm-scenery";
import { createOsmScene } from "./osm-scene";

export type CameraMode = "follow" | "cab" | "front" | "side" | "orbit" | "top" | "overview" | "tour" | "sector";
export type WorldSnapshot = {
  progress: number; running: boolean; demo: boolean; rate: number;
  camera: CameraMode; sector: number; signal: SignalState; traffic: TrafficLevel;
};
export type WorldStats = { progress: number; vehicles: number; signal: SignalState; waiting: boolean; speed: number };

function roadRibbon(route: SimulationRoute, width: number, height: number, offset = 0) {
  const positions: number[] = [];
  const indices: number[] = [];
  // Incluir cada vértice original conserva todos los giros de la geometría vial.
  route.points.forEach((point, index) => {
    const previous = route.points[Math.max(0, index - 1)];
    const next = route.points[Math.min(route.points.length - 1, index + 1)];
    const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
    const rx = -(next.z - previous.z) / length;
    const rz = (next.x - previous.x) / length;
    for (const side of [-1, 1]) {
      positions.push(point.x + rx * (offset + side * width / 2), height, point.z + rz * (offset + side * width / 2));
    }
    if (index < route.points.length - 1) { const n = index * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function labelSprite(text: string, background = "#0b5647") {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.fillStyle = background; context.fillRect(0, 0, 512, 96);
  context.fillStyle = "#ffffff"; context.font = "700 28px Arial";
  context.textAlign = "center"; context.textBaseline = "middle";
  context.fillText(text, 256, 48, 480);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(8, 1.5, 1);
  return sprite;
}

function addCity(scene: THREE.Object3D, route: SimulationRoute) {
  const dummy = new THREE.Object3D();
  const spots: Array<{ x: number; z: number; w: number; d: number; h: number; angle: number; park: boolean }> = [];
  const cells = new Map<string, Array<{ x: number; z: number }>>();
  for (let meters = 0; meters <= route.length; meters += 8) {
    const p = sampleRoute(route, meters / route.length);
    const key = `${Math.floor(p.x / 40)},${Math.floor(p.z / 40)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(p);
  }
  for (const ratio of SIGNAL_POSITIONS) {
    const crossing = sampleRoute(route, ratio);
    for (let lateral = -32; lateral <= 32; lateral += 8) {
      const point = { x: crossing.x + crossing.rightX * lateral, z: crossing.z + crossing.rightZ * lateral };
      const key = `${Math.floor(point.x / 40)},${Math.floor(point.z / 40)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(point);
    }
  }
  const roadNear = (x: number, z: number, radius: number) => {
    const cellX = Math.floor(x / 40), cellZ = Math.floor(z / 40);
    for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
      if (cells.get(`${cellX + dx},${cellZ + dz}`)?.some((p) => Math.hypot(p.x - x, p.z - z) < radius)) return true;
    }
    return false;
  };
  const count = Math.min(190, Math.max(20, Math.floor(route.length / 22)));
  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.25) / count;
    const p = sampleRoute(route, t);
    for (const side of [-1, 1]) {
      const distance = 24 + (index % 5) * 6;
      const x = p.x + p.rightX * distance * side;
      const z = p.z + p.rightZ * distance * side;
      if (roadNear(x, z, 19)) continue;
      spots.push({ x, z, w: 8 + (index % 4) * 3, d: 9 + (index % 3) * 3, h: 7 + (index % 7) * 4, angle: Math.atan2(p.dx, p.dz), park: Math.floor(t * 3) === 1 && index % 3 !== 0 });
    }
  }
  const buildings = spots.filter((spot) => !spot.park);
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), buildings.length);
  const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x789eab, metalness: 0.35, roughness: 0.3 }), buildings.length);
  const colors = [0xbdc9c6, 0xe7d7c3, 0x819ba0, 0xa9b9bb, 0xc6b6a4];
  buildings.forEach((spot, index) => {
    dummy.position.set(spot.x, spot.h / 2, spot.z); dummy.rotation.set(0, spot.angle, 0); dummy.scale.set(spot.w, spot.h, spot.d); dummy.updateMatrix();
    blocks.setMatrixAt(index, dummy.matrix); blocks.setColorAt(index, new THREE.Color(colors[index % colors.length]));
    dummy.scale.set(spot.w * 0.75, spot.h * 0.7, spot.d + 0.1); dummy.updateMatrix(); windows.setMatrixAt(index, dummy.matrix);
  });
  blocks.castShadow = true; blocks.receiveShadow = true;
  scene.add(blocks, windows);
  const treeSpots: Array<{ x: number; z: number }> = [];
  for (let meters = 12; meters < route.length; meters += 22) {
    const p = sampleRoute(route, meters / route.length);
    const side = Math.floor(meters / 22) % 2 ? 1 : -1;
    const x = p.x + p.rightX * 12 * side, z = p.z + p.rightZ * 12 * side;
    if (!roadNear(x, z, 9)) treeSpots.push({ x, z });
  }
  for (const spot of spots.filter((item) => item.park)) treeSpots.push({ x: spot.x, z: spot.z });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.45, 3, 6), new THREE.MeshStandardMaterial({ color: 0x6d5940 }), treeSpots.length);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.5, 1), new THREE.MeshStandardMaterial({ color: 0x397358, roughness: 0.95 }), treeSpots.length);
  treeSpots.forEach((spot, index) => {
    dummy.position.set(spot.x, 1.5, spot.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); trunks.setMatrixAt(index, dummy.matrix);
    dummy.position.y = 4.2; dummy.scale.set(1, 1.4, 1); dummy.updateMatrix(); crowns.setMatrixAt(index, dummy.matrix);
  });
  crowns.castShadow = true; scene.add(trunks, crowns);
}

export function createSimulationWorld(host: HTMLDivElement, route: SimulationRoute, getState: () => WorldSnapshot, callbacks: {
  onDemoProgress: (progress: number) => void; onTrafficHold: (hold: boolean) => void; onStats: (stats: WorldStats) => void;
  onScenery?: (message: string) => void;
}, truckConfig: TruckConfiguration = DEFAULT_TRUCK) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute("aria-label", "Simulación tridimensional interactiva de un camión sobre la ruta calculada");
  host.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8d1d9);
  scene.fog = new THREE.Fog(0xb8d1d9, 110, 500);
  const camera = new THREE.PerspectiveCamera(52, host.clientWidth / Math.max(1, host.clientHeight), 0.3, 30000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.08; controls.minDistance = 6;
  controls.maxDistance = Math.max(400, route.length * 2);
  scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x576b46, 2));
  const sun = new THREE.DirectionalLight(0xffedce, 2.8);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 180 });
  sun.shadow.bias = -0.0005; scene.add(sun, sun.target);
  const { bounds } = route;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(bounds.maxX - bounds.minX + 500, bounds.maxZ - bounds.minZ + 500), new THREE.MeshStandardMaterial({ color: 0x8b9e79, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((bounds.maxX + bounds.minX) / 2, -0.05, (bounds.maxZ + bounds.minZ) / 2); ground.receiveShadow = true; scene.add(ground);
  for (const [width, height, color] of [[14, 0.01, 0xb8b4a8], [10, 0.04, 0x5a6060], [7.4, 0.07, 0x303a40]]) {
    const ribbon = new THREE.Mesh(roadRibbon(route, width, height), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.95 }));
    ribbon.receiveShadow = true; scene.add(ribbon);
  }
  const routeLine = new THREE.Mesh(roadRibbon(route, 0.28, 0.11, 1.8), new THREE.MeshBasicMaterial({ color: 0x1be6a0, side: THREE.DoubleSide }));
  scene.add(routeLine);
  const dashMaterial = new THREE.MeshStandardMaterial({ color: 0xf4efcc });
  const dashes = Math.ceil(route.length / 10);
  const marks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.025, 3), dashMaterial, dashes);
  const dummy = new THREE.Object3D();
  for (let index = 0; index < dashes; index += 1) {
    const p = sampleRoute(route, Math.min(1, (index * 10 + 2) / route.length));
    dummy.position.set(p.x, 0.1, p.z); dummy.rotation.set(0, Math.atan2(p.dx, p.dz), 0); dummy.updateMatrix(); marks.setMatrixAt(index, dummy.matrix);
  }
  scene.add(marks);
  const recreatedCity = new THREE.Group(); addCity(recreatedCity, route); scene.add(recreatedCity);
  const cameraObstacles: THREE.Box3[] = [];
  let disposed = false;
  callbacks.onScenery?.("Cargando edificios y calles de OpenStreetMap…");
  void fetchOsmScenery(route).then((data) => {
    if (disposed) return;
    const mapped = createOsmScene(data, route);
    scene.add(mapped.group);
    mapped.group.updateMatrixWorld(true);
    mapped.group.traverse((object) => { if (object.userData.cameraObstacle) cameraObstacles.push(new THREE.Box3().setFromObject(object)); });
    // Keep the fallback's resources attached for normal cleanup, but hide its invented buildings.
    if (mapped.buildings > 0) recreatedCity.visible = false;
    callbacks.onScenery?.(`OSM · ${mapped.buildings} edificios · ${mapped.roads} calles · ${mapped.parks} áreas verdes/agua`);
  }).catch(() => { if (!disposed) callbacks.onScenery?.("Entorno recreado · OSM no disponible; puedes seguir simulando"); });

  const signalBulbs: Array<{ bulb: THREE.Mesh; aspect: SignalState }> = [];
  const crossingAgents: Array<{ mesh: THREE.Group; ratio: number; offset: number }> = [];
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x424b50, roughness: 0.95 });
  for (const [index, ratio] of SIGNAL_POSITIONS.entries()) {
    const p = sampleRoute(route, ratio);
    const crossing = new THREE.Mesh(new THREE.BoxGeometry(65, 0.06, 7.4), asphalt);
    crossing.position.set(p.x, 0.095, p.z); crossing.rotation.y = -Math.atan2(p.rightZ, p.rightX); scene.add(crossing);
    for (let stripe = -3; stripe <= 3; stripe += 1) {
      const zebra = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 2.6), dashMaterial);
      zebra.position.set(p.x + p.rightX * stripe, 0.15, p.z + p.rightZ * stripe);
      zebra.rotation.y = Math.atan2(p.dx, p.dz); scene.add(zebra);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 8), new THREE.MeshStandardMaterial({ color: 0x35434a }));
    pole.position.set(p.x + p.rightX * 5.5, 2.5, p.z + p.rightZ * 5.5); scene.add(pole);
    const head = new THREE.Group(); head.position.set(pole.position.x, 4.5, pole.position.z); head.rotation.y = Math.atan2(-p.dx, -p.dz);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.7, 0.5), new THREE.MeshStandardMaterial({ color: 0x1e282d })); head.add(housing);
    for (const [bulbIndex, aspect] of (["rojo", "amarillo", "verde"] as SignalState[]).entries()) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshStandardMaterial({ color: 0x22352c }));
      bulb.position.set(0, 0.5 - bulbIndex * 0.5, -0.28); head.add(bulb); signalBulbs.push({ bulb, aspect });
    }
    scene.add(head);
    const sign = labelSprite(`Cruce ${index + 1} · semáforo`); sign.position.set(pole.position.x, 9, pole.position.z); scene.add(sign);
    for (let carIndex = 0; carIndex < 2; carIndex += 1) {
      const mesh = createTrafficAgent(carIndex ? 0xe7ad5a : 0x5299c3); scene.add(mesh); crossingAgents.push({ mesh, ratio, offset: carIndex * 0.5 });
    }
  }
  for (const [index, sector] of route.sectors.entries()) {
    const p = sampleRoute(route, sector.start);
    const sign = labelSprite(`${index + 1} · ${sector.name}`);
    sign.position.set(p.x - p.rightX * 8, 8, p.z - p.rightZ * 8); scene.add(sign);
  }
  for (const [ratio, title] of [[0, "SALIDA"], [1, "DESTINO"]] as const) {
    const p = sampleRoute(route, ratio);
    const sign = labelSprite(title, ratio ? "#175c9c" : "#0b7055"); sign.position.set(p.x, 12, p.z); scene.add(sign);
    const marker = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.22, 8, 32), new THREE.MeshBasicMaterial({ color: ratio ? 0x48b9ff : 0x35efa5 }));
    marker.position.set(p.x, 0.2, p.z); marker.rotation.x = Math.PI / 2; scene.add(marker);
  }
  const rig = createTruckRig(truckConfig); scene.add(rig.group);
  const truck = rig.tractor;
  const trailerAxles = rig.trailers.map(() => ({ x: 0, z: 0 }));
  let rigInitialized = false, demoSpeed = 0, wheelTravel = 0;
  let trafficLevel = getState().traffic;
  const spawnTraffic = (level: TrafficLevel, progress: number) => createTraffic(route.length, level).filter((car) => car.direction === -1 || Math.abs(car.distance - progress * route.length) > truckConfig.length + 10);
  let cars = spawnTraffic(trafficLevel, getState().progress);
  const carMeshes = Array.from({ length: 72 }, (_, index) => {
    const car = createTrafficAgent([0xe8be65, 0x578ec8, 0xc56c63, 0xb3c0bb, 0x725d85][index % 5]);
    scene.add(car); return car;
  });
  const look = new THREE.Vector3(), desired = new THREE.Vector3();
  const cameraRay = new THREE.Ray(), cameraHit = new THREE.Vector3(), viewDirection = new THREE.Vector3();
  const center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 80);
  const initial = sampleRoute(route, getState().progress);
  camera.position.set(initial.x - initial.dx * 23, 13, initial.z - initial.dz * 23);
  controls.target.set(initial.x, 2, initial.z);
  let previous = performance.now(), clock = 0, reportAt = 0, frame = 0, lastMode = "", lastHold = false;
  let lastProgress = getState().progress;
  let inView = true;
  const visibility = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; });
  visibility.observe(host);

  const animate = (now: number) => {
    const dt = Math.min(0.075, Math.max(0, (now - previous) / 1000)); previous = now;
    const state = getState();
    if (state.running) clock += dt * state.rate;
    const signal = state.demo ? signalStateForTick(Math.floor(clock)) : state.signal;
    if (trafficLevel !== state.traffic) { trafficLevel = state.traffic; cars = spawnTraffic(trafficLevel, state.progress); }
    if (!state.running && Math.abs(state.progress - lastProgress) * route.length > 25) cars = spawnTraffic(trafficLevel, state.progress);
    let progress = state.progress;
    const jumped = Math.abs(progress - lastProgress) * route.length > 5;
    if (jumped) { rigInitialized = false; demoSpeed = 0; }
    if (state.running) {
      const steps = Math.max(1, Math.ceil(dt * state.rate / .04));
      for (let i=0;i<steps;i++) {
        const seconds = dt * state.rate / steps;
        cars = stepTraffic(cars, seconds, route.length, signal, state.traffic, progress * route.length, truckConfig.length);
        if (state.demo) {
          const movement = driveTruck(progress, demoSpeed, seconds, route, cars, signal, truckConfig.length);
          progress = movement.progress; demoSpeed = movement.speed;
        }
      }
      if (state.demo) callbacks.onDemoProgress(progress);
    } else demoSpeed = 0;
    const travel = jumped ? 0 : Math.max(0, progress - lastProgress) * route.length;
    wheelTravel += travel;
    const physicalSpeed = state.running ? state.demo ? demoSpeed : travel / Math.max(dt, .001) : 0;
    for (const wheel of rig.wheels) {
      wheel.spin.rotation.x = -wheelTravel / .5;
    }
    lastProgress = progress;
    const p = sampleRoute(route, progress);
    const truckGap = trafficGap(cars, progress * route.length, 1);
    const hold = !state.demo && state.running && truckGap < 16;
    if (hold !== lastHold) { callbacks.onTrafficHold(hold); lastHold = hold; }
    truck.position.set(p.x + p.rightX * 1.8, 0.1, p.z + p.rightZ * 1.8);
    const targetHeading = Math.atan2(-p.dx, -p.dz);
    const difference = Math.atan2(Math.sin(targetHeading - truck.rotation.y), Math.cos(targetHeading - truck.rotation.y));
    truck.rotation.y = targetHeading;
    const steering = Math.max(-.45, Math.min(.45, difference * 3));
    for (const wheel of rig.wheels) if (wheel.front) wheel.steer.rotation.y = steering;
    rig.brake.emissiveIntensity = state.running && physicalSpeed < 1 ? 2.5 : .35;
    let hitch = { x: truck.position.x + Math.sin(truck.rotation.y) * 3.2, z: truck.position.z + Math.cos(truck.rotation.y) * 3.2 };
    for (const [index, trailer] of rig.trailers.entries()) {
      if (!rigInitialized) trailerAxles[index] = { x: hitch.x + Math.sin(truck.rotation.y) * trailer.axleDistance, z: hitch.z + Math.cos(truck.rotation.y) * trailer.axleDistance };
      const axle = advanceTrailer(hitch, trailerAxles[index], trailer.axleDistance, truck.rotation.y);
      trailer.mesh.position.set(hitch.x, .1, hitch.z); trailer.mesh.rotation.y = axle.heading;
      trailerAxles[index] = axle;
      hitch = { x: hitch.x + Math.sin(axle.heading) * trailer.rearHitch, z: hitch.z + Math.cos(axle.heading) * trailer.rearHitch };
    }
    rigInitialized = true;
    cars.forEach((car, index) => {
      const point = sampleRoute(route, car.distance / route.length);
      const mesh = carMeshes[index]; mesh.visible = true;
      mesh.position.set(point.x + point.rightX * car.direction * 1.8, 0.12, point.z + point.rightZ * car.direction * 1.8);
      mesh.rotation.y = Math.atan2(-point.dx * car.direction, -point.dz * car.direction);
    });
    for (let index = cars.length; index < carMeshes.length; index += 1) carMeshes[index].visible = false;
    for (const { bulb, aspect } of signalBulbs) {
      const color = aspect === "rojo" ? 0xf34434 : aspect === "amarillo" ? 0xffc83d : 0x32e68a;
      const material = bulb.material as THREE.MeshStandardMaterial;
      material.color.setHex(signal === aspect ? color : 0x263731);
      material.emissive.setHex(signal === aspect ? color : 0x000000); material.emissiveIntensity = 1.5;
    }
    crossingAgents.forEach(({ mesh, ratio, offset }) => {
      const point = sampleRoute(route, ratio);
      // El tráfico transversal cruza únicamente mientras el camión tiene rojo.
      const along = ((clock * 0.12 + offset) % 1) * 54 - 27;
      const frontBeyondCrossing = progress * route.length - ratio * route.length;
      const truckOccupiesCrossing = frontBeyondCrossing > -5 && frontBeyondCrossing < truckConfig.length + 5;
      mesh.visible = signal === "rojo" && !truckOccupiesCrossing;
      mesh.position.set(point.x + point.rightX * along - point.dx * 1.8, 0.13, point.z + point.rightZ * along - point.dz * 1.8);
      mesh.rotation.y = Math.atan2(-point.rightX, -point.rightZ);
    });
    const wide = state.camera === "overview" || state.camera === "tour";
    (scene.fog as THREE.Fog).near = wide ? span * 1.5 : 150; (scene.fog as THREE.Fog).far = wide ? span * 6 : 550;
    controls.enabled = state.camera === "orbit";
    const modeChanged = lastMode !== state.camera; lastMode = state.camera;
    let focus = p;
    if (state.camera === "sector" || state.camera === "tour") {
      const index = state.camera === "tour" ? Math.floor(now / 6000) % route.sectors.length : Math.min(state.sector, route.sectors.length - 1);
      focus = sampleRoute(route, route.sectors[index].center);
    }
    if (state.camera === "overview") {
      desired.copy(center).add(new THREE.Vector3(span * 0.25, span * 0.85, span * 0.65)); look.copy(center);
    } else if (state.camera === "top") {
      desired.set(p.x, 95, p.z + 0.1); look.set(p.x, 0, p.z);
    } else if (state.camera === "sector" || state.camera === "tour") {
      desired.set(focus.x - focus.dx * 55 + focus.rightX * 35, 48, focus.z - focus.dz * 55 + focus.rightZ * 35); look.set(focus.x, 0, focus.z);
    } else if (state.camera === "cab") {
      desired.set(truck.position.x + p.dx * 1.9, Math.min(truckConfig.height-.5,2.8), truck.position.z + p.dz * 1.9); look.set(p.x + p.dx * 40, 2.5, p.z + p.dz * 40);
    } else if (state.camera === "front") {
      desired.set(p.x + p.dx * 20 + p.rightX * 5, 6, p.z + p.dz * 20 + p.rightZ * 5); look.set(p.x, 2, p.z);
    } else if (state.camera === "side") {
      const back = truckConfig.length*.4;
      desired.set(p.x - p.dx*back + p.rightX * (truckConfig.length+12), 12, p.z - p.dz*back + p.rightZ * (truckConfig.length+12)); look.set(p.x-p.dx*back, 2, p.z-p.dz*back);
    } else if (state.camera === "follow") {
      const distance = truckConfig.length + 17;
      desired.set(p.x - p.dx * distance + p.rightX * 5, 12 + truckConfig.length*.18, p.z - p.dz * distance + p.rightZ * 5); look.set(p.x + p.dx * 8, 1.8, p.z + p.dz * 8);
    }
    if (state.camera !== "orbit") {
      if (state.camera !== "cab") {
        // Lift exterior cameras over mapped buildings rather than placing them inside a roof.
        for(let pass=0;pass<2;pass++) {
          viewDirection.copy(desired).sub(look); const distance=viewDirection.length(); viewDirection.normalize(); cameraRay.set(look,viewDirection);
          for(const box of cameraObstacles) {
            if(cameraRay.intersectBox(box,cameraHit) && cameraHit.distanceTo(look)<distance && cameraHit.distanceTo(look)>3) desired.y=Math.max(desired.y,box.max.y+14);
          }
        }
      }
      const blend = modeChanged ? 1 : 1 - Math.exp(-dt * 6);
      camera.position.lerp(desired, blend); controls.target.lerp(look, blend);
    }
    sun.position.set(p.x - 40, 75, p.z + 30); sun.target.position.set(p.x, 0, p.z);
    controls.update();
    if (inView && !document.hidden) renderer.render(scene, camera);
    if (now - reportAt > 180) {
      callbacks.onStats({ progress, vehicles: cars.length + crossingAgents.filter(({ mesh }) => mesh.visible).length, signal, waiting: state.running && (truckGap < 16 || (state.demo && physicalSpeed < .1)), speed: physicalSpeed * 3.6 });
      reportAt = now;
    }
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  const resize = new ResizeObserver(() => {
    if (!host.clientWidth || !host.clientHeight) return;
    renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
  }); resize.observe(host);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame); resize.disconnect(); visibility.disconnect(); controls.dispose(); callbacks.onTrafficHold(false);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    scene.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material); if ("map" in material && material.map instanceof THREE.Texture) textures.add(material.map);
        }
      }
    });
    textures.forEach((texture) => texture.dispose()); geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
    sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); host.replaceChildren();
  };
}
