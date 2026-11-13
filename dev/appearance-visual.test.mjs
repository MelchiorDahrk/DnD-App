// Optional palette review; not part of the deployment unit suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('both palettes provide AA text contrast and visible form boundaries',()=>{
  const css=readFileSync(new URL('../theme.css',import.meta.url),'utf8');
  const palettes=[css.slice(css.indexOf(':root, [data-theme="light"]'),css.indexOf('[data-theme="dark"]')),css.slice(css.indexOf('[data-theme="dark"]'))];
  const luminance=hex=>hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  for(const [index,css] of palettes.entries()) {
    const colors=Object.fromEntries([...css.matchAll(/--([\w-]+): #([\da-f]{6});/g)].map(([,key,value])=>[key,value]));
    const pairs=[
      ...['text-primary','text-secondary','accent-brass'].flatMap(fg=>['surface-page','surface-panel','surface-raised','surface-recessed','surface-sidebar'].map(bg=>[fg,bg,4.5])),
      ['button-text','button-primary',4.5],['nav-text','nav-active',4.5],['hero-text','hero-surface',4.5],['hero-muted','hero-surface',4.5],['hero-brass','hero-raised',4.5],
      ...['success','danger','warning','magic'].map(status=>['status-'+status,'status-'+status+'-bg',4.5]),
      ...['surface-panel','surface-recessed'].map(bg=>['border-control',bg,3])
    ];
    for(const [fg,bg,minimum] of pairs) {
      const a=luminance(colors[fg]),b=luminance(colors[bg]),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      assert.ok(ratio>=minimum,`${index?'Dark':'Light'} ${fg}/${bg}: ${ratio.toFixed(2)} < ${minimum}`);
    }
  }
});
