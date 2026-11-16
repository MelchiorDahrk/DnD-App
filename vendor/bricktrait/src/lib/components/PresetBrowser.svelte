<script lang="ts">
  import {onMount} from 'svelte';
  import {asset} from '../../paths.js';
  import {filterPresets,readPresetPreferences} from '../presets.js';
  let {onapply,ready,oncustomize}: {onapply:(preset:any)=>void;ready:boolean;oncustomize:()=>void}=$props();
  let presets:any[]=$state([]),error=$state(''),loading=$state(true),selected=$state('');
  let query=$state(''),theme=$state(''),archetype=$state(''),species=$state(''),kind=$state(''),compatibility=$state(''),collection=$state(''),sort=$state('name'),page=$state(1);
  let favorites:string[]=$state([]),recent:string[]=$state([]);
  let offlineSupported=$state(false),offlineBusy=$state(false),offlineStatus=$state('');
  const perPage=24;
  const themes=$derived([...new Set(presets.flatMap(p=>[p.theme,...p.themes||[]]))].sort());
  const archetypes=$derived([...new Set(presets.flatMap(p=>p.archetypes||[]))].sort());
  const speciesList=$derived([...new Set(presets.map(p=>p.species).filter(Boolean))].sort());
  const filtered=$derived(filterPresets(presets,{query,theme,archetype,species,kind,compatibility,collection,sort,favorites,recent}));
  const pages=$derived(Math.max(1,Math.ceil(filtered.length/perPage)));
  const visible=$derived(filtered.slice((Math.min(page,pages)-1)*perPage,Math.min(page,pages)*perPage));
  $effect(()=>{void [query,theme,archetype,species,kind,compatibility,collection,sort];page=1;});
  async function load(){
    loading=true;error='';
    try{const response=await fetch(asset('preset-catalog.json'));if(!response.ok)throw new Error();const data=await response.json();presets=data.presets;}catch{error='The preset catalog could not load. Reconnect and try again.';}finally{loading=false;}
  }
  onMount(()=>{
    try{const prefs=readPresetPreferences(localStorage);favorites=prefs.favorites;recent=prefs.recent;}catch{/* Storage can be unavailable in private browsing. */}
    void load();
    offlineSupported=!!navigator.serviceWorker?.controller;
    const message=(event:MessageEvent)=>{
      if(event.data?.type!=='questlog:minifigure-presets-cache')return;
      offlineBusy=!event.data.complete&&!event.data.error;
      offlineStatus=event.data.error|| (event.data.complete?'The collection is ready offline.':`Downloading collection: ${event.data.done} / ${event.data.total}`);
    };
    navigator.serviceWorker?.addEventListener('message',message);
    return ()=>navigator.serviceWorker?.removeEventListener('message',message);
  });
  function downloadOffline(){const worker=navigator.serviceWorker?.controller;if(!worker)return;offlineBusy=true;offlineStatus='Downloading the collection…';worker.postMessage({type:'questlog:cache-minifigure-presets'});}
  function persist(){try{localStorage.setItem('bricktrait.presets.v1',JSON.stringify({favorites:$state.snapshot(favorites),recent:$state.snapshot(recent)}));}catch{/* Browsing still works when storage is full or disabled. */}}
  function favorite(id:string){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];persist();}
  function apply(preset:any){onapply(preset);selected=preset.name;recent=[preset.id,...recent.filter(id=>id!==preset.id)].slice(0,30);persist();}
  function reset(){query=theme=archetype=species=kind=compatibility=collection='';sort='name';page=1;}
</script>

