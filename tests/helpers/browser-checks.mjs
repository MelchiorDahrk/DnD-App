import assert from 'node:assert/strict';

// Deployment checks behavior. Opt into measurements during a design review.
export const visualChecks=process.argv.includes('--visual')||process.env.QUESTLOG_VISUAL_CHECKS==='1';

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
