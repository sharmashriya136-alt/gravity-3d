import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STYLES, initialSystem, orbitPlanet, step, STEP, validateSaved } from './physics.js';
import {
  makeTexture,
  makeGlow,
  loadSurfaceMap,
} from './textures.js';
import './style.css';

const $ = id => document.getElementById(id);
const viewport = $('viewport');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
catch { $('loading').textContent = '3D needs WebGL 2. Try a current browser with hardware acceleration enabled.'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor('#050810');renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
renderer.domElement.setAttribute('aria-label','3D space. Drag to rotate, scroll to zoom. Use the world list to select planets.');
renderer.domElement.tabIndex=0;
viewport.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,.025,10000);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=1;controls.maxDistance=650;
const ambient=new THREE.AmbientLight('#b6c7ef',.24);scene.add(ambient);
const sunLight=new THREE.PointLight('#fff2de',3,0,0);scene.add(sunLight);
let bodies=initialSystem(),selectedId=null,following=false,paused=false,speed=1,accumulator=0,nextId=5,styleCursor=0;
let fly=null,lastTime=performance.now(),trailClock=0,toastTimer;
const visuals=new Map(),sphere=new THREE.SphereGeometry(1,80,48),raycaster=new THREE.Raycaster();
const v3=a=>new THREE.Vector3(...a);
// GALAXY BACKGROUND
const skyLoader = new THREE.TextureLoader();

skyLoader.load(
  `${import.meta.env.BASE_URL}textures/8k_stars_milky_way.jpg`,
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    scene.background = texture;
    scene.backgroundIntensity = 0.9;
    scene.backgroundBlurriness = 0;

    // Tilt the Milky Way across the sky.
    scene.backgroundRotation.set(0.3, 0.8, 0.25);
  },
  undefined,
  () => {
    console.error(
      'Background missing: check public/textures/8k_stars_milky_way.jpg'
    );
  }
);

// SOFT STAR GLOW
const starCanvas = document.createElement('canvas');
starCanvas.width = starCanvas.height = 64;

const starContext = starCanvas.getContext('2d');
const starGlow = starContext.createRadialGradient(
  32, 32, 0,
  32, 32, 32
);

starGlow.addColorStop(0, 'rgba(255,255,255,1)');
starGlow.addColorStop(0.1, 'rgba(255,255,255,0.95)');
starGlow.addColorStop(0.25, 'rgba(255,255,255,0.35)');
starGlow.addColorStop(0.55, 'rgba(255,255,255,0.08)');
starGlow.addColorStop(1, 'rgba(255,255,255,0)');

starContext.fillStyle = starGlow;
starContext.fillRect(0, 0, 64, 64);

const starTexture = new THREE.CanvasTexture(starCanvas);
const brightStars = new THREE.Group();
scene.add(brightStars);

function addStarLayer(count, size, opacity) {
  const positions = [];
  const colors = [];

  const palette = [
    new THREE.Color('#fff5df'),
    new THREE.Color('#d0e5ff'),
    new THREE.Color('#ffd29a'),
    new THREE.Color('#ffffff'),
  ];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const height = Math.random() * 2 - 1;
    const spread = Math.sqrt(1 - height * height);
    const distance = 3500;

    positions.push(
      Math.cos(angle) * spread * distance,
      height * distance,
      Math.sin(angle) * spread * distance
    );

    const color = palette[i % palette.length];
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );

  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  );

  const material = new THREE.PointsMaterial({
    map: starTexture,
    size,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  brightStars.add(new THREE.Points(geometry, material));
}

// Many small lights, fewer bright stars.
addStarLayer(900, 3, 0.65);
addStarLayer(160, 7, 0.85);
addStarLayer(35, 13, 1);
function notice(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3800);}
function chosen(){return bodies.find(b=>b.id===selectedId);}
function makeVisual(b){
  const texture=makeTexture(b.style,b.seed);
  const material=b.style==='sun'?new THREE.MeshBasicMaterial({map:texture,color:'#ffd896'}):new THREE.MeshStandardMaterial({map:texture,roughness:b.style==='ocean'?.65:.95,metalness:0});
  const mesh=new THREE.Mesh(sphere,material);mesh.userData.id=b.id;mesh.position.fromArray(b.position);mesh.scale.setScalar(b.radius);scene.add(mesh);
  const label=document.createElement('span');label.className='planet-label';label.textContent=b.name;$('labels').append(label);
  const trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:STYLES[b.style]?.color||'#ffce79',transparent:true,opacity:.42}));scene.add(trail);
  const extras=[];
  // A separate cloud layer above Earth's surface.
