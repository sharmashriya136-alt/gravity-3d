// Dimensionless sandbox units. Fixed-step velocity Verlet keeps the simulation
// independent of display refresh rate. Every body attracts every other body.
export const G = 1;
export const STEP = 1 / 120;
const SOFTENING = 0.16;
export function accelerations(bodies) {
  const result = bodies.map(() => [0, 0, 0]);
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const delta = bodies[j].position.map((v, k) => v - bodies[i].position[k]);
    const r2 = delta.reduce((sum, v) => sum + v * v, SOFTENING);
    const force = G / Math.pow(r2, 1.5);
    for (let k = 0; k < 3; k++) {
      result[i][k] += delta[k] * force * bodies[j].mass;
      result[j][k] -= delta[k] * force * bodies[i].mass;
    }
  }
  return result;
}
export function step(bodies, dt = STEP) {
  const before = accelerations(bodies);
  bodies.forEach((b, i) => b.position.forEach((_, k) => {
    b.position[k] += b.velocity[k] * dt + before[i][k] * dt * dt * 0.5;
  }));
  const after = accelerations(bodies);
  bodies.forEach((b, i) => b.velocity.forEach((_, k) => {
    b.velocity[k] += (before[i][k] + after[i][k]) * dt * 0.5;
  }));
  const events = [];
  for (let i = bodies.length - 1; i > 0; i--) for (let j = i - 1; j >= 0; j--) {
    const a = bodies[j], b = bodies[i];
    if (Math.hypot(...a.position.map((v, k) => v - b.position[k])) >= a.radius + b.radius) continue;
    const mass = a.mass + b.mass;
    a.position = a.position.map((v, k) => (v * a.mass + b.position[k] * b.mass) / mass);
    a.velocity = a.velocity.map((v, k) => (v * a.mass + b.velocity[k] * b.mass) / mass);
    a.mass = mass;
    a.radius = Math.cbrt(a.radius ** 3 + b.radius ** 3);
    bodies.splice(i, 1);
    events.push({ kept: a.id, removed: b.id });
    break;
  }
  return events;
}
export const STYLES = {
  ocean: {
    name: 'Earth-like world',
    color: '#71b9ef',
  },
  ice: {
    name: 'Uranus-like world',
    color: '#a0e9df',
  },
  gas: {
    name: 'Jupiter-like giant',
    color: '#e7be84',
  },
  violet: {
    name: 'Neptune-like giant',
    color: '#648bdf',
  },
  rock: {
    name: 'Moon-like world',
    color: '#b7bfce',
  },
  desert: {
    name: 'Mars-like world',
    color: '#dba076',
  },
  saturn: {
    name: 'Saturn-like giant',
    color: '#ddc99a',
  },
  venus: {
    name: 'Venus surface',
    color: '#db9865',
  },
};
export function orbitPlanet(id, name, style, distance, angle = 0, inclination = 0, sun = { position: [0,0,0], velocity: [0,0,0], mass: 6000 }) {
  const speed = Math.sqrt(G * sun.mass / distance);
  return { id, name, style, mass: 1.5, radius: style === 'gas' || style === 'violet' ? 2.8 : 1.8,
    position: [Math.cos(angle)*distance, Math.sin(angle)*Math.sin(inclination)*distance, Math.sin(angle)*Math.cos(inclination)*distance].map((v,k) => v + sun.position[k]),
    velocity: [-Math.sin(angle)*speed, Math.cos(angle)*Math.sin(inclination)*speed, Math.cos(angle)*Math.cos(inclination)*speed].map((v,k) => v + sun.velocity[k]), seed: id * 19.31 };
}
export function initialSystem() {
  return [{ id: 0, name: 'Helios', style: 'sun', mass: 6000, radius: 5.8, position: [0,0,0], velocity: [0,0,0], seed: 4 },
    orbitPlanet(1, 'Astra', 'ocean', 25, 0.7, 0.08),
    orbitPlanet(2, 'Eos', 'desert', 38, 3.1, -0.1),
    orbitPlanet(3, 'Aurelia', 'gas', 55, 4.6, 0.15),
    orbitPlanet(4, 'Nivis', 'ice', 72, 1.9, -0.06)];
}
export function validateSaved(data) {
  if (data?.version !== 1 || !Array.isArray(data.bodies) || data.bodies.length < 1 || data.bodies.length > 25) throw new Error('Invalid universe file.');
  const ids = new Set();
  for (const b of data.bodies) {
    if (!Number.isSafeInteger(b.id) || b.id < 0 || ids.has(b.id) || typeof b.name !== 'string' || !b.name.trim() || b.name.length > 32 || !(b.style in STYLES || b.style === 'sun')) throw new Error('Invalid planet.');
    ids.add(b.id);
    for (const field of ['position','velocity']) if (!Array.isArray(b[field]) || b[field].length !== 3 || !b[field].every(v=>Number.isFinite(v)&&Math.abs(v)<1e7)) throw new Error('Invalid coordinates.');
    if (![b.mass,b.radius,b.seed].every(Number.isFinite) || b.mass<=0 || b.mass>1e8 || b.radius<=0 || b.radius>1000) throw new Error('Invalid properties.');
  }
  if(data.bodies[0].style !== 'sun' || data.bodies.filter(b=>b.style==='sun').length !== 1) throw new Error('A universe needs one central star.');
  return structuredClone(data.bodies);
}
