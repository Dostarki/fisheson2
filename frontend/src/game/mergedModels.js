import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cache=new Map();
export const actorMaterial=new THREE.MeshLambertMaterial({vertexColors:true});
function colored(geometry,color){const c=new THREE.Color(color),arr=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<arr.length;i+=3){arr[i]=c.r;arr[i+1]=c.g;arr[i+2]=c.b;}geometry.setAttribute('color',new THREE.BufferAttribute(arr,3));return geometry;}
function merge(parts){const result=mergeGeometries(parts);parts.forEach(p=>p.dispose());result.computeBoundingSphere();return result;}
function builder(){const parts=[];return {parts,box(at,size,color,rotation=[0,0,0],parent){const g=colored(new THREE.BoxGeometry(...size),color);g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(1,1,1)));if(parent)g.applyMatrix4(parent);parts.push(g);},add(g,color,at=[0,0,0],rotation=[0,0,0]){colored(g,color);g.rotateX(rotation[0]);g.rotateY(rotation[1]);g.rotateZ(rotation[2]);g.translate(...at);parts.push(g);}};}
const compose=(at,rot)=>new THREE.Matrix4().compose(new THREE.Vector3(...at),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(1,1,1));
const ARM=compose([.31,.6,.08],[-.55,0,.15]);
const HAND=new THREE.Vector3().setFromMatrixPosition(ARM.clone().multiply(compose([0,-.23,.06],[0,0,0])));
// Rod leaves the hand pointing forward (+z) and up; Workers.jsx animates it around ROD_PIVOT.
const ROD_BASE=compose(HAND.toArray(),[.96,0,-.08]);
export const ROD_PIVOT=HAND.toArray();
export const ROD_TIP=new THREE.Vector3(0,1.29,0).applyMatrix4(ROD_BASE).sub(HAND).toArray();
export const NET_TIP=new THREE.Vector3(0,1.38,0).applyMatrix4(ROD_BASE).sub(HAND).toArray();

export function bucketGeometry(filled=false){
  const key=`bucket:${filled}`;if(cache.has(key))return cache.get(key);
  const b=builder();b.add(new THREE.CylinderGeometry(.18,.14,.3,6),'#4fa3b5',[0,.15,0]);b.add(new THREE.TorusGeometry(.162,.018,3,6),'#e3f2f0',[0,.31,0],[Math.PI/2,0,0]);
  if(filled){b.box([.03,.32,0],[.06,.05,.24],'#7fd3f0',[0,.5,.3]);b.box([-.06,.32,.03],[.07,.07,.2],'#ffb347');}
  const geo=merge(b.parts);cache.set(key,geo);return geo;
}

const HAT={boat:['#f4f1e2','#f2b632'],yacht:['#ffffff','#2a6ad6'],sub:['#2b3a4a','#ffd23f'],flagship:['#1c2d4f','#f2c94c'],mothership:['#3b1f5e','#ffd23f']};
export function fisherGeometry(color,kind,pose){
  const key=`fisher:${color}:${kind}:${pose}`;if(cache.has(key))return cache.get(key);
  const b=builder();const hat=HAT[kind]||[color,'#fff1d6'];
  b.box([-.14,.12,.01],[.2,.25,.3],'#2c3f5c');b.box([.14,.12,.01],[.2,.25,.3],'#2c3f5c');
  b.box([0,.49,0],[.52,.55,.35],color);b.box([0,.31,-.19],[.4,.11,.05],'#ffd08a');
  b.box([0,.9,0],[.4,.4,.36],'#f2c094');b.box([0,1.12,0],[.48,.19,.43],hat[0]);
  b.box([0,1.25,0],[.15,.13,.15],hat[1]);b.box([0,.75,.2],[.35,.13,.08],'#f1ece0');
  b.box([-.1,.94,.188],[.045,.05,.03],'#1d2d44');b.box([.1,.94,.188],[.045,.05,.03],'#1d2d44');b.box([0,.87,.22],[.1,.08,.08],'#e58f6a');
  b.box([-.33,.51,.05],[.15,.45,.18],color,[-.28,0,-.06]);
  b.box([0,-.1,.02],[.15,.36,.18],color,[0,0,0],ARM);b.box([0,-.3,.02],[.14,.13,.15],'#f2c094',[0,0,0],ARM);
  if(pose==='carry'||pose==='shopping'){const g=bucketGeometry(true).clone();g.translate(.42,.2,.1);b.parts.push(g);}
  const geo=merge(b.parts);cache.set(key,geo);return geo;
}

