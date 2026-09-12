import test from 'node:test';
import assert from 'node:assert/strict';
import {initialSystem,step,accelerations,validateSaved,orbitPlanet} from '../src/physics.js';
test('initial system has all different planet names and three-axis states',()=>{const b=initialSystem();assert.equal(new Set(b.map(p=>p.name)).size,b.length);assert.ok(b.every(p=>p.position.length===3&&p.velocity.length===3));});
test('pairwise force conserves net momentum',()=>{const b=initialSystem(),a=accelerations(b);for(let k=0;k<3;k++)assert.ok(Math.abs(a.reduce((s,v,i)=>s+v[k]*b[i].mass,0))<1e-9);});
test('two-body orbit stays bounded for 12000 fixed steps',()=>{const b=initialSystem().slice(0,2);const initial=Math.hypot(...b[1].position);for(let i=0;i<12000;i++)step(b);assert.equal(b.length,2);const final=Math.hypot(...b[1].position.map((v,k)=>v-b[0].position[k]));assert.ok(Math.abs(final-initial)/initial<.01);});
test('collision conserves mass and momentum',()=>{const b=[{id:0,mass:3,radius:2,position:[0,0,0],velocity:[1,0,0]},{id:1,mass:2,radius:2,position:[1,0,0],velocity:[-1,0,0]}];const events=step(b,0);assert.equal(b.length,1);assert.equal(b[0].mass,5);assert.ok(Math.abs(b[0].velocity[0]-.2)<1e-10);assert.deepEqual(events,[{kept:0,removed:1}]);});
test('save validation rejects corrupt or duplicate states',()=>{assert.equal(validateSaved({version:1,bodies:initialSystem()}).length,5);assert.throws(()=>validateSaved({version:2,bodies:[]}));const b=initialSystem();b[1].id=0;assert.throws(()=>validateSaved({version:1,bodies:b}));});
test('new tilted planet inherits star motion',()=>{const p=orbitPlanet(8,'Test','ice',40,.6,.3,{position:[10,20,30],velocity:[2,3,4],mass:6000});assert.ok(p.position[1]!==20);assert.ok(p.velocity.every(Number.isFinite));});
