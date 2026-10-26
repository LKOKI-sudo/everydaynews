const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('reader.js', 'utf8') + '\nthis.Reader = Reader;', context);
const {Reader} = context;
const now = Date.parse('2026-10-21T12:00:00Z');
const article = (overrides = {}) => ({title:'Senate approves major technology privacy bill', url:'https://example.com/one', category:'politics', source:'BBC News', published:new Date(now - 1000).toISOString(), ...overrides});
assert.equal(Reader.isNew(article(), now - 2000, now), true);
assert.equal(Reader.isNew(article(), NaN, now), false);
assert.equal(Reader.isNew(article({published:new Date(now + 1000).toISOString()}), now - 2000, now), false);
assert.equal(Reader.region(article()), 'uk');
assert.equal(Reader.region(article({source:'NPR'})), 'us');
assert.equal(Reader.region(article({region:'world'})), 'world');
const related = article({source:'NPR',url:'https://example.com/two',title:'Senate approves major privacy technology bill today'});
assert.equal(Reader.related(article(),related), true);
assert.equal(Reader.related(article(),article({url:'https://example.com/three'})), false);
assert.equal(Reader.related(article(), {...related, published:'2020-01-01'}), false);
assert.equal(Reader.related(article(), {...related, title:'New telescope captures distant galaxy'}), false);
const batch = [article(), related, ...Array.from({length:8}, (_,i)=>article({title:`Different headline ${i}`,url:`https://example.com/${i}`,category:'technology'}))];
const brief = Reader.brief(batch, ()=>'worth-knowing',new Set([batch[0].url]));
assert.equal(brief.length, 5);
assert.equal(brief[0].url, related.url);
assert.equal(brief.some(s=>s.url===batch[0].url),false);

// Exercise the complete application with a lightweight DOM and a mocked feed.
class Node {
 constructor(){this.dataset={};this.value='';this.children=[];this.classList={toggle(){}};this.events={};}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=nodes}
 setAttribute(k,v){this[k]=v}
 addEventListener(k,v){this.events[k]=v}
}
const nodes = new Map();
const $ = id => {if(!nodes.has(id)) nodes.set(id,new Node());return nodes.get(id)};
let timer, feedCalls=0;
const document={querySelector:$,querySelectorAll:()=>[],createElement:()=>new Node(),createTextNode:s=>s,hidden:false,addEventListener(k,f){this[k]=f}};
const window={events:{},addEventListener(k,f){this.events[k]=f}};
const store = new Map();
const app = vm.createContext({console,Date,Intl,Set,document,window,navigator:{onLine:true},location:{protocol:'http:'},AbortSignal:{timeout:()=>null},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setInterval:f=>{timer=f},fetch:async()=>{feedCalls++;return {ok:true,json:async()=>({stories:batch,updatedAt:new Date().toISOString(),unavailable:[]})}}});
vm.runInContext(fs.readFileSync('reader.js','utf8')+'\n'+fs.readFileSync('app.js','utf8'),app);
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal($('#stories').children.length,batch.length);
 $('#region').onchange({target:{value:'us'}});
 assert.equal($('#stories').children.length,9); // NPR politics + eight global tech stories
 $('#reading-view').onchange({target:{value:'brief'}});
 assert.equal($('#stories').children.length,5);
 $('#auto-update').onchange({target:{checked:false}});
 const calls=feedCalls; window.events.online(); assert.equal(feedCalls,calls);
 assert.equal($('#next-update').textContent,'Automatic updates paused');
 $('#auto-update').onchange({target:{checked:true}});
 await new Promise(resolve=>setImmediate(resolve)); assert.equal(feedCalls,calls+1);
 assert.equal(JSON.parse(store.get('brief-region')),'us');
 console.log('Passed: new-story dates, regions, related coverage, briefing selection, full-app rendering, combined filters, preferences, and automatic-update controls.');
})().catch(error=>{console.error(error);process.exitCode=1});
