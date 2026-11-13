import {library} from '../../src/lib/ldraw';
import {Stage} from '../../src/lib/scene';
import {drawThumb} from '../../src/lib/thumb-render';
import {THUMB_COLORS} from '../../src/lib/thumbs';
import {extractDescriptor} from '../../../../portrait-image-analysis.js';

// Used only at build time; photographs never need WebGL or part geometry.
const stage=new Stage();
const scratch=document.createElement('canvas');scratch.width=scratch.height=96;
const ctx=scratch.getContext('2d',{willReadFrequently:true})!;
const pixels=(canvas:HTMLCanvasElement)=>{ctx.clearRect(0,0,96,96);ctx.drawImage(canvas,0,0,96,96);return ctx.getImageData(0,0,96,96);};
(window as any).renderPortraitReferences=async (parts:any[])=>{
  await library.init();const results=[];
  for(const part of parts){
    const color=THUMB_COLORS[part.cat as keyof typeof THUMB_COLORS]!,views=[];
    const angles=['headgear','neck','back','hand'].includes(part.cat)?[0,-30]:[0];
    let thumb='';
    for(const yaw of angles){
      const view={yaw,pitch:yaw?12:0,zoom:1};
      const alternate=pixels(await drawThumb(stage,part.id,0,undefined,view));
      const canvas=await drawThumb(stage,part.id,color,undefined,view);
      if(!thumb)thumb=canvas.toDataURL('image/webp',.88);
      const descriptor=extractDescriptor(pixels(canvas),{transparent:true,baseImage:alternate});
      if(!descriptor)throw new Error(`Empty reference: ${part.id}`);
      views.push(descriptor);
    }
    results.push({id:part.id,views,thumb});
  }
  return results;
};
