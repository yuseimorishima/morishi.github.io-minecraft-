export function nightAt(time){return ((time%600)+600)%600>=300;}
export function daylightAt(time){return Math.max(.04,Math.min(1,.12+.88*Math.sin(time/600*Math.PI*2)));}
const SPECIES={zombie:{name:'ゾンビ',hp:16,speed:1.35,radius:.3,height:1.8,damage:3},slime:{name:'スライム',hp:8,speed:.9,radius:.38,height:.8,damage:2}};

// Simulation uses terrain/light callbacks; it is independent of graphics and frame rate.
export class NightCreatures {
 constructor(env){this.env=env;this.creatures=[];this.spawnTimer=0;this.attackTimer=0;this.serial=0;this.epoch=Date.now().toString(36);this.stats={spawned:0,blockedByLight:0,attacks:0,killed:0};}
 clear(){for(const c of this.creatures)this.env.remove?.(c);this.creatures.length=0;this.spawnTimer=0;this.attackTimer=0;}
 spawn(player){
  if(this.creatures.length>=6)return;
  for(let attempt=0;attempt<12;attempt++){
   const random=this.env.random??Math.random,angle=random()*Math.PI*2,r=16+random()*12,x=player.x+Math.cos(angle)*r,z=player.z+Math.sin(angle)*r;
   const y=this.env.ground(x,z,player.y+5),kind=random()<.7?'zombie':'slime',d=SPECIES[kind];
   if(Math.abs(y-player.y)>5||!this.env.occupy(x,y,z,d.radius,d.height)||!this.env.safeFloor(x,y,z))continue;
   if(this.env.light(x,y+.6,z)){this.stats.blockedByLight++;continue;}
   if(this.creatures.some(c=>Math.hypot(c.x-x,c.z-z)<3))continue;
   const c={id:`night:${this.epoch}:${this.serial++}`,kind,...d,x,y,z,angle:angle+Math.PI,age:0,cooldown:0,flash:0,think:0,skyTimer:0,sky:false,state:'徘徊',wander:random()*Math.PI*2};
   this.creatures.push(c);this.stats.spawned++;this.env.spawn?.(c);return;
  }
 }
 remove(c,reason){const at=this.creatures.indexOf(c);if(at<0)return;this.creatures.splice(at,1);this.env.remove?.(c);if(reason==='defeated'){this.stats.killed++;this.env.defeated?.(c);}}
 step(c,dx,dz,dt){
  if(Math.abs(dx)+Math.abs(dz)<1e-8)return false;
  const x=c.x+dx*dt,z=c.z+dz*dt,y=this.env.ground(x,z,c.y+1.1);
  if(y>c.y+1.05||y<c.y-2||!this.env.safeFloor(x,y,z)||!this.env.occupy(x,y,z,c.radius,c.height))return false;
  c.x=x;c.y=y;c.z=z;return true;
 }
 tick(dt,{enabled,night,player,invulnerable=false}){
  this.attackTimer=Math.max(0,this.attackTimer-dt);if(!enabled)return;
  this.spawnTimer-=dt;if(night&&this.spawnTimer<=0){this.spawnTimer=4;this.spawn(player);}
  const heroLight=this.env.light(player.x,player.y+.9,player.z);
  for(const c of [...this.creatures]){
   c.age+=dt;c.cooldown=Math.max(0,c.cooldown-dt);c.flash=Math.max(0,c.flash-dt);c.think-=dt;c.skyTimer-=dt;
   const dx=player.x-c.x,dz=player.z-c.z,distance=Math.hypot(dx,dz);
   if(distance>56){this.remove(c,'far');continue;}
   if(c.skyTimer<=0){c.skyTimer=1;c.sky=this.env.sky(c.x,c.y+c.height,c.z);}
   if(!night&&c.sky){c.state='日光';c.hp-=dt*4;if(c.hp<=0){this.remove(c,'sun');continue;}}
   const light=this.env.light(c.x,c.y+.6,c.z);
   if(c.think<=0){c.think=.45;c.seesHero=distance<30&&Math.abs(player.y-c.y)<3&&this.env.visible(c.x,c.y+.8,c.z,player.x,player.y+.9,player.z);if(Math.random()<.1)c.wander+=(Math.random()-.5)*2;}
   let angle=c.wander,speed=c.speed*.4;
   if(light){c.state='明かりから退避';angle=Math.atan2(c.z-light.z,c.x-light.x);speed=c.speed*1.3;}
   else if(!invulnerable&&!heroLight&&c.seesHero){c.state='追跡';angle=Math.atan2(dz,dx);speed=c.speed;}
   else if(night)c.state='徘徊';
   c.angle=Math.PI/2-angle;
   if(distance>1.1||c.state!=='追跡'){
    const vx=Math.cos(angle)*speed,vz=Math.sin(angle)*speed;
    if(!this.step(c,vx,vz,dt)&&!this.step(c,vx,0,dt)&&!this.step(c,0,vz,dt)){c.wander+=1.2;c.think=0;}
   }
   if(!invulnerable&&!heroLight&&!light&&distance<1.55&&Math.abs(player.y-c.y)<1.1&&c.seesHero&&c.cooldown<=0&&this.env.visible(c.x,c.y+.8,c.z,player.x,player.y+.9,player.z)){c.cooldown=1.4;this.stats.attacks++;this.env.hurt(c.damage,c.name);}
   this.env.update?.(c);
  }
 }
 aimed(origin,direction,obstruction=Infinity,reach=3.8){
  let found=null,nearest=Math.min(reach,obstruction);
  for(const c of this.creatures){let lo=0,hi=nearest;const bounds=[[c.x-c.radius,c.x+c.radius],[c.y,c.y+c.height],[c.z-c.radius,c.z+c.radius]],o=[origin.x,origin.y,origin.z],d=[direction.x,direction.y,direction.z];
   for(let axis=0;axis<3;axis++){if(Math.abs(d[axis])<1e-9){if(o[axis]<bounds[axis][0]||o[axis]>bounds[axis][1]){hi=-1;break;}continue;}let a=(bounds[axis][0]-o[axis])/d[axis],b=(bounds[axis][1]-o[axis])/d[axis];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)break;}
   if(hi>=lo&&lo<nearest){nearest=lo;found=c;}
  }return found;
 }
 strike(c,power){if(!c||!this.creatures.includes(c))return false;if(this.attackTimer>0)return true;this.attackTimer=.38;c.hp-=power;c.flash=.2;this.env.hit?.(c);if(c.hp<=0)this.remove(c,'defeated');return true;}
 snapshot(){return this.creatures.map(({id,kind,name,x,y,z,hp,state})=>({id,kind,name,x,y,z,hp,state}));}
}

