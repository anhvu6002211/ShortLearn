const CACHE_LIMIT = 150;
const CONCURRENCY_LIMIT = 3;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const queue: Array<() => void> = [];
let running = 0;

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= CONCURRENCY_LIMIT) await new Promise<void>(resolve => queue.push(resolve));
  running += 1;
  try { return await work(); }
  finally { running -= 1; queue.shift()?.(); }
}

export async function translateEnglish(text: string): Promise<string> {
  const source = text.trim(); if (!source) return '';
  const hit = cache.get(source); if (hit) return hit;
  const active = pending.get(source); if (active) return active;
  const task = withSlot(async () => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(source)}`;
      const response=await fetch(url,{signal:controller.signal}); if(!response.ok) throw new Error('Chưa thể dịch.');
      const payload=await response.json(); const value=Array.isArray(payload?.[0])?payload[0].map((s:unknown[])=>typeof s?.[0]==='string'?s[0]:'').join('').trim():'';
      if(!value||value.toLocaleLowerCase()===source.toLocaleLowerCase()) throw new Error('Chưa thể dịch.');
      if(cache.size>=CACHE_LIMIT) cache.delete(cache.keys().next().value!); cache.set(source,value); return value;
    } finally { clearTimeout(timer); }
  }); pending.set(source,task); try{return await task;}finally{pending.delete(source);}
}