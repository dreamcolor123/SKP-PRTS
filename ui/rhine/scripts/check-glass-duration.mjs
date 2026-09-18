import assert from 'node:assert/strict';
import {DecryptionController,decryptionFrame,INTERACTIVE_CLEAR_DURATION} from '../src/decryption.ts';
assert.equal(INTERACTIVE_CLEAR_DURATION,1);
const samples=[];
for(const fps of [5,30,60,120]){
 const controller=new DecryptionController();controller.enter();let time=0,previous=0;
 while(time<1-1e-10){const dt=Math.min(1/fps,1-time);time+=dt;controller.update(dt,true,false);assert.ok(controller.clarity>=previous&&controller.clarity<=1);previous=controller.clarity;}
 assert.equal(controller.clarity,1);samples.push({fps,time,clarity:controller.clarity});
}
const controller=new DecryptionController();controller.enter();controller.update(.5,true,false);
assert.ok(Math.abs(controller.clarity-.5)<1e-9,'The first half second must visibly clear, not wait for the scan');
controller.leave();controller.update(.02,false,false);const returning=controller.clarity;
controller.enter();controller.update(0,true,false);assert.equal(controller.clarity,returning);
controller.update(.5,true,false);assert.ok(controller.clarity>returning);controller.update(.5,true,false);assert.equal(controller.clarity,1);
controller.select();controller.enter();controller.update(0,true,true);assert.equal(controller.clarity,1);
for(const time of [34.12,35,38.84,39,39.56]){controller.update(0,false,false,time);assert.deepEqual(controller.frame,decryptionFrame(time),'Cinematic reference remains independent of interactive speed');}
console.log(JSON.stringify({passed:true,durationSeconds:1,halfSecondClarity:.5,samples,checks:['5/30/60/120Hz','monotone clearing from extraction','reentry retains visible clarity','reduced motion','unchanged cinematic reference']}));
