/* Shell Academy v4: bounded, in-memory shell interpreter. Never spawns system processes. */
(function (global) {
    'use strict';
    const MAX_INPUT = 2000, MAX_TEXT = 90000, MAX_ITEMS = 450, MAX_OUTPUT = 18000, MAX_STAGES = 10;
    const bashCommands = ['pwd', 'ls', 'cd', 'mkdir', 'touch', 'cat', 'head', 'tail', 'wc', 'grep', 'sort', 'uniq', 'cut', 'tr', 'sed', 'tee', 'nl', 'tac', 'rev', 'echo', 'printf', 'cp', 'mv', 'rm', 'rmdir', 'find', 'tree', 'stat', 'file', 'basename', 'dirname', 'seq', 'diff', 'test', 'date', 'whoami', 'hostname', 'uname', 'id', 'printenv', 'which', 'history', 'clear', 'reset', 'help', 'ip', 'ping', 'ss', 'ps', 'df', 'free', 'uptime', 'dig', 'curl', 'awk', 'paste', 'comm', 'join', 'env', 'export', 'unset', 'du', 'rg', 'jq', 'sha256sum', 'cmp', 'true', 'false', 'man', 'chmod', 'nslookup', 'traceroute'];
    const psCommands = ['Get-Location', 'Get-ChildItem', 'Set-Location', 'New-Item', 'Get-Item', 'Test-Path', 'Get-Content', 'Set-Content', 'Add-Content', 'Clear-Content', 'Copy-Item', 'Move-Item', 'Remove-Item', 'Rename-Item', 'Select-String', 'Select-Object', 'Where-Object', 'Sort-Object', 'Group-Object', 'Measure-Object', 'Format-Table', 'Format-List', 'Out-String', 'Out-File', 'Tee-Object', 'Get-Unique', 'Split-Path', 'Join-Path', 'Get-Process', 'Get-Service', 'Get-Date', 'Write-Output', 'Write-Host', 'Get-Help', 'Get-Alias', 'Get-Command', 'Get-History', 'Get-NetIPAddress', 'Get-NetIPConfiguration', 'Get-NetRoute', 'Test-NetConnection', 'Test-Connection', 'Clear-Host', 'ForEach-Object', 'Get-Member', 'ConvertTo-Json', 'ConvertFrom-Json', 'ConvertTo-Csv', 'ConvertFrom-Csv', 'Import-Csv', 'Export-Csv', 'Compare-Object', 'Join-String', 'Get-Random', 'Get-FileHash', 'Test-Json', 'Get-Variable', 'Set-Variable', 'Remove-Variable', 'Resolve-Path', 'Get-NetAdapter', 'Get-NetTCPConnection', 'Get-DnsClientServerAddress', 'Resolve-DnsName', 'Get-NetFirewallRule', 'Get-Acl', 'reset', 'help'];
    function commands(shell) { return shell === 'bash' ? bashCommands : psCommands }
    function lex(s) {
        if (s.length > MAX_INPUT) throw Error('Input too long (max 2000 characters).'); const parts = []; let buf = '', quote = '', started = false, qkind = '', quotedOnly = false; const push = () => { if (started) { parts.push({ kind: 'word', value: buf, literal: quotedOnly && qkind === "'" }); buf = ''; started = false; qkind = ''; quotedOnly = false } };
        for (let i = 0; i < s.length; i++) {
            let ch = s[i]; if (quote) { if (ch === quote) { quote = ''; continue } if (ch === '\\' && quote === '"' && s[i + 1] === '"') { buf += '"'; i++; continue } buf += ch; continue }
            if (ch === '"' || ch === "'") { if (!started) { qkind = ch; quotedOnly = true } else quotedOnly = false; quote = ch; started = true; continue }
            if (ch === '\\' && s[i + 1] && (/[ \t"'|;&><]/.test(s[i + 1]))) { buf += s[++i]; started = true; continue }
            if (/[ \t\r]/.test(ch)) { push(); continue }
            if (ch === '\n') { push(); parts.push({ kind: 'op', value: ';' }); continue }
            if ('|;&>'.includes(ch)) { push(); let v = ch; if ((ch === '>' && s[i + 1] === '>') || (ch === '&' && s[i + 1] === '&') || (ch === '|' && s[i + 1] === '|')) v += s[++i]; parts.push({ kind: 'op', value: v }); continue }
            if (ch === '<') throw Error('Input redirection is not supported in this lab.');
            buf += ch; started = true; if (qkind) quotedOnly = false
        }
        if (quote) throw Error('Unclosed quoted string.'); push(); return parts
    }
    function splitPipeline(src) {
        let lx = lex(src), chains = [], chain = [], segment = [], gate = ';'; for (const t of lx) {
            if (t.kind === 'op') {
                if (t.value === '|') { if (!segment.length) throw Error('Missing command before pipe.'); chain.push(segment); segment = [] }
                else if (t.value === ';' || t.value === '&&' || t.value === '||') { if (segment.length) { chain.push(segment); segment = [] } if (chain.length) { chains.push({ pipeline: chain, gate }); chain = [] } gate = t.value }
                else segment.push(t)
            } else segment.push(t)
        } if (segment.length) chain.push(segment); if (chain.length) chains.push({ pipeline: chain, gate }); if (chains.length > MAX_STAGES || chains.some(c => c.pipeline.length > MAX_STAGES)) throw Error('Too many chained or piped commands.'); return chains
    }
    const err = s => { throw Error(s) };
    function safeRegex(source, flags = '') {
        const p = String(source);
        if (p.length > 100 || /(\([^)]*[+*][^)]*\)[+*{]|\\[1-9]|\(\?[:=!<])/.test(p)) err('Regex too complex for the browser simulator; simplify the pattern.');
        try { return new RegExp(p, flags) } catch { err('Invalid regular expression.') }
    }

    function sha256(text) {
        const raw = new TextEncoder().encode(String(text)); const n = Math.ceil((raw.length + 9) / 64) * 64;
        const data = new Uint8Array(n); data.set(raw); data[raw.length] = 128;
        const view = new DataView(data.buffer); const bitlen = raw.length * 8;
        view.setUint32(n - 8, Math.floor(bitlen / 4294967296)); view.setUint32(n - 4, bitlen >>> 0);
        const primes = []; for (let a = 2; primes.length < 64; a++) { let prime = true; for (let d = 2; d * d <= a; d++)if (a % d === 0) { prime = false; break } if (prime) primes.push(a) }
        const frac = x => Math.floor((x % 1) * 4294967296) >>> 0;
        const K = primes.map(p => frac(Math.cbrt(p)));
        let H = primes.slice(0, 8).map(p => frac(Math.sqrt(p)));
        const rotr = (x, n) => (x >>> n) | (x << (32 - n));
        for (let off = 0; off < n; off += 64) {
            const W = new Uint32Array(64);
            for (let i = 0; i < 16; i++)W[i] = view.getUint32(off + i * 4);
            for (let i = 16; i < 64; i++)W[i] = (W[i - 16] + (rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)) + W[i - 7] + (rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10))) >>> 0;
            let [a, b, c, d, e, f, g, h] = H;
            for (let i = 0; i < 64; i++) {
                const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
                const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
                h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
            }
            H = H.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) >>> 0)
        }
        return H.map(x => x.toString(16).padStart(8, '0')).join('');
    }
    const basename = p => p === '/' ? '/' : p.slice(p.lastIndexOf('/') + 1);
    const parent = p => p === '/' ? '/' : p.slice(0, p.lastIndexOf('/')) || '/';
    function norm(fs, p) { let s = String(p ?? '.').replaceAll('\\', '/'); if (s === '~') s = '/home/student'; else if (s.startsWith('~/')) s = '/home/student/' + s.slice(2); else if (/^c:\/users\/student/i.test(s)) s = s.replace(/^c:\/users\/student/i, '/home/student'); else if (/^c:\//i.test(s)) s = '/home/student/' + s.slice(3); if (!s.startsWith('/')) s = fs.cwd + '/' + s; let stack = []; for (const a of s.split('/')) { if (a === '..') stack.pop(); else if (a && a !== '.') stack.push(a) } return '/' + stack.join('/') }
    function ensure(fs, p) { if (!fs.dirs.has(p)) err('Directory not found: ' + p) }
    function fileRead(fs, p) { if (fs.dirs.has(p)) err('Is a directory: ' + p); if (!fs.files.has(p)) err('File not found: ' + p); return fs.files.get(p) }
    function write(fs, p, text, append = false) { if (fs.dirs.has(p)) err('Cannot write to directory: ' + p); ensure(fs, parent(p)); if (!fs.files.has(p) && fs.files.size + fs.dirs.size >= MAX_ITEMS) err('Virtual lab file limit reached.'); let val = (append ? (fs.files.get(p) || '') : '') + String(text); if (val.length > MAX_TEXT) err('Maximum file size is 90 KB.'); fs.files.set(p, val); return p }
    function mkdir(fs, p, recursive) { if (p === '/') return; if (fs.files.has(p)) err('A file already exists at ' + p); if (fs.dirs.has(p)) return; if (recursive) { let acc = ''; for (const x of p.split('/').filter(Boolean)) { acc += '/' + x; if (fs.files.has(acc)) err('Not a directory: ' + acc); if (fs.dirs.size + fs.files.size >= MAX_ITEMS) err('Virtual filesystem capacity reached.'); fs.dirs.add(acc) } } else { ensure(fs, parent(p)); if (fs.dirs.size + fs.files.size >= MAX_ITEMS) err('Virtual filesystem capacity reached.'); fs.dirs.add(p) } }
    function rm(fs, p, recursive = false) { if (p === '/' || p === '/home' || p === '/home/student') err('Cannot remove protected lab directory.'); if (fs.files.has(p)) { fs.files.delete(p); return } if (!fs.dirs.has(p)) err('Path does not exist: ' + p); let children = [...fs.files.keys(), ...fs.dirs].filter(x => x.startsWith(p + '/')); if (children.length && !recursive) err('Directory not empty. Use -r / -Recurse.'); for (const x of children) { fs.files.delete(x); fs.dirs.delete(x) } fs.dirs.delete(p); if (fs.cwd === p || fs.cwd.startsWith(p + '/')) fs.cwd = '/home/student' }
    function cp(fs, src, dst, recursive, move = false) { if (!fs.files.has(src) && !fs.dirs.has(src)) err('Source not found: ' + src); if (fs.dirs.has(dst)) dst = norm(fs, dst + '/' + basename(src)); if (src === dst) err('Source and destination are the same.'); ensure(fs, parent(dst)); if (fs.files.has(src)) { write(fs, dst, fs.files.get(src)); if (move) fs.files.delete(src); return dst } if (!recursive && !move) err('Directory copy needs -r / -Recurse.'); if (dst.startsWith(src + '/')) err('Cannot copy a directory into itself.'); let dirs = [src, ...fs.dirs].filter(d => d === src || d.startsWith(src + '/')).sort((a, b) => a.length - b.length); for (const d of dirs) mkdir(fs, dst + d.slice(src.length), true); let files = [...fs.files].filter(([p]) => p.startsWith(src + '/')); for (const [p, t] of files) write(fs, dst + p.slice(src.length), t); if (move) rm(fs, src, true); return dst }
    function formatPath(fs, p, shell) { return shell === 'powershell' ? 'C:\\Users\\Student' + p.replace(/^\/home\/student/, '').replaceAll('/', '\\') : p }
    function globRx(pattern) { const p = String(pattern || '*'); return new RegExp('^' + p.split('*').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*').replaceAll('?', '.') + '$', 'i') }
    function flags(args, tag) { return args.includes(tag) || args.some(a => /^-[a-z]+$/.test(a) && tag.length === 2 && a.includes(tag[1])) }
    function positional(args, exclude) { let skip = false; return args.filter((a, i) => { if (skip) { skip = false; return false } if (a.startsWith('-') && a !== '-') { if (exclude.includes(a.toLowerCase())) skip = true; return false } return true }) }
    function option(args, opts) { for (const k of opts) { let i = args.findIndex(a => a.toLowerCase() === k.toLowerCase()); if (i >= 0) return args[i + 1] } return null }
    function streamFrom(value) { return value?.type === 'objects' ? value.rows.map(o => Object.values(o).join('  ')).join('\n') : value?.text || '' }
    function textVal(text, meta = {}) { return { type: 'text', text: String(text ?? ''), ...meta } }
    function objsVal(rows, meta = {}) { return { type: 'objects', rows, ...meta } }
    function asRows(value) { if (value?.type === 'objects') return value.rows; return (value?.text || '').split(/\r?\n/).filter(Boolean).map(s => ({ Value: s })) }
    function table(rows, cols) { if (!rows.length) return ''; cols = cols || Object.keys(rows[0]); let widths = cols.map(k => Math.max(k.length, ...rows.map(x => String(x[k] ?? '').length)).valueOf()); widths = widths.map((x, i) => Math.min(cols[i] === 'Hash' ? 64 : 34, x)); return cols.join('  ') + '\n' + cols.map((x, i) => '-'.repeat(Math.min(widths[i], x.length + 4))).join('  ') + '\n' + rows.slice(0, 150).map(o => cols.map((k, i) => String(o[k] ?? '').slice(0, widths[i]).padEnd(widths[i])).join('  ')).join('\n') }
    function output(value) { if (!value) return ''; let s = value.type === 'objects' ? table(value.rows) : String(value.text || ''); return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + '\n[Output truncated: 18 KB limit]' : s }
    const sample = {
        'get-netipaddress': 'IPAddress      InterfaceAlias\n192.0.2.10     Ethernet\n127.0.0.1      Loopback',
        'get-netipconfiguration': 'InterfaceAlias: Ethernet\nIPv4Address: 192.0.2.10\nIPv4DefaultGateway: 192.0.2.1',
        'get-netroute': 'DestinationPrefix  NextHop\n0.0.0.0/0          192.0.2.1',
        'test-netconnection': 'ComputerName: example.test\nTcpTestSucceeded: True (simulated)',
        'test-connection': 'Source: LAB  Destination: localhost  Status: Success',
        'ip': 'eth0: inet 192.0.2.10/24\nlo: 127.0.0.1/8',
        'ping': 'PING localhost (127.0.0.1)\n2 packets transmitted, 2 received (simulated)',
        'ss': 'Netid State  Local Address:Port\ntcp   LISTEN 127.0.0.1:8080',
        'df': 'Filesystem  Size Used Avail\n/dev/vda1    16G 2G  14G',
        'free': '           total used available\nMem:       2.0G 400M 1.6G',
        'uptime': 'up 2 hours, 1 user (simulated)',
        'dig': 'example.test. 3600 IN A 192.0.2.100',
        'curl': 'HTTP/1.1 200 OK (simulated response)',
        'uname': 'Linux shell-academy-lab 6.x (simulated)',
        'ps': 'PID  USER     COMMAND\n101  student  bash\n120  student  ps',
        'get-alias': 'ls  Get-ChildItem\npwd Get-Location\ncd  Set-Location',
        'get-command': 'Get-Location\nGet-ChildItem\nGet-Content\nGet-Process',
        'get-help': 'Get-Help <Command> -Full — consult the real installed help for your version',
    };
    function execute(fs, shell, words, upstream, history) {
        if (!words.length) return textVal(''); let name = words[0].value, cmd = name.toLowerCase(), args = words.slice(1).map(x => x.value), hasInput = upstream !== null;
        if (shell === 'powershell') { cmd = ({ 'ls': 'get-childitem', 'dir': 'get-childitem', 'gci': 'get-childitem', 'cd': 'set-location', 'pwd': 'get-location', 'cat': 'get-content', 'gc': 'get-content', 'echo': 'write-output', 'cls': 'clear-host', 'where': 'where-object', '?': 'where-object', 'select': 'select-object', 'sort': 'sort-object', 'ft': 'format-table', 'fl': 'format-list', 'measure': 'measure-object', 'sls': 'select-string', 'cp': 'copy-item', 'mv': 'move-item', 'rm': 'remove-item', 'ni': 'new-item', 'sc': 'set-content', 'ac': 'add-content', 'type': 'get-content' }[cmd] || cmd) }
        const ps = shell === 'powershell'; const rawName = name;
        if (global.ShellLabV8 && global.ShellLabV8.isNet(cmd, shell)) return global.ShellLabV8.exec(fs, shell, cmd, args, upstream);
        const param = (...names) => option(args, names);
        const skip = ['-n', '-c', '-tail', '-totalcount', '-first', '-last', '-itemtype', '-path', '-literalpath', '-name', '-filter', '-pattern', '-property', '-value', '-destination', '-newname', '-count', '-algorithm', '-encoding', '-type', '-delimiter', '-context', '-exclude', '-include', '-d', '-f', '-maximum', '-minimum', '-json', '-filepath', '-separator'];
        const pos = positional(args, skip);
        const argPath = () => norm(fs, param('-Path', '-LiteralPath') || pos[0] || '.');
        const inputText = () => streamFrom(upstream);
        const valuesFrom = () => hasInput ? inputText() : fileRead(fs, argPath());
        const linesFrom = () => valuesFrom().replace(/\r/g, '').replace(/\n$/, '').split('\n');
        const takeNum = (v, def) => { const n = Number(v ?? def); if (!Number.isSafeInteger(n) || n < 0 || n > 10000) err('Invalid number: ' + String(v)); return n };
        if (cmd === 'pwd' || cmd === 'get-location') return textVal(formatPath(fs, fs.cwd, shell));
        if (cmd === 'true') return textVal('', { exitCode: 0 });
        if (cmd === 'help') { let available = commands(shell); return textVal('Shell Academy — implemented educational subset (not a real OS):\n' + available.join('  · ')); }
        if (cmd === 'false') return textVal('', { exitCode: 1 });
        if (cmd === 'whoami') return textVal('student');
        if (shell === 'bash' && /^[A-Za-z_][A-Za-z_0-9]*=/.test(name)) {
            const j = name.indexOf('='); fs.env = fs.env || {}; fs.env[name.slice(0, j)] = name.slice(j + 1); return textVal('');
        }
        if (cmd === 'unset') { fs.env = fs.env || {}; for (const k of pos) delete fs.env[k]; return textVal(''); }
        if (ps && ['set-variable', 'get-variable', 'remove-variable'].includes(cmd)) {
            fs.env = fs.env || {}; const key = param('-Name') || pos[0]; if (!key) err('Specify -Name.'); const canonical = Object.keys(fs.env).find(k => k.toLowerCase() === key.toLowerCase()) || key;
            if (cmd === 'set-variable') { let v = param('-Value') ?? pos[1] ?? ''; fs.env[canonical] = v; return textVal(''); }
            if (cmd === 'remove-variable') { delete fs.env[canonical]; return textVal(''); }
            if (!(canonical in fs.env)) err('Variable does not exist: ' + key);
            return objsVal([{ Name: canonical, Value: fs.env[canonical] }]);
        }
        if (cmd === 'env' || cmd === 'export') {
            if (cmd === 'export' && pos[0] && pos[0].includes('=')) { const [k, ...v] = pos[0].split('='); if (!/^[A-Za-z_][\w]*$/.test(k)) err('Invalid variable name.'); fs.env = fs.env || {}; fs.env[k] = v.join('='); return textVal(''); }
            const env = { HOME: '/home/student', USER: 'student', SHELL: '/bin/bash', ...(fs.env || {}) };
            return textVal(cmd === 'env' ? Object.entries(env).map(([k, v]) => k + '=' + v).join('\n') : Object.keys(fs.env || {}).map(k => 'export ' + k + '=' + fs.env[k]).join('\n'));
        }

        if (cmd === 'hostname') return textVal('shell-lab');
        if (cmd === 'id') return textVal('uid=1000(student) gid=1000(student) groups=1000(student)');
        if (cmd === 'date' || cmd === 'get-date') return textVal(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
        if (cmd === 'history' || cmd === 'get-history') return textVal(history.map((x, i) => String(i + 1).padStart(3) + '  ' + x).join('\n'));
        if (cmd === 'printenv') { const e = { HOME: '/home/student', USER: 'student', SHELL: '/bin/bash', ...(fs.env || {}) }; return textVal(args[0] ? (e[args[0]] ?? '') : Object.entries(e).map(([k, v]) => k + '=' + v).join('\n')) };
        if (cmd === 'which') return textVal(args.length ? '/usr/bin/' + args[0] : '');
        if (cmd === 'get-location') return textVal(formatPath(fs, fs.cwd, shell));
        if (cmd === 'cd' || cmd === 'set-location') { let p = norm(fs, param('-Path', '-LiteralPath') || pos[0] || '~'); ensure(fs, p); fs.cwd = p; return textVal(formatPath(fs, fs.cwd, shell)) }
        if (cmd === 'ls' || cmd === 'get-childitem') {
            let p = argPath(), hidden = flags(args, '-a') || args.includes('-Force'), recursive = args.includes('-Recurse') || flags(args, '-R'); if (!fs.dirs.has(p)) { if (fs.files.has(p)) return ps ? objsVal([{ Name: basename(p), Length: fs.files.get(p).length, Mode: '-a---' }]) : textVal(basename(p)); err('Path not found: ' + p) }
            let all = [...fs.dirs, ...fs.files.keys()].filter(x => x !== p && x.startsWith(p === '/' ? '/' : p + '/') && (recursive || !x.slice((p === '/' ? '/' : p + '/').length).includes('/')) && (hidden || !basename(x).startsWith('.'))).filter(x => !ps || !args.includes('-File') || fs.files.has(x)).filter(x => !ps || !args.includes('-Directory') || fs.dirs.has(x)).sort();
            if (all.length > 400) all = all.slice(0, 400); return ps ? objsVal(all.map(x => ({ Name: basename(x), Mode: fs.dirs.has(x) ? 'd----' : '-a---', Length: fs.files.has(x) ? fs.files.get(x).length : 0, Path: x }))) : textVal(all.map(x => (fs.dirs.has(x) ? '[DIR]  ' : '       ') + (recursive ? x.slice(p.length + 1) : basename(x))).join('\n') || '(empty)')
        }
        if (cmd === 'mkdir' || cmd === 'touch' || cmd === 'new-item') {
            let name = param('-Path', '-Name') || pos[0], isDir = cmd === 'mkdir' || (cmd === 'new-item' && /directory/i.test(param('-ItemType') || args.join(' '))); if (!name) err('Missing path.'); const p = norm(fs, name); if (cmd === 'touch' && fs.files.has(p)) return textVal(p); if (cmd === 'touch' && fs.dirs.has(p)) return textVal(p);
            if (isDir) mkdir(fs, p, flags(args, '-p') || args.includes('-Force')); else { if (fs.dirs.has(p)) err('Already a directory: ' + p); write(fs, p, fs.files.get(p) || '') } return textVal((isDir ? 'Directory: ' : 'File: ') + formatPath(fs, p, shell))
        }
        if (cmd === 'rm' || cmd === 'rmdir' || cmd === 'remove-item') {
            let names = param('-Path', '-LiteralPath') ? [param('-Path', '-LiteralPath')] : pos; if (!names.length) err('Missing path.'); for (const x of names) { rm(fs, norm(fs, x), flags(args, '-r') || args.includes('-Recurse') || flags(args, '-R')) } return textVal('Removed ' + names.join(', '))
        }
        if (cmd === 'cp' || cmd === 'mv' || cmd === 'copy-item' || cmd === 'move-item') {
            let src = norm(fs, param('-Path') || pos[0]), dstStr = param('-Destination') || pos[1]; if (!dstStr) err('Destination missing.'); const dest = cp(fs, src, norm(fs, dstStr), flags(args, '-r') || args.includes('-Recurse'), cmd === 'mv' || cmd === 'move-item'); return textVal('Created: ' + formatPath(fs, dest, shell))
        }
        if (cmd === 'rename-item') { let a = norm(fs, param('-Path') || pos[0]), dest = param('-NewName') || pos[1]; if (!dest) err('NewName missing.'); return textVal('Renamed: ' + cp(fs, a, norm(fs, parent(a) + '/' + dest), true, true)) }
        if (cmd === 'cat' || cmd === 'get-content' || cmd === 'head' || cmd === 'tail') {
            let data = valuesFrom(); if (cmd === 'head' || cmd === 'tail' || param('-Tail', '-TotalCount')) { let lines = data.split('\n'), n = takeNum(param('-Tail', '-TotalCount') || param('-n') || ((cmd === 'head' || cmd === 'tail') && args.includes('-n') ? args[args.indexOf('-n') + 1] : undefined), 10); data = (cmd === 'tail' || param('-Tail') ? lines.slice(-n) : lines.slice(0, n)).join('\n') } return textVal(data)
        }
        if (cmd === 'set-content' || cmd === 'add-content' || cmd === 'clear-content' || cmd === 'out-file') {
            let path = norm(fs, param('-Path', '-FilePath') || pos[0]), data = hasInput ? inputText() : (param('-Value') ?? pos.slice(1).join(' ')); if (cmd === 'clear-content') data = ''; write(fs, path, data, cmd === 'add-content' || args.includes('-Append')); return textVal('Saved: ' + formatPath(fs, path, shell))
        }
        if (cmd === 'echo' || cmd === 'printf' || cmd === 'write-output' || cmd === 'write-host') {
            let data = words.slice(1).map(w => {
                let z = w.value; if (w.literal) return z;
                if (ps) return z.replace(/\$env:USERPROFILE/gi, 'C:\\Users\\Student').replace(/\$HOME/gi, 'C:\\Users\\Student').replace(/\$([A-Za-z_][\w]*)/g, (_, k) => { const key = Object.keys(fs.env || {}).find(x => x.toLowerCase() === k.toLowerCase()); return key ? (fs.env[key] ?? '') : ('$' + k) });
                return z.replace(/\$\{([A-Za-z_][A-Za-z_0-9]*)\}|\$([A-Za-z_][A-Za-z_0-9]*)/g, (_, a, b) => ({ HOME: '/home/student', USER: 'student', SHELL: '/bin/bash', ...(fs.env || {}) })[a || b] ?? '')
            }).join(' '); if (cmd === 'printf') data = data.replace(/\\n/g, '\n').replace(/\\t/g, '\t'); return textVal(data, { newline: cmd !== 'printf' })
        }
        if (cmd === 'test-path') return textVal(String(fs.files.has(argPath()) || fs.dirs.has(argPath())));
        if (cmd === 'test') { const candidate = args.at(-1); if (!candidate || candidate.startsWith('-')) err('test: missing path'); const p = norm(fs, candidate); const ok = args.includes('-f') ? fs.files.has(p) : args.includes('-d') ? fs.dirs.has(p) : fs.files.has(p) || fs.dirs.has(p); return textVal('', { exitCode: ok ? 0 : 1 }) }
        if (cmd === 'get-item' || cmd === 'stat' || cmd === 'file') { let p = argPath(), isF = fs.files.has(p); if (!isF && !fs.dirs.has(p)) err('Not found: ' + p); return textVal((isF ? 'File: ' : 'Directory: ') + formatPath(fs, p, shell) + (isF ? '\nSize: ' + fs.files.get(p).length + ' bytes' : '')) }
        if (cmd === 'basename' || cmd === 'dirname' || cmd === 'split-path') {
            let p = norm(fs, param('-Path') || pos[0] || '.'); return textVal(cmd === 'basename' || args.includes('-Leaf') ? basename(p) : parent(p))
        }
        if (cmd === 'join-path') { let a = param('-Path') || pos[0] || '.', b = param('-ChildPath') || pos[1] || ''; return textVal(formatPath(fs, norm(fs, a + '/' + b), shell)) }
        if (cmd === 'find' || cmd === 'tree') {
            let p = argPath(); ensure(fs, p); let all = [...fs.dirs, ...fs.files.keys()].filter(x => x === p || x.startsWith(p + '/')).sort(), pat = param('-name', '-iname'), typ = param('-type'), maxdepth = param('-maxdepth');
            if (pat) { const re = globRx(pat); all = all.filter(x => re.test(basename(x))) }
            if (typ === 'f') all = all.filter(x => fs.files.has(x)); else if (typ === 'd') all = all.filter(x => fs.dirs.has(x));
            if (maxdepth !== null) { const depth = takeNum(maxdepth, 1); all = all.filter(x => x === p || x.slice((p === '/' ? '' : p).length).split('/').filter(Boolean).length <= depth) }
            if (cmd === 'find') return textVal(all.slice(0, 400).join('\n'));
            return textVal(basename(p) + '\n' + all.filter(x => x !== p).slice(0, 180).map(x => '  '.repeat(Math.min(8, x.slice(p.length + 1).split('/').length - 1)) + '└─ ' + basename(x)).join('\n'))
        }
        if (cmd === 'wc' || cmd === 'measure-object') {
            if (cmd === 'wc') { let s = valuesFrom(); return textVal(flags(args, '-l') ? String((s.match(/\n/g) || []).length + (hasInput && upstream?.newline && !s.endsWith('\n') ? 1 : 0)) : flags(args, '-c') ? String(new TextEncoder().encode(s).length) : `${(s.match(/\n/g) || []).length} ${s.split(/\s+/).filter(Boolean).length} ${new TextEncoder().encode(s).length}`) }
            let rows = asRows(upstream || textVal('')), property = param('-Property') || 'Value', vals = rows.map(r => Number(r[property])).filter(Number.isFinite), result = { Count: rows.length }; if (args.includes('-Line')) result.Lines = streamFrom(upstream).split('\n').filter(Boolean).length; if (args.includes('-Sum')) result.Sum = vals.reduce((a, b) => a + b, 0); if (args.includes('-Average')) result.Average = vals.length ? (result.Sum ?? vals.reduce((a, b) => a + b, 0)) / vals.length : 0; return objsVal([result])
        }
        if (cmd === 'grep' || cmd === 'rg' || cmd === 'select-string') {
            const searchPos = cmd === 'grep' || cmd === 'rg' ? args.filter(a => !a.startsWith('-')) : pos; const patt = param('-Pattern') || searchPos[0]; if (!patt) err('Search pattern missing.');
            const fixed = flags(args, '-F'), ignore = flags(args, '-i') || (ps && !args.includes('-CaseSensitive'));
            const regex = fixed ? null : safeRegex(patt, ignore ? 'i' : '');
            const check = line => fixed ? (ignore ? line.toLowerCase().includes(patt.toLowerCase()) : line.includes(patt)) : regex.test(line);
            const recursive = cmd === 'rg' || flags(args, '-r') || flags(args, '-R') || args.includes('-Recurse');
            const pathName = ps ? (param('-Path') || pos[1]) : (searchPos[1] || '.');
            let paths = [];
            if (hasInput) paths = [null]; else if (recursive) { const dir = norm(fs, pathName); if (fs.files.has(dir)) paths = [dir]; else { ensure(fs, dir); paths = [...fs.files.keys()].filter(p => p.startsWith(dir === '/' ? '/' : dir + '/')).sort().slice(0, 400) } }
            else { const path = norm(fs, pathName); if (!fs.files.has(path)) err('File not found: ' + path); paths = [path] }
            let hits = [];
            for (const path of paths) {
                const lines = (path === null ? inputText() : fileRead(fs, path)).split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) { const ok = check(lines[i]); if (ok !== flags(args, '-v')) hits.push({ path, line: lines[i], i: i + 1 }) }
            }
            if (flags(args, '-l')) return textVal([...new Set(hits.map(h => h.path || '(stdin)'))].join('\n'));
            if (flags(args, '-c')) return textVal(String(hits.length));
            const prefix = recursive || cmd === 'rg'; const numbered = flags(args, '-n') || args.includes('-LineNumber');
            return textVal(hits.slice(0, 450).map(h => (prefix && h.path ? h.path + ':' : '') + (numbered ? h.i + ':' : '') + h.line).join('\n'));
        }
        if (cmd === 'sort' || cmd === 'sort-object') {
            if (ps && upstream?.type === 'objects') { let key = param('-Property') || Object.keys(upstream.rows[0] || {})[0]; let rows = upstream.rows.slice().sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { numeric: true })); if (args.includes('-Descending')) rows.reverse(); if (args.includes('-Unique')) rows = rows.filter((x, i) => i === 0 || x[key] !== rows[i - 1][key]); return objsVal(rows) }
            let arr = valuesFrom().split('\n').sort((a, b) => flags(args, '-n') ? Number(a) - Number(b) : a.localeCompare(b)); if (flags(args, '-r') || args.includes('-Descending')) arr.reverse(); if (args.includes('-Unique')) arr = [...new Set(arr)]; return textVal(arr.join('\n'))
        }
        if (cmd === 'uniq' || cmd === 'get-unique') { let lines = valuesFrom().split('\n'); let seen = []; for (const x of lines) if (seen[seen.length - 1] !== x) seen.push(x); if (flags(args, '-c')) { let group = []; for (const line of lines) { if (group.length && group[group.length - 1].line === line) group[group.length - 1].count++; else group.push({ line, count: 1 }) } return textVal(group.map(x => x.count + ' ' + x.line).join('\n')) } return textVal(seen.join('\n')) }
        if (cmd === 'cut') { let delimiter = param('-d') || '\t', field = takeNum(param('-f') || '1', 1); return textVal(linesFrom().map(l => l.split(delimiter)[field - 1] ?? '').join('\n')) }
        if (cmd === 'tr') { let from = pos[0] || '', to = pos[1] || ''; let data = inputText(); if (!hasInput) err('tr requires piped input in the lab.'); if (flags(args, '-d')) return textVal(data.split('').filter(c => !from.includes(c)).join('')); return textVal([...data].map(c => { let i = from.indexOf(c); return i < 0 ? c : (to[i] ?? to[to.length - 1] ?? '') }).join('')) }
        if (cmd === 'sed') { let expression = pos[0] || '', raw = valuesFrom(); let m = expression.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/); if (!m) err('Lab supports sed s/old/new/[g] only.'); let re = safeRegex(m[2], m[4].includes('g') ? 'g' : ''); return textVal(raw.replace(re, m[3])) }
        if (cmd === 'nl') { return textVal(linesFrom().map((l, i) => String(i + 1).padStart(6) + '\t' + l).join('\n')) }
        if (cmd === 'tac') return textVal(linesFrom().reverse().join('\n'));
        if (cmd === 'rev') return textVal(linesFrom().map(l => [...l].reverse().join('')).join('\n'));
        if (cmd === 'tee' || cmd === 'tee-object') {
            if (!hasInput) err('tee requires piped input.'); let p = norm(fs, param('-FilePath') || pos[0] || ''); write(fs, p, inputText(), flags(args, '-a') || args.includes('-Append')); return upstream
        }
        if (cmd === 'out-string') return textVal(output(upstream));
        if (cmd === 'select-object') {
            let rows = asRows(upstream || textVal('')); let props = (param('-Property') || pos.join(',')).split(',').map(x => x.trim()).filter(Boolean); if (props.length && props[0] !== '*') { rows = rows.map(x => Object.fromEntries(props.map(p => [p, x[p] ?? '']))) } let n = param('-First'); if (n != null) rows = rows.slice(0, takeNum(n, 10)); n = param('-Last'); if (n != null) rows = rows.slice(-takeNum(n, 10)); if (args.includes('-Unique')) rows = rows.filter((x, i) => rows.findIndex(v => JSON.stringify(v) === JSON.stringify(x)) === i); return objsVal(rows)
        }
        if (cmd === 'where-object') {
            let rows = asRows(upstream || textVal('')), prop = param('-Property'), op = '-eq', target = ''; if (!prop) { let cond = args.join(' ').replace(/[{}$_]/g, ' ').trim().split(/\s+/); prop = cond[0] || 'Name'; op = cond[1] || '-eq'; target = cond.slice(2).join(' ').replace(/^['"]|['"]$/g, '') } else { let i = args.findIndex(v => v.toLowerCase() === '-property'); op = args[i + 2] || '-eq'; target = args[i + 3] || '' }
            if (!['-eq', '-ne', '-gt', '-ge', '-lt', '-le', '-like', '-match'].includes(op.toLowerCase())) err('Unsupported Where-Object operator.'); let filterFn = o => { let a = o[prop] ?? o.Value ?? '', b = target, na = Number(a), nb = Number(b), numeric = Number.isFinite(na) && Number.isFinite(nb); let cmp = numeric ? na - nb : String(a).toLowerCase().localeCompare(String(b).toLowerCase()); switch (op.toLowerCase()) { case '-eq': return cmp === 0; case '-ne': return cmp !== 0; case '-gt': return cmp > 0; case '-ge': return cmp >= 0; case '-lt': return cmp < 0; case '-le': return cmp <= 0; case '-like': return globRx(b).test(String(a)); case '-match': try { return safeRegex(b, 'i').test(String(a)) } catch { return false } } }; return objsVal(rows.filter(filterFn))
        }
        if (cmd === 'group-object') { let rows = asRows(upstream || textVal('')), prop = param('-Property') || pos[0] || 'Value', m = new Map(); for (const o of rows) { const k = String(o[prop] ?? ''); m.set(k, (m.get(k) || 0) + 1) } return objsVal([...m].map(([Name, Count]) => ({ Count, Name }))) }
        if (cmd === 'format-table' || cmd === 'format-list') {
            let rows = asRows(upstream || textVal('')), props = (param('-Property') || pos.join(',')).split(',').map(x => x.trim()).filter(Boolean); if (!props.length || props[0] === '*') props = Object.keys(rows[0] || {}); return textVal(cmd === 'format-table' ? table(rows, props) : rows.map(o => props.map(k => k + ' : ' + (o[k] ?? '')).join('\n')).join('\n\n'))
        }
        if (cmd === 'get-process') return objsVal([{ Name: 'pwsh', Id: 1120, CPU: 2.1, WorkingSet: 12345678 }, { Name: 'explorer', Id: 2240, CPU: 3.5, WorkingSet: 25400128 }, { Name: 'notepad', Id: 3320, CPU: 0.3, WorkingSet: 8388608 }].filter(x => !param('-Name') || x.Name === param('-Name')), { sample: true });
        if (cmd === 'get-service') return objsVal([{ Name: 'EventLog', Status: 'Running' }, { Name: 'WinDefend', Status: 'Running' }, { Name: 'Spooler', Status: 'Stopped' }].filter(x => !param('-Name') || x.Name === param('-Name')), { sample: true });
        // v6 additions: deterministic local filesystem diagnostics, JSON queries and hashes.
        if (cmd === 'du') {
            const src = norm(fs, pos.find(v => !v.startsWith('-')) || '.');
            if (!fs.files.has(src) && !fs.dirs.has(src)) err('Path not found: ' + src);
            const bytes = [...fs.files].filter(([p]) => p === src || p.startsWith(src + '/')).reduce((n, [, v]) => n + new TextEncoder().encode(v).length, 0);
            const units = flags(args, '-h') ? (bytes < 1024 ? bytes + 'B' : (bytes / 1024).toFixed(1) + 'K') : String(bytes);
            return textVal(units + '\t' + src);
        }
        if (cmd === 'cmp') {
            if (pos.length < 2) err('cmp requires two paths.'); const a = fileRead(fs, norm(fs, pos[0])), b = fileRead(fs, norm(fs, pos[1]));
            return a === b ? textVal('', { exitCode: 0 }) : textVal(pos[0] + ' ' + pos[1] + ' differ', { exitCode: 1 });
        }
        if (cmd === 'sha256sum' || cmd === 'get-filehash') {
            const path = param('-Path', '-LiteralPath') || pos[0]; if (!path) err('Specify a virtual file path.');
            const full = norm(fs, path), digest = sha256(fileRead(fs, full));
            if (cmd === 'get-filehash') { const alg = param('-Algorithm') || 'SHA256'; if (alg.toUpperCase() !== 'SHA256') err('Lab implements SHA256 only.'); return objsVal([{ Algorithm: 'SHA256', Hash: digest.toUpperCase(), Path: formatPath(fs, full, shell) }]); }
            return textVal(digest + '  ' + path);
        }
        if (cmd === 'resolve-path') { const full = argPath(); if (!fs.files.has(full) && !fs.dirs.has(full)) err('Path not found: ' + full); return textVal(formatPath(fs, full, shell)); }
        if (cmd === 'test-json') {
            const val = param('-Json') ?? (hasInput ? inputText() : pos.join(' ')); try { JSON.parse(val); return textVal('True') } catch { return textVal('False') }
        }
        if (cmd === 'jq') {
            let exp = pos[0]; if (!exp) err('jq needs a filter, such as . or .items[].name');
            if (exp.length > 90 || !/^\.(?:(?:[A-Za-z_][A-Za-z0-9_-]*|\[\d*\])\.?)*$/.test(exp)) err('Lab jq supports selectors like ., .name, .items[], .items[].name and .[0].name. No arbitrary jq programs.');
            const raw = hasInput ? inputText() : fileRead(fs, norm(fs, pos[1] || '')); let obj; try { obj = JSON.parse(raw) } catch { err('Invalid JSON source.') }
            const steps = exp.slice(1).match(/[A-Za-z_][A-Za-z0-9_-]*|\[\d*\]/g) || []; let values = [obj];
            for (const key of steps) {
                const next = []; for (const value of values) {
                    if (key === '[]') { if (!Array.isArray(value)) err('jq [] expects an array.'); next.push(...value.slice(0, 400)) }
                    else if (key.startsWith('[')) { if (!Array.isArray(value)) err('jq [n] expects an array.'); const i = Number(key.slice(1, -1)); next.push(value[i] ?? null) }
                    else next.push(value && typeof value === 'object' && key in value ? value[key] : null)
                } values = next.slice(0, 400)
            }
            const rawFlag = flags(args, '-r'), compact = flags(args, '-c'); return textVal(values.map(v => rawFlag && typeof v === 'string' ? v : JSON.stringify(v, null, compact ? 0 : 2)).join('\n'));
        }
        if (cmd === 'get-netadapter') { let rows = [{ Name: 'Ethernet', Status: 'Up', LinkSpeed: '1 Gbps' }, { Name: 'Wi-Fi', Status: 'Down', LinkSpeed: '0 bps' }]; const n = param('-Name'); return objsVal(n ? rows.filter(r => r.Name.toLowerCase() === n.toLowerCase()) : rows, { sample: true }); }
        if (cmd === 'get-nettcpconnection') { let rows = [{ LocalAddress: '127.0.0.1', LocalPort: 8080, RemoteAddress: '0.0.0.0', State: 'Listen' }]; const state = param('-State'); return objsVal(state ? rows.filter(r => r.State.toLowerCase() === state.toLowerCase()) : rows, { sample: true }); }
        // v5 realistic, bounded text and object transformations.
        if (cmd === 'awk') {
            const program = pos[0] || ''; if (!program) err('awk needs a program.');
            if (!/^\s*(?:-F\s*\S+\s*)?\{\s*print\s+(?:\$[0-9]+|NR|NF|\$0)(?:\s*,\s*\$[0-9]+)*\s*\}\s*$/.test(program)) err('Lab awk supports {print $1}, {print $0}, {print NR}, {print NF} and multiple fields only.');
            const fieldSep = param('-F') || ' ', source = hasInput ? inputText() : fileRead(fs, norm(fs, pos[1] || '')), rows = source.replace(/\r/g, '').replace(/\n$/, '').split('\n'); return textVal(rows.map((line, i) => {
                const fields = fieldSep === ' ' ? line.trim().split(/\s+/) : line.split(fieldSep);
                return program.replace(/.*print\s+/, '').replace(/\s*}\s*$/, '').split(',').map(tok => { tok = tok.trim(); return tok === 'NR' ? String(i + 1) : tok === 'NF' ? String(fields.length) : tok === '$0' ? line : fields[Number(tok.slice(1)) - 1] || '' }).join(' ')
            }).join('\n'));
        }
        if (cmd === 'paste') {
            if (!pos.length) err('paste expects two files.'); let sources = pos.map(p => fileRead(fs, norm(fs, p)).split(/\r?\n/)); let size = Math.max(...sources.map(x => x.length)); if (size > 600) err('Too many rows.'); let delimiter = param('-d') || '\t'; return textVal(Array.from({ length: size }, (_, i) => sources.map(a => a[i] || '').join(delimiter)).join('\n'));
        }
        if (cmd === 'comm') {
            if (pos.length < 2) err('comm requires two sorted text files.'); const a = new Set(fileRead(fs, norm(fs, pos[0])).split('\n')), b = new Set(fileRead(fs, norm(fs, pos[1])).split('\n')); const hide = args.filter(x => /^-[123]+$/.test(x)).join(''); let out = [];
            for (const x of [...new Set([...a, ...b])].sort()) { let col = a.has(x) && b.has(x) ? '3' : a.has(x) ? '1' : '2'; if (!hide.includes(col)) out.push((col === '3' ? '\t\t' : col === '2' ? '\t' : '') + x) } return textVal(out.join('\n'));
        }
        if (cmd === 'join') {
            if (pos.length < 2) err('join needs two sorted files.'); let a = fileRead(fs, norm(fs, pos[0])).split('\n'), b = fileRead(fs, norm(fs, pos[1])).split('\n'), map = new Map(); for (const row of b) { const [key, ...rest] = row.trim().split(/\s+/); if (!map.has(key)) map.set(key, []); map.get(key).push(rest) } let out = []; for (const row of a) { let [key, ...rest] = row.trim().split(/\s+/); for (const next of map.get(key) || []) out.push([key, ...rest, ...next].join(' ')) } return textVal(out.slice(0, 300).join('\n'));
        }
        if (cmd === 'forEach-object' || cmd === 'foreach-object') {
            if (!hasInput) err('ForEach-Object needs pipeline input.'); let expr = args.join(' ').replace(/^\s*\{\s*|\s*\}\s*$/g, '').trim(), rows = asRows(upstream);
            if (/^\$_\.(\w+)$/i.test(expr)) { let key = expr.match(/^\$_\.(\w+)$/i)[1]; return textVal(rows.map(r => String(r[key] ?? '')).join('\n')) }
            if (/^\$_\s*$/.test(expr)) return upstream;
            err('Lab supports ForEach-Object { $_ } or { $_.Property } only.');
        }
        if (cmd === 'get-member') {
            const rows = asRows(upstream || textVal('')); if (!rows.length) return textVal('No members.'); const keys = Object.keys(rows[0]); return objsVal(keys.map(Name => ({ Name, MemberType: 'NoteProperty', Definition: typeof rows[0][Name] })));
        }
        if (cmd === 'convertto-json') {
            let data = upstream?.type === 'objects' ? upstream.rows : hasInput ? inputText().split('\n') : pos.join(' ');
            return textVal(JSON.stringify(data, null, 2));
        }
        if (cmd === 'convertfrom-json') {
            const src = hasInput ? inputText() : pos.join(' '); try { const parsed = JSON.parse(src); return Array.isArray(parsed) ? objsVal(parsed.map(o => typeof o === 'object' && o !== null ? o : { Value: o })) : typeof parsed === 'object' && parsed !== null ? objsVal([parsed]) : textVal(String(parsed)) } catch { err('Invalid JSON input.') }
        }
        if (cmd === 'convertto-csv' || cmd === 'export-csv') {
            const rows = asRows(upstream || textVal('')); if (!rows.length) return textVal(''); const cols = Object.keys(rows[0]); const quote = v => '"' + String(v ?? '').replaceAll('"', '""') + '"'; let csv = [cols.map(quote).join(','), ...rows.map(row => cols.map(k => quote(row[k])).join(','))].join('\n');
            if (cmd === 'export-csv') { let p = param('-Path') || pos[0]; if (!p) err('Export-Csv needs -Path.'); write(fs, norm(fs, p), csv); return textVal('Exported CSV: ' + p) } return textVal(csv);
        }
        if (cmd === 'convertfrom-csv' || cmd === 'import-csv') {
            const src = cmd === 'import-csv' ? fileRead(fs, norm(fs, param('-Path') || pos[0] || '')) : hasInput ? inputText() : pos.join(' ');
            function parseCsv(s) { let all = [], row = [], val = '', quoted = false; for (let i = 0; i < s.length; i++) { let c = s[i]; if (c === '"') { if (quoted && s[i + 1] === '"') { val += '"'; i++ } else quoted = !quoted } else if (c === ',' && !quoted) { row.push(val); val = '' } else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && s[i + 1] === '\n') i++; row.push(val); all.push(row); row = []; val = '' } else val += c } if (quoted) err('Unterminated CSV quote.'); if (row.length || val) all.push([...row, val]); return all }
            const rows = parseCsv(src); const headers = rows.shift() || []; return objsVal(rows.slice(0, 450).map(r => Object.fromEntries(headers.map((k, i) => [k, r[i] || '']))));
        }
        if (cmd === 'compare-object') {
            const refs = param('-ReferenceObject') || '', diffs = param('-DifferenceObject') || '';
            const ref = refs ? refs.split(',') : [], dif = diffs ? diffs.split(',') : [];
            if (!ref.length && !dif.length) err('Lab supports comma-separated -ReferenceObject and -DifferenceObject arguments.');
            return objsVal([...ref.filter(x => !dif.includes(x)).map(InputObject => ({ InputObject, SideIndicator: '<=' })), ...dif.filter(x => !ref.includes(x)).map(InputObject => ({ InputObject, SideIndicator: '=>' }))]);
        }
        if (cmd === 'join-string') return textVal(asRows(upstream || textVal('')).map(o => String(o.Value ?? Object.values(o)[0] ?? '')).join(param('-Separator') ?? ''));
        if (cmd === 'get-random') {
            let max = Number(param('-Maximum') || pos[0] || 100), min = Number(param('-Minimum') || 0); if (!Number.isFinite(max) || !Number.isFinite(min) || max <= min) err('Invalid random range.'); return textVal(String(Math.floor(min + Math.random() * (max - min))));
        }
        if (cmd === 'diff') { if (pos.length < 2) err('Specify two files.'); let a = fileRead(fs, norm(fs, pos[0])), b = fileRead(fs, norm(fs, pos[1])); return textVal(a === b ? '(files are identical)' : '--- ' + pos[0] + '\n+++ ' + pos[1] + '\n- ' + a.slice(0, 1000) + '\n+ ' + b.slice(0, 1000)) }
        if (cmd === 'seq') { let end = takeNum(pos[1] || pos[0], 1), start = pos[1] ? takeNum(pos[0], 1) : 1; if (end - start > 300) err('Sequence too large.'); return textVal(Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => String(start + i)).join('\n')) }
        if (cmd === 'get-alias' || cmd === 'get-command' || cmd === 'get-help') return textVal(sample[cmd]);
        if (Object.prototype.hasOwnProperty.call(sample, cmd)) return textVal(sample[cmd] + '\n[SIMULATED SAMPLE — no real system or network access]', { sample: true });
        err('Unsupported in this lab: ' + rawName + '. Type help for available commands.')
    }
    function run(fs, shell, src, history) { let chains; try { chains = splitPipeline(src) } catch (e) { return { text: 'ERROR: ' + String(e.message || e), ok: false, sample: false, mutated: false } } let results = [], lastOk = true, last = null, mutated = false; for (const chain of chains) { if ((chain.gate === '&&' && !lastOk) || (chain.gate === '||' && lastOk)) continue; try { let stages = chain.pipeline, upstream = null, redirection = null; for (const stage of stages) { let words = []; for (let i = 0; i < stage.length; i++) { let token = stage[i]; if (token.kind === 'op' && (token.value === '>' || token.value === '>>')) { if (i + 1 >= stage.length || stage[i + 1].kind !== 'word') err('Redirection needs a file path.'); if (i + 2 !== stage.length) err('Redirection must be at end of command.'); redirection = { append: token.value === '>>', path: stage[i + 1].value }; break } if (token.kind !== 'word') err('Unexpected operator: ' + token.value); words.push(token) } if (!words.length) err('Empty pipeline stage.'); upstream = execute(fs, shell, words, upstream, history); mutated = true } if (redirection) { let p = norm(fs, redirection.path); write(fs, p, streamFrom(upstream), redirection.append); upstream = textVal('Saved: ' + formatPath(fs, p, shell)) } last = upstream; results.push(output(upstream)); lastOk = upstream?.exitCode !== 1 } catch (e) { results.push('ERROR: ' + String(e.message || e)); lastOk = false; last = { type: 'error', text: String(e.message || e) } } } return { text: results.filter(Boolean).join('\n'), ok: lastOk, sample: Boolean(last?.sample), mutated } }
    return global.ShellLabV4 = { run, commands, norm, formatPath, output };
})(window);
