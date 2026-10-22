import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { truckConfiguration } from '../app/lib/truck-configuration.ts';
import { createTruckRig, advanceTrailer } from '../app/lib/truck-rig.ts';
import { buildSimulationRoute, driveTruck, upcomingTurn } from '../app/lib/simulation-route.ts';

test('vehicle selection creates distinct rigs at the selected physical size', () => {
  for (const [length,axles,kind,trailers] of [[10.5,2,'rigid',0],[18.5,5,'tractor',1],[31,9,'double',2]]) {
    const config=truckConfiguration({length,axles,width:2.6,height:4.25});
    assert.equal(config.kind,kind);
    const rig=createTruckRig(config); assert.equal(rig.trailers.length,trailers);
    assert.equal(rig.wheels.length,axles*2);
    let hitch=3.2;
    for(const part of rig.trailers) { part.mesh.position.z=hitch; hitch+=part.rearHitch; }
    rig.group.updateMatrixWorld(true);
    const size=new THREE.Box3().setFromObject(rig.group).getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.z-length)<.8,`${kind}: ${size.z} m`);
  }
});
test('a trailing axle stays connected to its hitch while articulating', () => {
  const axle=advanceTrailer({x:8,z:-2},{x:0,z:5},10,0);
  assert.ok(Math.abs(Math.hypot(axle.x-8,axle.z+2)-10)<1e-9);
  assert.ok(Math.abs(axle.heading)>.1);
});
test('truck accelerates progressively, stops before red, and reaches the destination on green', () => {
  const route=buildSimulationRoute([{lat:19.35,lng:-99.28},{lat:19.354,lng:-99.28}]);
  let progress=0,speed=0;
  for(let i=0;i<2200;i++) { const next=driveTruck(progress,speed,.05,route,[],'rojo',31); assert.ok(next.speed-speed<=.85*.05+1e-9); progress=next.progress;speed=next.speed; }
  assert.ok(progress*route.length <= route.length*.33-8+.001);
  assert.ok(speed<.01);
  for(let i=0;i<2400 && progress<1;i++) { const next=driveTruck(progress,speed,.05,route,[],'verde',31); progress=next.progress;speed=next.speed; }
  assert.equal(progress,1);
});
test('maneuver references distinguish right and left turns', () => {
  const route=buildSimulationRoute([{lat:19.35,lng:-99.28},{lat:19.351,lng:-99.28},{lat:19.351,lng:-99.279}]);
  assert.equal(upcomingTurn(route,0).text,'Curva a la derecha');
});
