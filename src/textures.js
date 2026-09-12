import * as THREE from 'three';
function hash(x,y,z) { const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; return n-Math.floor(n); }
function noise(x,y,z) {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  const smooth=v=>v*v*(3-2*v),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz);
  let value=0;
  for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)value+=hash(ix+a,iy+b,iz+c)*(a?u:1-u)*(b?v:1-v)*(c?w:1-w);
  return value;
}
// Sample a sphere in 3D to avoid visible longitude seams or stretched polar noise.
function makeProceduralTexture(style,seed=0) {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(canvas.width,canvas.height);
  const craters=Array.from({length:20},(_,i)=>{const h=hash(i,seed,8)*2-1,a=hash(i,seed,9)*Math.PI*2;return [Math.sqrt(1-h*h)*Math.cos(a),h,Math.sqrt(1-h*h)*Math.sin(a),.025+hash(i,seed,4)*.07];});
  for(let y=0;y<512;y++)for(let x=0;x<1024;x++){
    const lat=y/511*Math.PI,lon=x/1023*Math.PI*2;
    const px=Math.sin(lat)*Math.cos(lon),py=Math.cos(lat),pz=Math.sin(lat)*Math.sin(lon);
    const n=(f)=>noise(px*f+seed,py*f+seed*.3,pz*f-seed*.1);
    const broad=n(4),detail=n(22),fine=n(85),terrain=broad*.65+n(9)*.25+detail*.1;
    let rgb;
    if(style==='sun') { const v=.62+fine*.28+detail*.1;rgb=[255*v, (142+detail*70)*v, (20+fine*40)*v]; }
    else if(style==='ocean') {
      rgb=terrain>.52?[44+detail*62,90+detail*65,39+fine*30]:[8+detail*12,40+detail*30,95+detail*62];
      if(Math.abs(py)>.96-n(12)*.025)rgb=[211,226,235];
      const clouds=Math.max(0,(n(11)*.6+n(30)*.4-.59)*3.2);
      rgb=rgb.map(c=>c*(1-clouds)+235*clouds);
    }else if(style==='ice') {
      const crack=Math.abs(Math.sin(px*22+broad*10)+Math.cos(pz*24+py*13));
      rgb=crack<.07?[53,126,148]:[142+terrain*92,190+terrain*60,195+terrain*56];
    }else if(style==='gas'||style==='violet') {
      const bands=.5+.5*Math.sin(py*68+broad*7+detail*1.4),storm=Math.exp(-((px-.6)**2+(py-.18)**2*7+(pz-.65)**2)*60);
      rgb=style==='gas'?[158+bands*76,111+bands*77,70+bands*88]:[89+bands*105,67+bands*77,145+bands*90];
      rgb=rgb.map((c,i)=>c*(1-storm*.5)+(i===0?175:75)*storm*.5);
    }else {
      rgb=style==='rock'?[100+terrain*93,107+terrain*91,115+terrain*89]:[146+terrain*90,67+terrain*77,33+terrain*61];
      if(style==='rock') for(const [a,b,c,r] of craters){const d=Math.hypot(px-a,py-b,pz-c)/r;if(d<1.2){const shade=d<.78?.63:d<1?1.2:1;rgb=rgb.map(v=>v*shade);}}
      else {const dune=.93+.07*Math.sin(py*170+broad*15);rgb=rgb.map(v=>v*dune);}
      rgb=rgb.map(v=>v*(.92+fine*.15));
    }
    const i=(y*1024+x)*4;for(let k=0;k<3;k++)image.data[i+k]=rgb[k];image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}
export function makeGlow() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'#fff7d8');g.addColorStop(.18,'#ffdd95bb');g.addColorStop(.35,'#ff9b3838');g.addColorStop(1,'#ff7c0000');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
}
const textureLoader = new THREE.TextureLoader();

const planetMaps = {
  ocean: '2k_earth_daymap.jpg',
  ice: '2k_uranus.jpg',
  gas: '2k_jupiter.jpg',
  violet: '2k_neptune.jpg',
  rock: '2k_moon.jpg',
  desert: '2k_mars.jpg',
  saturn: '2k_saturn.jpg',
  venus: '2k_venus_surface.jpg',
};

export function loadSurfaceMap(filename, isColor = true) {
  const url = `${import.meta.env.BASE_URL}textures/${filename}`;

  const texture = textureLoader.load(
    url,
    undefined,
    () => {
      console.error(
        `Could not load ${filename}. Check your public/textures folder.`
      );
    }
  );

  texture.colorSpace = isColor
    ? THREE.SRGBColorSpace
    : THREE.NoColorSpace;

  texture.anisotropy = 4;
  return texture;
}

export function makeTexture(style, seed = 0) {
  const filename = planetMaps[style];

  if (filename) {
    return loadSurfaceMap(filename);
  }

  return makeProceduralTexture(style, seed);
}
