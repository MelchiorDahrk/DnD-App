// Keep the local runner and CI matrix on the same complete suite list.
// Each rendering-heavy group gets its own runner instead of competing for CPU.
export const deploymentGroups={
  // The expanded sheet checks reached their final mobile dialogs at 3 minutes
  // on a shared runner. Allow headroom without removing any functional checks.
  sheet:[['sheet-layout',5],['item-icons',3],['magic-items',3],['treasure',2],['themes',5]],
  spells:[['spell-icons',3]],
  dice:[['dice',4]],
  portraits:[['portraits',10]],
  'portrait-photos':[['portrait-photos',5]],
  presets:[['presets',5]]
};

export function deploymentOptions(args=[]) {
  if(args.length===1&&args[0]==='--matrix')return {matrix:{group:Object.keys(deploymentGroups)}};
  if(args.length===0)return {group:'all',suites:Object.values(deploymentGroups).flat()};
  if(args.length===2&&args[0]==='--group'&&Object.hasOwn(deploymentGroups,args[1])) {
    return {group:args[1],suites:deploymentGroups[args[1]]};
  }
  throw new Error(`Usage: test-deploy.mjs [--matrix | --group ${Object.keys(deploymentGroups).join('|')}]`);
}
