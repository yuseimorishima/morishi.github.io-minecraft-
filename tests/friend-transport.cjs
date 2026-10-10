// Test-only broker: the managed cloud browser prohibits non-proxied WebRTC UDP.
// This substitutes only RTCPeerConnection, exercising the shipped signaling,
// fragmentation, world transactions and UI in two isolated browser contexts.
module.exports=async function installTransport(page,rooms){
 await page.exposeFunction('__testRtcSend',async message=>{
  if(message.kind==='host'){rooms.set(message.id,{host:page});return;}
  const room=rooms.get(message.id);if(!room)return;
  if(message.kind==='join'){room.guest=page;return;}
  if(message.kind==='open'){for(const p of[room.host,room.guest])await p.evaluate(()=>window.__testRtcPeer.open());room.opened=true;for(const [sender,data]of room.buffer||[]){const target=room.host===sender?room.guest:room.host;await target.evaluate(data=>window.__testRtcPeer.channel.onmessage?.({data}),data);}room.buffer=[];return;}
  if(message.kind==='data'){if(!room.opened){(room.buffer??=[]).push([page,message.data]);return;}const target=room.host===page?room.guest:room.host;if(target)await target.evaluate(data=>window.__testRtcPeer.channel.onmessage?.({data}),message.data);return;}
  if(message.kind==='close'){const target=room.host===page?room.guest:room.host;if(target&&!target.isClosed())await target.evaluate(()=>{const pc=window.__testRtcPeer;if(pc.connectionState!=='closed'){pc.connectionState='closed';pc.channel.readyState='closed';pc.channel.onclose?.();}});}
 });
 await page.addInitScript(()=>{
  class Channel{constructor(pc){this.pc=pc;this.readyState='connecting';this.bufferedAmount=0;}send(data){window.__testRtcSend({kind:'data',id:this.pc.id,data}).catch(()=>{});}close(){this.pc.close();}}
  class Peer extends EventTarget{
   constructor(){super();this.connectionState='new';this.iceConnectionState='new';this.iceGatheringState='complete';this.channel=null;this.localDescription=null;this.remoteDescription=null;window.__testRtcPeer=this;}
   createDataChannel(){this.id=crypto.randomUUID();this.channel=new Channel(this);window.__testRtcSend({kind:'host',id:this.id});return this.channel;}
   async createOffer(){return{type:'offer',sdp:'v=0\r\na=x-test:'+this.id+'\r\na=candidate:test\r\n'};}
   async createAnswer(){return{type:'answer',sdp:'v=0\r\na=x-test:'+this.id+'\r\na=candidate:test\r\n'};}
   async setLocalDescription(value){this.localDescription=value;}
   async setRemoteDescription(value){this.remoteDescription=value;this.id=value.sdp.match(/a=x-test:([^\r]+)/)[1];if(value.type==='offer'){this.channel=new Channel(this);await window.__testRtcSend({kind:'join',id:this.id});this.ondatachannel?.({channel:this.channel});}else await window.__testRtcSend({kind:'open',id:this.id});}
   open(){this.connectionState='connected';this.iceConnectionState='connected';this.channel.readyState='open';this.channel.onopen?.();this.onconnectionstatechange?.();}
   close(){if(this.connectionState==='closed')return;this.connectionState='closed';if(this.channel)this.channel.readyState='closed';window.__testRtcSend({kind:'close',id:this.id}).catch(()=>{});}
  }
  window.RTCPeerConnection=Peer;
 });
};
