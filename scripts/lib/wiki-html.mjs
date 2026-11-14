// Minimal HTML tree for the cached Wikidot research pages. No remote resources run.
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—',hellip:'…',times:'×',minus:'−'};
export const decodeHTML=s=>s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(all,key)=>key[0]==='#'?String.fromCodePoint(parseInt(key.slice(key[1]?.toLowerCase()==='x'?2:1),key[1]?.toLowerCase()==='x'?16:10)):entities[key]??all);
export function parseHTML(html){
  const root={tag:'root',attrs:{},children:[]},stack=[root];
  for(const token of html.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]*>|[^<]+/g)||[]){
    if(token.startsWith('<!'))continue;
    if(token.startsWith('</')){const tag=token.match(/^<\/([\w-]+)/)?.[1]?.toLowerCase();const i=stack.findLastIndex(n=>n.tag===tag);if(i>0)stack.length=i;continue;}
    if(token[0]==='<'){
      const tag=token.match(/^<([\w-]+)/)?.[1]?.toLowerCase();if(!tag)continue;
      const attrs=Object.fromEntries([...token.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1],decodeHTML(m[2]??m[3])]));
      const node={tag,attrs,children:[]};stack.at(-1).children.push(node);
      if(!/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)&&!token.endsWith('/>'))stack.push(node);
    }else stack.at(-1).children.push(decodeHTML(token));
  }
  return root;
}
export function nodes(node,predicate){return typeof node==='string'?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(child=>nodes(child,predicate))];}
export function text(node){return (typeof node==='string'?node:/^(script|style)$/.test(node.tag)?'':node.children.map(text).join(' ')).replace(/\s+/g,' ').trim();}
export const pageContent=html=>{const node=nodes(parseHTML(html),n=>n.attrs.id==='page-content')[0];if(!node)throw Error('Missing wiki page content');return node;};
