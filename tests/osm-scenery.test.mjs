import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingHeight, projectOsm, sceneryCenters } from '../app/lib/osm-scenery.ts';
import { buildSimulationRoute } from '../app/lib/simulation-route.ts';

test('OSM shares the route coordinate system and keeps queries bounded', () => {
  const origin = {lat:19.35,lng:-99.28};
  const route = buildSimulationRoute([origin,{lat:19.36,lng:-99.27}]);
  assert.deepEqual(projectOsm({lat:origin.lat,lon:origin.lng}, origin), {x:0,z:-0});
  const endpoint = projectOsm({lat:19.36,lon:-99.27},origin);
  assert.deepEqual(endpoint,route.points.at(-1));
  const centers = sceneryCenters(route);
  assert.ok(centers.length <= 8);
  assert.deepEqual(centers[0],origin);
  assert.deepEqual(centers.at(-1),{lat:19.36,lng:-99.27});
});
test('building heights prefer measured values, then floors, with bounded fallback', () => {
  assert.equal(buildingHeight({height:'18','building:levels':'3'}),18);
  assert.equal(buildingHeight({height:'10 ft'}),3.048);
  assert.equal(buildingHeight({'building:levels':'5'}),16);
  assert.equal(buildingHeight({}),9.6);
  assert.equal(buildingHeight({height:'99999'}),250);
});
