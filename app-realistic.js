import * as THREE from 'three';

const canvas = document.querySelector('#game');
const mini = document.querySelector('#minimap');
const miniCtx = mini.getContext('2d');
const statusEl = document.querySelector('#status');
const modeEl = document.querySelector('#mode');
const speedEl = document.querySelector('#speed');
const areaEl = document.querySelector('#area');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbdd4e6);
scene.fog = new THREE.Fog(0xbdd4e6, 500, 1800);

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled = true;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth/window.innerHeight, 0.1, 4000);

scene.add(new THREE.HemisphereLight(0xe6f6ff,0x55614d,1.8));
const sun = new THREE.DirectionalLight(0xffffff,2.2);
sun.position.set(250,500,180);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
 new THREE.PlaneGeometry(2200,2200),
 new THREE.MeshStandardMaterial({ color:0x6e9d62 })
);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

const buildingBoxes = [];
const roads = [];

function road(x1,z1,x2,z2,width=10) {
 const dx=x2-x1,dz=z2-z1;
 const len=Math.hypot(dx,dz);
 const mesh=new THREE.Mesh(
   new THREE.BoxGeometry(width,0.1,len),
   new THREE.MeshStandardMaterial({ color: width>9 ? 0x24282c : 0x32363a })
 );
 mesh.position.set((x1+x2)/2,0.05,(z1+z2)/2);
 mesh.rotation.y=Math.atan2(dx,dz);
 mesh.receiveShadow=true;
 scene.add(mesh);
 roads.push([[x1,z1],[x2,z2]]);
}

road(-500,-120,520,140,12);
road(-200,420,120,-420,11);
road(-540,60,560,-120,10);
road(-430,330,460,-340,8);
road(-300,-280,200,260,7);

function building(x,z,w,d,h,col=0xb9ad97) {
 const mesh = new THREE.Mesh(
   new THREE.BoxGeometry(w,h,d),
   new THREE.MeshStandardMaterial({ color:col })
 );
 mesh.position.set(x,h/2,z);
 mesh.castShadow=true;
 mesh.receiveShadow=true;
 scene.add(mesh);
 const roof = new THREE.Mesh(
   new THREE.BoxGeometry(w*0.96,0.5,d*0.96),
   new THREE.MeshStandardMaterial({ color:0x726b61 })
 );
 roof.position.set(x,h+0.25,z);
 scene.add(roof);
 buildingBoxes.push(new THREE.Box3().setFromObject(mesh));
}

for(let i=0;i<140;i++) {
 const x=(Math.random()-0.5)*1200;
 const z=(Math.random()-0.5)*1200;
 if(Math.abs(x)<70 && Math.abs(z)<70) continue;
 building(x,z,12+Math.random()*30,12+Math.random()*34,8+Math.random()*18,Math.random()>0.7?0xd3c1a3:0xb9ad97);
}

function tree(x,z,s=1){
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.4*s,.5*s,5*s),new THREE.MeshStandardMaterial({color:0x6b4323}));
 trunk.position.set(x,2.5*s,z);
 const leaves=new THREE.Mesh(new THREE.SphereGeometry(3.5*s,10,10),new THREE.MeshStandardMaterial({color:0x2d7c3b}));
 leaves.position.set(x,7*s,z);
 trunk.castShadow=leaves.castShadow=true;
 scene.add(trunk,leaves);
}
for(let i=0;i<180;i++) tree((Math.random()-0.5)*1500,(Math.random()-0.5)*1500,.6+Math.random()*0.5);

const player=new THREE.Mesh(
 new THREE.CapsuleGeometry(1,3,5,10),
 new THREE.MeshStandardMaterial({color:0x2457ff})
);
player.position.set(0,2.5,0);
player.castShadow=true;
scene.add(player);

const car=new THREE.Group();
const body=new THREE.Mesh(new THREE.BoxGeometry(4.8,1.4,8),new THREE.MeshStandardMaterial({color:0xcc2222}));
body.position.y=1.2;
const cabin=new THREE.Mesh(new THREE.BoxGeometry(3.5,1.2,3),new THREE.MeshStandardMaterial({color:0x263544,roughness:.15}));
cabin.position.set(0,2,-0.6);
car.add(body,cabin);
car.position.set(20,0,10);
car.traverse(o=>{if(o.isMesh)o.castShadow=true;});
scene.add(car);

const npcCars=[];
for(let i=0;i<8;i++) {
 const n=car.clone();
 n.children[0].material=n.children[0].material.clone();
 n.children[0].material.color.setHex([0x2e75b6,0xffffff,0x222222,0x1b8a5a][i%4]);
 n.position.set(-400+i*100,0,-50+i*30);
 npcCars.push(n);
 scene.add(n);
}

let inCar=false;
let heading=0;
let carSpeed=0;
let camYaw=Math.PI/4;

