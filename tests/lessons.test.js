'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const D = path.resolve(__dirname, '..');
const win = {}; const ctx = { window: win, TextEncoder, performance }; vm.createContext(ctx);
const read = n => fs.readFileSync(path.join(D, 'js', n), 'utf8');
vm.runInContext(read('catalog.js') + '\n;globalThis.COMMAND_LIST=COMMANDS;', ctx);
vm.runInContext(read('lab-engine.js'), ctx);
vm.runInContext(read('lab-v8-core.js'), ctx);
vm.runInContext(read('lessons-data.js') + '\n' + read('lessons-v8-data.js') + '\n' + read('lessons-v8-projects.js') + '\n;globalThis.LESSONS_LIST=LESSONS;globalThis.MODULES=LESSON_MODULES;', ctx);
const lessons = ctx.LESSONS_LIST, modules = ctx.MODULES, commands = ctx.COMMAND_LIST, engine = win.ShellLabV4;
assert.equal(lessons.length, 184); assert.equal(modules.length, 28); assert.equal(commands.length, 975);
for (const module of modules) { assert.equal(lessons.filter(x => x.module === module.id).length, ['b-incidents', 'b-audits', 'p-incidents', 'p-audits'].includes(module.id) ? 8 : ['b-reliable', 'p-reliability'].includes(module.id) ? 14 : ['b-perms', 'b-triage', 'b-netops', 'p-adminops', 'p-netops', 'p-reporting'].includes(module.id) ? 10 : 4, module.id) }
const ids = new Set(); let refs = 0, matched = 0;
for (const l of lessons) {
    assert(!ids.has(l.id), 'duplicate ' + l.id); ids.add(l.id);
    assert(['bash', 'powershell'].includes(l.shell)); assert(l.minutes >= 8 && l.minutes <= 12);
    for (const k of ['title', 'goal', 'concept', 'explain', 'pitfall']) for (const lang of ['ar', 'fr', 'en']) assert(typeof l[k][lang] === 'string' && l[k][lang].length > (k === 'title' ? 3 : 12), l.id + ' ' + k + ' ' + lang);
    assert(l.syntax && l.example && l.lab);
    for (const ref of l.refs) { refs++; if (commands.some(c => c.shell === l.shell && c.name.toLowerCase() === ref.toLowerCase())) matched++ }
}
function labFS() { const base = '/home/student'; return { cwd: base, dirs: new Set(['/', '/home', base, base + '/Documents', base + '/Labs', base + '/logs', base + '/data', base + '/training']), files: new Map([[base + '/notes.txt', 'Hello from Shell Academy\nThis is a safe virtual example.'], [base + '/names.txt', 'Charlie\nAlice\nBob'], [base + '/app.log', 'INFO ready\nERROR trouble'], [base + '/Documents/notes.txt', 'Welcome'], [base + '/logs/app.log', 'INFO start\nERROR network timeout\nINFO done'], [base + '/data/users.csv', 'name,age,team\nAda,21,network\nBen,24,linux'], [base + '/data/config.json', '{"name":"shell-academy","enabled":true}']]) } }
let success = 0; for (const l of lessons) { const r = engine.run(labFS(), l.shell, l.lab, []); assert(r.ok, `lab ${l.id}: ${l.lab} => ${r.text}`); success++ }
for (const module of modules) { const ls = lessons.filter(l => l.module === module.id); const codes = ls.map(l => ({ 'p-start-4': 'Set-Location Documents', 'p-network-4': 'Get-NetIPAddress; Get-NetRoute; Test-NetConnection localhost -Port 80' }[l.id] || l.example.split('\n')[0])); assert.equal(new Set(codes).size, ls.length, 'unique quiz codes ' + module.id) }
console.log(`✓ ${lessons.length} detailed lessons across ${modules.length} modules: all translations, content and unique IDs`);
console.log(`✓ ${success} sandbox examples execute successfully`);
console.log(`✓ All 28 modules have distinct quiz answer choices`);
console.log(`✓ ${matched}/${refs} related commands have exact reference matches (others are reading-only)`);
