// The same assembly, materials and transparent stage used by the editor.
import {library,type Figure} from '../../src/lib/ldraw';
import {portraitPlacements} from '../../src/lib/portrait-assembly';
import {PortraitStage} from '../../src/lib/portrait-scene';
import {preparePortraitModel} from '../../src/lib/materials';
declare global{interface Window{presetThumbsReady:Promise<void>;renderPresetThumb:(figure:Figure)=>Promise<string>;}}
library.base='/ldraw/';
window.presetThumbsReady=library.init().then(()=>{});
let stage:PortraitStage;
window.renderPresetThumb=async figure=>{
  await window.presetThumbsReady;
  stage??=new PortraitStage();
  const find=(id:string|null)=>library.catalog.find(p=>p.id===id);
  const model=preparePortraitModel(await library.build(portraitPlacements(figure,find(figure.torso.id),find(figure.head.id),find(figure.legs.id))),library.catalog);
  stage.setModel(model);
  try{stage.setTheme('light');stage.fit({yaw:-18,pitch:8,zoom:1});return stage.render(192).toDataURL('image/webp',0.88);}
  finally{stage.setModel(null);}
};