const keys=new Set();
window.addEventListener('keydown',e=>{
 keys.add(e.key.toLowerCase());
 if(e.key.toLowerCase()==='e') toggleVehicle();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));

canvas.addEventListener('click',()=>canvas.requestPointerLock?.());
window.addEventListener('mousemove',e=>{
 if(document.pointerLockElement!==canvas) return;
 camYaw-=e.movementX*0.003;
});

function collides(pos,radius=3){
 const box=new THREE.Box3(
  new THREE.Vector3(pos.x-radius,0,pos.z-radius),
  new THREE.Vector3(pos.x+radius,10,pos.z+radius)
 );
 return buildingBoxes.some(b=>b.intersectsBox(box));
}

function toggleVehicle(){
 if(!inCar && player.position.distanceTo(car.position)<10){
  inCar=true;
  player.visible=false;
  modeEl.textContent='Driving';
 } else if(inCar){
  inCar=false;
  player.visible=true;
  player.position.copy(car.position).add(new THREE.Vector3(8,2.5,0));
  modeEl.textContent='Walking';
 }
}

statusEl.textContent='Loaded realistic prototype with collisions';

function drawMini(target){
 miniCtx.fillStyle='rgba(10,15,20,.9)';
 miniCtx.fillRect(0,0,220,220);
 miniCtx.save();
 miniCtx.translate(110,110);
 miniCtx.scale(.12,.12);
 miniCtx.translate(-target.x,-target.z);
 miniCtx.strokeStyle='#f5d76e';
 miniCtx.lineWidth=18;
 roads.forEach(r=>{
  miniCtx.beginPath();
  miniCtx.moveTo(r[0][0],r[0][1]);
  miniCtx.lineTo(r[1][0],r[1][1]);
  miniCtx.stroke();
 });
 miniCtx.fillStyle='#9c8f7a';
 buildingBoxes.forEach(b=>{
  miniCtx.fillRect(b.min.x,b.min.z,b.max.x-b.min.x,b.max.z-b.min.z);
 });
 miniCtx.fillStyle='#ff3333';
 miniCtx.beginPath();
 miniCtx.arc(car.position.x,car.position.z,20,0,Math.PI*2);
 miniCtx.fill();
 miniCtx.fillStyle='#3377ff';
 miniCtx.beginPath();
 miniCtx.arc(player.position.x,player.position.z,16,0,Math.PI*2);
 miniCtx.fill();
 miniCtx.restore();
}

const clock=new THREE.Clock();
function animate(){
 const dt=Math.min(clock.getDelta(),0.033);
 const f=keys.has('w')||keys.has('arrowup');
 const b=keys.has('s')||keys.has('arrowdown');
 const l=keys.has('a')||keys.has('arrowleft');
 const r=keys.has('d')||keys.has('arrowright');
 const boost=keys.has('shift');

 if(inCar){
  if(f) carSpeed+=(boost?70:42)*dt;
  if(b) carSpeed-=(boost?70:42)*dt;
  carSpeed*=0.97;
  if(Math.abs(carSpeed)>0.4){
   if(l) car.rotation.y+=dt*1.5*Math.sign(carSpeed);
   if(r) car.rotation.y-=dt*1.5*Math.sign(carSpeed);
  }
  const dir=new THREE.Vector3(Math.sin(car.rotation.y),0,Math.cos(car.rotation.y));
  const next=car.position.clone().addScaledVector(dir,carSpeed*dt);
  if(!collides(next,3.2)) car.position.copy(next);
  else carSpeed*=-0.25;
 } else {
  if(l) heading+=dt*2.6;
  if(r) heading-=dt*2.6;
  const move=(f?1:0)-(b?1:0);
  const dir=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
  const next=player.position.clone().addScaledVector(dir,move*(boost?20:10)*dt);
  if(!collides(next,2)) player.position.copy(next);
  player.rotation.y=heading;
 }

 npcCars.forEach((n,i)=>{
  n.position.x+=Math.sin(performance.now()/3000+i)*0.2;
  n.position.z+=Math.cos(performance.now()/2600+i)*0.2;
 });

 const target=inCar?car.position:player.position;
 const cam=new THREE.Vector3(target.x+Math.sin(camYaw)*28,16,target.z+Math.cos(camYaw)*28);
 camera.position.lerp(cam,0.08);
 camera.lookAt(target.x,4,target.z);

 speedEl.textContent=Math.round(Math.abs(carSpeed)*1.2);
 areaEl.textContent=Math.hypot(target.x,target.z)<180?'Clarkston Toll':'Greater Clarkston';
 drawMini(target);
 renderer.render(scene,camera);
 requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize',()=>{
 renderer.setSize(window.innerWidth,window.innerHeight);
 camera.aspect=window.innerWidth/window.innerHeight;
 camera.updateProjectionMatrix();
});