export function rodGeometry(kind){
  const key=`rod:${kind}`;if(cache.has(key))return cache.get(key);
  const b=builder();
  b.box([0,.59,0],[.045,1.4,.045],'#a8682f',[0,0,0],ROD_BASE);b.box([0,-.02,0],[.07,.3,.07],'#4a3521',[0,0,0],ROD_BASE);
  if(kind==='net'){const g=colored(new THREE.TorusGeometry(.36,.022,4,8),'#ffcf6e');g.translate(0,1.38,0);g.applyMatrix4(ROD_BASE);b.parts.push(g);b.box([0,1.38,0],[.6,.6,.01],'#bff3ea',[0,0,0],ROD_BASE);}
  else{b.box([0,.2,-.07],[.09,.09,.09],'#ff3b3b',[0,0,0],ROD_BASE);for(let i=0;i<4;i++)b.box([0,.45+i*.26,.03],[.07,.03,.07],'#e8e2d2',[0,0,0],ROD_BASE);}
  const geo=merge(b.parts);geo.translate(-ROD_PIVOT[0],-ROD_PIVOT[1],-ROD_PIVOT[2]);cache.set(key,geo);return geo;
}

export function hammockGeometry(){
  if(cache.has('hammock'))return cache.get('hammock');const b=builder();
  [-1,1].forEach(s=>{b.box([s*1.0,.55,0],[.12,1.1,.12],'#8a5a2b');b.box([s*1.0,1.12,0],[.18,.06,.18],'#c99a5e');b.box([s*.85,.82,0],[.48,.03,.03],'#f1e2c0',[0,0,s*.93]);});
  const stripes=['#ff5d73','#ffd23f','#3ec1d3','#ffd23f','#ff5d73'];
  stripes.forEach((c,i)=>{const x=-.56+i*.28;b.box([x,.62-.12*(1-(x/.7)**2),0],[.29,.05,.6],c);});
  const geo=merge(b.parts);cache.set('hammock',geo);return geo;
}

export function boatGeometry(){
  if(cache.has('boat'))return cache.get('boat');const b=builder();
  b.box([0,.05,0],[.95,.2,1.8],'#7a4a2c');b.box([-.53,.25,0],[.14,.38,1.8],'#d9773b');b.box([.53,.25,0],[.14,.38,1.8],'#d9773b');
  b.box([0,.25,-.94],[1.2,.38,.18],'#d9773b');b.box([0,.23,1],[.7,.3,.4],'#d9773b',[0,Math.PI/4,0]);
  b.box([0,.31,.45],[1,.08,.18],'#ffd08a');b.box([.69,.39,-.1],[.07,.06,2.4],'#e8b878',[0,.28,0]);
  b.box([-.53,.47,0],[.16,.06,1.82],'#ffffff');b.box([.53,.47,0],[.16,.06,1.82],'#ffffff');
  const geo=merge(b.parts);cache.set('boat',geo);return geo;
}

