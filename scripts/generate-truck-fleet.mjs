import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createTruckRig } from '../app/lib/truck-rig.ts';
import { truckConfiguration } from '../app/lib/truck-configuration.ts';

globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((value) => { this.result=value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((value) => { this.result=`data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
await fs.mkdir('public/models',{recursive:true});
for(const vehicle of [{length:10.5,width:2.5,height:3.6,axles:2},{length:18.5,width:2.6,height:4.25,axles:5},{length:31,width:2.6,height:4.35,axles:9}]) {
  const config=truckConfiguration(vehicle), rig=createTruckRig(config);
  let hitch=3.2;
  for(const trailer of rig.trailers) { trailer.mesh.position.z=hitch; hitch+=trailer.rearHitch; }
  const scene=new THREE.Scene(); scene.add(rig.group); scene.updateMatrixWorld(true);
  const bytes=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});
  const output=`public/models/truck-${config.kind}.glb`;
  await fs.writeFile(output,Buffer.from(bytes)); console.log(`${config.label}: ${output}`);
}
