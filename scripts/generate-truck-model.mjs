import fs from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

const scene = new THREE.Scene();
const truck = new THREE.Group();
truck.name = "AgenteCamionCarga";

const white = new THREE.MeshStandardMaterial({ color: 0xf4f7f5, roughness: 0.42, metalness: 0.16 });
const graphite = new THREE.MeshStandardMaterial({ color: 0x172329, roughness: 0.72, metalness: 0.24 });
const green = new THREE.MeshStandardMaterial({ color: 0x16bb78, roughness: 0.35, metalness: 0.08 });
const glass = new THREE.MeshStandardMaterial({ color: 0x173c4a, roughness: 0.12, metalness: 0.3 });
const red = new THREE.MeshStandardMaterial({ color: 0xe45148, emissive: 0x7a110d, emissiveIntensity: 0.8 });
const amber = new THREE.MeshStandardMaterial({ color: 0xffca62, emissive: 0x9b5b00, emissiveIntensity: 0.9 });

function box(name, size, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  truck.add(mesh);
  return mesh;
}

box("chassis", [2.5, 0.28, 9.4], [0, 0.72, 0.25], graphite);
box("trailer", [2.58, 3.05, 6.25], [0, 2.25, 1.5], white);
box("route-cargo-stripe", [2.61, 0.22, 6.3], [0, 1.25, 1.5], green);
box("cab", [2.46, 2.65, 2.45], [0, 2.02, -3.2], white);
box("cab-roof", [2.3, 0.48, 1.65], [0, 3.43, -3.02], white, [-0.08, 0, 0]);
box("windshield", [1.88, 0.86, 0.07], [0, 2.58, -4.44], glass, [-0.1, 0, 0]);
box("grille", [1.62, 0.62, 0.08], [0, 1.52, -4.45], graphite);
box("bumper", [2.52, 0.22, 0.28], [0, 0.73, -4.48], graphite);
box("left-headlight", [0.43, 0.22, 0.09], [-0.86, 1.18, -4.49], amber);
box("right-headlight", [0.43, 0.22, 0.09], [0.86, 1.18, -4.49], amber);
box("left-tail", [0.34, 0.2, 0.09], [-0.84, 1.12, 4.7], red);
box("right-tail", [0.34, 0.2, 0.09], [0.84, 1.12, 4.7], red);
box("left-mirror", [0.2, 0.48, 0.25], [-1.36, 2.62, -3.68], graphite);
box("right-mirror", [0.2, 0.48, 0.25], [1.36, 2.62, -3.68], graphite);

const wheelGeometry = new THREE.CylinderGeometry(0.49, 0.49, 0.34, 24);
for (const z of [-3.1, 1.7, 3.25]) {
  for (const x of [-1.29, 1.29]) {
    const wheel = new THREE.Mesh(wheelGeometry, graphite);
    wheel.name = `wheel-${x}-${z}`;
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.55, z);
    truck.add(wheel);
  }
}

scene.add(truck);
scene.updateMatrixWorld(true);

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, { binary: true, onlyVisible: true });
const output = path.resolve("public/models/cargo-truck.glb");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, Buffer.from(glb));
console.log(`Generated ${output}`);
