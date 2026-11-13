// Shared by the build renderer and browser worker. No DOM or model dependency.
export const DESCRIPTOR_VERSION = 1;
export const REGION_TEMPLATE = Object.freeze({
  headgear:[.24,0,.52,.23], head:[.31,.17,.38,.2], neck:[.22,.32,.56,.14],
  back:[.05,.28,.9,.43], torso:[.24,.38,.52,.27], legs:[.27,.65,.46,.35],
  handR:[0,.38,.24,.5], handL:[.76,.38,.24,.5]
});
export function clampRect(rect) {
  const x=Math.max(0,Math.min(.98,Number(rect[0])||0)), y=Math.max(0,Math.min(.98,Number(rect[1])||0));
  return [x,y,Math.max(.02,Math.min(1-x,Number(rect[2])||.02)),Math.max(.02,Math.min(1-y,Number(rect[3])||.02))];
}
export function regionRect(crop,region) {
  return clampRect([crop[0]+region[0]*crop[2],crop[1]+region[1]*crop[3],region[2]*crop[2],region[3]*crop[3]]);
}
const bin=(r,g,b)=>(Math.min(3,r>>6)*16+Math.min(3,g>>6)*4+Math.min(3,b>>6));
const bytes=values=>Array.from(values,v=>Math.max(0,Math.min(255,Math.round(v))));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

/** Conservative border separation: complex backgrounds stay visible and are flagged. */
export function foregroundMask({data,width,height},transparent=false) {
  const mask=new Uint8Array(width*height);
  if(transparent){for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>32?1:0;return {mask,reliable:true};}
  const border=[];
  for(let x=0;x<width;x+=Math.max(1,width>>4))for(const y of [0,height-1])border.push(Array.from(data.slice((y*width+x)*4,(y*width+x)*4+3)));
  for(let y=0;y<height;y+=Math.max(1,height>>4))for(const x of [0,width-1])border.push(Array.from(data.slice((y*width+x)*4,(y*width+x)*4+3)));
  const bg=[0,1,2].map(c=>border.map(p=>p[c]).sort((a,b)=>a-b)[border.length>>1]);
  const spread=border.reduce((s,p)=>s+distance(p,bg),0)/border.length;
  if(spread>30){mask.fill(1);return {mask,reliable:false};}
  // Flood only the background connected to the border, retaining enclosed prints.
  const seen=new Uint8Array(mask.length), queue=[];
  const visit=i=>{if(seen[i])return;seen[i]=1;const j=i*4;if(distance([data[j],data[j+1],data[j+2]],bg)<42)queue.push(i);};
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
  for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  const removed=new Uint8Array(mask.length);
  for(let n=0;n<queue.length;n++){const i=queue[n];removed[i]=1;if(i%width)visit(i-1);if(i%width<width-1)visit(i+1);if(i>=width)visit(i-width);if(i<mask.length-width)visit(i+width);}
  let count=0;for(let i=0;i<mask.length;i++){mask[i]=removed[i]?0:1;count+=mask[i];}
  return {mask,reliable:count>mask.length*.06&&count<mask.length*.96};
}

