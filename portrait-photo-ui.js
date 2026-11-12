import {PORTRAIT_PHOTO_LIMITS,PORTRAIT_SLOTS,validatePortraitPhotos,validatePortraitSuggestions,portraitServiceURL} from './portrait-scan.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastServiceURL='';

async function preparePhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose JPG, PNG, or WebP. Export HEIC photos as JPG first.');
  if(!file.size||file.size>PORTRAIT_PHOTO_LIMITS.fileBytes)throw new Error('Each photo must be smaller than 15 MB.');
  const url=URL.createObjectURL(file),img=new Image();
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('This photo could not be opened. Try exporting it as JPG.'));img.src=url;});
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>60000000)throw new Error('Export a smaller copy of this photo.');
    const scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser could not prepare the photo. Try another browser.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',0.88);validatePortraitPhotos([data]);
    return {name:file.name,data};
  }finally{URL.revokeObjectURL(url);}
}

export function mountPortraitPhotos(container,{send}){
  container.innerHTML=`<summary>Start from a LEGO photo</summary><div class="portrait-photo-content">
    <p>Upload up to three views of the same minifigure. We’ll suggest matching parts and colours, including CMFs (Collectible Minifigures). Use one foreground figure and keep its face, clothes, and accessories in focus.</p>
    <div class="portrait-photo-actions"><button type="button" class="btn" data-photo="choose">Choose photos</button><button type="button" class="btn" data-photo="camera">Take a photo</button><span>JPG, PNG, WebP · 15 MB each · Drop photos here</span></div>
    <input type="file" data-photo-files accept="image/jpeg,image/png,image/webp" multiple hidden><input type="file" data-photo-camera accept="image/jpeg,image/png,image/webp" capture="environment" hidden>
    <div class="portrait-photo-previews"></div>
    <details class="portrait-photo-service"><summary>Connect a photo service</summary><div class="form-grid"><label class="form-field">Photo service URL (blank = this host)<input type="url" name="portraitService" placeholder="https://your-service.example/api/suggest-portrait" value="${esc(lastServiceURL)}"></label><label class="form-field">Service access code (if required)<input type="password" name="portraitAccess" autocomplete="off"></label></div><p>GitHub Pages needs a connected photo service. You can use the same service and access code as sheet scanning. Setup instructions are in the README.</p></details>
    <p class="portrait-photo-privacy">Suggest selections sends these photos to your chosen service and OpenAI for analysis and may use API credits. Photos stay in this dialog only; they are excluded from saved portraits and backups.</p>
    <div class="portrait-photo-actions"><button type="button" class="btn btn-primary" data-photo="suggest" disabled>Suggest selections</button><button type="button" class="btn" data-photo="stop" hidden>Stop analysis</button></div>
    <p class="portrait-photo-status" role="status" aria-live="polite">Add a photo to get started.</p><p class="portrait-photo-error" role="alert" hidden></p>
    <div class="portrait-photo-results" hidden></div></div>`;
  const events=new AbortController();let photos=[],catalog=[],colors=[],result=null,busy=false,disposed=false,request=null,applyTimer=null;
  const q=selector=>container.querySelector(selector);
  const status=q('.portrait-photo-status'),error=q('.portrait-photo-error'),results=q('.portrait-photo-results');
  const showError=message=>{error.textContent=message;error.hidden=false;};
  const setBusy=value=>{
    busy=value;container.setAttribute('aria-busy',String(value));
    container.querySelectorAll('button,input').forEach(el=>el.disabled=value);
    q('[data-photo="stop"]').hidden=!request;q('[data-photo="stop"]').disabled=false;
    q('[data-photo="suggest"]').disabled=value||!photos.length||!catalog.length;
  };
  function clearResults(){result=null;results.replaceChildren();results.hidden=true;}
  function renderPhotos(){
    q('.portrait-photo-previews').innerHTML=photos.map((p,i)=>`<figure><img src="${p.data}" alt="LEGO character reference ${i+1}"><figcaption>${esc(p.name)}</figcaption><button type="button" class="btn" data-photo="remove" data-index="${i}" aria-label="Remove photo ${i+1}">Remove</button></figure>`).join('');
    status.textContent=photos.length?`${photos.length} of 3 photos ready.${catalog.length?'':' Waiting for the portrait maker…'}`:'Add a photo to get started.';
  }
  async function addFiles(files){
    if(busy||disposed)return;const incoming=[...files];if(!incoming.length)return;
    container.open=true;error.hidden=true;
    if(photos.length+incoming.length>PORTRAIT_PHOTO_LIMITS.photos){showError('Use up to three views of the same character. Remove a photo first.');return;}
    setBusy(true);status.textContent='Preparing photos…';
    try{
      const prepared=[];for(const file of incoming)prepared.push(await preparePhoto(file));
      if(disposed)return;validatePortraitPhotos([...photos,...prepared].map(p=>p.data));
      photos.push(...prepared);clearResults();renderPhotos();
    }catch(reason){if(!disposed){renderPhotos();showError(reason.message);}}
    finally{if(!disposed)setBusy(false);}
  }
  function renderSuggestions(){
    const partById=new Map(catalog.map(p=>[p.id,p]));const colorName=code=>colors.find(c=>c.code===code)?.name;
    results.innerHTML=`<h3>Suggested portrait selections</h3><p>${esc(result.summary)}</p>${result.warnings.length?`<ul class="portrait-photo-warnings">${result.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}<p>Choose the suggestions to apply. Low-confidence matches start unchecked. Unchecked parts keep their current selection.</p><div class="portrait-photo-matches">${result.selections.map((s,i)=>{
      const name=s.id===null?'Remove accessory':partById.get(s.id).name;
      const palette=[['color','Colour'],['arms','Arms'],['hands','Hands'],['hips','Hips']].filter(([key])=>s[key]!==null).map(([key,label])=>`${label}: ${colorName(s[key])}`).join(' · ');
      return `<label class="portrait-photo-match"><input type="checkbox" data-match="${i}" ${s.confidence==='low'?'':'checked'}><span><strong>${esc(PORTRAIT_SLOTS[s.slot])} · ${esc(name)}</strong><small>${esc(s.confidence)} confidence${s.id?` · ${esc(s.id)}`:''}${palette?` · ${esc(palette)}`:''}</small><span>${esc(s.reason)}</span></span></label>`;
    }).join('')}</div><button type="button" class="btn btn-primary" data-photo="apply">Apply selected suggestions</button><p>Keep editing any part below. Choose Use portrait when you’re happy with the result.</p>`;
    results.hidden=false;updateApply();
  }
  function updateApply(){const apply=q('[data-photo="apply"]');if(apply)apply.disabled=busy||!results.querySelector('[data-match]:checked');}
  async function suggest(){
    if(busy||!photos.length||!catalog.length)return;
    error.hidden=true;
    if(!navigator.onLine){showError('Connect to the internet for photo suggestions. Manual portrait editing works offline with cached parts.');return;}
    let endpoint;try{endpoint=portraitServiceURL(q('[name="portraitService"]').value.trim(),document.baseURI);}catch(reason){showError(reason.message);return;}
    const accessCode=q('[name="portraitAccess"]').value;
    clearResults();request=new AbortController();const timer=setTimeout(()=>request?.abort(),125000);setBusy(true);
    status.textContent='Matching your LEGO character… This may take a minute. You can stop analysis or close the portrait maker to cancel.';
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(accessCode?{Authorization:`Bearer ${accessCode}`}:{})},body:JSON.stringify({images:photos.map(p=>p.data)}),signal:request.signal,credentials:'omit',cache:'no-store',redirect:'error'});
      let data;try{data=await response.json();}catch{throw new Error('No photo service was found. On GitHub Pages, open “Connect a photo service” and enter your service URL. See the README for setup.');}
      if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Could not suggest selections. Try again.');
      if(disposed)return;result=validatePortraitSuggestions(data.suggestions,catalog,colors);renderSuggestions();status.textContent='Suggestions are ready. Review the matches, then apply the ones you want.';
    }catch(reason){if(!disposed){status.textContent='Your current portrait is unchanged.';showError(reason.name==='AbortError'?'Photo analysis stopped or timed out. You can try again.':reason instanceof TypeError?'Could not reach the photo service. Check your connection and service URL.':reason.message);}}
    finally{clearTimeout(timer);request=null;if(!disposed){setBusy(false);updateApply();}}
  }
  container.addEventListener('click',event=>{
    const action=event.target.closest('[data-photo]');if(!action)return;
    if(action.dataset.photo==='stop'){request?.abort();return;}if(busy)return;
    switch(action.dataset.photo){
      case 'choose':q('[data-photo-files]').click();break;
      case 'camera':q('[data-photo-camera]').click();break;
      case 'remove':photos.splice(Number(action.dataset.index),1);clearResults();renderPhotos();setBusy(false);break;
      case 'suggest':void suggest();break;
      case 'apply':{
        const selections=[...results.querySelectorAll('[data-match]:checked')].map(el=>result.selections[Number(el.dataset.match)]);
        if(!selections.length)return;error.hidden=true;setBusy(true);status.textContent='Applying selected suggestions…';
        send({type:'questlog:portrait-apply-selections',selections});
        applyTimer=setTimeout(()=>{if(!disposed){setBusy(false);updateApply();showError('The portrait maker did not respond. Try applying again.');}},10000);break;
      }
    }
  },{signal:events.signal});
  container.addEventListener('change',event=>{if(event.target.matches('[data-photo-files],[data-photo-camera]')){void addFiles(event.target.files);event.target.value='';}if(event.target.matches('[data-match]'))updateApply();},{signal:events.signal});
  container.addEventListener('input',event=>{if(event.target.name==='portraitService')lastServiceURL=event.target.value.trim();},{signal:events.signal});
  container.addEventListener('dragover',event=>event.preventDefault(),{signal:events.signal});
  container.addEventListener('drop',event=>{event.preventDefault();void addFiles(event.dataTransfer.files);},{signal:events.signal});
  return {
    ready(parts,palette){catalog=parts;colors=palette;if(!busy){renderPhotos();setBusy(false);}},
    applied(message){clearTimeout(applyTimer);setBusy(false);updateApply();if(message){showError(message);status.textContent='Suggestions could not be applied.';}else{status.textContent='Selected suggestions applied. Continue editing below, or choose Use portrait to save.';container.open=false;}},
    dispose(){disposed=true;events.abort();request?.abort();clearTimeout(applyTimer);photos=[];result=null;container.replaceChildren();}
  };
}
