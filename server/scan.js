// Real lookups only. Nothing here is stored or logged.
const crypto=require('crypto');
const UA={'user-agent':'SafeHer-Self-Scan/1.0'};
const get=(url,h={})=>fetch(url,{headers:{...UA,...h},signal:AbortSignal.timeout(8000)});

async function breach(email){
 try{
  if(process.env.HIBP_API_KEY){
   const r=await get('https://haveibeenpwned.com/api/v3/breachedaccount/'+encodeURIComponent(email)+'?truncateResponse=true',{'hibp-api-key':process.env.HIBP_API_KEY});
   if(r.status===404)return{status:'clear',source:'Have I Been Pwned'};
   if(r.ok)return{status:'found',source:'Have I Been Pwned',names:(await r.json()).map(b=>b.Name)};
   return{status:'error',source:'Have I Been Pwned'};
  }
  const r=await get('https://api.xposedornot.com/v1/check-email/'+encodeURIComponent(email));
  if(r.status===404)return{status:'clear',source:'XposedOrNot'};
  if(!r.ok)return{status:'error',source:'XposedOrNot'};
  const j=await r.json(),names=[].concat(...(j.breaches||[]));
  return names.length?{status:'found',source:'XposedOrNot',names}:{status:'clear',source:'XposedOrNot'};
 }catch{return{status:'error'}}
}

async function gravatar(email){
 try{const h=crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  const r=await get('https://gravatar.com/avatar/'+h+'?d=404&s=1');
  return r.status===200?{status:'found'}:r.status===404?{status:'clear'}:{status:'error'}}catch{return{status:'error'}}
}

// [site, api url, profile url, optional parser(response)=>boolean]
const SITES=[
 ['GitHub',u=>'https://api.github.com/users/'+u,u=>'https://github.com/'+u],
 ['GitLab',u=>'https://gitlab.com/api/v4/users?username='+u,u=>'https://gitlab.com/'+u,async r=>(await r.json()).length>0],
 ['Reddit',u=>'https://www.reddit.com/user/'+u+'/about.json',u=>'https://www.reddit.com/user/'+u],
 ['Keybase',u=>'https://keybase.io/_/api/1.0/user/lookup.json?usernames='+u,u=>'https://keybase.io/'+u,async r=>{const j=await r.json();return !!(j.them&&j.them[0])}],
 ['Hacker News',u=>'https://hacker-news.firebaseio.com/v0/user/'+u+'.json',u=>'https://news.ycombinator.com/user?id='+u,async r=>(await r.json())!==null],
 ['Chess.com',u=>'https://api.chess.com/pub/player/'+u.toLowerCase(),u=>'https://www.chess.com/member/'+u],
 ['Lichess',u=>'https://lichess.org/api/user/'+u,u=>'https://lichess.org/@/'+u],
 ['DEV',u=>'https://dev.to/api/users/by_username?url='+u,u=>'https://dev.to/'+u],
 ['Docker Hub',u=>'https://hub.docker.com/v2/users/'+u+'/',u=>'https://hub.docker.com/u/'+u],
 ['Mastodon.social',u=>'https://mastodon.social/api/v1/accounts/lookup?acct='+u,u=>'https://mastodon.social/@'+u]];

async function usernames(u){
 const out=await Promise.all(SITES.map(async([site,api,prof,parse])=>{
  try{const r=await get(api(u),site==='GitHub'&&process.env.GITHUB_TOKEN?{Authorization:'Bearer '+process.env.GITHUB_TOKEN}:{});
   if(r.ok)return(parse?await parse(r):true)?{site,url:prof(u),s:'found'}:{site,s:'clear'};
   return r.status===404?{site,s:'clear'}:{site,s:'error'}}catch{return{site,s:'error'}}}));
 const found=out.filter(x=>x.s==='found').map(x=>({site:x.site,url:x.url})),failed=out.filter(x=>x.s==='error').map(x=>x.site);
 return{status:found.length?'found':failed.length<out.length?'clear':'error',checked:out.length-failed.length,found,failed};
}

const BROKER=['truecaller','spokeo','whitepages','justdial','sulekha','zaubacorp','mylife','radaris','beenverified','intelius','pipl','rocketreach','lusha','signalhire','clustrmaps','fastpeoplesearch','thatsthem','spydialer','sync.me','getcontact','callapp','eyecon','instantcheckmate','peekyou','nuwber','411.com'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Optional: needs BRAVE_API_KEY (free tier at brave.com/search/api)
async function search({email,phone,name,city}){
 if(!process.env.BRAVE_API_KEY)return{status:'skipped'};
 const qs=[];
 if(email)qs.push({k:'email',q:'"'+email+'"',t:email.toLowerCase()});
 if(phone)qs.push({k:'phone',q:'"'+phone+'"',t:phone.replace(/\D/g,'').slice(-10)});
 if(name)qs.push({k:'name',q:'"'+name+'"'+(city?' "'+city+'"':''),t:name.toLowerCase()});
 if(!qs.length)return{status:'skipped'};
 const seen=new Set(),items=[];let ok=0;
 for(const[i,x]of qs.entries()){
  if(i)await sleep(1100);
  try{const r=await get('https://api.search.brave.com/res/v1/web/search?count=10&q='+encodeURIComponent(x.q),{'X-Subscription-Token':process.env.BRAVE_API_KEY,Accept:'application/json'});
   if(!r.ok)continue;ok++;
   for(const w of((await r.json()).web||{}).results||[]){
    let d;try{d=new URL(w.url).hostname.replace(/^www\./,'')}catch{continue}
    if(seen.has(w.url))continue;seen.add(w.url);
    const text=(w.title+' '+(w.description||'')).toLowerCase(),flat=text.replace(/\D/g,'');
    const verified=x.k==='phone'?flat.includes(x.t):text.includes(x.t);
    items.push({kind:x.k,title:String(w.title||'').slice(0,120),url:w.url,domain:d,broker:BROKER.some(b=>d.includes(b)),verified})}
  }catch{}}
 return{status:items.length?'found':ok?'clear':'error',items:items.slice(0,15)};
}

exports.runScan=async f=>{
 const[b,g,u,s]=await Promise.all([breach(f.email),gravatar(f.email),f.username?usernames(f.username):{status:'skipped'},search(f)]);
 return{breach:b,gravatar:g,usernames:u,search:s};
};
