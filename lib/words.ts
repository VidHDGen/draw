import {categoryNames,curatedPools,requestedWords} from './word-data.ts';
export {categoryNames,requestedWords};

// Categories are disjoint so each three-choice offer really contains three types.
const unique=new Set<string>();
export const wordPools=curatedPools.map(pool=>pool.filter(word=>{if(unique.has(word))return false;unique.add(word);return true}));
export const wordBank=wordPools.flat();
function shuffled<T>(items:T[]){const result=[...items],random=crypto.getRandomValues(new Uint32Array(items.length));for(let i=result.length-1;i>0;i--){const j=random[i]%(i+1);[result[i],result[j]]=[result[j],result[i]]}return result}

export function dealWordDecks(playerCount:number,history:string[]=[]){
 const used=new Set<string>(),seen=new Map(history.map((word,index)=>[word,index]));
 // Unseen words first; when a category is exhausted, reuse its oldest words first.
 const pools=wordPools.map(pool=>shuffled(pool).sort((a,b)=>(seen.get(a)??-1)-(seen.get(b)??-1)));
 function take(category:number){const word=pools[category].find(word=>!used.has(word));if(!word)throw Error('词库不足');used.add(word);return word}
 const categories=shuffled(wordPools.map((_,i)=>i));
 const decks=Array.from({length:playerCount},(_,player)=>Array.from({length:4},(_,batch)=>shuffled(Array.from({length:3},(_,slot)=>take(categories[(player*12+batch*3+slot)%categories.length])))).flat());
 // Discard retired prompts from older versions, preserving recent active words.
 return {decks,history:[...history.filter(word=>unique.has(word)&&!used.has(word)),...used].slice(-1600)};
}
