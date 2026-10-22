import * as THREE from "three";

export function createTruck() {
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

export function createTrafficAgent(color: number) {
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

export function createClearanceSign(text: string) {
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

export function addBuilding(scene: THREE.Scene, x: number, z: number, width: number, depth: number, height: number, color: number) {
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
