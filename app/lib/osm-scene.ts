import * as THREE from "three";
import { buildingHeight, projectOsm, type OsmScenery } from "./osm-scenery";
import type { SimulationRoute } from "./simulation-route";

function polygon(points: Array<{ x: number; z: number }>) {
  const shape = new THREE.Shape();
  points.forEach((p, index) => index ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z));
  shape.closePath();
  return shape;
}
function streetLabel(text: string) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#253e38e8"; ctx.fillRect(0, 0, 512, 64);
  ctx.font = "24px Arial"; ctx.fillStyle = "#f2f6e9"; ctx.textAlign = "center";
  ctx.fillText(text, 256, 42, 490);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture })); sprite.scale.set(12, 1.5, 1); return sprite;
}
export function createOsmScene(data: OsmScenery, route: SimulationRoute) {
  const group = new THREE.Group(); group.name = "OpenStreetMap";
  let buildings = 0, roads = 0, parks = 0;
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#d4d2c4"; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#a6ada5"; ctx.fillRect(0, 122, 128, 6);
  for (const x of [18, 76]) {
    ctx.fillStyle = "#647b80"; ctx.fillRect(x, 22, 34, 66);
    ctx.fillStyle = "#91a9ae"; ctx.fillRect(x + 3, 25, 12, 59);
    ctx.fillStyle = "#e3e2d7"; ctx.fillRect(x - 3, 89, 40, 5);
  }
  const windows = new THREE.CanvasTexture(canvas); windows.colorSpace = THREE.SRGBColorSpace;
  windows.wrapS = windows.wrapT = THREE.RepeatWrapping; windows.repeat.set(.16, .3);
  const facade = new THREE.MeshStandardMaterial({ color: 0xe2dfd1, map: windows, roughness: .8 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x8c9991, roughness: .95 });
  const green = new THREE.MeshStandardMaterial({ color: 0x587d45, roughness: 1, side: THREE.DoubleSide });
  const water = new THREE.MeshStandardMaterial({ color: 0x6199a4, metalness: .15, roughness: .35, side: THREE.DoubleSide });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x565d5c, roughness: 1, side: THREE.DoubleSide });
  const seenNames = new Set<string>();
  for (const element of data.elements) {
    const tags = element.tags ?? {};
    if (element.type === "node" && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
      const point = projectOsm({ lat: element.lat!, lon: element.lon! }, route.origin);
      if (tags.natural === "tree") {
        const tree = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 7), green);
        tree.position.set(point.x, 3, point.z); tree.castShadow = true; group.add(tree);
      } else if (tags.highway === "bus_stop") {
        const shelter = new THREE.Mesh(new THREE.BoxGeometry(4, .25, 2), roof); shelter.position.set(point.x, 3, point.z); group.add(shelter);
        const label = streetLabel(tags.name || "Parada de autobús"); label.position.set(point.x, 5, point.z); group.add(label);
      }
      continue;
    }
    if (!element.geometry || element.geometry.length < 2) continue;
    const points = element.geometry.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => projectOsm(p, route.origin));
    if (points.length < 2) continue;
    const closed = Math.hypot(points[0].x - points.at(-1)!.x, points[0].z - points.at(-1)!.z) < 1;
    if (tags.building && tags.building !== "no" && closed && points.length >= 4 && buildings < 1400) {
      const height = buildingHeight(tags);
      const geometry = new THREE.ExtrudeGeometry(polygon(points), { depth: height, bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      const block = new THREE.Mesh(geometry, [roof, facade]); block.userData.cameraObstacle = true; block.castShadow = true; block.receiveShadow = true; group.add(block); buildings++;
      // Outlines preserve the mapped roof silhouette at overview distance.
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({ color: 0x677a70, transparent: true, opacity: .3 })); group.add(edges);
    } else if ((tags.leisure || tags.natural === "water") && closed && points.length >= 4) {
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(polygon(points)), tags.natural === "water" ? water : green);
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = -.015; mesh.receiveShadow = true; group.add(mesh); parks++;
    } else if (tags.highway && roads < 900) {
      const width = Math.min(22, Math.max(3, Number.parseFloat(tags.width) || (Number.parseFloat(tags.lanes) || 2) * 3.2));
      const positions: number[] = [];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]; const len = Math.hypot(b.x - a.x, b.z - a.z); if (len < .1) continue;
        const x = -(b.z - a.z) / len * width / 2, z = (b.x - a.x) / len * width / 2;
        for (const p of [[a.x+x,a.z+z],[a.x-x,a.z-z],[b.x+x,b.z+z],[a.x-x,a.z-z],[b.x-x,b.z-z],[b.x+x,b.z+z]]) positions.push(p[0], 0, p[1]);
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, asphalt); mesh.receiveShadow = true; group.add(mesh); roads++;
      if (tags.name && seenNames.size < 24 && !seenNames.has(tags.name)) {
        const p = points[Math.floor(points.length / 2)]; const label = streetLabel(tags.name); label.position.set(p.x, 4, p.z); group.add(label); seenNames.add(tags.name);
      }
    }
  }
  const used = new Set<THREE.Material>();
  group.traverse((object) => { if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) used.add(material); });
  for (const material of [facade, roof, green, water, asphalt]) if (!used.has(material)) material.dispose();
  if (!used.has(facade)) windows.dispose();
  return { group, buildings, roads, parks };
}