if (b.style === 'ocean') {
  const clouds = new THREE.Mesh(
    sphere,
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      alphaMap: loadSurfaceMap('2k_earth_clouds.jpg', false),
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      roughness: 1,
    })
  );

  clouds.scale.setScalar(1.012);
  mesh.add(clouds);
  extras.push(clouds);
}

// Saturn's rings are real geometry around the sphere.
if (b.style === 'saturn') {
  const innerRadius = 1.35;
  const outerRadius = 2.35;

  const ringGeometry = new THREE.RingGeometry(
    innerRadius,
    outerRadius,
    192
  );

  const positions = ringGeometry.attributes.position;
  const uv = ringGeometry.attributes.uv;

  // Map the ring image from the inner edge to the outer edge.
  for (let i = 0; i < positions.count; i++) {
    const radius = Math.hypot(
      positions.getX(i),
      positions.getY(i)
    );

    uv.setXY(
      i,
      (radius - innerRadius) / (outerRadius - innerRadius),
      0.5
    );
  }

  uv.needsUpdate = true;

  const rings = new THREE.Mesh(
    ringGeometry,
    new THREE.MeshStandardMaterial({
      map: loadSurfaceMap('2k_saturn_ring_alpha.png'),
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.02,
      roughness: 1,
      metalness: 0,
    })
  );

  rings.rotation.x = -Math.PI / 2 + THREE.MathUtils.degToRad(26);

  mesh.add(rings);
  extras.push(rings);
}
  if(b.style==='sun'){
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:makeGlow(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));glow.scale.set(5.5,5.5,1);mesh.add(glow);extras.push(glow);
  }else if(b.style==='ocean'||b.style==='ice'){
    const atmosphere=new THREE.Mesh(sphere,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
      uniforms:{tint:{value:new THREE.Color(b.style==='ice'?'#8cf4df':'#73aaff')}},
      vertexShader:'varying vec3 n; varying vec3 view; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal);view=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader:'uniform vec3 tint; varying vec3 n; varying vec3 view; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(view))),3.);gl_FragColor=vec4(tint,rim*.38);}'
    }));atmosphere.scale.setScalar(1.025);mesh.add(atmosphere);extras.push(atmosphere);
  }
  visuals.set(b.id,{mesh,label,trail,points:[],texture,extras});
}
function removeVisual(id){
  const v=visuals.get(id);if(!v)return;scene.remove(v.mesh,v.trail);v.label.remove();v.mesh.material.dispose();v.texture.dispose();v.trail.geometry.dispose();v.trail.material.dispose();
  for (const e of v.extras) {
    e.material.map?.dispose();
    e.material.alphaMap?.dispose();
    e.material.dispose();
  
    // Ring geometry is unique; planet sphere geometry is shared.
    if (e.geometry && e.geometry !== sphere) {
      e.geometry.dispose();
    }
  }
  
  visuals.delete(id);
}
function rebuildList(){
  $('body-list').replaceChildren();$('count').textContent=`${bodies.length-1} / 24`;$('add').disabled=bodies.length>=25;
  for(const b of bodies){
    const button=document.createElement('button');button.className='body-item';button.dataset.id=b.id;button.setAttribute('aria-pressed',String(b.id===selectedId));
    const dot=document.createElement('span');dot.className='dot';dot.style.background=STYLES[b.style]?.color||'#ffd27d';
    const name=document.createElement('span');name.className='name';name.textContent=b.name;button.append(dot,name);
    button.onclick=()=>select(b.id);$('body-list').append(button);
  }
}
function select(id){
  const b=bodies.find(b=>b.id===id);if(!b)return;
  selectedId=id;following=false;fly=null;controls.enablePan=true;controls.minDistance=.5;
  $('inspector').hidden=false;$('planet-name').value=b.name;$('edit-style').disabled=b.style==='sun';$('edit-style').value=b.style==='sun'?'ocean':b.style;
  $('destroy').disabled=b.style==='sun';$('type-label').textContent=b.style==='sun'?'CENTRAL STAR':STYLES[b.style].name.toUpperCase();
  $('planet-info').textContent=b.style==='sun'?'The central star anchors this sandbox. It can be renamed, but not destroyed.':'Explore close-up follows this world as it moves. Scroll to approach its surface.';
  rebuildList();
}
function focus(){
  const b=chosen();if(!b)return;
  const sun=bodies.find(p=>p.style==='sun');
  const direction=b.style==='sun'?new THREE.Vector3(1,.35,1):v3(sun.position).sub(v3(b.position)).normalize().add(new THREE.Vector3(.2,.28,.25)).normalize();
  const distance=b.radius*3.6;
  fly={fromCamera:camera.position.clone(),fromTarget:controls.target.clone(),offset:direction.multiplyScalar(distance),start:performance.now()};
  following=true;controls.enablePan=false;controls.minDistance=b.radius*1.1;controls.maxDistance=650;
  document.body.classList.add('exploring');$('view-caption').textContent='Drag to orbit this world · Scroll to approach the surface · All worlds to return';
}
function home(top=false){
  following=false;fly=null;controls.enablePan=true;controls.minDistance=1;document.body.classList.remove('exploring');
  const center=v3(bodies[0].position),extent=Math.max(80,...bodies.map(b=>v3(b.position).distanceTo(center)+b.radius));
  const dist=Math.min(570,extent*2.7);
  controls.target.copy(center);camera.position.copy(center).add(top?new THREE.Vector3(0,dist,.01):new THREE.Vector3(dist*.65,dist*.53,dist*.8));controls.update();
  $('view-caption').textContent='Drag to orbit · Scroll to zoom · Click a planet to select';
}
function resize(){const {width,height}=viewport.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport);resize();
const styleOptions=()=>Object.entries(STYLES).map(([value,s])=>{const o=document.createElement('option');o.value=value;o.textContent=s.name;return o;});
$('edit-style').append(...styleOptions());
const auto=document.createElement('option');auto.value='auto';auto.textContent='Surprise me — varied worlds';$('new-style').append(auto,...styleOptions());
$('rename-form').onsubmit=e=>{e.preventDefault();const b=chosen(),name=$('planet-name').value.trim();if(!b||!name){notice('Enter a name first.');return;}b.name=name.slice(0,32);visuals.get(b.id).label.textContent=b.name;rebuildList();notice(`Named ${b.name}. Save universe to keep your changes.`);};
$('edit-style').onchange=()=>{const b=chosen();if(!b||b.style==='sun')return;const wasFollowing=following;b.style=$('edit-style').value;removeVisual(b.id);makeVisual(b);select(b.id);if(wasFollowing)focus();notice('Surface updated.');};
$('close-up').onclick=focus;$('home').onclick=()=>home();$('top').onclick=()=>home(true);
function zoom(factor){const offset=camera.position.clone().sub(controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();}
$('zoom-in').onclick=()=>zoom(.72);$('zoom-out').onclick=()=>zoom(1.4);
function confirmAction(title,copy,action){$('confirm-title').textContent=title;$('confirm-copy').textContent=copy;const dialog=$('confirm-dialog');dialog.returnValue='';dialog.onclose=()=>{if(dialog.returnValue==='confirm')action();};dialog.showModal();}
$('destroy').onclick=()=>{const b=chosen();if(!b||b.style==='sun')return;confirmAction(`Destroy ${b.name}?`,'This removes the planet from the current simulation. Your last saved universe is unchanged.',()=>{removeVisual(b.id);bodies=bodies.filter(p=>p.id!==b.id);selectedId=null;$('inspector').hidden=true;home();rebuildList();notice(`${b.name} destroyed.`);});};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';$('state').textContent=paused?'Simulation paused':'Simulation live';accumulator=0;};
$('speed').oninput=()=>{speed=Number($('speed').value);$('speed-value').textContent=`${speed.toFixed(1)}×`;};
$('trails').onchange=()=>visuals.forEach(v=>v.trail.visible=$('trails').checked);
$('show-labels').onchange=()=>{$('labels').hidden=!$('show-labels').checked;};
$('add').onclick=()=>{
  if(bodies.length>=25){notice('Maximum 24 planets. Destroy one to make room.');return;}
  const style=$('new-style').value==='auto'?Object.keys(STYLES)[styleCursor++ % Object.keys(STYLES).length]:$('new-style').value;
  const distance=28+(nextId%7)*8,angle=nextId*2.39996,inclination=Math.sin(nextId)*.27;
  const b=orbitPlanet(nextId,`World ${nextId}`,style,distance,angle,inclination,bodies[0]);nextId++;
  // Avoid spawning inside an existing sphere.
  for(let i=0;i<20&&bodies.some(p=>v3(p.position).distanceTo(v3(b.position))<p.radius+b.radius+2);i++){
    Object.assign(b,orbitPlanet(b.id,b.name,style,distance+i*3+3,angle+i*.33,inclination,bodies[0]));
  }
  bodies.push(b);makeVisual(b);select(b.id);focus();notice(`${STYLES[style].name} created.`);
};
function replaceSystem(next){for(const id of [...visuals.keys()])removeVisual(id);bodies=next;nextId=Math.max(...bodies.map(b=>b.id))+1;selectedId=null;following=false;accumulator=0;$('inspector').hidden=true;for(const b of bodies)makeVisual(b);rebuildList();home();}
$('reset').onclick=()=>confirmAction('Reset your universe?','This replaces the current system with the starting worlds. Your saved universe is unchanged.',()=>replaceSystem(initialSystem()));
$('save-system').onclick=()=>{try{localStorage.setItem('gravity-3d-v1',JSON.stringify({version:1,bodies}));notice('Universe saved on this browser.');}catch{notice('Could not save. Browser storage may be unavailable or full.');}};
$('load-system').onclick=()=>{
  let next;try{const raw=localStorage.getItem('gravity-3d-v1');if(!raw){notice('No saved universe yet.');return;}next=validateSaved(JSON.parse(raw));}catch{notice('Could not load the saved universe.');return;}
  confirmAction('Load your saved universe?','This replaces the current unsaved system.',()=>{replaceSystem(next);notice('Saved universe loaded.');});
};
let pointerStart=null;
renderer.domElement.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{
  if(e.button!==0||!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)return;
  const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
  const hit=raycaster.intersectObjects([...visuals.values()].map(v=>v.mesh),false)[0];if(hit)select(hit.object.userData.id);
});
renderer.domElement.addEventListener('dblclick',()=>{if(chosen())focus();});
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)||$('confirm-dialog').open)return;if(e.code==='Space'){e.preventDefault();$('pause').click();}if(e.key.toLowerCase()==='f')focus();if(e.key==='Escape')home();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;$('loading').hidden=false;$('loading').textContent='The graphics context was lost. Reload to restart; saved worlds are kept.';});