function yachtGeometry(){
  const b=builder();
  b.box([0,.02,0],[1.2,.2,3.2],'#1d3557');b.box([0,.22,0],[1.4,.36,3.4],'#f8f8f4');b.box([0,.22,1.75],[1.0,.36,1.0],'#f8f8f4',[0,Math.PI/4,0]);
  b.box([0,.26,0],[1.44,.08,3.0],'#2a6ad6');b.box([0,.42,0],[1.3,.06,3.2],'#e9dcc0');
  [-1,1].forEach(s=>{b.box([s*.66,.55,.5],[.05,.2,2.0],'#ffffff');b.box([s*.66,.66,.5],[.07,.04,2.0],'#ffffff');});
  b.box([0,.72,-.95],[1.1,.56,1.3],'#f8f8f4');b.box([0,.78,-.95],[1.14,.2,.9],'#5ad1ff');b.box([0,1.03,-.95],[1.22,.08,1.42],'#f0f0ea');
  b.box([0,1.28,-1.15],[.06,.42,.06],'#9aa4b0');b.box([0,1.5,-1.15],[.55,.05,.1],'#e9eef3');b.box([-.3,1.45,-.6],[.08,.75,.08],'#9aa4b0');b.box([-.3,1.8,-.5],[.42,.22,.03],'#2a6ad6');
  return merge(b.parts);
}
function subGeometry(){
  const b=builder();const hull='#3b4a5c',dark='#2b3745';
  b.add(new THREE.CylinderGeometry(.6,.6,3.6,8),hull,[0,0,0],[Math.PI/2,0,0]);
  b.add(new THREE.CylinderGeometry(.25,.6,.7,8),hull,[0,0,2.15],[Math.PI/2,0,0]);b.add(new THREE.CylinderGeometry(.6,.25,.7,8),hull,[0,0,-2.15],[Math.PI/2,0,0]);
  b.box([0,.45,0],[.5,.12,3.0],dark);b.box([0,.2,0],[1.26,.06,2.6],'#ffd23f');
  b.box([0,.35,0],[.9,.4,1.3],dark);b.box([0,.56,0],[.8,.04,1.2],'#4a5a6c');
  b.box([.3,.9,-.4],[.06,.7,.06],'#9aa4b0');b.box([.3,1.26,-.3],[.1,.08,.28],'#9aa4b0');b.box([-.25,.8,-.5],[.05,.5,.05],'#9aa4b0');
  [-1,1].forEach(s=>b.box([s*.55,0,-1.9],[.6,.08,.5],dark));b.box([0,.5,-2.1],[.08,.5,.45],dark);
  b.add(new THREE.TorusGeometry(.22,.05,4,6),'#c9a24a',[0,0,-2.55]);
  [-.9,.3,1.1].forEach(z=>b.box([.56,.12,z],[.12,.12,.2],'#8fd7ff'));
  return merge(b.parts);
}
function flagshipGeometry(){
  const b=builder();const steel='#7d8795',light='#9aa4b0';
  b.box([0,.05,0],[1.9,.2,4.9],'#5a3a3a');b.box([0,.3,0],[2.0,.5,5.0],steel);b.box([0,.3,2.6],[1.42,.5,1.42],steel,[0,Math.PI/4,0]);
  b.box([0,.57,0],[1.9,.06,4.8],light);b.box([0,.42,0],[2.04,.06,4.6],'#f2c94c');
  [-1,1].forEach(s=>{b.box([s*.96,.7,.8],[.05,.22,2.6],'#d5dbe2');b.box([s*.96,.82,.8],[.07,.04,2.6],'#d5dbe2');});
  b.box([0,.95,-1.2],[1.3,.7,1.6],'#8e98a6');b.box([0,1.45,-1.2],[1.0,.3,1.0],light);b.box([0,1.45,-.72],[.9,.15,.08],'#5ad1ff');
  b.box([0,1.6,-1.7],[.46,.9,.46],'#3a4552');b.box([0,1.98,-1.7],[.5,.14,.5],'#d9342b');
  b.box([0,2.0,-.9],[.06,1.1,.06],light);b.box([.28,2.42,-.9],[.5,.3,.04],'#d9342b');b.box([.28,2.42,-.9],[.5,.1,.045],'#f2c94c');
  b.box([0,.72,1.3],[.8,.3,.8],'#6b7584');[-.15,.15].forEach(x=>b.box([x,.8,1.95],[.08,.08,.9],'#3a4552'));
  [-.5,.5].forEach(x=>b.box([x,1.0,-2.3],[.3,.3,.3],'#6b7584'));
  return merge(b.parts);
}
function mothershipGeometry(){
  const b=builder();const hull='#4a2a7a',gold='#f2c94c',deep='#2d1650';
  b.box([0,.05,0],[2.3,.2,5.5],deep);b.box([0,.35,0],[2.4,.6,5.6],hull);b.box([0,.35,2.9],[1.7,.6,1.7],hull,[0,Math.PI/4,0]);
  b.box([0,.67,0],[2.3,.06,5.4],'#6a4a9a');b.box([0,.5,0],[2.44,.08,5.2],gold);
  [-1,1].forEach(s=>{b.box([s*1.16,.82,.9],[.05,.24,3.0],gold);});
  b.box([0,1.1,-1.4],[1.6,.8,1.9],'#5a3a8a');b.box([0,1.7,-1.4],[1.2,.4,1.2],'#6a4a9a');b.box([0,1.7,-.82],[1.1,.18,.08],'#ffd23f');
  [-.45,.45].forEach(x=>{b.box([x,1.9,-2.1],[.4,1.0,.4],deep);b.box([x,2.3,-2.1],[.44,.14,.44],gold);});
  b.box([0,2.4,-1.0],[.06,1.4,.06],gold);b.box([.3,2.95,-1.0],[.56,.34,.04],'#8a4bd6');b.box([.3,2.95,-1.0],[.56,.1,.045],gold);
  b.box([0,.85,1.5],[1.0,.36,1.0],'#5a3a8a');[-.2,.2].forEach(x=>b.box([x,.95,2.25],[.1,.1,1.1],deep));
  return merge(b.parts);
}
const VESSELS={boat:boatGeometry,yacht:yachtGeometry,sub:subGeometry,flagship:flagshipGeometry,mothership:mothershipGeometry};
export function vesselGeometry(kind='boat'){
  const key=`vessel:${kind}`;if(cache.has(key))return cache.get(key);
  const geo=(VESSELS[kind]||boatGeometry)();cache.set(key,geo);return geo;
}
