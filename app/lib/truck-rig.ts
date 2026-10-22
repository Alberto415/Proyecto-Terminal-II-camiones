import * as THREE from "three";
import type { TruckConfiguration } from "./truck-configuration.ts";

export function createTruckRig(config: TruckConfiguration) {
  const group = new THREE.Group(); group.name = config.label;
  const tractor = new THREE.Group(); tractor.name = "tractor"; group.add(tractor);
  const white = new THREE.MeshStandardMaterial({ color: 0xf0f2e9, metalness: .25, roughness: .38 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x202a2d, roughness: .75 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x9da9ad, metalness: .85, roughness: .3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x244754, metalness: .45, roughness: .15 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x397461, roughness: .5 });
  const brake = new THREE.MeshStandardMaterial({ color: 0xff4433, emissive: 0xff2211, emissiveIntensity: .35 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xffb83d, emissive: 0xcc6500, emissiveIntensity: .7 });
  const lamps = new THREE.MeshStandardMaterial({ color: 0xe5f5ff, emissive: 0xdceeff, emissiveIntensity: .8 });
  const wheels: Array<{ spin: THREE.Group; steer: THREE.Group; front: boolean }> = [];
  function box(parent: THREE.Group, name: string, size: number[], p: number[], material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),material); mesh.name=name; mesh.position.set(p[0],p[1],p[2]); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  function axle(parent: THREE.Group, z: number, front = false) {
    box(parent,"axle",[config.width-.15,.15,.15],[0,.5,z],dark);
    for (const side of [-1,1]) {
      const steer = new THREE.Group(); steer.position.set(side*(config.width/2-.04),.53,z); parent.add(steer);
      const spin = new THREE.Group(); steer.add(spin);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.3,20),dark); tire.rotation.z=Math.PI/2; tire.castShadow=true; spin.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.315,12),chrome); hub.rotation.z=Math.PI/2; spin.add(hub);
      wheels.push({spin,steer,front});
    }
  }
  const cabHeight = Math.min(config.height-.3,3.25), width = config.width;
  box(tractor,"cab",[width*.94,cabHeight-0.6,2.5],[0,(cabHeight+.6)/2,-.5],white);
  box(tractor,"windshield",[width*.76,.85,.045],[0,cabHeight-.65,-1.77],glass);
  for (const side of [-1,1]) {
    box(tractor,"side-window",[.045,.85,1.3],[side*width*.475,cabHeight-.65,-.5],glass);
    box(tractor,"mirror",[.18,.45,.25],[side*(width/2+.18),cabHeight-.7,-1.25],dark);
    box(tractor,"step",[.32,.18,.9],[side*width/2,.6,.25],chrome);
    box(tractor,"headlamp",[.4,.22,.06],[side*width*.34,1,-1.8],lamps);
  }
  box(tractor,"grille",[width*.65,.55,.06],[0,1.25,-1.8],dark);
  for (let n=0;n<4;n++) box(tractor,"grille-slat",[width*.62,.035,.07],[0,1.05+n*.12,-1.84],chrome);
  box(tractor,"bumper",[width,.24,.22],[0,.6,-1.8],chrome);
  box(tractor,"roof-fairing",[width*.9,.35,1.9],[0,cabHeight+.12,-.3],accent);
  const tractorLength = config.kind === "rigid" ? config.length : 5.4;
  box(tractor,"frame",[width*.75,.28,tractorLength-1],[0,.75,(tractorLength-1)/2-1.3],dark);
  axle(tractor,0,true);
  if (config.kind === "rigid") axle(tractor,config.length-3);
  else { axle(tractor,2.3); axle(tractor,3.5); box(tractor,"fuel-tank",[width*.85,.7,1.2],[0,.95,1],chrome); }

  function cargo(parent: THREE.Group, length: number, start: number, axleCount: number) {
    const h = config.height-1.15;
    box(parent,"cargo-box",[width,h,length],[0,1.1+h/2,start+length/2],white);
    for (const side of [-1,1]) {
      box(parent,"cargo-stripe",[.025,.22,length],[side*(width/2+.015),1.5,start+length/2],accent);
      for (let m=.5;m<length;m+=1.2) box(parent,"side-marker",[.04,.08,.17],[side*(width/2+.03),1.12,start+m],amber);
    }
    for (const side of [-1,1]) {
      box(parent,"rear-door",[width*.47,h-.12,.04],[side*width*.245,1.1+h/2,start+length+.025],white);
      box(parent,"door-lock",[.055,h*.7,.07],[side*width*.28,1.1+h/2,start+length+.06],chrome);
      box(parent,"brake-lamp",[.35,.18,.055],[side*width*.34,.95,start+length+.09],brake);
    }
    box(parent,"rear-bumper",[width,.16,.2],[0,.65,start+length+.12],chrome);
    for(let a=0;a<axleCount;a++) axle(parent,start+length-1.25-a*1.15);
  }
  const trailers: Array<{ mesh: THREE.Group; axleDistance: number; rearHitch: number }> = [];
  if(config.kind === "rigid") cargo(tractor,config.length-3.4,1.4,0);
  else {
    const bodyLength = (config.length-3.9-.8*(config.trailers-1))/config.trailers;
    for(let i=0;i<config.trailers;i++) {
      const mesh = new THREE.Group(); mesh.name=`trailer-${i+1}`; group.add(mesh);
      cargo(mesh,bodyLength,-1.2,config.kind === "double" && i===1 ? 3 : 2);
      box(mesh,"trailer-frame",[width*.75,.22,bodyLength],[0,.8,bodyLength/2-1.2],dark);
      if(i===1) { box(mesh,"dolly-drawbar",[.25,.2,1.6],[0,.65,-1.5],chrome); axle(mesh,.6); }
      trailers.push({mesh,axleDistance:Math.max(3,bodyLength-2.5),rearHitch:bodyLength+.8});
    }
  }
  return {group,tractor,trailers,wheels,brake,config};
}

/** Hitch-constrained trailing axle approximation; bodies remain joined in turns. */
export function advanceTrailer(hitch: {x:number;z:number}, previousAxle: {x:number;z:number}, wheelbase: number, fallback: number) {
  const dx=hitch.x-previousAxle.x,dz=hitch.z-previousAxle.z;
  const heading=Math.hypot(dx,dz)>.01 ? Math.atan2(-dx,-dz) : fallback;
  return { heading, x:hitch.x+Math.sin(heading)*wheelbase,z:hitch.z+Math.cos(heading)*wheelbase };
}
