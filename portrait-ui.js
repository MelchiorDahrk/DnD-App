import {validPortrait} from './portrait.js';
import {mountPortraitPhotos} from './portrait-photo-ui.js';

export function openPortraitMaker({character,onSave}) {
  const dialog=document.createElement('dialog');
  dialog.className='portrait-dialog';
  dialog.setAttribute('aria-labelledby','portrait-title');
  dialog.innerHTML=`<header class="portrait-header"><div><h2 id="portrait-title">Make your character portrait.</h2><p>Choose fantasy parts, colours, and a pose. Portraits save with a transparent background. Made with <a href="https://github.com/Maxichance/bricktrait" target="_blank" rel="noopener noreferrer">Bricktrait by Maxichance</a>.</p></div><div class="portrait-actions"><button type="button" class="btn" data-portrait-close>Cancel</button><button type="button" class="btn btn-primary portrait-use" disabled>Use portrait</button></div></header><p class="portrait-status" role="status">Opening Bricktrait…</p><p class="portrait-error" role="alert" hidden></p><iframe title="Bricktrait character portrait maker" class="portrait-editor" allow="clipboard-write"></iframe>`;
  dialog.querySelector('.portrait-header p').firstChild.textContent='Choose fantasy and CMF parts, colours, and a pose, or start from a LEGO photo. Portraits save with a transparent background. Made with ';
  const photoPanel=document.createElement('details');photoPanel.className='portrait-photo-panel';
  dialog.querySelector('.portrait-header').after(photoPanel);
  const frame=dialog.querySelector('iframe');
  const status=dialog.querySelector('.portrait-status');
  const error=dialog.querySelector('.portrait-error');
  const use=dialog.querySelector('.portrait-use');
  const session=crypto.randomUUID();
  const photos=mountPortraitPhotos(photoPanel,{send:data=>frame.contentWindow.postMessage({...data,session},location.origin)});
  frame.name=session;
  // Keep the URL stable so the editor can reopen from the service-worker cache.
  frame.src='./portrait-maker/';
  document.body.append(dialog);
  function showError(message) {error.textContent=message;error.hidden=false;}
  const timeout=setTimeout(()=>{status.textContent='The portrait maker is taking longer than expected. Close it and try again when the app is available.';},30000);
  function receive(event) {
    if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.session!==session)return;
    switch(event.data.type) {
      case 'questlog:portrait-ready':
        clearTimeout(timeout);status.textContent='Loading portrait parts…';
        frame.contentWindow.postMessage({type:'questlog:portrait-init',session,design:character.portrait?.design},location.origin);
        break;
      case 'questlog:portrait-loaded':
        status.hidden=event.data.webgl;
        if(!event.data.webgl)status.textContent='The portrait maker needs WebGL. Try a browser with graphics acceleration enabled.';
        use.disabled=!event.data.webgl;
        if(event.data.webgl&&Array.isArray(event.data.catalog)&&Array.isArray(event.data.colors))photos.ready(event.data.catalog,event.data.colors);
        break;
      case 'questlog:portrait-selections-applied':photos.applied();break;
      case 'questlog:portrait-selections-preview':photos.previewed(event.data);break;
      case 'questlog:portrait-selections-error':photos.applied(event.data.message||'Could not apply these selections.');break;
      case 'questlog:portrait-error':
        showError(event.data.message);use.disabled=false;use.textContent='Use portrait';break;
      case 'questlog:portrait-cancel':dialog.close();break;
      case 'questlog:portrait-save':
        use.disabled=false;use.textContent='Use portrait';
        if(!validPortrait(event.data.portrait)){showError('The portrait could not be saved. Try another design.');return;}
        try {onSave(structuredClone(event.data.portrait));dialog.close();}
        catch(reason){showError(reason.message||'Could not save this portrait.');}
        break;
    }
  }
  window.addEventListener('message',receive);
  dialog.querySelector('[data-portrait-close]').addEventListener('click',()=>dialog.close());
  use.addEventListener('click',()=>{error.hidden=true;use.disabled=true;use.textContent='Rendering…';frame.contentWindow.postMessage({type:'questlog:portrait-request-save',session},location.origin);});
  dialog.addEventListener('close',()=>{clearTimeout(timeout);photos.dispose();window.removeEventListener('message',receive);dialog.remove();},{once:true});
  dialog.showModal();
}