export function createCreatureVisuals(THREE,scene){
 const group=new THREE.Group();scene.add(group);const cube=new THREE.BoxGeometry(1,1,1),materials={};
 for(const [key,color]of Object.entries({skin:0x618946,shirt:0x337987,pants:0x38455c,eyes:0xe7e9b1,pupil:0x241c22,slime:0x73c754,slimeEyes:0x173b1e}))materials[key]=new THREE.MeshLambertMaterial({color,transparent:key==='slime',opacity:key==='slime'?.78:1});
 const visuals=new Map();
 function part(parent,color,x,y,z,sx,sy,sz){const m=new THREE.Mesh(cube,materials[color]);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
 return {
  spawn(c){const root=new THREE.Group();root.position.set(c.x,c.y,c.z);group.add(root);const limbs=[];
   if(c.kind==='zombie'){part(root,'shirt',0,1,0,.5,.65,.3);part(root,'skin',0,1.58,0,.52,.48,.45);for(const x of[-.14,.14]){part(root,'eyes',x,1.61,.231,.11,.09,.015);part(root,'pupil',x,1.6,.241,.045,.06,.015);}for(const x of[-.32,.32]){const arm=part(root,'skin',x,1.04,.25,.16,.16,.55);limbs.push(arm);}for(const x of[-.13,.13])limbs.push(part(root,'pants',x,.35,0,.21,.7,.25));}
   else{part(root,'slime',0,.4,0,.76,.76,.76);for(const x of[-.18,.18])part(root,'slimeEyes',x,.49,.389,.12,.12,.02);part(root,'slimeEyes',0,.25,.389,.2,.06,.02);}
   const bar=part(root,'pupil',0,c.height+.2,0,.55,.045,.035);const hp=part(root,'eyes',0,c.height+.2,.02,.55,.04,.035);bar.visible=hp.visible=false;visuals.set(c.id,{root,limbs,bar,hp});
  },
  update(c){const v=visuals.get(c.id);if(!v)return;v.root.position.set(c.x,c.y+(c.kind==='slime'?Math.abs(Math.sin(c.age*4))*.16:0),c.z);v.root.rotation.y=c.angle;v.limbs.forEach((limb,i)=>limb.rotation.x=Math.sin(c.age*6+i*Math.PI)*.2);v.bar.visible=v.hp.visible=c.flash>0;v.hp.scale.x=.55*Math.max(0,c.hp/SPECIES[c.kind].hp);},
  remove(c){const v=visuals.get(c.id);if(v){group.remove(v.root);visuals.delete(c.id);}},
  count:()=>visuals.size,
 };
}
