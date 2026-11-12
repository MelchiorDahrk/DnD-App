import {ABILITIES,SKILLS,CLASSES,COINS,SHEET_TEXT,CONDITIONS,uid} from './model.js';
import {SCAN_LIMITS,characterFromScan,validateScannedCharacter,validateScanImages,scanServiceURL} from './sheet-scan.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,extra='')=>`<button type="button" class="btn" data-scan-action="${action}" ${extra}>${label}</button>`;
const input=(label,path,value,type='text',extra='')=>`<label class="form-field">${esc(label)}<input name="${path}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const numeric=(label,path,value,min=0,max=9999)=>input(label,path,value,'number',`required min="${min}" max="${max}" step="1"`);
const select=(label,path,value,options)=>`<label class="form-field">${esc(label)}<select name="${path}">${options.map(v=>`<option value="${esc(v)}" ${value===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
const check=(label,path,value)=>`<label class="check-field"><input type="checkbox" name="${path}" ${value?'checked':''}>${esc(label)}</label>`;
const area=(label,path,value,max=20000)=>`<label class="form-field full">${esc(label)}<textarea name="${path}" rows="3" maxlength="${max}">${esc(value)}</textarea></label>`;
const section=(title,body,open=false)=>`<details class="scan-section" ${open?'open':''}><summary>${esc(title)}</summary><div class="form-grid">${body}</div></details>`;
let lastServiceURL='';
let dismissPrevious=()=>{};

async function preparePhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose JPG, PNG, or WebP photos. Convert HEIC or PDF pages to JPG first.');
  if(!file.size||file.size>SCAN_LIMITS.fileBytes)throw new Error('Each photo must be smaller than 15 MB.');
  const url=URL.createObjectURL(file),img=new Image();
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('This photo could not be opened. Try exporting it as JPG.'));img.src=url;});
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>60000000)throw new Error('This photo is too large to open. Export a smaller copy.');
    const scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser could not prepare the photo. Try a different browser.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',0.9);validateScanImages([data]);
    return {name:file.name,data};
  }finally{URL.revokeObjectURL(url);}
}

export function openSheetScanner({modal,setModal,onCreate}) {
  dismissPrevious();
  const events=new AbortController();let request=null,photos=[],busy=false,disposed=false,service=lastServiceURL,accessCode='',draft=null;
  const dispose=()=>{disposed=true;events.abort();request?.abort();photos=[];draft=null;accessCode='';if(modal.querySelector('[data-sheet-scanner]'))modal.replaceChildren();modal.classList.remove('scan-dialog');};
  dismissPrevious=dispose;modal.classList.add('scan-dialog');
  modal.addEventListener('close',dispose,{once:true,signal:events.signal});
  function showError(error){if(disposed)return;const el=modal.querySelector('#form-error');if(el){el.hidden=false;el.className='form-error';el.textContent=error.message;el.scrollIntoView({block:'nearest'});}}
  function pages(full=false){return `<div class="scan-pages ${full?'scan-pages-full':''}">${photos.map((p,i)=>`<figure><img src="${p.data}" alt="Sheet page ${i+1}" ${full?'':'loading="lazy"'}><figcaption>Page ${i+1} · ${esc(p.name)}</figcaption>${full?'':button('remove-photo','Remove',`data-index="${i}" aria-label="Remove page ${i+1}"`)}</figure>`).join('')}</div>`;}
  function upload(){
    setModal('Bring your paper hero along.',`<section data-sheet-scanner="upload"><div class="scan-steps"><span class="active">1 · Add photos</span><span>2 · Review & create</span></div><p class="modal-intro">Scan a printed or handwritten 5e sheet. Add up to six photos of the same character, including spell and equipment pages.</p>
      <div class="scan-drop"><strong>A whole character, from paper to pocket.</strong><p>Use a flat, well-lit page with all four corners visible. Check that small handwriting is in focus.</p><div class="scan-photo-actions">${button('choose','Choose photos')}${button('camera','Take a photo')}</div><input type="file" data-scan-files accept="image/jpeg,image/png,image/webp" multiple hidden><input type="file" data-scan-camera accept="image/jpeg,image/png,image/webp" capture="environment" hidden><p class="form-help">JPG, PNG, or WebP · 15 MB per photo · Drop photos here</p></div>
      ${pages()}<p class="scan-status" role="status" aria-live="polite">${photos.length?`${photos.length} of 6 pages ready.`:'No photos added yet.'}</p>
      <details class="scan-section"><summary>Connect a scan service</summary><div class="form-grid">${input('Scan service URL (blank = this host)','scanService',service,'url','placeholder="https://your-service.example/api/scan-sheet"')}${input('Service access code (if required)','scanAccess',accessCode,'password','autocomplete="off"')}</div><p class="form-help">Scanning needs a connected service. On GitHub Pages, enter the service URL supplied by your host. The access code stays in this dialog; it is never saved in a backup. Setup instructions are in the project README.</p></details>
      <p class="scan-privacy">Scan & review sends these photos to the selected scan service and OpenAI for transcription. It needs internet access and may use paid API credits. Photos are kept only for this review in Questlog; the saved character contains text and stats. Unclear handwriting will need checking.</p><div class="modal-actions">${button('cancel','Cancel')}<button type="submit" class="btn btn-primary" ${photos.length?'':'disabled'}>Scan & review</button></div></section>`,()=>{void scan();});
  }
  function collection(title,key,entries,fields){
    return section(`${title} (${entries.length})`,entries.length?entries.map((v,i)=>`<article class="scan-entry full" data-scan-collection="${key}" data-index="${i}"><div class="scan-entry-heading"><strong>${esc(v.name)}</strong>${button('remove-entry','Remove',`aria-label="Remove ${esc(v.name)}"`)}</div><div class="form-grid">${fields(v,`${key}.${i}`)}</div></article>`).join(''):'<p class="form-help full">No entries read from these pages. You can add more after creating the character.</p>');
  }
  function review(scanResult){
    draft=scanResult.character;const c=draft;
    const identity=input('Character name','name',c.name,'text','required maxlength="120" autofocus')+input('Player name','playerName',c.playerName,'text','maxlength="120"')+input('Species / race','race',c.race,'text','maxlength="500"')+select('Class','class',c.class,Object.keys(CLASSES))+input('Subclass','subclass',c.subclass,'text','maxlength="500"')+numeric('Level','level',c.level,1,20)+input('Background','background',c.background,'text','maxlength="500"')+input('Alignment','alignment',c.alignment,'text','maxlength="500"')+input('Campaign','campaign',c.campaign,'text','maxlength="500"')+numeric('Experience points','xp',c.xp,0,100000000);
    const combat=Object.entries(ABILITIES).map(([k,v])=>numeric(v,`stats.${k}`,c.stats[k],1,30)).join('')+numeric('Maximum HP','maxHp',c.maxHp,1)+numeric('Current HP','hp',c.hp)+numeric('Temporary HP','tempHp',c.tempHp)+numeric('Total armor class','ac',c.ac,0,99)+numeric('Base walking speed (ft.)','speed',c.speed,0,999)+numeric('Initiative adjustment (beyond Dexterity)','initiativeBonus',c.initiativeBonus,-99,99)+numeric('Passive Perception adjustment','passivePerceptionBonus',c.passivePerceptionBonus,-99,99)+select('Hit die size','hitDie',String(c.hitDie),['6','8','10','12'])+numeric('Hit dice remaining','hitDice',c.hitDice,0,20)+numeric('Death save successes','deathSuccess',c.deathSuccess,0,3)+numeric('Death save failures','deathFailure',c.deathFailure,0,3)+numeric('Exhaustion','exhaustion',c.exhaustion,0,6)+check('Inspiration','inspiration',c.inspiration)+area(SHEET_TEXT.defenses,'defenses',c.defenses);
    const skills=Object.entries(SKILLS).map(([name])=>select(name,`skill.${name}`,c.expertise.includes(name)?'Expertise':c.skills.includes(name)?'Proficient':'Untrained',['Untrained','Proficient','Expertise'])).join('')+Object.entries(ABILITIES).map(([key,label])=>check(`${label} save proficiency`,`save.${key}`,c.saves.includes(key))).join('')+CONDITIONS.map(v=>check(v,`condition.${v}`,c.conditions.includes(v))).join('');
    setModal('A new chapter, checked by you.',`<section data-sheet-scanner="review"><div class="scan-steps"><span>1 · Add photos</span><span class="active">2 · Review & create</span></div><p class="modal-intro">Compare every section with your photos. Written values and older rules are preserved. Saving adds a new character; your existing characters stay as they are.</p>
      ${scanResult.warnings.length?`<div class="scan-warnings" role="status"><strong>Check these details</strong><ul>${scanResult.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}
      <details class="scan-section"><summary>Compare original photos (${photos.length})</summary>${pages(true)}</details>
      ${section('Character details',identity,true)}${section('Ability scores & combat',combat,true)}${section('Skills, saves & conditions',skills)}
      ${section('Personality, languages & proficiencies',Object.entries(SHEET_TEXT).filter(([k])=>k!=='defenses').map(([k,v])=>area(v,k,c[k])).join(''))}
      ${section('Coin purse',Object.entries(COINS).map(([k,v])=>numeric(v.toUpperCase(),k,c[k],0,100000000)).join(''))}
      ${collection('Attacks','attacks',c.attacks,(v,p)=>input('Name',`${p}.name`,v.name,'text','required maxlength="200"')+select('Ability',`${p}.ability`,v.ability,Object.keys(ABILITIES))+numeric('Additional attack bonus',`${p}.bonus`,v.bonus,-99,99)+check('Proficient',`${p}.proficient`,v.proficient)+input('Damage dice, including modifier',`${p}.damage`,v.damage,'text','required maxlength="30"')+input('Damage type',`${p}.type`,v.type,'text','maxlength="100"')+input('Range / reach',`${p}.range`,v.range,'text','maxlength="100"')+area('Attack notes',`${p}.notes`,v.notes))}
      ${collection('Equipment','items',c.items,(v,p)=>input('Name',`${p}.name`,v.name,'text','required maxlength="200"')+select('Category',`${p}.category`,v.category,['Weapon','Armor','Gear','Consumable','Treasure'])+numeric('Quantity',`${p}.qty`,v.qty,0,99999)+input('Weight per item (lb.)',`${p}.weight`,v.weight,'number','required min="0" max="99999" step="0.01"')+check('Equipped',`${p}.equipped`,v.equipped)+area('Description',`${p}.description`,v.description))}
      ${collection('Features & resources','features',c.features,(v,p)=>input('Name',`${p}.name`,v.name,'text','required maxlength="200"')+numeric('Maximum uses',`${p}.maxUses`,v.maxUses,0,999)+numeric('Used',`${p}.used`,v.used,0,999)+select('Refresh',`${p}.reset`,v.reset,['manual','short','long'])+input('Roll formula (optional)',`${p}.rollFormula`,v.rollFormula,'text','maxlength="30"')+area('Description',`${p}.description`,v.description))}
      ${collection('Spells','spells',c.spells,(v,p)=>input('Name',`${p}.name`,v.name,'text','required maxlength="200"')+numeric('Spell level (0 = cantrip)',`${p}.level`,v.level,0,9)+input('School',`${p}.school`,v.school,'text','maxlength="2000"')+input('Casting time',`${p}.castingTime`,v.castingTime,'text','maxlength="2000"')+input('Range',`${p}.range`,v.range,'text','maxlength="2000"')+input('Duration',`${p}.duration`,v.duration,'text','maxlength="2000"')+check('Concentration',`${p}.concentration`,v.concentration)+check('Prepared',`${p}.prepared`,v.prepared)+area('Spell notes',`${p}.notes`,v.notes))}
      ${section('Spellcasting & slots',select('Casting ability','spellAbility',c.spellAbility,['auto',...Object.keys(ABILITIES)])+c.slots.map((v,i)=>numeric(`Level ${i+1} total slots`,`slots.${i}.max`,v.max,0,99)+numeric(`Level ${i+1} used slots`,`slots.${i}.used`,v.used,0,99)).join(''))}
      ${section('Transcription & review notes',area('Notes saved to the journal','importNotes',c.notes[0]?.body||'',100000))}
      <label class="check-field"><input type="checkbox" name="reviewed" required>I checked the transcription against my paper sheet.</label><p class="form-help">Questlog calculates rolls and rests using its 2024 tracker rules. Review differences with your table when importing an older sheet.</p><div class="modal-actions">${button('back','Back to photos')}<button type="submit" class="btn btn-primary">Create character</button></div></section>`,data=>{
        const next=structuredClone(draft);
        for(const el of modal.querySelectorAll('[name]')){
          if(['reviewed','importNotes'].includes(el.name)||el.name.startsWith('skill.')||el.name.startsWith('save.')||el.name.startsWith('condition.'))continue;
          const parts=el.name.split('.');let target=next;for(const part of parts.slice(0,-1))target=target[part];
          target[parts.at(-1)]=el.type==='checkbox'?el.checked:el.type==='number'||el.name==='hitDie'?Number(el.value):el.value.trim();
        }
        for(const key of ['attacks','items','features','spells']){const kept=new Set([...modal.querySelectorAll(`[data-scan-collection="${key}"]`)].map(v=>Number(v.dataset.index)));next[key]=next[key].filter((_,i)=>kept.has(i));}
        next.skills=[];next.expertise=[];next.saves=[];next.conditions=[];
        for(const name of Object.keys(SKILLS)){const v=data.get(`skill.${name}`);if(v==='Proficient')next.skills.push(name);if(v==='Expertise')next.expertise.push(name);}
        for(const key of Object.keys(ABILITIES))if(data.has(`save.${key}`))next.saves.push(key);
        for(const name of CONDITIONS)if(data.has(`condition.${name}`))next.conditions.push(name);
        const notes=String(data.get('importNotes')||'').trim();next.notes=notes?[{id:uid(),title:'Paper sheet import',body:notes,tag:'Personal',pinned:false,updated:new Date().toISOString()}]:[];
        if(next.hp>next.maxHp)throw new Error('Current HP cannot exceed maximum HP.');
        if(next.hitDice>next.level)throw new Error('Hit dice remaining cannot exceed character level.');
        if(next.features.some(v=>v.used>v.maxUses))throw new Error('Used feature charges cannot exceed maximum uses.');
        if(next.slots.some(v=>v.used>v.max))throw new Error('Used spell slots cannot exceed total slots.');
        validateScannedCharacter(next);onCreate(next);modal.close();
      });
  }
  async function addFiles(files){
    if(busy)return;
    const incoming=[...files];if(!incoming.length)return;
    if(photos.length+incoming.length>SCAN_LIMITS.pages){showError(new Error('Use up to six photos for one character.'));return;}
    busy=true;const status=modal.querySelector('.scan-status');if(status)status.textContent='Preparing photos…';
    modal.querySelector('button[type="submit"]').disabled=true;
    try{const prepared=[];for(const file of incoming)prepared.push(await preparePhoto(file));if(disposed)return;validateScanImages([...photos,...prepared].map(v=>v.data));photos.push(...prepared);upload();}
    catch(error){showError(error);if(status)status.textContent='The photos could not be added. Try again.';}
    finally{busy=false;if(!disposed){const submit=modal.querySelector('button[type="submit"]');if(submit)submit.disabled=!photos.length;}}
  }
  async function scan(){
    if(busy||!photos.length)return;
    if(!navigator.onLine){showError(new Error('Connect to the internet to scan a sheet. Your saved characters are available offline.'));return;}
    let endpoint;try{endpoint=scanServiceURL(service,document.baseURI);}catch(error){showError(error);return;}
    busy=true;request=new AbortController();const timer=setTimeout(()=>request?.abort(),125000);
    modal.querySelectorAll('button:not([data-action="close"]),input').forEach(el=>el.disabled=true);
    const status=modal.querySelector('.scan-status');status.textContent='Reading your sheet… This can take a minute. You can close this dialog to cancel.';status.setAttribute('aria-busy','true');
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(accessCode?{Authorization:`Bearer ${accessCode}`}:{})},body:JSON.stringify({images:photos.map(v=>v.data)}),signal:request.signal,credentials:'omit',cache:'no-store',redirect:'error'});
      let result;try{result=await response.json();}catch{throw new Error('No scan service was found here. On GitHub Pages, connect a scan service below. See the README for setup.');}
      if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'Scanning failed. Please try again.');
      if(disposed)return;review(characterFromScan(result.scan));
    }catch(error){if(!disposed){upload();showError(error.name==='AbortError'?new Error('Scanning timed out. Try fewer pages or clearer photos.'):error instanceof TypeError?new Error('Could not reach the scan service. Check your connection and service URL.'):error);}}
    finally{clearTimeout(timer);busy=false;request=null;}
  }
  modal.addEventListener('click',event=>{
    const el=event.target.closest('[data-scan-action]');if(!el)return;
    switch(el.dataset.scanAction){
      case 'cancel':modal.close();break;
      case 'choose':if(!busy)modal.querySelector('[data-scan-files]')?.click();break;
      case 'camera':if(!busy)modal.querySelector('[data-scan-camera]')?.click();break;
      case 'remove-photo':if(!busy){photos.splice(Number(el.dataset.index),1);upload();}break;
      case 'remove-entry':el.closest('[data-scan-collection]').remove();break;
      case 'back':upload();break;
    }
  },{signal:events.signal});
  modal.addEventListener('change',event=>{if(event.target.matches('[data-scan-files],[data-scan-camera]')){void addFiles(event.target.files);event.target.value='';}},{signal:events.signal});
  modal.addEventListener('invalid',event=>{let details=event.target.closest('details');while(details){details.open=true;details=details.parentElement.closest('details');}},{capture:true,signal:events.signal});
  modal.addEventListener('input',event=>{if(event.target.name==='scanService'){service=event.target.value.trim();lastServiceURL=service;}if(event.target.name==='scanAccess')accessCode=event.target.value;},{signal:events.signal});
  modal.addEventListener('dragover',event=>{if(modal.querySelector('[data-sheet-scanner="upload"]'))event.preventDefault();},{signal:events.signal});
  modal.addEventListener('drop',event=>{if(modal.querySelector('[data-sheet-scanner="upload"]')){event.preventDefault();void addFiles(event.dataTransfer.files);}},{signal:events.signal});
  upload();
}