/** Tight-box normalized occupancy, relative luminance, edges and 4³ RGB bins. */
export function extractDescriptor(image,{transparent=false,baseImage=null}={}) {
  const {data,width,height}=image;
  if(!width||!height||data.length!==width*height*4)throw new Error('Invalid image pixels.');
  const {mask,reliable}=foregroundMask(image,transparent);
  let x0=width,y0=height,x1=-1,y1=-1,count=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){count++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(count<16)return null;
  const w=x1-x0+1,h=y1-y0+1,occ=new Float64Array(64),gray=new Float64Array(64),cells=new Float64Array(64),hist=new Float64Array(64),fixed=new Float64Array(64),edges=new Float64Array(16);
  const rgbSum=Array.from({length:64},()=>[0,0,0]);let baseCount=0,edgeCount=0,totalGray=0,squareGray=0;
  const lum=i=>.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const p=y*width+x,i=p*4,cell=Math.min(7,Math.floor((y-y0)*8/h))*8+Math.min(7,Math.floor((x-x0)*8/w));cells[cell]++;
    if(!mask[p])continue;
    const r=data[i],g=data[i+1],b=data[i+2],v=lum(i),k=bin(r,g,b);
    occ[cell]++;gray[cell]+=v;hist[k]++;rgbSum[k][0]+=r;rgbSum[k][1]+=g;rgbSum[k][2]+=b;totalGray+=v;squareGray+=v*v;
    const plastic=baseImage&&Math.hypot(r-baseImage.data[i],g-baseImage.data[i+1],b-baseImage.data[i+2])>45;
    if(plastic)baseCount++;else fixed[k]++;
    if(x<x1&&y<y1&&mask[p+1]&&mask[p+width]){
      const dx=lum(i+4)-v,dy=lum(i+width*4)-v,m=Math.hypot(dx,dy);
      if(m>18){const angle=(Math.atan2(dy,dx)+Math.PI)%Math.PI;edges[Math.min(7,Math.floor(angle*8/Math.PI))]++;edges[8+Math.min(7,Math.floor((y-y0)*8/h))]++;edgeCount++;}
    }
  }
  const mean=totalGray/count,std=Math.max(20,Math.sqrt(Math.max(0,squareGray/count-mean*mean)));
  const dominant=Array.from(hist,(n,k)=>({n,k})).sort((a,b)=>b.n-a.n||a.k-b.k).filter(v=>v.n>count*.015).slice(0,3).map(({n,k})=>rgbSum[k].map(v=>Math.round(v/n)));
  return {aspect:Math.round(w/h*1000)/1000,fill:Math.round(count/(w*h)*1000)/1000,
    mask:bytes(occ.map((n,i)=>255*n/Math.max(1,cells[i]))),gray:bytes(gray.map((n,i)=>occ[i]?128+40*(n/occ[i]-mean)/std:128)),
    hist:bytes(hist.map(n=>255*n/count)),fixed:bytes(fixed.map(n=>255*n/count)),base:Math.round(baseCount/count*255),
    edges:bytes(edges.map(n=>255*n/Math.max(1,edgeCount))),dominant,
    complexity:Math.round(edgeCount/count*255),quality:reliable?1:.45,coverage:Math.round(count/(width*height)*1000)/1000};
}

// HTMLImageElement decoding applies EXIF orientation in current Safari/Chrome.
export async function preparePortraitPhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose JPG, PNG, or WebP. Export HEIC photos as JPG first.');
  if(!file.size||file.size>15000000)throw new Error('Each photo must be smaller than 15 MB.');
  const url=URL.createObjectURL(file),image=new Image();
  try {
    image.src=url;await image.decode();
    if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>60000000)throw new Error('Export a smaller copy of this photo.');
    const scale=Math.min(1,1400/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo preparation needs Canvas support.');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    canvas.width=canvas.height=0;if(!blob)throw new Error('Could not prepare this photo.');
    return {name:file.name,url:URL.createObjectURL(blob),crop:[.05,.02,.9,.96],regions:structuredClone(REGION_TEMPLATE),visible:{head:true,headgear:true,neck:false,back:false,torso:true,legs:true,handR:false,handL:false}};
  } catch(error) {throw new Error(error.message==='The source image cannot be decoded.'?'This photo could not be opened. Export it as JPG.':error.message);}
  finally {URL.revokeObjectURL(url);image.src='';}
}

export async function photoRegionPixels(url,rect) {
  const image=new Image();image.src=url;await image.decode();
  const [x,y,w,h]=clampRect(rect),canvas=document.createElement('canvas');
  const sw=w*image.naturalWidth,sh=h*image.naturalHeight,scale=96/Math.max(sw,sh);
  canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Photo analysis needs Canvas support. You can still choose parts manually.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,x*image.naturalWidth,y*image.naturalHeight,sw,sh,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),preview=canvas.toDataURL('image/webp',.8);
  canvas.width=canvas.height=0;image.src='';return {pixels,preview};
}
