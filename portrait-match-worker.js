import {extractDescriptor} from './portrait-image-analysis.js';
import {matchPortraitSlot,validateMatchIndex} from './portrait-match.js';
let index;
self.onmessage=({data})=>{
  try {
    if(data.index)index=validateMatchIndex(data.index);
    const results=data.regions.map(({slot,pixels})=>matchPortraitSlot(slot,extractDescriptor(pixels),index,data.catalog,data.colors));
    self.postMessage({results});
  } catch(error) {self.postMessage({error:error.message});}
};
