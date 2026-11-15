import assert from 'node:assert/strict';

// Deployment checks behavior. Opt into measurements during a design review.
export const visualChecks=process.argv.includes('--visual')||process.env.QUESTLOG_VISUAL_CHECKS==='1';

export async function waitForRollResult(page,{host='#modal[open]',timeout=20000}={}) {
  // A critical hit can put accuracy in a disclosure instead of .roll-modal.
  // Check the completed dice result, independently of the surrounding layout.
  await page.waitForFunction(host=>{
    const stage=document.querySelector(host)?.querySelector('.dice-stage');
    return stage&&['settled','static'].includes(stage.dataset.state)&&
      !document.body.classList.contains('dice-pending')&&
      stage.querySelector('.dice-stage-faces')?.hidden===false;
  },{timeout,polling:100},host);
  const faces=await page.$$eval(`${host} .dice-stage-faces span`,nodes=>nodes.map(node=>Number(node.textContent)));
  assert.ok(faces.length&&faces.every(value=>Number.isInteger(value)&&value>0),'Completed rolls expose their recorded dice.');
  return faces;
}

export async function waitForImages(page,selector,{timeout=15000}={}) {
  // decode() can wait indefinitely for an offscreen loading="lazy" image.
  // Load test targets eagerly and poll their actual result with a bounded wait.
  await page.$$eval(selector,images=>images.forEach(image=>{image.loading='eager';}));
  try {
    await page.waitForFunction(selector=>{
      const images=[...document.querySelectorAll(selector)];
      return images.length>0&&images.every(image=>image.complete);
    },{timeout},selector);
  } catch(error) {
    throw new Error(`Images did not finish loading within ${timeout}ms (${selector})`,{cause:error});
  }
  const broken=await page.$$eval(selector,images=>images.filter(image=>image.naturalWidth===0).map(image=>image.currentSrc||image.src));
  assert.deepEqual(broken,[],`Images failed to load (${selector})`);
}
