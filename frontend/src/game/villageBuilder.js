/* Deterministic, hand-laid voxel assets; batched into a handful of GPU draw calls. */
export const seeded = n => { const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x); };
export const riverX = z => -6.5+Math.sin(z*.18)*.85;
export const shoreZ = x => 11.3+Math.sin(x*.24)*1.2;
const LAKES=[[-6.5,-36,9,6],[27,-21,6.5,4.5],[-30,-14,5,3.5]];
export const inLake=(x,z,pad=0)=>LAKES.some(([cx,cz,rx,rz])=>((x-cx)/(rx+pad))**2+((z-cz)/(rz+pad))**2<1);
const inOld=(x,z)=>x>=-18&&x<18&&z>=-16&&z<14;
export function buildVillage() {
  const blocks=[], lights=[], lamps=[];
  const box=(x,y,z,w,h,d,color,r=0)=>blocks.push({x,y,z,w,h,d,color,r});
  const glow=(x,y,z,w,h,d,color)=>lights.push({x,y,z,w,h,d,color});
  const shine=(x,y,z,s,light=false,extra={})=>lamps.push({x,y,z,s,light,...extra});
  const snow=['#e8e7e9','#eee8e6','#e5e5ea','#eeeae5'];
  // Individual coastline tiles create irregular shores, rather than a floating square.
  for(let x=-45;x<45;x++)for(let z=-45;z<14;z++){
    const center=riverX(z), coast=shoreZ(x), river=z>-36;
    if(z>coast||x<-44+Math.sin(z*.25)*1.5||x>43+Math.sin(z*.32)||z<-44+Math.sin(x*.21)*1.3||(river&&Math.abs(x-center)<1.65)||inLake(x,z))continue;
    const n=seeded(x*52+z), edge=(river&&Math.abs(x-center)<2.8)||z>coast-1.5||x>41.5||x<-42.5||z<-42.3||inLake(x,z,1.3);
    box(x,.26,z,1.04,1.38,1.04,edge?'#5f9fb0':'#7fb0a6');
    box(x,.96,z,1.04,.15,1.04,snow[Math.floor(n*4)]);
    if(edge){box(x,.13,z,1.1,.3,1.1,'#aec7c5');if(n>.65)box(x,.53,z,.84,.2,.83,'#c1cfcd');}
    if(n>.9&&!edge)box(x,1.06,z,.55,.06,.35,'#f3eeee');
  }
  function path(x,z,w,d){
    box(x,1.045,z,w,.05,d,'#c2bbaf');
    for(let a=-w/2+.22;a<w/2;a+=.48)for(let b=-d/2+.22;b<d/2;b+=.48){const n=seeded((x+a)*71+z+b);box(x+a,1.078,z+b,.445,.018,.445,n>.7?'#d4c8b6':n>.3?'#c8c2b8':'#b9b9b0');}
  }
  path(7.1,-.2,1.5,24);path(4.9,5.65,19.3,1.45);path(4.9,-5.5,20,1.4);path(-2.6,-1.8,1.25,13.2);path(1.5,1.6,8.7,6.4);path(-12,-1.5,1.25,18);
  function pine(x,z,scale=1){
    const y=1.02;box(x,y+.8*scale,z,.29*scale,1.6*scale,.29*scale,'#745b54');
    for(let i=0;i<8;i++){const width=(2.08-i*.22)*scale;const level=y+1.0*scale+i*.32*scale;
      box(x,level,z,width,.28*scale,width,i%3===0?'#47786e':'#d8dfe3');
      box(x,level+.15*scale,z,width+.03,.12*scale,width+.03,i%2?'#e9e8ea':'#e3e5e9');
    }
    box(x,y+3.52*scale,z,.2*scale,.35*scale,.2*scale,'#eee9e8');
  }
  function pinkTree(x,z,scale=1){
    box(x,1.92,z,.24,1.8,.25,'#816259');box(x+.22,2.58,z,.67,.18,.15,'#816259');
    const c=['#dca2b4','#e9b6c0','#efc5c8','#ca96ae'];
    [[0,0,0,1.55],[.54,.1,.12,1.05],[-.46,-.1,.2,1.0],[.04,.48,-.23,1.08],[.1,-.08,-.55,1.05]].forEach(([a,b,d,w],i)=>{box(x+a*scale,3.07+b*scale,z+d*scale,w*scale,.85*scale,w*scale,c[i%4]);if(i%2===0)box(x+a*scale,3.51+b*scale,z+d*scale,w*scale,.06,w*scale,'#f0d7d7');});
  }
  function fence(x,z,length,axis='x'){
    const horizontal=axis==='x';
    for(let i=0;i<=length;i+=.75){box(x+(horizontal?i:0),1.48,z+(horizontal?0:i),.13,.83,.13,'#ab8b72');box(x+(horizontal?i:0),1.91,z+(horizontal?0:i),.18,.07,.18,'#e6dfd8');}
    [.38,.7].forEach(h=>box(x+(horizontal?length/2:0),1.03+h,z+(horizontal?0:length/2),horizontal?length:.075,.085,horizontal?.075:length,'#bf9c7c'));
  }
  function crate(x,z,scale=1){box(x,1.3,z,.58*scale,.55*scale,.57*scale,'#bc9271');[-.24,.24].forEach(a=>box(x+a*scale,1.3,z+.292*scale,.065*scale,.55*scale,.03,'#8c735e'));box(x,1.58,z,.62*scale,.04,.6*scale,'#cfaf87');}
  function lamp(x,z,light=false){box(x,2.02,z,.095,2,.095,'#6f635c');box(x+.18,3.02,z,.45,.095,.09,'#6f635c');box(x+.39,2.8,z,.28,.38,.27,'#6b6152');glow(x+.39,2.8,z+.145,.19,.23,.018,'#ffe1a0');glow(x+.54,2.8,z,.018,.23,.19,'#ffe1a0');box(x+.39,3.04,z,.39,.09,.36,'#e7dfd7');shine(x+.39,2.8,z,2.6,light);}
  function cabin(x,z,s=1,roof='#647f89',kind='home'){
    const w=2.45*s,d=2.05*s,h=1.78*s,base=1.02;
    box(x,base+.14,z,w+.3,.28,d+.3,'#8e9f9b');
    box(x,base+h/2+.24,z,w,h,d,'#b18768');
    for(let i=0;i<8;i++){const y=base+.38+i*.205*s;box(x,y,z+d/2+.035,w+.12,.07,.09,i%2?'#c3a080':'#d2ae8c');box(x+w/2+.03,y,z,.09,.075,d,'#9b775e');}
    [-1,1].forEach(a=>{box(x+a*w*.45,base+h*.55,z+d/2+.09,.16,h,.12,'#795d4d');box(x+a*w*.45,base+h+.16,z,.16,.12,d+.1,'#775e52');});
    // Stepped, tiled pitched roofs are built from small blocks, never smooth cones.
    for(let i=0;i<9;i++){const y=base+h+.2+i*.12*s, ww=(w+.48)*(1-i/10);
      box(x,y,z,ww,.15*s,d+.47,roof);
      box(x,y+.095*s,z,ww,.065*s,d+.48,i%3?'#e9e4e5':'#dcdde4');
      if(i%2===0)for(let t=-1;t<=1;t++)box(x+ww/2-.07,y+.14*s,z+t*.59*s,.15,.055,.12,'#f5efeb');
    }
    box(x,base+h+1.32*s,z,.34,.12,d+.51,'#efeeee');
    box(x-.42*s,base+.73*s,z+d/2+.13,.61*s,1.22*s,.15,'#646d61');box(x-.24*s,base+.72*s,z+d/2+.225,.055,.055,.03,'#e9c779');
    const wx=x+.55*s,wy=base+1.16*s,wz=z+d/2+.11;
    box(wx,wy,wz,.72*s,.7*s,.12,'#6c5749');glow(wx,wy,wz+.07,.56*s,.51*s,.03,'#ffdc94');shine(wx,wy,wz+.12,1.4*s,false,{ground:base+.08});
    box(wx,wy,wz+.1,.065,.59*s,.04,'#8a6950');box(wx,wy,wz+.1,.61*s,.065,.04,'#8a6950');box(wx,wy-.39*s,wz,.87*s,.1,.33,'#e9e5df');
    box(x+w/2+.06,base+1.1*s,z,.1,.7*s,.65*s,'#665a4d');glow(x+w/2+.12,base+1.1*s,z,.02,.49*s,.47*s,'#ffd29c');box(x+w/2+.14,base+1.1*s,z,.02,.54*s,.07,'#977957');
    box(x-.42*s,base+.08,z+d/2+.42,.92*s,.15,.42,'#aaa696');box(x-.42*s,base+.025,z+d/2+.71,1.05*s,.1,.27,'#c6c3b5');
    box(x+.65*s,base+h+1.09*s,z-.42*s,.37*s,1.5*s,.37*s,'#927f7d');
    for(let i=0;i<4;i++)box(x+.65*s,base+h+.8*s+i*.3*s,z-.42*s,.4*s,.045,.4*s,'#b89c94');
    box(x+.65*s,base+h+1.87*s,z-.42*s,.5*s,.12,.5*s,'#e9e3e2');
    if(kind==='inn'){box(x,base+.33,z+d/2+1.15,w+1.0,.13,1.1,'#ac8d75');[-1,1].forEach(a=>box(x+a*(w/2+.22),base+1.28,z+d/2+1.42,.13,2.0,.13,'#8e735d'));box(x,base+2.4,z+d/2+.96,w+1.1,.13,1.9,roof);}
  }
  function stall(x,z,color='#709b7a'){
    box(x,1.53,z,2.5,1,1.08,'#b79170');box(x,2.07,z+.08,2.7,.13,1.27,'#d4b68e');
    for(let i=-1;i<=1;i++)box(x+i*.85,1.54,z+.55,.05,.83,.03,'#967655');
    [-1.15,1.15].forEach(a=>box(x+a,2.37,z-.38,.14,2.7,.14,'#8f765c'));
    for(let i=0;i<8;i++){const c=i%2?'#e9e3c9':color;box(x-1.22+i*.35,3.46,z,.348,.12,1.66,c);box(x-1.22+i*.35,3.27,z+.82,.348,.31,.08,c);}
    for(let i=-1;i<=1;i++){box(x+i*.74,2.2,z+.05,.64,.13,.77,'#8d9270');for(let a=0;a<3;a++)box(x+i*.74-.18+a*.17,2.3,z+.06,.12,.09,.46,i===0?'#a8ccbe':'#dcb5a2');}
  }
  function dock(x,z,w,d){
    for(let a=-d/2;a<=d/2;a+=.28)box(x,.84,z+a,w,.15,.25,Math.round(a*10)%3?'#bc9674':'#d1b087');
    [-1,1].forEach(side=>{for(let a=-d/2;a<=d/2;a+=1.6){box(x+side*(w/2-.08),.43,z+a,.19,1.65,.19,'#89725c');box(x+side*(w/2-.08),1.28,z+a,.24,.06,.24,'#d7c0a1');}});
  }
  // Main river crossing, small working pier, and broad seaside harbor.
  dock(-6.5,-5.5,5.6,1.7);dock(-5.15,-1.6,3.9,1.55);dock(8.8,13.5,1.6,7.3);dock(11.2,16.6,6.3,1.45);dock(12.6,13.8,1.3,5.1);
  for(let i=0;i<8;i++){box(-9.1+i*.75,1.5,-6.25,.09,1,.09,'#9b7e62');box(-9.1+i*.75,1.5,-4.73,.09,1,.09,'#9b7e62');}
  box(-6.5,1.9,-6.25,5.6,.1,.1,'#b49a7e');box(-6.5,1.9,-4.73,5.6,.1,.1,'#b49a7e');
  cabin(-.4,-9.5,1.1,'#627f93');cabin(3.8,-10.7,1,'#9f6a64');cabin(10.9,-10.1,1.25,'#718a81');cabin(13.1,-2.1,1.0,'#5e8390');cabin(9.4,-1.7,1.0,'#aa7770');
  cabin(1.7,-2.4,1.13,'#657f82','inn');cabin(3.2,8.6,.9,'#8a7f6b');cabin(12.5,7.9,1.22,'#6d8390','inn');cabin(-12.4,-8.7,.95,'#856e7c');cabin(-12.4,2.5,.8,'#6c8a81');
  stall(.4,2.4);stall(4,2.4,'#c58f76');
  // Town garden, small stone fountain and snow-topped building plots.
  box(9.2,1.12,2.5,2.0,.22,2.0,'#aeb3aa');box(9.2,1.29,2.5,1.63,.22,1.63,'#c4c5b5');box(9.2,1.44,2.5,1.18,.18,1.18,'#72b8b4');box(9.2,1.98,2.5,.37,1.1,.37,'#a5b5aa');box(9.2,2.56,2.5,.67,.15,.67,'#d3d4c6');
  [[-.4,8.5,2.0,2.5],[11,-5,3,2],[3.9,-6.9,2.3,2.4],[-13.4,6.2,3,2.4]].forEach(([x,z,w,d])=>{box(x,1.05,z,w,.04,d,'#d8c6bf');fence(x-w/2,z-d/2,w);fence(x-w/2,z-d/2,d,'z');fence(x+w/2,z-d/2,d,'z');});
  [[-3.6,-11.8],[5.35,8.9],[5.15,-7.5],[15.1,3.2],[11,-13.4],[-10.4,-12],[-14.6,7.7]].forEach(([x,z],i)=>pinkTree(x,z,.8+(i%3)*.1));
  for(let i=0;i<43;i++){
    let x,z;
    if(i<19){x=-17.1+seeded(i*21)*6.8;z=-15.3+seeded(i*31)*25; if(Math.abs(x+12.3)<1.6&&(Math.abs(z+8.7)<3||Math.abs(z-2.5)<3))continue;}
    else if(i<34){x=-2.5+seeded(i*11)*19;z=-15.2+seeded(i*41)*2.5;}
    else{x=15.6+seeded(i)*1.2;z=-10+seeded(i*73)*18;}
    pine(x,z,.68+seeded(i*3)*.53);
  }
  [[-10.6,8.5],[-15.6,10.4],[-2.8,-13.9],[5.9,11],[15.3,9.5]].forEach(([x,z],i)=>pine(x,z,.85+i%2*.18));
  [[.5,-5.1],[5.9,5.7],[8.25,-5.4],[8.35,10.7],[-11,-5.4],[14.2,4.9],[-3,-.3]].forEach(([x,z])=>lamp(x,z,true));
  [[2.1,2.9],[2.5,3.4],[10.9,9.2],[11.6,9.2],[-11,3.7],[4.9,-11.4],[14.1,-1.9]].forEach(([x,z],i)=>crate(x,z,i%2?.8:1));
  // Lighthouse with an illuminated lantern and a stepped masonry base.
  const lx=-14.7,lz=9;box(lx,1.13,lz,2.2,.24,2.2,'#b6b5ad');
  for(let i=0;i<8;i++)box(lx,1.42+i*.42,lz,1.37-i*.04,.42,1.37-i*.04,i===2||i===3?'#b88182':'#e8e5db');
  box(lx,4.74,lz,1.75,.15,1.75,'#686b6c');glow(lx,5.12,lz,1.08,.6,1.08,'#ffe3a9');shine(lx,5.12,lz,6,true,{ground:1.3,color:'#ffe6b0'});
  [-.63,.63].forEach(x=>[-.63,.63].forEach(z=>box(lx+x,5.12,lz+z,.1,.74,.1,'#74665d')));
  box(lx,5.52,lz,1.64,.19,1.64,'#8b7171');box(lx,5.73,lz,1.1,.21,1.1,'#c5a4a3');box(lx,5.93,lz,.65,.21,.65,'#e5d9d5');
  // Wider world: extra hamlets, forests, frozen lakes and stepped northern hills.
  const hamlets=[[-26,-6,1.1,'#d9483b'],[-31,3,.95,'#2f7fd1'],[-22,-24,1,'#5aa02c'],[24,-6,1.15,'#ef8a17'],[31,3,1,'#5b5ff0'],[34,-12,1.05,'#d63c8f'],[20,-32,1,'#14a38b'],[-34,-30,.9,'#b5562b']];
  hamlets.forEach(([x,z,s,r])=>{cabin(x,z,s,r);lamp(x+2.2,z+2.1);crate(x-1.8,z+2);});
  // Robinhood plaza: pink stone terrace with stairs, torches, a fence and the hanging banner (mesh in Island.jsx).
  const PLAZA=[23.5,5.5];
  function plaza(x,z){
    const w=7,d=5;
    box(x,1.24,z,w+.3,.44,d+.3,'#c99aa0');box(x,1.5,z,w,.1,d,'#e9c7c6');
    for(let a=-w/2+.5;a<w/2;a+=1)for(let b=-d/2+.5;b<d/2;b+=1){const n=seeded(a*31+b*7);box(x+a,1.565,z+b,.92,.03,.92,n>.66?'#f4dcd8':n>.33?'#e8c6c3':'#dcb4b7');}
    for(let i=0;i<3;i++){const top=1.46-i*.14;box(x,(1.02+top)/2,z+d/2+.3+i*.6,3.4,top-1.02,.6,i%2?'#e9c6c3':'#dbb3b4');box(x,top+.02,z+d/2+.3+i*.6,3.4,.04,.6,'#f6e2dd');}
    [-1,1].forEach(a=>{box(x+a*2.1,1.3,z+d/2+1.2,.9,.5,2.3,'#b58e93');box(x+a*2.1,1.58,z+d/2+1.2,.95,.08,2.35,'#e3c8c6');});
    fence(x-w/2,z-d/2-.45,w);fence(x-w/2,z-d/2-.45,2.2,'z');fence(x+w/2,z-d/2-.45,2.2,'z');
    const pz=z+d/2-.7;
    [-1.95,1.95].forEach(a=>{box(x+a,2.95,pz,.24,2.8,.24,'#9a7a5a');box(x+a,4.4,pz,.32,.12,.32,'#d8c6a8');});
    box(x,4.32,pz,4.3,.2,.2,'#9a7a5a');box(x,4.62,pz,.55,.42,.14,'#e5c062');box(x,4.62,pz+.08,.3,.22,.04,'#2f7d4f');
    [-1,1].forEach(a=>{const tx=x+a*(w/2-.45),tz=z+d/2-.4;box(tx,1.75,tz,.3,.3,.3,'#6b6152');box(tx,2.3,tz,.14,1.0,.14,'#8c6e52');box(tx,2.85,tz,.3,.22,.3,'#6b6152');glow(tx,3.1,tz,.26,.34,.26,'#ffb547');glow(tx,3.32,tz,.14,.14,.14,'#ffe29a');shine(tx,3.15,tz,2.2,true,{ground:1.6,color:'#ffb366'});});
    [[-w/2+.45,-d/2+.5],[w/2-.45,-d/2+.5]].forEach(([a,b])=>{box(x+a,1.78,z+b,.5,.42,.5,'#a98870');box(x+a,2.12,z+b,.56,.3,.56,'#6fae7c');box(x+a,2.3,z+b,.3,.16,.3,'#e98aa8');});
    pinkTree(x-2.9,z-d/2-1.9,1.15);pinkTree(x+3.1,z-d/2-2.1,.95);
    for(let i=0;i<9;i++)box(x-4.2+i*1.05,1.08,z+d/2+2.7,.3+seeded(i*7)*.3,.12,.3,i%2?'#b7cbc6':'#dad9d0');
  }
  plaza(...PLAZA);
  for(let i=0;i<200;i++){const x=-43+seeded(i*13.7+5)*86,z=-43+seeded(i*7.3+9)*54;
    if(inOld(x,z)||z>shoreZ(x)-2.2||(z>-37&&Math.abs(x-riverX(z))<4.6)||inLake(x,z,2.4)||(Math.abs(x-PLAZA[0])<6&&Math.abs(z-PLAZA[1])<6.5)||hamlets.some(([cx,cz])=>Math.abs(x-cx)<3.6&&Math.abs(z-cz)<3.6))continue;
    pine(x,z,.7+seeded(i*3.1)*.6);}
  [[-22,-17],[22,-12],[28,-2],[-20,4],[15,-24],[-15,-30],[36,-24],[-38,-8]].forEach(([x,z],i)=>pinkTree(x,z,.85+i%3*.1));
  [[-28,-40,8,6],[18,-41,9,7],[38,-36,6,5],[-40,-24,5,4]].forEach(([cx,cz,r,h])=>{for(let l=0;l<h;l++){const w=r*(1-l/(h+1));box(cx,1.3+l*.6,cz,w,.62,w*.8,l%2?'#8aa39b':'#7c968f');box(cx,1.64+l*.6,cz,w+.04,.1,w*.8+.04,'#f4f4f8');}});
  // Shore pebbles and reeds add small-scale detail.
  for(let i=0;i<42;i++){const z=-14+seeded(i*19)*26,x=riverX(z)+(i%2?2.0:-2.2);box(x,.64,z,.25+seeded(i)*.3,.25,.35,i%3?'#adc3bc':'#d9d8cf');}
  return {blocks,lights,lamps,plaza:PLAZA};
}