const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('native app screens and safety core are present', () => {
 for (const f of ['src/screens/SosScreen.js','src/screens/RoutesScreen.js','src/screens/CheckScreen.js','src/screens/ReportsScreen.js','src/state/Sos.js']) assert.ok(fs.existsSync(path.join(root,f)), `${f} exists`);
});
test('app and web scam checker copies are identical', () => {
 assert.deepEqual(fs.readFileSync(path.join(root,'src/lib/msgcheck.js')),fs.readFileSync(path.resolve(root,'..','server/public/msgcheck.js')));
});