function animate(now){
  requestAnimationFrame(animate);const delta=Math.min((now-lastTime)/1000,.05);lastTime=now;
  const before=following&&chosen()?v3(chosen().position):null;
  if(!paused){accumulator+=delta*speed;while(accumulator>=STEP){
    const events=step(bodies);accumulator-=STEP;
    for(const event of events){removeVisual(event.removed);const kept=visuals.get(event.kept);kept.points=[];if(selectedId===event.removed){selectedId=event.kept;select(selectedId);}rebuildList();notice('Two bodies collided and merged.');}
  }}
  sunLight.position.fromArray(bodies[0].position);
  trailClock+=delta;
  for(const b of bodies){const v=visuals.get(b.id);v.mesh.position.fromArray(b.position);v.mesh.scale.setScalar(b.radius);if(!paused)v.mesh.rotation.y+=delta*.035;
    v.trail.visible=$('trails').checked;
    if(trailClock>.06&&!paused&&b.style!=='sun'){v.points.push(v3(b.position));if(v.points.length>600)v.points.shift();v.trail.geometry.dispose();v.trail.geometry=new THREE.BufferGeometry().setFromPoints(v.points);}
  }
  if(trailClock>.06)trailClock=0;
  const b=chosen();
  if(following&&b){const target=v3(b.position);controls.minDistance=b.radius*1.1;
    if(fly){const t=Math.min(1,(now-fly.start)/950),s=t*t*(3-2*t);camera.position.lerpVectors(fly.fromCamera,target.clone().add(fly.offset),s);controls.target.lerpVectors(fly.fromTarget,target,s);if(t===1)fly=null;}
    else{if(before)camera.position.add(target.clone().sub(before));controls.target.copy(target);}
  }
  controls.update();camera.updateMatrixWorld();
  const w=viewport.clientWidth,h=viewport.clientHeight;
  for(const body of bodies){const v=visuals.get(body.id),p=v.mesh.position.clone().add(new THREE.Vector3(0,body.radius*1.4,0)).project(camera);v.label.hidden=p.z>1||p.z< -1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1;v.label.style.left=`${(p.x*.5+.5)*w}px`;v.label.style.top=`${(-p.y*.5+.5)*h}px`;v.label.classList.toggle('selected',body.id===selectedId);}
  brightStars.position.copy(camera.position);
  renderer.render(scene,camera);
}
// Let the loading message paint before generating the procedural textures.
setTimeout(()=>{try{for(const b of bodies)makeVisual(b);rebuildList();home();$('loading').hidden=true;lastTime=performance.now();requestAnimationFrame(animate);}catch(error){$('loading').textContent='Unable to start the scene. Check the browser console for details.';console.error(error);}},30);
