// Original synthesized sound effects: no downloads or audio files required.
export function createGameAudio(){
 let context=null,enabled=true,master=null,last=0;
 function unlock(){try{context??=new(window.AudioContext||window.webkitAudioContext)();if(!master){master=context.createGain();master.gain.value=.2;master.connect(context.destination);}if(context.state==='suspended')context.resume().catch(()=>{});}catch{}}
 function play(kind='stone'){
  if(!enabled||!context||context.state!=='running')return;
  const now=context.currentTime;if(now-last<.035)return;last=now;
  const settings={step:[.075,600,.15],grass:[.07,1100,.13],wood:[.12,350,.4],stone:[.13,1500,.32],place:[.09,750,.32],hurt:[.2,170,.5],craft:[.16,920,.16],water:[.18,700,.16],eat:[.11,1200,.2]},[duration,frequency,volume]=settings[kind]||settings.stone;
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.value=volume;source.connect(filter);filter.connect(gain);gain.connect(master);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start();
  if(kind==='craft'){const oscillator=context.createOscillator(),tone=context.createGain();oscillator.type='triangle';oscillator.frequency.setValueAtTime(660,now);oscillator.frequency.exponentialRampToValueAtTime(990,now+.13);tone.gain.setValueAtTime(.09,now);tone.gain.exponentialRampToValueAtTime(.001,now+.2);oscillator.connect(tone);tone.connect(master);oscillator.start();oscillator.stop(now+.2);oscillator.onended=()=>{oscillator.disconnect();tone.disconnect();};}
 }
 return{unlock,play,setEnabled(value){enabled=!!value;return enabled;},enabled:()=>enabled};
}
export function createBlockParticles(THREE,scene,materials,blockMaterials){
 const geometry=new THREE.BoxGeometry(.085,.085,.085),pieces=[];let emitted=0;
 return{
  burst(x,y,z,type){const material=materials[blockMaterials[type]];if(!material)return;for(let i=0;i<12;i++){if(pieces.length>=96){const old=pieces.shift();scene.remove(old.mesh);}const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x+(Math.random()-.5)*.7,y+(Math.random()-.5)*.7,z+(Math.random()-.5)*.7);scene.add(mesh);pieces.push({mesh,vx:(Math.random()-.5)*2.3,vy:1.4+Math.random()*1.8,vz:(Math.random()-.5)*2.3,life:.4+Math.random()*.35});emitted++;}},
  tick(dt){for(let i=pieces.length-1;i>=0;i--){const p=pieces[i];p.life-=dt;p.vy-=8*dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.mesh.rotation.x+=dt*4;p.mesh.rotation.z+=dt*3;if(p.life<=0){scene.remove(p.mesh);pieces.splice(i,1);}}},
  stats:()=>({active:pieces.length,emitted})
 };
}
export function createVoxelSky(THREE,scene){
 const sun=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial({color:0xfff1be,fog:false,depthWrite:false})),moon=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshBasicMaterial({color:0xdfeaff,fog:false,depthWrite:false}));scene.add(sun,moon);
 const moonFace=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({color:0xb6c3d1,fog:false,depthWrite:false}));moonFace.position.set(-1.8,1,.01);moon.add(moonFace);const positions=[];for(let i=0;i<160;i++){const angle=i*2.399963,y=.13+((i*37)%100)/120,r=Math.sqrt(1-Math.min(.99,y*y));positions.push(Math.cos(angle)*r*135,y*135,Math.sin(angle)*r*135);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const material=new THREE.PointsMaterial({color:0xe6efff,size:.36,transparent:true,opacity:0,fog:false,depthWrite:false}),stars=new THREE.Points(geometry,material);scene.add(stars);
 return{tick(time,camera,caveMix){const angle=time/600*Math.PI*2,altitude=Math.sin(angle),dayPosition=new THREE.Vector3(Math.cos(angle)*100,altitude*105,-65);sun.position.copy(camera.position).add(dayPosition);moon.position.copy(camera.position).sub(dayPosition);sun.lookAt(camera.position);moon.lookAt(camera.position);sun.visible=altitude>-.05&&caveMix<.5;moon.visible=altitude<.05&&caveMix<.5;stars.position.copy(camera.position);material.opacity=Math.max(0,Math.min(.8,-altitude))*Math.max(0,1-caveMix);},stats:()=>({stars:160})};
}
