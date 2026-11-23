const selector = (name) => `#modal [name="${name}"]`;

export const nextBuilderStep = page => page.click('#modal .character-builder button[type="submit"]');

export async function chooseBuilderValue(page,name,value,index=0) {
  return page.$$eval(selector(name),(nodes,value,index)=>{
    const field=nodes[index];
    if(!field)throw new Error(`Missing builder control at index ${index}`);
    field.value=value;
    if(field.value!==value)throw new Error(`Option not available: ${value}`);
    field.dispatchEvent(new Event('change',{bubbles:true}));
    if(['class','alignment','species','background'].includes(field.name)&&!field.isConnected)throw new Error(`Builder replaced the active ${field.name} select`);
  },value,index);
}

async function fillChoiceGroups(page) {
  // Each change can unlock a dependent group, so re-read the active step.
  for(let attempt=0;attempt<70;attempt++){
    const field=await page.$eval('#modal-form',form=>{
      const control=[...form.querySelectorAll('[data-builder-choice]')].find(select=>!select.value);
      if(!control)return null;
      return {name:control.name,index:Number(control.dataset.choiceIndex),value:control.options[1]?.value};
    });
    if(!field)return;
    if(!field.value)throw new Error(`No choices for ${field.name}`);
    await chooseBuilderValue(page,field.name,field.value,field.index);
  }
  throw new Error('Builder choices did not settle');
}

export async function fillLevelOne(page,{name='A new adventurer',className='Wizard',species='Dwarf',background='Soldier',onStep}={}) {
  await page.type(selector('name'),name);
  await chooseBuilderValue(page,'class',className);
  await chooseBuilderValue(page,'alignment','Chaotic Good');
  await nextBuilderStep(page);
  await chooseBuilderValue(page,'species',species);
  await chooseBuilderValue(page,'background',background);
  await fillChoiceGroups(page);
  await nextBuilderStep(page);
  const names=['str','dex','con','int','wis','cha'];
  for(const [index,ability] of names.entries())await chooseBuilderValue(page,`assignments.${ability}`,String(index));
  const bonuses=await page.$$eval('#modal [name^="bonuses."]',fields=>fields.map(field=>field.name));
  await chooseBuilderValue(page,bonuses[0],'2');
  await chooseBuilderValue(page,bonuses[1],'1');
  await onStep?.(3);
  await nextBuilderStep(page);
  for(let step=4;step<=7;step++){
    try {await page.waitForSelector(`[data-builder-step="${step}"]`,{timeout:3000});}
    catch (error) {
      const body=await page.$eval('#modal',node=>node.innerText);
      throw new Error(`Expected builder step ${step}. Dialog: ${body}`,{cause:error});
    }
    await fillChoiceGroups(page);
    await onStep?.(step);
    await nextBuilderStep(page);
  }
  await page.waitForSelector('[data-builder-step="8"]');
  await onStep?.(8);
}
