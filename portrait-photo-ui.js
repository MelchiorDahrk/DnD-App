import {PORTRAIT_PHOTO_LIMITS,PORTRAIT_SLOTS,validatePortraitSuggestions} from './portrait-scan.js';
import {preparePortraitPhoto,photoRegionPixels,clampRect,regionRect,extractDescriptor} from './portrait-image-analysis.js';
import {slotCategory,matchPortraitSlot,validateMatchIndex} from './portrait-match.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const optional=s=>!['head','torso','legs'].includes(s);
const thumb=id=>`./portrait-maker/thumbs/${encodeURIComponent(id)}.webp`;

export function mountPortraitPhotos(container,{send}) {
  container.innerHTML=`<summary>Start from a LEGO photo · offline matching</summary><div class="portrait-photo-content">
    <h3>1. Add photos</h3><p>Use up to three views of one minifigure. Photos stay in this dialog and are analyzed on this device. Use a clear front view, even lighting and a contrasting background.</p>
    <div class="portrait-photo-actions"><button type="button" class="btn" data-photo="choose">Choose photos</button><button type="button" class="btn" data-photo="camera">Take a photo</button><button type="button" class="btn" data-photo="manual">Browse parts manually</button><span>JPG, PNG, WebP · 15 MB each · Drop photos here</span></div>
    <input type="file" data-photo-files accept="image/jpeg,image/png,image/webp" multiple hidden><input type="file" data-photo-camera accept="image/jpeg,image/png,image/webp" capture="environment" hidden>
    <div class="portrait-photo-previews"></div>
    <div class="portrait-photo-actions"><button type="button" class="btn" data-photo="cache">Cache visual palette for offline use</button><span class="portrait-palette-cache" role="status">Matching data caches with the app. Cache the visual palette before going offline. Preview needs the selected parts’ cached geometry.</span></div>
    <section class="portrait-photo-adjust" hidden><h3>2. Adjust photo regions</h3><p>Fit the crop around the whole figure. Choose each visible part and adjust its box. Drag the box to move it; drag its corner to resize. Sliders also work with touch and keyboard. Hidden parts stay unresolved. Right hand means the figure’s own right (photo left).</p>
      <div class="portrait-photo-actions"><label>Editing photo <select data-edit-photo></select></label><button type="button" class="btn" data-photo="rotate">Rotate 90°</button><label>Box <select data-edit-region><option value="crop">Whole figure crop</option>${Object.entries(PORTRAIT_SLOTS).map(([s,n])=>`<option value="${s}">${n}</option>`).join('')}</select></label></div>
      <div class="portrait-crop"><img alt="Adjust minifigure crop" draggable="false"><div class="portrait-region-outlines"></div><div class="portrait-crop-box" data-handle="move"><span>Whole figure crop</span><button type="button" data-handle="resize" aria-label="Resize selected region"></button></div></div>
      <div class="portrait-region-sliders">${['X','Y','Width','Height'].map((n,i)=>`<label>${n} <output data-rect-output="${i}"></output><input type="range" min="0" max="100" step="1" data-rect="${i}" aria-label="Region ${n.toLowerCase()}"></label>`).join('')}</div>
      <div class="portrait-region-sources"></div><div class="portrait-photo-actions"><button type="button" class="btn btn-primary" data-photo="suggest" disabled>Find matching LEGO parts</button><button type="button" class="btn" data-photo="stop" hidden>Stop analysis</button></div>
    </section><p class="portrait-photo-status" role="status" aria-live="polite">Loading the local part palette…</p><p class="portrait-photo-error" role="alert" hidden></p>
    <section class="portrait-photo-results" hidden></section>
    <section class="portrait-photo-apply" hidden><h3>4. Preview and apply</h3><p>Preview uses Bricktrait and leaves the editor unchanged. Apply is one undoable edit. Choose “Use portrait” separately to save.</p><button type="button" class="btn" data-photo="preview">Preview reviewed choices</button><img class="portrait-photo-assembly" alt="Bricktrait preview of reviewed choices" hidden><button type="button" class="btn btn-primary" data-photo="apply" disabled>Apply reviewed choices to Bricktrait</button></section></div>`;
  const events=new AbortController(),signal=events.signal,q=s=>container.querySelector(s);
  let photos=[],primary=0,editing=0,sources={},index=null,catalog=[],colors=[],editorReady=false,busy=false,disposed=false,worker=null,run=0,request=null,timer=null,revision=0,previewReady=false;
  let results={},choices={},references={};
  const status=q('.portrait-photo-status'),error=q('.portrait-photo-error');
  const showError=message=>{error.textContent=message;error.hidden=false;};
  const reviewed=()=>Object.values(choices);
  function updateApply(){const any=reviewed().length>0;q('[data-photo="preview"]').disabled=busy||!any||!editorReady;q('[data-photo="apply"]').disabled=busy||!any||!editorReady||!previewReady;}
  function setBusy(value){busy=value;container.setAttribute('aria-busy',String(value));container.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);q('[data-photo="stop"]').hidden=!value;q('[data-photo="stop"]').disabled=false;q('[data-photo="suggest"]').disabled=value||!photos.length||!index;q('[data-photo="manual"]').disabled=value||!catalog.length;container.querySelectorAll('[data-color]').forEach(el=>el.disabled=value||!choices[el.dataset.slot]);updateApply();}
  function invalidatePreview(){revision++;previewReady=false;q('.portrait-photo-assembly').hidden=true;updateApply();}
  function clearResults(){results={};choices={};references={};q('.portrait-photo-results').hidden=true;q('.portrait-photo-apply').hidden=true;invalidatePreview();}
  const photoOptions=selected=>photos.map((p,i)=>`<option value="${i}" ${i===selected?'selected':''}>${i+1}${i===primary?' · front':''}: ${esc(p.name)}</option>`).join('');
  function renderPhotos(){
    q('.portrait-photo-previews').innerHTML=photos.map((p,i)=>`<figure><img src="${p.url}" alt="LEGO reference ${i+1}"><figcaption>${esc(p.name)}</figcaption><button type="button" class="btn" data-photo="primary" data-index="${i}" aria-pressed="${i===primary}">${i===primary?'Primary front':'Make primary'}</button><button type="button" class="btn" data-photo="edit" data-index="${i}">Adjust</button><button type="button" class="btn" data-photo="remove" data-index="${i}" aria-label="Remove photo ${i+1}">Remove</button></figure>`).join('');
    q('.portrait-photo-adjust').hidden=!photos.length;q('[data-edit-photo]').innerHTML=photoOptions(editing);
    q('.portrait-region-sources').innerHTML=Object.entries(PORTRAIT_SLOTS).map(([s,n])=>`<div><label><input type="checkbox" data-visible="${s}" ${photos[sources[s]??primary]?.visible[s]?'checked':''}> ${esc(n)} visible</label><label>Use view <select data-source="${s}" aria-label="Photo for ${esc(n)}">${photoOptions(sources[s]??primary)}</select></label></div>`).join('');
    renderAdjustment();setBusy(false);
  }
  function editRect(){const p=photos[editing],slot=q('[data-edit-region]').value;return slot==='crop'?p.crop:p.regions[slot];}
  function setRect(rect){const p=photos[editing],slot=q('[data-edit-region]').value;if(slot==='crop')p.crop=clampRect(rect);else p.regions[slot]=clampRect(rect);clearResults();renderAdjustment();}
  function position(el,r){el.style.left=`${r[0]*100}%`;el.style.top=`${r[1]*100}%`;el.style.width=`${r[2]*100}%`;el.style.height=`${r[3]*100}%`;}
  function renderAdjustment(){
    const p=photos[editing];if(!p)return;const img=q('.portrait-crop img');if(img.getAttribute('src')!==p.url)img.src=p.url;
    const slot=q('[data-edit-region]').value,rect=editRect();position(q('.portrait-crop-box'),slot==='crop'?rect:regionRect(p.crop,rect));q('.portrait-crop-box>span').textContent=slot==='crop'?'Whole figure crop':PORTRAIT_SLOTS[slot];
    q('.portrait-region-outlines').innerHTML=Object.entries(p.regions).filter(([s])=>p.visible[s]&&s!==slot).map(([s,r])=>{const v=regionRect(p.crop,r);return `<div style="left:${v[0]*100}%;top:${v[1]*100}%;width:${v[2]*100}%;height:${v[3]*100}%"><span>${esc(PORTRAIT_SLOTS[s])}</span></div>`;}).join('');
    rect.forEach((v,i)=>{q(`[data-rect="${i}"]`).value=String(Math.round(v*100));q(`[data-rect-output="${i}"]`).textContent=`${Math.round(v*100)}%`;});
  }
  async function addFiles(files){
    if(busy||disposed)return;const incoming=[...files];if(!incoming.length)return;container.open=true;error.hidden=true;
    if(photos.length+incoming.length>PORTRAIT_PHOTO_LIMITS.photos){showError('Use up to three views. Remove a photo first.');return;}
    setBusy(true);status.textContent='Preparing photos locally…';const prepared=[];
    try{for(const file of incoming)prepared.push(await preparePortraitPhoto(file));if(disposed){prepared.forEach(p=>URL.revokeObjectURL(p.url));return;}photos.push(...prepared);clearResults();renderPhotos();status.textContent='Adjust the crop and visible regions, then find matching parts.';}
    catch(reason){prepared.forEach(p=>URL.revokeObjectURL(p.url));if(!disposed)showError(reason.message);}
    finally{if(!disposed)setBusy(false);}
  }
  const selection=(slot,id)=>({slot,id,color:null,arms:null,hands:null,hips:null,confidence:'low',reason:'Reviewed local palette choice.'});
  const validateReviewed=()=>validatePortraitSuggestions({isMinifigure:true,summary:'Reviewed local matches',warnings:[],selections:reviewed()},catalog,colors).selections;
  function partButton(part,slot,score){return `<button type="button" class="portrait-candidate" data-candidate="${esc(part.id)}" data-slot="${slot}" aria-pressed="${choices[slot]?.id===part.id}" title="${esc(part.name)}"><img src="${thumb(part.id)}" loading="lazy" decoding="async" alt=""><span>${esc(part.name)}</span>${score!==undefined?`<small>Similarity ${score.toFixed(2)}</small>`:''}</button>`;}
  function renderReview(){
    const byId=new Map(catalog.map(p=>[p.id,p]));
    q('.portrait-photo-results').innerHTML=`<h3>3. Review parts</h3><p>Visual resemblance is approximate. Scores measure similarity, not certainty. Choose a thumbnail to review a part; every slot starts unchanged. Colours also stay unchanged until you choose one. Thumbnails show reference colours.</p>${Object.entries(PORTRAIT_SLOTS).map(([slot,name])=>{
      const r=results[slot],choice=choices[slot],fields=['color',...(slot==='torso'?['arms','hands']:slot==='legs'?['hips']:[])];
      return `<article class="portrait-photo-slot" data-slot-card="${slot}"><h4>${name}</h4><div class="portrait-region-reference">${references[slot]?`<img src="${references[slot]}" alt="${name} photo region">`:''}<p>${r?.status==='strong'?'Closest visual match shown first. Review before choosing.':r?.candidates.length?'Similar choices — selection required.':'Unresolved: mark a visible region or choose from the palette.'}</p></div><div class="portrait-candidates">${(r?.candidates||[]).filter(c=>byId.has(c.id)).map(c=>partButton(byId.get(c.id),slot,c.score)).join('')}</div>
      <p class="portrait-choice" role="status">${choice?choice.id===null?'None (remove accessory)':`Chosen: ${esc(byId.get(choice.id)?.name)}`:'Leave unchanged'}</p><div class="portrait-photo-actions"><button type="button" class="btn" data-unchanged="${slot}">Leave unchanged</button>${optional(slot)?`<button type="button" class="btn" data-none="${slot}" aria-pressed="${choice?.id===null}">None</button>`:''}</div>
      <div class="portrait-slot-colors">${fields.map(key=>`<label>${{color:'Plastic colour',arms:'Arms',hands:'Hands',hips:'Hips'}[key]}<select data-color="${key}" data-slot="${slot}" ${!choice?'disabled':''}><option value="">Keep current colour</option>${colors.map(c=>`<option value="${c.code}" ${choice?.[key]===c.code?'selected':''}>${esc(c.name)} (${c.code})</option>`).join('')}</select></label>`).join('')}</div>${r?.colors.length?`<p class="portrait-color-estimates">Closest plastic colours (may include print): ${r.colors.map(c=>esc(colors.find(p=>p.code===c.code)?.name||c.code)).join(', ')}. Select explicitly above.</p>`:''}
      <details class="portrait-palette" data-palette="${slot}"><summary>Browse entire category</summary><div class="portrait-photo-actions"><input type="search" data-search="${slot}" placeholder="Search names or IDs" aria-label="Search ${name}"><select data-collection="${slot}" aria-label="Collection for ${name}"><option value="all">All collections</option><option value="fantasy">Fantasy</option><option value="cmf">CMF</option>${[...new Set(index?.parts.flatMap(p=>p.themes)||[])].sort().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div><div class="portrait-palette-items portrait-candidates"></div><button type="button" class="btn" data-more="${slot}">Show more</button></details></article>`;
    }).join('')}`;
    q('.portrait-photo-results').hidden=false;q('.portrait-photo-apply').hidden=false;invalidatePreview();
  }
  function renderPalette(slot,limit=24){
    const panel=q(`[data-palette="${slot}"]`),search=panel.querySelector('input').value.toLowerCase(),collection=panel.querySelector('select').value,metadata=new Map(index?.parts.map(p=>[p.id,p])||[]);
    const parts=catalog.filter(p=>p.cat===slotCategory(slot)&&`${p.name} ${p.id}`.toLowerCase().includes(search)).filter(p=>{const m=metadata.get(p.id);return collection==='all'||(collection==='fantasy'?m?.fantasy:collection==='cmf'?m?.cmf:m?.themes?.includes(collection));});
    panel.dataset.limit=String(limit);panel.querySelector('.portrait-palette-items').innerHTML=parts.slice(0,limit).map(p=>partButton(p,slot)).join('')||'<p>No parts match this search.</p>';panel.querySelector('[data-more]').hidden=parts.length<=limit;
  }
  function choose(slot,id){
    choices[slot]=selection(slot,id);invalidatePreview();const card=q(`[data-slot-card="${slot}"]`);card.querySelector('.portrait-choice').textContent=id===null?'None (remove accessory)':`Chosen: ${catalog.find(p=>p.id===id)?.name}`;
    card.querySelectorAll('[data-candidate]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.candidate===id)));card.querySelector('[data-none]')?.setAttribute('aria-pressed',String(id===null));card.querySelectorAll('[data-color]').forEach(el=>{el.disabled=false;el.value='';});updateApply();
  }
  async function suggest(){
    if(busy||!photos.length||!index)return;error.hidden=true;clearResults();const generation=++run;setBusy(true);status.textContent='Comparing photo regions on this device…';
    try{
      const regions=[];
      for(const slot of Object.keys(PORTRAIT_SLOTS)){const p=photos[sources[slot]??primary];if(!p?.visible[slot])continue;const {pixels,preview}=await photoRegionPixels(p.url,regionRect(p.crop,p.regions[slot]));if(disposed||generation!==run)return;regions.push({slot,pixels});references[slot]=preview;}
      let ranked;
      if(typeof Worker==='function'){
        worker=new Worker(new URL('./portrait-match-worker.js',import.meta.url),{type:'module'});
        ranked=await new Promise((resolve,reject)=>{request={reject};worker.onmessage=({data})=>data.error?reject(new Error(data.error)):resolve(data.results);worker.onerror=()=>reject(new Error('Worker unavailable'));worker.postMessage({index,regions,catalog,colors});});
      } else {ranked=[];for(const {slot,pixels} of regions){ranked.push(matchPortraitSlot(slot,extractDescriptor(pixels),index,catalog,colors));await new Promise(resolve=>setTimeout(resolve,0));if(generation!==run||disposed)return;}}
      if(generation!==run||disposed)return;results=Object.fromEntries(ranked.map(r=>[r.slot,r]));renderReview();status.textContent='Local matches ready. Review each part; obscured slots remain unchanged.';
    } catch(reason){if(generation===run&&!disposed){renderReview();showError(`${reason.message}. Choose parts manually below; your photos remain available.`);status.textContent='Automatic matching was unavailable. The manual palette is ready.';}}
    finally{if(generation===run&&!disposed){worker?.terminate();worker=null;request=null;setBusy(false);}}
  }
  async function rotate(){
    const p=photos[editing];if(!p)return;setBusy(true);
    try{const img=new Image();img.src=p.url;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalHeight;canvas.height=img.naturalWidth;const ctx=canvas.getContext('2d');ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(img,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve));canvas.width=canvas.height=0;if(!blob)throw new Error('Could not rotate this photo.');if(disposed)return;URL.revokeObjectURL(p.url);p.url=URL.createObjectURL(blob);p.crop=[0,0,1,1];clearResults();renderPhotos();}
    catch(reason){if(!disposed)showError(reason.message);}finally{if(!disposed)setBusy(false);}
  }
  container.addEventListener('click',event=>{
    const el=event.target.closest('button');if(!el)return;
    if(el.dataset.photo==='stop'){run++;worker?.terminate();worker=null;request?.reject(new Error('Stopped'));request=null;clearTimeout(timer);invalidatePreview();setBusy(false);status.textContent='Stopped. Adjust regions or browse parts manually.';return;}
    if(busy)return;
    if(el.hasAttribute('data-candidate')){choose(el.dataset.slot,el.dataset.candidate);return;}
    if(el.dataset.none){choose(el.dataset.none,null);return;}
    if(el.dataset.unchanged){const s=el.dataset.unchanged;delete choices[s];const card=q(`[data-slot-card="${s}"]`);card.querySelector('.portrait-choice').textContent='Leave unchanged';card.querySelectorAll('[aria-pressed]').forEach(e=>e.setAttribute('aria-pressed','false'));card.querySelectorAll('[data-color]').forEach(e=>{e.value='';e.disabled=true;});invalidatePreview();return;}
    if(el.dataset.more){const s=el.dataset.more;renderPalette(s,Number(q(`[data-palette="${s}"]`).dataset.limit)+24);return;}
    switch(el.dataset.photo){
      case 'choose':q('[data-photo-files]').click();break;
      case 'camera':q('[data-photo-camera]').click();break;
      case 'cache':{
        if(!navigator.serviceWorker){showError('Offline caching needs a browser with service-worker support.');break;}
        q('.portrait-palette-cache').textContent='Caching visual palette…';
        navigator.serviceWorker.ready.then(reg=>reg.active?.postMessage({type:'questlog:cache-portrait-palette'})).catch(()=>showError('Could not cache the palette. Reconnect and try again.'));break;
      }
      case 'manual':renderReview();status.textContent='Choose any parts below. A photo or automatic match is optional.';break;
      case 'primary':primary=Number(el.dataset.index);editing=primary;sources={};clearResults();renderPhotos();break;
      case 'edit':editing=Number(el.dataset.index);renderPhotos();break;
      case 'remove':{const i=Number(el.dataset.index);URL.revokeObjectURL(photos[i].url);photos.splice(i,1);primary=Math.min(primary,Math.max(0,photos.length-1));editing=primary;sources={};clearResults();renderPhotos();break;}
      case 'rotate':void rotate();break;
      case 'suggest':void suggest();break;
      case 'preview':{
        try{const selections=validateReviewed();invalidatePreview();setBusy(true);status.textContent='Rendering reviewed choices in Bricktrait…';send({type:'questlog:portrait-preview-selections',selections,revision});timer=setTimeout(()=>{if(!disposed){setBusy(false);showError('Preview could not load. Reconnect to cache selected part geometry, then try again.');}},30000);}catch(reason){showError(reason.message);}break;
      }
      case 'apply':{
        try{const selections=validateReviewed();setBusy(true);status.textContent='Applying reviewed choices…';send({type:'questlog:portrait-apply-selections',selections});timer=setTimeout(()=>{if(!disposed){setBusy(false);showError('The editor did not respond. Try again.');}},10000);}catch(reason){showError(reason.message);}break;
      }
    }
  },{signal});
  container.addEventListener('change',event=>{
    const el=event.target;
    if(el.matches('[data-photo-files],[data-photo-camera]')){void addFiles(el.files);el.value='';}
    if(el.matches('[data-edit-photo]')){editing=Number(el.value);renderAdjustment();}
    if(el.matches('[data-edit-region]'))renderAdjustment();
    if(el.dataset.visible){photos[sources[el.dataset.visible]??primary].visible[el.dataset.visible]=el.checked;clearResults();renderAdjustment();}
    if(el.dataset.source){sources[el.dataset.source]=Number(el.value);editing=Number(el.value);q('[data-edit-region]').value=el.dataset.source;clearResults();renderPhotos();}
    if(el.dataset.color&&choices[el.dataset.slot]){choices[el.dataset.slot][el.dataset.color]=el.value===''?null:Number(el.value);invalidatePreview();}
    if(el.dataset.collection)renderPalette(el.dataset.collection);
  },{signal});
  container.addEventListener('input',event=>{const el=event.target;if(el.dataset.rect!==undefined){const r=[...editRect()];r[Number(el.dataset.rect)]=Number(el.value)/100;setRect(r);}if(el.dataset.search)renderPalette(el.dataset.search);},{signal});
  container.addEventListener('toggle',event=>{if(event.target.matches('[data-palette]')&&event.target.open)renderPalette(event.target.dataset.palette);},{signal,capture:true});
  let drag=null;const cropElement=q('.portrait-crop');
  cropElement.addEventListener('pointerdown',event=>{const handle=event.target.closest('[data-handle]');if(!handle||busy)return;event.preventDefault();const bounds=cropElement.getBoundingClientRect(),crop=q('[data-edit-region]').value==='crop'?[0,0,1,1]:photos[editing].crop;drag={id:event.pointerId,x:event.clientX,y:event.clientY,rect:[...editRect()],resize:handle.dataset.handle==='resize',width:bounds.width*crop[2],height:bounds.height*crop[3]};cropElement.setPointerCapture(event.pointerId);},{signal});
  cropElement.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const r=[...drag.rect],dx=(event.clientX-drag.x)/drag.width,dy=(event.clientY-drag.y)/drag.height;if(drag.resize){r[2]+=dx;r[3]+=dy;}else{r[0]=Math.max(0,Math.min(1-r[2],r[0]+dx));r[1]=Math.max(0,Math.min(1-r[3],r[1]+dy));}setRect(r);},{signal});
  for(const type of ['pointerup','pointercancel'])cropElement.addEventListener(type,()=>{drag=null;},{signal});
  container.addEventListener('dragover',event=>event.preventDefault(),{signal});container.addEventListener('drop',event=>{event.preventDefault();void addFiles(event.dataTransfer.files);},{signal});
  navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='questlog:portrait-palette-cache'){const d=event.data;q('.portrait-palette-cache').textContent=d.error||(d.complete?'Visual palette cached for offline matching.':`Caching visual palette: ${d.done} / ${d.total}`);}},{signal});
  // Static same-origin data only. Uploaded pixels never enter a network request.
  fetch(new URL('./portrait-maker/portrait-match-index.json',import.meta.url),{signal}).then(r=>{if(!r.ok)throw new Error('Local matching data is not cached.');return r.json();}).then(data=>{
    if(disposed)return;index=validateMatchIndex(data);if(!editorReady){catalog=index.parts;colors=index.colors;}status.textContent='Local part palette ready. Add a photo or browse manually.';if(!busy)setBusy(false);
  }).catch(reason=>{if(!disposed){showError(`${reason.message} You can still browse parts from the editor.`);if(!busy)setBusy(false);}});
  setBusy(false);
  return {
    ready(parts,palette){editorReady=true;catalog=parts;colors=palette;if(!busy)setBusy(false);},
    previewed({image,message,revision:received}){if(disposed||received!==revision)return;clearTimeout(timer);setBusy(false);if(message){showError(message);return;}if(!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(image)||image.length>180000){showError('Could not render preview.');return;}const img=q('.portrait-photo-assembly');img.src=image;img.hidden=false;previewReady=true;status.textContent='Preview ready. Apply to continue editing, then choose Use portrait to save.';updateApply();},
    applied(message){clearTimeout(timer);setBusy(false);if(message)showError(message);else{status.textContent='Reviewed choices applied. Continue editing below or choose Use portrait to save.';container.open=false;}},
    dispose(){disposed=true;run++;events.abort();worker?.terminate();request?.reject(new Error('Closed'));clearTimeout(timer);photos.forEach(p=>URL.revokeObjectURL(p.url));photos=[];index=null;catalog=[];references={};choices={};container.replaceChildren();}
  };
}
