const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('SafeHer server and web routes are configured for external OSM services', () => {
 const s=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.match(s,/TRUST_PROXY/); assert.match(s,/nominatim\.openstreetmap\.org/); assert.match(s,/routing\.openstreetmap\.de/);
 assert.doesNotMatch(s,/Footprint Scanner running/);
});
test('tracking page declares parsed response and avoids undeclared j', () => {
 const s=fs.readFileSync(path.join(root,'public','track.html'),'utf8');
 assert.match(s,/const j=await r\.json\(\)/); assert.doesNotMatch(s,/first=false,j=/);
});
test('web and mobile scam-checker source copies stay identical', () => {
 const web=fs.readFileSync(path.join(root,'public','msgcheck.js'));
 const app=fs.readFileSync(path.resolve(root,'..','app','src','lib','msgcheck.js'));
 assert.deepEqual(web,app);
});