<section class="preset-browser" aria-label="Minifigure presets">
  <div class="intro"><h2>Choose a minifigure</h2><p>Start with a complete figure, then make every part your own.</p></div>
  <label class="search">Search the collection<input type="search" bind:value={query} placeholder="Name, theme, faction or archetype…" /></label>
  <div class="filters">
    <label>Theme<select bind:value={theme}><option value="">All themes</option>{#each themes as item}<option value={item}>{item}</option>{/each}</select></label>
    <label>Archetype<select bind:value={archetype}><option value="">All archetypes</option>{#each archetypes as item}<option value={item}>{item}</option>{/each}</select></label>
    <label>Species<select bind:value={species}><option value="">All species</option>{#each speciesList as item}<option value={item}>{item}</option>{/each}</select></label>
    <label>Collection<select bind:value={kind}><option value="">Official & original</option><option value="official">Official LEGO figures</option><option value="original">Original combinations</option></select></label>
    <label>Compatibility<select bind:value={compatibility}><option value="">Complete & partial</option><option value="complete">Complete</option><option value="partial">Partial</option></select></label>
    <label>Show<select bind:value={collection}><option value="">All presets</option><option value="favorites">Favorites ({favorites.length})</option><option value="recent">Recently used</option></select></label>
    <label>Sort<select bind:value={sort}><option value="name">Name</option><option value="theme">Theme</option><option value="recent">Recently used</option></select></label>
  </div>
  <div class="results"><span aria-live="polite">{filtered.length} of {presets.length} presets</span><button type="button" onclick={reset}>Clear filters</button></div>
  {#if selected}<div class="applied" role="status"><span>Loaded {selected}. Save when you’re ready to keep your portrait.</span><button type="button" onclick={oncustomize}>Customize parts</button></div>{/if}
  {#if loading}<p role="status">Loading the collection…</p>
  {:else if error}<p role="alert">{error} <button type="button" onclick={load}>Retry</button></p>
  {:else if !filtered.length}<p class="empty">No figures match these filters. Try another search or clear the filters.</p>
  {:else}
    <div class="grid">
      {#each visible as preset (preset.id)}
        <article class="card" data-preset-id={preset.id}>
          <button class="choose" type="button" disabled={!ready} onclick={()=>apply(preset)} aria-label={`Load ${preset.name}`}>
            <img src={asset(preset.thumbnail)} alt={preset.name} width="192" height="192" loading="lazy" decoding="async" />
            <strong>{preset.name}</strong><span class="theme">{preset.theme}</span>
            <span class="badge">{preset.kind==='official'?'Official figure':'Original combination'} · {preset.compatibility.status}</span>
          </button>
          <button class="favorite" type="button" aria-label={`${favorites.includes(preset.id)?'Unfavorite':'Favorite'} ${preset.name}`} aria-pressed={favorites.includes(preset.id)} onclick={()=>favorite(preset.id)}>{favorites.includes(preset.id)?'★':'☆'}</button>
          <details><summary>Details{preset.compatibility.status==='partial'?' & missing parts':''}</summary>
            <p>{preset.description}</p>
            {#if preset.compatibility.issues.length}<ul>{#each preset.compatibility.issues as issue}<li>{issue.part||issue.slot||'Source'}: {issue.reason}</li>{/each}</ul>{/if}
            {#each preset.sources as source}<p class="credit"><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> · {source.author} · {#if source.licenseUrl}<a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.license}</a>{:else}{source.license}{/if}</p>{/each}
          </details>
        </article>
      {/each}
    </div>
    <nav class="pagination" aria-label="Preset pages"><button type="button" disabled={page<=1} onclick={()=>page=Math.max(1,page-1)}>Previous</button><span>Page {Math.min(page,pages)} of {pages}</span><button type="button" disabled={page>=pages} onclick={()=>page=Math.min(pages,page+1)}>Next</button></nav>
  {/if}
  <p class="notice">Official figure reconstructions are credited fan models. Partial presets list omitted components. Original combinations are Questlog designs, not LEGO products.</p>
  {#if offlineSupported}<button type="button" disabled={offlineBusy} onclick={downloadOffline}>Download collection for offline use</button><p class="notice" role="status">{offlineStatus||'Includes previews and parts for all presets. Downloads only missing files, including shared geometry.'}</p>{/if}
</section>

<style>
  .preset-browser{padding:1rem;min-width:0}h2{font-size:1.15rem;margin:0 0 .35rem}.intro p,.notice{font-size:.8rem;opacity:.75;line-height:1.5}.search{display:grid;gap:.35rem;font-size:.8rem}.search input{width:100%;box-sizing:border-box;padding:.7rem;border:1px solid var(--line,#7776);border-radius:.4rem;background:transparent;color:inherit}.filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem;margin-top:.8rem}.filters label{display:grid;gap:.3rem;font-size:.75rem}.filters select{min-width:0;width:100%;padding:.4rem;background:var(--card,#fff);color:var(--ink,#222);border:1px solid #8887;border-radius:.3rem}.results{display:flex;align-items:center;justify-content:space-between;font-size:.8rem;margin:.7rem 0;gap:.5rem}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:.65rem}.card{position:relative;border:1px solid #8885;border-radius:.5rem;min-width:0;overflow:hidden}.choose{display:flex;flex-direction:column;align-items:center;gap:.3rem;width:100%;padding:.65rem;background:transparent;border:0;color:inherit;text-align:center;cursor:pointer}.choose:hover{background:#8881}.choose img{width:100%;height:auto;aspect-ratio:1;object-fit:contain}.choose strong{font-size:.85rem;overflow-wrap:anywhere}.theme{font-size:.75rem;opacity:.8}.badge{font-size:.65rem;line-height:1.4}.favorite{position:absolute;right:.25rem;top:.25rem;border:0;background:var(--card,#fff);color:var(--ink,#222);border-radius:50%;font-size:1.3rem;width:2rem;height:2rem;cursor:pointer}.favorite[aria-pressed=true]{color:#ab6e00}.card details{font-size:.72rem;padding:.5rem;border-top:1px solid #8884;overflow-wrap:anywhere}.card details p{line-height:1.5}.card details ul{padding-left:1rem}.credit a{color:inherit;text-decoration:underline}.pagination{display:flex;align-items:center;justify-content:center;gap:1rem;margin:1rem 0;font-size:.8rem}.applied{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;border:1px solid #7895;padding:.65rem;margin-bottom:.8rem;border-radius:.4rem;font-size:.8rem}.applied button,.pagination button,.results button{padding:.4rem .6rem;background:transparent;color:inherit;border:1px solid #8886;border-radius:.3rem;cursor:pointer}.notice{margin-top:1rem}.empty{padding:2rem .5rem;text-align:center}@media(max-width:420px){.preset-browser{padding:.7rem}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
