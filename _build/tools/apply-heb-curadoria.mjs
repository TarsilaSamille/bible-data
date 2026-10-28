#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const CURADORIA = '/Users/macbook/GitHub/mestrado/bible-reader-web/docs/referencia/curadoria/heb';

async function loadJson(p){ return JSON.parse(await readFile(p,'utf8')); }

async function main(){
  const files = readdirSync(CURADORIA).filter(f=>/^CURADORIA-HEB-part\d+\.json$/.test(f));
  const lookup = new Map();
  for (const f of files) {
    const d = await loadJson(join(CURADORIA,f));
    for (const it of d.itens ?? []) {
      if (it.estado === 'curado' && it.curadoria) lookup.set(it.palavra, it.curadoria);
    }
  }
  console.log(`Curated lookup: ${lookup.size} words`);

  let applied=0, filesChanged=0;
  for (let b=1;b<=66;b++){
    const path = join(RAIZ,'dict','heb',`${b}.json`);
    if(!existsSync(path)) continue;
    const data = await loadJson(path);
    let changed=false;
    for (const [surface, entry] of Object.entries(data)){
      if(!entry||typeof entry!=='object') continue;
      const cur = lookup.get(surface);
      if(!cur) continue;
      let touched=false;
      for (const k of ['pt','es','id','en']){
        const v=cur[k];
        if(typeof v==='string' && v.trim() && !v.startsWith('[')){ entry[k]=v; touched=true; }
      }
      if(touched){ applied++; changed=true; }
    }
    if(changed){ await writeFile(path, JSON.stringify(data), 'utf8'); filesChanged++; }
  }
  // missing
  const allKeys=new Set();
  for (let b=1;b<=66;b++){
    const path=join(RAIZ,'dict','heb',`${b}.json`);
    if(!existsSync(path)) continue;
    const data=await loadJson(path);
    for(const k of Object.keys(data)) allKeys.add(k);
  }
  const missing=[...lookup.keys()].filter(w=>!allKeys.has(w));
  console.log(`Applied: ${applied} entries across ${filesChanged} files`);
  console.log(`Curated words not found: ${missing.length}`);
  if(missing.length) console.log('Sample missing:', missing.slice(0,20));
}
main().catch(e=>{console.error(e);process.exit(1);});
