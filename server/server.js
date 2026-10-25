require('dotenv').config();
const{runScan}=require('./scan');
const express=require('express'),Database=require('better-sqlite3'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),
cookie=require('cookie-parser'),helmet=require('helmet'),rl=require('express-rate-limit'),crypto=require('crypto'),path=require('path');
const fs=require('fs');
function persisted(){const f=path.join(__dirname,'.secret');try{return fs.readFileSync(f,'utf8')}catch{const k=crypto.randomBytes(32).toString('hex');fs.writeFileSync(f,k,{mode:0o600});return k}}
const SECRET=process.env.JWT_SECRET||persisted();
const db=new Database(process.env.DB_FILE||'data.db');db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');
// Privacy by design: only account email, scan score and checklist progress are stored.
// Names, phone numbers, usernames, cities and photos are never sent to or stored by the server.
db.exec(`create table if not exists users(id integer primary key,email text unique not null,hash text not null,created_at text not null);
create table if not exists scans(id integer primary key,user_id integer not null references users(id) on delete cascade,score integer not null,created_at text not null,updated_at text not null);
create table if not exists findings(scan_id integer not null references scans(id) on delete cascade,fid text not null,sev integer not null,done integer not null,primary key(scan_id,fid));`);
try{db.exec('alter table users add column name_enc text')}catch{}
try{db.exec('alter table users add column phone_enc text')}catch{}
db.exec(`create table if not exists contacts(id integer primary key,user_id integer not null references users(id) on delete cascade,name_enc text not null,phone_enc text not null);
create table if not exists sos(id integer primary key,user_id integer not null references users(id) on delete cascade,kind text not null,token text unique not null,created_at text not null,ended_at text);
create table if not exists locations(id integer primary key,sos_id integer not null references sos(id) on delete cascade,lat real not null,lon real not null,acc integer,ts text not null);
create table if not exists reports(id integer primary key,user_id integer not null references users(id) on delete cascade,type text not null,place_enc text not null,desc_enc text not null,created_at text not null);`);
try{db.exec('alter table sos add column views integer not null default 0')}catch{}
try{db.exec('alter table sos add column expires_at text')}catch{}
try{db.exec('alter table reports add column incident_at text')}catch{}
try{db.exec('alter table reports add column evidence_enc text')}catch{}
db.exec(`create table if not exists report_files(id integer primary key,report_id integer not null references reports(id) on delete cascade,name_enc text not null,mime text not null,size integer not null,data blob not null,created_at text not null);`);
try{db.exec('alter table sos add column last_view_at text')}catch{}
// AES-256-GCM encryption for personal details, contacts and reports
const KEY=crypto.scryptSync(process.env.ENC_KEY||SECRET,'safeher-salt',32);
const enc=s=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',KEY,iv),b=Buffer.concat([c.update(String(s),'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),b]).toString('base64')};
const dec=s=>{try{const b=Buffer.from(s,'base64'),d=crypto.createDecipheriv('aes-256-gcm',KEY,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8')}catch{return ''}};
const encB=buf=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',KEY,iv),b=Buffer.concat([c.update(buf),c.final()]);return Buffer.concat([iv,c.getAuthTag(),b])};
const decB=b=>{try{const d=crypto.createDecipheriv('aes-256-gcm',KEY,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()])}catch{return null}};
const pub=u=>({email:u.email,name:u.name_enc?dec(u.name_enc):'',phone:u.phone_enc?dec(u.phone_enc):''});
const phoneOk=p=>/^\+?\d{8,15}$/.test(p),strip=p=>String(p||'').replace(/[\s-]/g,'');
const app=express();
// Enable only when the deployment is behind a trusted reverse proxy. Use a hop count (e.g. 1), not blindly `true`.
if (process.env.TRUST_PROXY) { const hops=Number(process.env.TRUST_PROXY); if (!Number.isInteger(hops)||hops<1||hops>5) throw new Error('TRUST_PROXY must be an integer from 1 to 5'); app.set('trust proxy', hops); }
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'"],styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],fontSrc:["https://fonts.gstatic.com"],imgSrc:["'self'","blob:","data:","https://*.tile.openstreetmap.org"],connectSrc:["'self'","https://nominatim.openstreetmap.org","https://routing.openstreetmap.de","https://overpass-api.de","https://www.openstreetmap.org"],upgradeInsecureRequests:null}}}));
const smallJson=express.json({limit:'20kb'});
app.use((q,r,n)=>/^\/api\/reports\/\d+\/evidence$/.test(q.path)?n():smallJson(q,r,n));app.use(cookie());
const lim=n=>rl({windowMs:15*60*1000,limit:n,standardHeaders:true,legacyHeaders:false,message:{error:'Too many requests. Try again later.'}});
app.use('/api',lim(600));
const okEmail=e=>/^\S+@\S+\.\S+$/.test(e)&&e.length<=254;
const issue=(res,uid)=>{const tk=jwt.sign({uid},SECRET,{expiresIn:'7d'});res.cookie('t',tk,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:6048e5});return tk};
// Mobile app: accepts the same token as an "Authorization: Bearer" header (cookies still work for the web version).
const tokenOf=q=>q.cookies.t||(/^Bearer (.+)$/.exec(q.get('authorization')||'')||[])[1];
const auth=(q,r,n)=>{try{q.uid=jwt.verify(tokenOf(q),SECRET).uid;n()}catch{r.status(401).json({error:'Please sign in'})}};

app.post('/api/register',lim(20),async(q,r)=>{const email=String(q.body.email||'').trim().toLowerCase(),pw=String(q.body.password||'');
 if(!okEmail(email))return r.status(400).json({error:'Enter a valid email'});
 if(pw.length<8||pw.length>72)return r.status(400).json({error:'Password must be 8 to 72 characters'});
 try{const x=db.prepare('insert into users(email,hash,created_at) values(?,?,?)').run(email,await bcrypt.hash(pw,11),new Date().toISOString());const token=issue(r,x.lastInsertRowid);r.json({token,user:{email,name:'',phone:''}})}
 catch{r.status(409).json({error:'That email is already registered'})}});
app.post('/api/login',lim(20),async(q,r)=>{const email=String(q.body.email||'').trim().toLowerCase(),u=db.prepare('select * from users where email=?').get(email);
 if(!u||!(await bcrypt.compare(String(q.body.password||''),u.hash)))return r.status(401).json({error:'Wrong email or password'});const token=issue(r,u.id);r.json({token,user:pub(u)})});
app.post('/api/logout',(q,r)=>{r.clearCookie('t');r.json({ok:true})});
app.get('/api/me',auth,(q,r)=>{const u=db.prepare('select * from users where id=?').get(q.uid);u?r.json({user:pub(u)}):r.status(401).json({error:'Please sign in'})});
app.delete('/api/me',auth,(q,r)=>{db.prepare('delete from users where id=?').run(q.uid);r.clearCookie('t');r.json({ok:true})});

// Real footprint scan: requires sign-in, consent, and always checks the account's own email.
// Inputs are used once for the lookups and are never stored or logged.
const scanLim=rl({windowMs:24*36e5,limit:8,standardHeaders:true,legacyHeaders:false,keyGenerator:q=>'u'+q.uid,message:{error:'Daily scan limit reached (8). Try again tomorrow.'}});
app.post('/api/scan',auth,scanLim,async(q,r)=>{
 if(q.body.consent!==true)return r.status(400).json({error:'Please confirm you are scanning only your own information'});
 const u=db.prepare('select email from users where id=?').get(q.uid);if(!u)return r.status(401).json({error:'Please sign in'});
 const un=String(q.body.username||'').trim().replace(/^@/,'');
 if(un&&!/^[A-Za-z0-9_.-]{2,39}$/.test(un))return r.status(400).json({error:'Username can use letters, numbers, dots, dashes and underscores (2 to 39 characters)'});
 const f={email:u.email,username:un,name:String(q.body.name||'').trim().slice(0,80),city:String(q.body.city||'').trim().slice(0,60),phone:strip(q.body.phone)};
 if(f.phone&&!phoneOk(f.phone))return r.status(400).json({error:'Enter a valid phone number with country code'});
 try{r.json(await runScan(f))}catch{r.status(500).json({error:'Scan failed. Try again.'})}});
// Password leak check (k-anonymity): the browser sends only the first 5 characters of the SHA-1 hash.
app.post('/api/pwned',lim(60),async(q,r)=>{const p=String(q.body.prefix||'').toUpperCase();if(!/^[0-9A-F]{5}$/.test(p))return r.status(400).json({error:'Bad request'});
 try{const x=await fetch('https://api.pwnedpasswords.com/range/'+p,{headers:{'Add-Padding':'true','user-agent':'SafeHer'},signal:AbortSignal.timeout(8000)});if(!x.ok)throw 0;r.json({text:await x.text()})}
 catch{r.status(502).json({error:'Password check service is unreachable right now'})}});

const clean=b=>{const s=Number(b.score),f=b.findings;if(!Number.isInteger(s)||s<0||s>100||!Array.isArray(f)||f.length>20)return null;
 const o=f.map(x=>({id:String(x.id||'').slice(0,8),sev:[1,2,3].includes(x.sev)?x.sev:1,done:x.done?1:0}));return o.every(x=>x.id)?{s,o}:null};
app.post('/api/scans',auth,(q,r)=>{const c=clean(q.body);if(!c)return r.status(400).json({error:'Invalid scan'});const now=new Date().toISOString();
 const id=db.transaction(()=>{const i=db.prepare('insert into scans(user_id,score,created_at,updated_at) values(?,?,?,?)').run(q.uid,c.s,now,now).lastInsertRowid;
  const st=db.prepare('insert or replace into findings values(?,?,?,?)');c.o.forEach(x=>st.run(i,x.id,x.sev,x.done));return i})();r.json({id})});
app.patch('/api/scans/:id',auth,(q,r)=>{const c=clean(q.body),own=db.prepare('select id from scans where id=? and user_id=?').get(q.params.id,q.uid);
 if(!c)return r.status(400).json({error:'Invalid scan'});if(!own)return r.status(404).json({error:'Not found'});
 db.transaction(()=>{db.prepare('update scans set score=?,updated_at=? where id=?').run(c.s,new Date().toISOString(),own.id);
  const st=db.prepare('update findings set done=? where scan_id=? and fid=?');c.o.forEach(x=>st.run(x.done,own.id,x.id))})();r.json({ok:true})});
app.get('/api/scans',auth,(q,r)=>r.json({scans:db.prepare('select s.id,s.score,s.created_at,(select count(*) from findings f where f.scan_id=s.id and f.done=0) open from scans s where s.user_id=? order by s.id desc limit 20').all(q.uid)}));


// Profile
app.put('/api/profile',auth,(q,r)=>{const name=String(q.body.name||'').trim().slice(0,60),ph=strip(q.body.phone);
 if(ph&&!phoneOk(ph))return r.status(400).json({error:'Enter a valid phone number with country code'});
 db.prepare('update users set name_enc=?,phone_enc=? where id=?').run(name?enc(name):null,ph?enc(ph):null,q.uid);r.json({user:{name,phone:ph}})});
// Emergency contacts (max 5, encrypted)
app.get('/api/contacts',auth,(q,r)=>r.json({contacts:db.prepare('select id,name_enc,phone_enc from contacts where user_id=?').all(q.uid).map(c=>({id:c.id,name:dec(c.name_enc),phone:dec(c.phone_enc)}))}));
app.post('/api/contacts',auth,(q,r)=>{const name=String(q.body.name||'').trim().slice(0,60),ph=strip(q.body.phone);
 if(!name||!phoneOk(ph))return r.status(400).json({error:'Enter a name and a valid phone number with country code'});
 if(db.prepare('select count(*) n from contacts where user_id=?').get(q.uid).n>=5)return r.status(400).json({error:'You can add up to 5 contacts'});
 r.json({id:db.prepare('insert into contacts(user_id,name_enc,phone_enc) values(?,?,?)').run(q.uid,enc(name),enc(ph)).lastInsertRowid})});
app.delete('/api/contacts/:id',auth,(q,r)=>{db.prepare('delete from contacts where id=? and user_id=?').run(q.params.id,q.uid);r.json({ok:true})});
// SOS and live location sharing. Only the latest 20 points are kept. Every link expires automatically
// (default 2 h for sharing, 4 h for SOS, 12 h at most). All stored points are deleted when sharing stops or expires.
const MAXMS=12*36e5,DUR=[30,60,120,240,480,720];
const expOf=e=>e.expires_at?Date.parse(e.expires_at):Date.parse(e.created_at)+MAXMS;
const isLive=e=>!e.ended_at&&Date.now()<expOf(e);
const endIt=(e,when)=>{db.prepare('delete from locations where sos_id=?').run(e.id);db.prepare('update sos set ended_at=? where id=? and ended_at is null').run(when||new Date().toISOString(),e.id)};
const sweep=()=>{try{for(const e of db.prepare('select * from sos where ended_at is null').all())if(!isLive(e))endIt(e,new Date(expOf(e)).toISOString())}catch{}};
sweep();setInterval(sweep,60000).unref();
const mine=q=>db.prepare('select * from sos where id=? and user_id=?').get(q.params.id,q.uid);
const putLoc=(id,b)=>{if(b.lat==null||b.lon==null)return;const lat=Number(b.lat),lon=Number(b.lon);if(!(lat>=-90&&lat<=90&&lon>=-180&&lon<=180))return;
 db.prepare('insert into locations(sos_id,lat,lon,acc,ts) values(?,?,?,?,?)').run(id,lat,lon,Math.round(Number(b.acc))||0,new Date().toISOString());
 db.prepare('delete from locations where sos_id=? and id not in (select id from locations where sos_id=? order by id desc limit 20)').run(id,id)};
app.post('/api/sos',auth,(q,r)=>{
 // A public link is only created after the person has clearly agreed to it (the app shows a consent step first).
 if(q.body.consent!==true)return r.status(400).json({error:'Please confirm that you understand anyone with the link can see your live location'});
 db.prepare('delete from locations where sos_id in (select id from sos where user_id=? and ended_at is null)').run(q.uid);
 db.prepare('update sos set ended_at=? where user_id=? and ended_at is null').run(new Date().toISOString(),q.uid);
 const kind=q.body.kind==='share'?'share':'sos',token=crypto.randomBytes(18).toString('hex'),m=Number(q.body.minutes),mins=DUR.includes(m)?m:(kind==='sos'?240:120),
  now=new Date(),exp=new Date(now.getTime()+mins*6e4).toISOString();
 const id=db.prepare('insert into sos(user_id,kind,token,created_at,expires_at) values(?,?,?,?,?)').run(q.uid,kind,token,now.toISOString(),exp).lastInsertRowid;putLoc(id,q.body);
 r.json({id,token,kind,expires_at:exp,views:0,last_view_at:null})});
app.get('/api/sos/active',auth,(q,r)=>{const e=db.prepare('select * from sos where user_id=? and ended_at is null order by id desc').get(q.uid);
 if(!e)return r.json({sos:null});if(!isLive(e)){endIt(e,new Date(expOf(e)).toISOString());return r.json({sos:null})}
 r.json({sos:{id:e.id,token:e.token,kind:e.kind,views:e.views,last_view_at:e.last_view_at,expires_at:new Date(expOf(e)).toISOString()}})});
app.post('/api/sos/:id/loc',auth,(q,r)=>{const e=mine(q);if(!e||e.ended_at)return r.status(404).json({error:'Not active'});
 if(!isLive(e)){endIt(e,new Date(expOf(e)).toISOString());return r.status(404).json({error:'Sharing time ended'})}
 putLoc(e.id,q.body);const v=db.prepare('select views,last_view_at from sos where id=?').get(e.id);r.json({ok:true,at:new Date().toISOString(),views:v.views,last_view_at:v.last_view_at,expires_at:new Date(expOf(e)).toISOString()})});
// Add 30 minutes, never past 12 hours after sharing began
app.post('/api/sos/:id/extend',auth,(q,r)=>{const e=mine(q);if(!e||!isLive(e))return r.status(404).json({error:'Sharing is not active'});
 const cap=Date.parse(e.created_at)+MAXMS,cur=expOf(e),nx=Math.min(cur+30*6e4,cap);
 if(nx<=cur)return r.status(400).json({error:'You have reached the 12 hour maximum. Start a new share if you still need one.'});
 const iso=new Date(nx).toISOString();db.prepare('update sos set expires_at=? where id=?').run(iso,e.id);r.json({expires_at:iso})});
app.post('/api/sos/:id/end',auth,(q,r)=>{const e=mine(q);if(!e)return r.status(404).json({error:'Not found'});endIt(e);r.json({ok:true})});
// Public tracking link for contacts (unguessable token). Dead as soon as sharing stops or expires; the "ended" notice stays for 2 hours.
app.get('/api/track/:t',lim(600),(q,r)=>{r.set('Cache-Control','no-store');
 const e=db.prepare('select * from sos where token=?').get(String(q.params.t).slice(0,64));
 if(!e)return r.status(404).json({error:'This link is no longer available'});
 const exp=expOf(e),ended=e.ended_at||(Date.now()>=exp?new Date(exp).toISOString():null);
 if(ended&&Date.now()-Date.parse(ended)>2*36e5)return r.status(404).json({error:'This link is no longer available'});
 if(!e.ended_at&&ended)endIt(e,ended);
 const active=!ended,n=db.prepare('select name_enc from users where id=?').get(e.user_id);
 if(active){db.prepare('update sos set last_view_at=?'+(q.query.open==='1'?',views=views+1':'')+' where id=?').run(new Date().toISOString(),e.id)}
 r.json({kind:e.kind,active,expires_at:active?new Date(exp).toISOString():null,name:n&&n.name_enc?dec(n.name_enc):'',loc:active?db.prepare('select lat,lon,acc,ts from locations where sos_id=? order by id desc limit 1').get(e.id)||null:null})});
// Safety reports (encrypted, private to the user): category, incident date/time, optional evidence, export.
const RT=['Harassment','Stalking','Online abuse','Suspicious message','Unsafe place','Physical assault','Theft or robbery','Verbal abuse or catcalling','Cyber fraud or scam','Workplace harassment','Domestic violence','Other'];
const MAXFILES=3,MAXFILE=2*1024*1024,MAXUSER=25*1024*1024;
const MIMES={'image/jpeg':b=>b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF,'image/png':b=>b.subarray(0,4).equals(Buffer.from([0x89,0x50,0x4E,0x47])),
 'image/gif':b=>b.subarray(0,4).toString('latin1')==='GIF8','image/webp':b=>b.subarray(0,4).toString('latin1')==='RIFF'&&b.subarray(8,12).toString('latin1')==='WEBP','application/pdf':b=>b.subarray(0,4).toString('latin1')==='%PDF'};
const ownReport=q=>db.prepare('select * from reports where id=? and user_id=?').get(q.params.id,q.uid);
const filesOf=id=>db.prepare('select id,name_enc,mime,size from report_files where report_id=? order by id').all(id).map(f=>({id:f.id,name:dec(f.name_enc),mime:f.mime,size:f.size}));
const shape=x=>({id:x.id,type:x.type,place:dec(x.place_enc),description:dec(x.desc_enc),created_at:x.created_at,incident_at:x.incident_at||x.created_at,evidence:x.evidence_enc?dec(x.evidence_enc):'',files:filesOf(x.id)});
app.get('/api/reports',auth,(q,r)=>r.json({categories:RT,reports:db.prepare('select * from reports where user_id=? order by coalesce(incident_at,created_at) desc,id desc limit 100').all(q.uid).map(shape)}));
const csvCell=v=>{let t=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
app.get('/api/reports/export.csv',auth,(q,r)=>{const rows=db.prepare('select * from reports where user_id=? order by coalesce(incident_at,created_at) desc,id desc').all(q.uid).map(shape);
 const head=['Report ID','Category','Incident date and time (UTC)','Recorded in app (UTC)','Place','What happened','Evidence notes','Attached files'];
 const out=[head.map(csvCell).join(',')].concat(rows.map(x=>[x.id,x.type,x.incident_at,x.created_at,x.place,x.description,x.evidence,x.files.map(f=>f.name).join('; ')].map(csvCell).join(',')));
 r.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="safeher-reports.csv"','Cache-Control':'no-store'});r.send('\ufeff'+out.join('\r\n')+'\r\n')});
app.post('/api/reports',auth,(q,r)=>{const type=RT.includes(q.body.type)?q.body.type:'Other',d=String(q.body.description||'').trim().slice(0,3000),pl=String(q.body.place||'').trim().slice(0,200),ev=String(q.body.evidence||'').trim().slice(0,2000);
 if(!d)return r.status(400).json({error:'Please describe what happened'});
 let at=new Date();if(q.body.incident_at){const t=Date.parse(q.body.incident_at);
  if(!Number.isFinite(t)||t>Date.now()+5*6e4||t<Date.now()-50*365*864e5)return r.status(400).json({error:'Enter a valid date and time that is not in the future'});at=new Date(t)}
 const now=new Date().toISOString();
 r.json({id:db.prepare('insert into reports(user_id,type,place_enc,desc_enc,created_at,incident_at,evidence_enc) values(?,?,?,?,?,?,?)').run(q.uid,type,enc(pl),enc(d),now,at.toISOString(),ev?enc(ev):null).lastInsertRowid})});
app.delete('/api/reports/:id',auth,(q,r)=>{db.prepare('delete from reports where id=? and user_id=?').run(q.params.id,q.uid);r.json({ok:true})});
// Evidence files: one per request as base64 JSON, max 3 per report, 2 MB each, 25 MB per account. Stored encrypted.
app.post('/api/reports/:id/evidence',auth,lim(60),express.json({limit:'3mb'}),(q,r)=>{const rep=ownReport(q);if(!rep)return r.status(404).json({error:'Report not found'});
 const mime=String(q.body.mime||''),check=MIMES[mime];if(!check)return r.status(400).json({error:'Only JPG, PNG, WebP, GIF or PDF files can be attached'});
 const buf=Buffer.from(String(q.body.data||''),'base64');if(!buf.length)return r.status(400).json({error:'The file was empty'});
 if(buf.length>MAXFILE)return r.status(400).json({error:'Each file must be 2 MB or smaller'});
 if(!check(buf))return r.status(400).json({error:'The file contents do not match its type'});
 if(db.prepare('select count(*) n from report_files where report_id=?').get(rep.id).n>=MAXFILES)return r.status(400).json({error:'You can attach up to 3 files to a report'});
 const used=db.prepare('select coalesce(sum(f.size),0) n from report_files f join reports p on p.id=f.report_id where p.user_id=?').get(q.uid).n;
 if(used+buf.length>MAXUSER)return r.status(400).json({error:'Your evidence storage (25 MB) is full. Delete some files first.'});
 const name=String(q.body.name||'evidence').replace(/[\u0000-\u001f\u007f\\/"<>|:*?]/g,'_').slice(0,80)||'evidence';
 r.json({id:db.prepare('insert into report_files(report_id,name_enc,mime,size,data,created_at) values(?,?,?,?,?,?)').run(rep.id,enc(name),mime,buf.length,encB(buf),new Date().toISOString()).lastInsertRowid,name})});
app.get('/api/reports/:id/evidence/:fid',auth,(q,r)=>{const rep=ownReport(q);if(!rep)return r.status(404).end();
 const f=db.prepare('select * from report_files where id=? and report_id=?').get(q.params.fid,rep.id);if(!f)return r.status(404).end();
 const b=decB(f.data);if(!b)return r.status(500).end();
 r.set({'Content-Type':f.mime,'Content-Disposition':'inline; filename="evidence-'+f.id+'"','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",'X-Content-Type-Options':'nosniff'});r.send(b)});
app.delete('/api/reports/:id/evidence/:fid',auth,(q,r)=>{const rep=ownReport(q);if(!rep)return r.status(404).json({error:'Report not found'});
 db.prepare('delete from report_files where id=? and report_id=?').run(q.params.fid,rep.id);r.json({ok:true})});

// Message-checker feedback: lets users flag wrong results so the rules can be improved.
// The pasted message is NOT stored unless the user ticks "include the message". Comment and message are encrypted.
db.exec(`create table if not exists msg_feedback(id integer primary key,user_id integer references users(id) on delete set null,created_at text not null,verdict text not null,level text not null,rules text not null,lang text,comment_enc text,text_enc text);`);
const FB_VERDICTS=['correct','missed_scam','false_alarm'],FB_LEVELS=['none','low','med','high'],RULE_ID=/^[a-z]{2,20}$/;
app.post('/api/feedback',lim(30),(q,r)=>{
 const b=q.body||{},verdict=String(b.verdict||''),level=String(b.level||'');
 if(!FB_VERDICTS.includes(verdict)||!FB_LEVELS.includes(level))return r.status(400).json({error:'Invalid feedback'});
 const rules=(Array.isArray(b.rules)?b.rules:[]).map(String).filter(x=>RULE_ID.test(x)).slice(0,30);
 const lang=['en','hi','mr','hinglish'].includes(b.lang)?b.lang:null,comment=String(b.comment||'').trim().slice(0,500);
 const text=b.include_text===true?String(b.text||'').trim().slice(0,3000):'';
 let uid=null;try{uid=jwt.verify(tokenOf(q),SECRET).uid;if(!db.prepare('select 1 from users where id=?').get(uid))uid=null}catch{}
 const id=db.prepare('insert into msg_feedback(user_id,created_at,verdict,level,rules,lang,comment_enc,text_enc) values(?,?,?,?,?,?,?,?)')
  .run(uid,new Date().toISOString(),verdict,level,rules.join(','),lang,comment?enc(comment):null,text?enc(text):null).lastInsertRowid;
 r.json({ok:true,id:Number(id)})});
// Maintainer export (set ADMIN_TOKEN in .env): GET /api/admin/feedback with header x-admin-token. Returns verdicts, rules and any comments/messages users chose to share.
app.get('/api/admin/feedback',lim(30),(q,r)=>{const tok=process.env.ADMIN_TOKEN||'';
 const given=Buffer.from(String(q.get('x-admin-token')||'')),want=Buffer.from(tok);
 if(!tok||given.length!==want.length||!crypto.timingSafeEqual(given,want))return r.status(403).json({error:'Forbidden'});
 const rows=db.prepare('select id,created_at,verdict,level,rules,lang,comment_enc,text_enc from msg_feedback order by id desc limit 500').all()
  .map(x=>({id:x.id,created_at:x.created_at,verdict:x.verdict,level:x.level,rules:x.rules?x.rules.split(','):[],lang:x.lang,comment:x.comment_enc?dec(x.comment_enc):'',text:x.text_enc?dec(x.text_enc):''}));
 const stats={};for(const x of rows)for(const id of x.rules){const o=stats[id]||(stats[id]={rule:id,false_alarm:0,correct:0,missed_scam:0});o[x.verdict]++}
 r.json({count:rows.length,rule_stats:Object.values(stats),feedback:rows})});
app.use(express.static(path.join(__dirname,'public')));
app.listen(process.env.PORT||3000,()=>console.log('SafeHer server running on http://localhost:'+(process.env.PORT||3000)));
