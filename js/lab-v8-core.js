/* Shell Academy v8: deterministic, bounded network sandbox and in-lab help.
   No sockets, process spawning, filesystem API or outbound requests. */
(function (global) {
   'use strict';
   const LOCAL = '192.0.2.10', GATEWAY = '192.0.2.1', DNS = '192.0.2.53', SERVER = '198.51.100.20';
   const names = { bash: ['ip', 'ping', 'dig', 'nslookup', 'ss', 'curl', 'traceroute', 'man', 'chmod'], powershell: ['get-netipaddress', 'get-netipconfiguration', 'get-netroute', 'get-dnsclientserveraddress', 'resolve-dnsname', 'test-netconnection', 'test-connection', 'get-netadapter', 'get-nettcpconnection', 'get-netfirewallrule', 'get-help', 'get-acl'] };
   const defaults = () => ({ mode: 'healthy', gateway: true, dns: true, web: true, firewall: true, adapter: true, history: [], ip: LOCAL, server: SERVER });
   const spec = { healthy: { gateway: true, dns: true, web: true, firewall: true, adapter: true }, dns: { gateway: true, dns: false, web: true, firewall: true, adapter: true }, gateway: { gateway: false, dns: true, web: true, firewall: true, adapter: true }, web: { gateway: true, dns: true, web: false, firewall: true, adapter: true }, firewall: { gateway: true, dns: true, web: true, firewall: false, adapter: true }, adapter: { gateway: true, dns: true, web: true, firewall: true, adapter: false } };
   function scene(fs, mode) { if (!Object.hasOwn(spec, mode)) mode = 'healthy'; fs.net = { ...defaults(), ...spec[mode], mode }; return fs.net }
   function state(fs) { if (!fs.net) scene(fs, 'healthy'); return fs.net }
   function pick(cmd) { return String(cmd || '').toLowerCase() }
   function isNet(cmd, shell) { return names[shell]?.includes(pick(cmd)) || false }
   function tx(text, ok = true, sample = true) { return { type: 'text', text: String(text), exitCode: ok ? 0 : 1, sample } }
   function ob(rows, ok = true) { return { type: 'objects', rows, exitCode: ok ? 0 : 1, sample: true } }
   function arg(args, flag) { let at = args.findIndex(a => a.toLowerCase() === flag.toLowerCase()); return at < 0 ? '' : String(args[at + 1] || '') }
   function target(args) { let a = args.filter(x => !x.startsWith('-') && !/^\d+$/.test(x)); return a.at(-1) || 'training.lab' }
   function fail(s) { return tx(s, false) }
   const manual = {
      'ip': ['ip addr | ip route | ip link', 'Show simulated network interfaces, routes and link state.', 'عرض عنوان الشبكة والمسارات وحالة الواجهة.', 'Afficher les interfaces, routes et liens virtuels.'],
      'ping': ['ping -c 2 192.0.2.1', 'Check whether a synthetic host responds to ICMP.', 'اختبر ICMP ضمن الشبكة الافتراضية.', 'Tester ICMP sur le réseau fictif.'],
      'dig': ['dig training.lab', 'Resolve training.lab using the virtual DNS service.', 'حل اسم التدريب بواسطة DNS افتراضي.', 'Résoudre un nom avec le DNS virtuel.'],
      'nslookup': ['nslookup training.lab', 'Query the simulated DNS resolver.', 'استعلم عن عنوان المضيف في DNS.', 'Interroger le DNS simulé.'],
      'ss': ['ss -tuln', 'Show synthetic listening sockets; no real ports are accessed.', 'اعرض منافذ استماع وهمية.', 'Afficher des sockets fictifs.'],
      'curl': ['curl -I https://training.lab', 'Fetch an offline, simulated HTTP response.', 'اعرض استجابة HTTP افتراضية دون إنترنت.', 'Simuler une réponse HTTP hors connexion.'],
      'chmod': ['chmod 640 file.txt', 'Modify virtual permission metadata only (not OS security).', 'غيّر رموز الصلاحيات الافتراضية فقط.', 'Modifier uniquement les métadonnées de permissions.'],
      'get-netipaddress': ['Get-NetIPAddress', 'Display virtual interface addresses.', 'اعرض العناوين الافتراضية لواجهة Windows.', 'Afficher les adresses IP virtuelles.'],
      'get-netroute': ['Get-NetRoute', 'Show the synthetic default route and next hop.', 'اعرض المسار الافتراضي والبوابة.', 'Afficher la route par défaut fictive.'],
      'get-dnsclientserveraddress': ['Get-DnsClientServerAddress', 'Display the fake DNS server address.', 'اعرض خادم DNS الافتراضي.', 'Afficher le DNS fictif.'],
      'resolve-dnsname': ['Resolve-DnsName training.lab', 'Resolve a training name through the virtual DNS.', 'حل الاسم عبر خدمة DNS الوهمية.', 'Résoudre le nom sur le DNS virtuel.'],
      'test-netconnection': ['Test-NetConnection training.lab -Port 443', 'Test a synthetic TCP port, gateway and DNS.', 'اختبر اتصال TCP وهمياً بمساعدة DNS والبوابة.', 'Tester une connexion TCP simulée.'],
      'get-netfirewallrule': ['Get-NetFirewallRule', 'Inspect simulated inbound filtering status.', 'افحص قواعد جدار حماية افتراضية.', 'Inspecter le pare-feu simulé.'],
      'get-acl': ['Get-Acl notes.txt', 'Display virtual permission metadata (not Windows ACL).', 'عرض صلاحيات تعليمية وليست Windows ACL حقيقية.', 'Afficher des autorisations pédagogiques, non ACL réelles.']
   };
   function doc(name, shell) {
      name = pick(name); if (shell === 'powershell' && name === 'get-help') return 'Get-Help <Command> -Full'; const d = manual[name]; if (d) return `${d[0]}\n\n${d[1]}\nالعربية: ${d[2]}\nFrançais: ${d[3]}\n\n[Shell Academy v8: educational subset, not system documentation]`;
      const c = typeof COMMANDS !== 'undefined' ? COMMANDS.find(x => x.shell === shell && pick(x.name) === name) : null;
      if (c) return `${c.name}\nSyntax: ${c.syntax}\nExample: ${c.example}\nEN: ${c.desc.en}\nAR: ${c.desc.ar}\nFR: ${c.desc.fr}\n\n[Reference entry; simulator execution not guaranteed]`;
      return ''
   }
   function exec(fs, shell, command, args, upstream) {
      const n = state(fs); const cmd = pick(command), raw = args.join(' '), host = target(args); n.history.push({ cmd, raw }); if (n.history.length > 80) n.history.shift();
      // Local command manual: returns only vetted docs or curated catalog content.
      if (cmd === 'man' || cmd === 'get-help') { const subject = (args[0] || '').replace(/^-/, ''); const help = doc(subject, shell); return help ? tx(help) : fail('No offline help for ' + (subject || '(empty)') + '. Try man ip / Get-Help Get-NetRoute.'); }
      if (cmd === 'chmod') {
         const mode = args[0], path = args[1]; if (!/^[0-7]{3}$/.test(mode || '') || !path) return fail('chmod: supported teaching form is chmod 640 FILE.');
         const p = global.ShellLabV4.norm(fs, path); if (!fs.files.has(p) && !fs.dirs.has(p)) return fail('chmod: virtual path not found: ' + path);
         fs.permissions = fs.permissions || {}; fs.permissions[p] = mode; return tx('Virtual metadata updated: ' + path + ' ' + mode + ' (no OS permission enforcement)');
      }
      if (cmd === 'get-acl') { const p = global.ShellLabV4.norm(fs, arg(args, '-Path') || args[0] || '.'); if (!fs.files.has(p) && !fs.dirs.has(p)) return fail('Path not found.'); return ob([{ Path: p, Mode: (fs.permissions || {})[p] || '644', Note: 'Educational metadata — not a Windows ACL' }]) }
      const online = n.adapter && n.gateway;
      const ipRows = [{ IPAddress: LOCAL, PrefixLength: 24, InterfaceAlias: 'Ethernet', AddressFamily: 'IPv4', Status: n.adapter ? 'Up' : 'Disabled' }];
      const routeRows = [{ DestinationPrefix: '0.0.0.0/0', NextHop: GATEWAY, InterfaceAlias: 'Ethernet', State: online ? 'Active' : 'Unavailable' }];
      if (cmd === 'ip') {
         if (args[0] === 'route' || args[0] === 'r') return tx(online ? `default via ${GATEWAY} dev eth0\n192.0.2.0/24 dev eth0 scope link` : 'default via 192.0.2.1 dev eth0  # UNREACHABLE');
         if (args.includes('link')) return tx('2: eth0: <BROADCAST,MULTICAST' + (n.adapter ? ',UP,LOWER_UP' : '') + '> state ' + (n.adapter ? 'UP' : 'DOWN'));
         return tx(`2: eth0: <${n.adapter ? 'UP' : 'DOWN'}> mtu 1500\n    inet ${LOCAL}/24 brd 192.0.2.255 scope global eth0`);
      }
      if (cmd === 'get-netipaddress') return ob(ipRows);
      if (cmd === 'get-netipconfiguration') return ob([{ InterfaceAlias: 'Ethernet', IPv4Address: LOCAL, IPv4DefaultGateway: GATEWAY, DNSServer: DNS, Status: n.adapter ? 'Up' : 'Disabled' }]);
      if (cmd === 'get-netroute') return ob(routeRows);
      if (cmd === 'get-netadapter') return ob([{ Name: 'Ethernet', Status: n.adapter ? 'Up' : 'Disabled', LinkSpeed: n.adapter ? '1 Gbps' : '0 bps' }]);
      if (cmd === 'get-dnsclientserveraddress') return ob([{ InterfaceAlias: 'Ethernet', ServerAddresses: DNS }]);
      if (cmd === 'get-nettcpconnection') return ob(n.web && n.adapter ? [{ LocalAddress: SERVER, LocalPort: 443, State: 'Listen', Note: 'Virtual server' }] : []);
      if (cmd === 'get-netfirewallrule') return ob([{ DisplayName: 'Allow HTTPS training', Enabled: n.firewall ? 'True' : 'False', Direction: 'Outbound', Action: n.firewall ? 'Allow' : 'Block' }]);
      if (cmd === 'ss') return tx(n.web && n.adapter ? 'tcp  LISTEN 0  128  198.51.100.20:443  0.0.0.0:*' : 'No listening HTTP endpoint in this scenario.');
      if (cmd === 'ping' || cmd === 'test-connection') {
         const addr = arg(args, '-TargetName') || arg(args, '-ComputerName') || host;
         const toGateway = addr === GATEWAY || /gateway|router/i.test(addr);
         const good = n.adapter && (toGateway ? n.gateway : online && (!/training\.lab/i.test(addr) || n.dns));
         const body = good ? (shell === 'bash' ? `PING ${addr}: 2 packets transmitted, 2 received, 0% packet loss [SIMULATED]` : `Source: ${LOCAL}  Destination: ${addr}  PingSucceeded: True [SIMULATED]`) : `Destination ${addr}: timed out / unreachable [SIMULATED]`;
         return tx(body, good);
      }
      if (cmd === 'dig' || cmd === 'nslookup' || cmd === 'resolve-dnsname') {
         const addr = arg(args, '-Name') || host;
         if (!online) return fail('Network unreachable: no working adapter or gateway [SIMULATED]');
         if (!n.dns) return fail(`DNS resolution failed for ${addr}: virtual resolver ${DNS} unavailable [SIMULATED]`);
         if (!['training.lab', 'www.training.lab', 'localhost', 'example.com'].includes(addr)) return fail('NXDOMAIN: ' + addr + ' [SIMULATED]');
         if (cmd === 'resolve-dnsname') return ob([{ Name: addr, Type: 'A', IPAddress: addr === 'localhost' ? '127.0.0.1' : addr === 'example.com' ? '203.0.113.10' : SERVER }]);
         return tx(`;; SERVER: ${DNS} (SIMULATED)\n${addr}. 300 IN A ${addr === 'localhost' ? '127.0.0.1' : addr === 'example.com' ? '203.0.113.10' : SERVER}`);
      }
      if (cmd === 'traceroute') return tx(online ? `1  ${GATEWAY}  1 ms\n2  ${SERVER}  3 ms [SIMULATED]` : '1  * * *  gateway unreachable [SIMULATED]', online);
      if (cmd === 'curl' || cmd === 'test-netconnection') {
         const dest = arg(args, '-ComputerName') || arg(args, '-TargetName') || host;
         const port = cmd === 'test-netconnection' ? (Number(arg(args, '-Port') || 443)) : 443;
         const nameUsed = /training\.lab/i.test(dest || raw);
         const reachable = (/^(localhost|127\.0\.0\.1)$/i.test(dest) && port === 80) || (online && (!nameUsed || n.dns) && n.web && n.firewall && port === 443);
         const reason = !n.adapter ? 'adapter disabled' : !n.gateway ? 'gateway unreachable' : (nameUsed && !n.dns) ? 'DNS failed' : !n.web ? 'server offline' : !n.firewall ? 'firewall blocked' : 'port closed';
         if (cmd === 'test-netconnection') return ob([{ ComputerName: dest || 'training.lab', RemoteAddress: SERVER, RemotePort: port, TcpTestSucceeded: reachable, PingSucceeded: online, Note: reachable ? 'Virtual success' : reason }], reachable);
         return reachable ? tx('HTTP/1.1 200 OK\nserver: training-sim/1.0\ncontent-type: text/plain\n[SIMULATED HTTP — no request was made]') : fail('curl: (7) ' + reason + ' [SIMULATED — no request was made]');
      }
      return fail('Unsupported virtual network command: ' + cmd);
   }
   const rules = [
      { test: /input too long|maximum file size|capacity|too many/i, code: 'LIMIT', ar: 'الأمر أو الملف تجاوز حدود المحاكاة. اختصر المدخلات أو قسّمها.', fr: 'La limite du simulateur est dépassée. Réduisez la commande.', en: 'Simulator limit reached. Shorten the command or file.' },
      { test: /file not found|path not found|does not exist|not found|cannot find/i, code: 'PATH', ar: 'المسار غير موجود داخل المختبر. استعمل pwd وls للتأكد من المجلد الحالي.', fr: 'Chemin introuvable. Vérifiez pwd et ls.', en: 'Virtual path missing. Check pwd and ls.' },
      { test: /permission|access denied/i, code: 'ACCESS', ar: 'فشل الوصول: راجع صلاحيات الملف وهوية المستخدم في نظام حقيقي. المحاكي لا يطبق ACL حقيقية.', fr: 'Accès refusé. Vérifiez les permissions dans un vrai système.', en: 'Access failure. Inspect permissions on a real system; this lab does not enforce ACLs.' },
      { test: /dns|nxdomain|resolution failed/i, code: 'DNS', ar: 'المشكل في حل أسماء DNS. تحقق من واجهة الشبكة، البوابة، ثم خادم DNS الافتراضي.', fr: 'Échec DNS. Vérifiez interface, passerelle puis serveur DNS virtuel.', en: 'DNS resolution failure. Check adapter, gateway, then virtual DNS.' },
      { test: /gateway|unreachable|timed out/i, code: 'ROUTE', ar: 'الاتصال غير متاح. ابدأ بفحص Adapter وDefault Gateway.', fr: 'Connectivité coupée. Vérifiez adaptateur et passerelle.', en: 'Connectivity failure. Check the adapter and default gateway first.' },
      { test: /firewall|blocked|server offline|port closed/i, code: 'TCP', ar: 'افحص حالة خدمة الويب وقواعد الجدار الناري والمنفذ 443 الوهمي.', fr: 'Vérifiez le service Web, le pare-feu et le port 443 virtuel.', en: 'Inspect the simulated web service, firewall and port 443.' },
      { test: /unsupported|not implemented|unknown command|not recognized/i, code: 'UNSUPPORTED', ar: 'هاد الأمر خارج الأوامر المدعومة. استعمل help أو المرجع؛ المحاكي ماشي Shell كامل.', fr: 'Commande non prise en charge. Consultez help ou la référence.', en: 'Command not implemented here. Use help or the command reference.' },
      { test: /invalid|missing|requires|needs|unexpected|unterminated/i, code: 'SYNTAX', ar: 'راجع Syntax: غالباً كاين معامل ناقص أو صياغة غير صحيحة. اقرأ المساعدة.', fr: 'Vérifiez la syntaxe et les paramètres avec l’aide.', en: 'Likely syntax or missing-argument issue. Check the command help.' }
   ];
   function diagnose(raw, result, language) { if (result?.ok) return { code: 'OK', text: { ar: 'نجح الأمر في المحاكاة. افحص المخرجات قبل الانتقال.', fr: 'Commande simulée réussie. Vérifiez la sortie.', en: 'Simulated command succeeded. Inspect the output.' }[language] || 'Simulated command succeeded.' }; let m = rules.find(x => x.test.test(result?.text || '')) || rules.at(-1); return { code: m.code, text: m[language] || m.en } }

   /* Strictly limited teaching-only control flow (no eval, no subprocesses). */
   function smallControl(fs, shell, source, history, original) {
      const src = String(source || '').trim(); if (src.length > 2000) return null;
      let m;
      if (shell === 'bash') {
         m = src.match(/^if\s+test\s+-(f|d)\s+([\w./-]+)\s*;\s*then\s+([^;\n]+)\s*;\s*else\s+([^;\n]+)\s*;\s*fi$/i);
         if (m) { const full = global.ShellLabV4.norm(fs, m[2]), yes = m[1] === 'f' ? fs.files.has(full) : fs.dirs.has(full); return original(fs, shell, yes ? m[3] : m[4], history) }
         m = src.match(/^for\s+([A-Za-z_][\w]*)\s+in\s+([\w.\/-]+(?:\s+[\w.\/-]+){0,14})\s*;\s*do\s+([^;\n']+)\s*;\s*done$/);
         if (m) { const varname = m[1], items = m[2].trim().split(/\s+/).slice(0, 15), cmd = m[3], pattern = new RegExp('\\$\\{?' + varname + '\\}?\\b', 'g'); let out = [], ok = true; for (const value of items) { const r = original(fs, shell, cmd.replace(pattern, value), history); if (r.text) out.push(r.text); if (!r.ok) { ok = false; break } } return { text: out.join('\n').slice(0, 18000), ok, mutated: true, sample: false } }
      } else if (shell === 'powershell') {
         m = src.match(/^if\s*\(\s*Test-Path\s+([\w./\\-]+)\s*\)\s*\{\s*([^{};\n]+?)\s*\}\s*else\s*\{\s*([^{};\n]+?)\s*\}$/i);
         if (m) { const full = global.ShellLabV4.norm(fs, m[1]), yes = fs.files.has(full) || fs.dirs.has(full); return original(fs, shell, yes ? m[2] : m[3], history) }
         m = src.match(/^foreach\s*\(\s*\$([A-Za-z_]\w*)\s+in\s+(\d{1,2})\.\.(\d{1,2})\s*\)\s*\{\s*([^{};\n]+?)\s*\}$/i);
         if (m) { let a = +m[2], b = +m[3]; if (Math.abs(b - a) > 14) return { text: 'ERROR: Loop limited to 15 iterations.', ok: false }; const re = new RegExp('\\$' + m[1] + '\\b', 'g'); let out = [], ok = true; for (let i = a; ; i += a <= b ? 1 : -1) { const r = original(fs, shell, m[4].replace(re, String(i)), history); if (r.text) out.push(r.text); if (!r.ok) { ok = false; break } if (i === b) break } return { text: out.join('\n').slice(0, 18000), ok, mutated: true, sample: false } }
         m = src.match(/^(\d{1,2})\.\.(\d{1,2})\s*\|\s*ForEach-Object\s*\{\s*\$_\s*\}$/i);
         if (m) { let a = +m[1], b = +m[2]; if (Math.abs(b - a) > 14) return { text: 'ERROR: Loop limited to 15 iterations.', ok: false }; return { text: Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => a + (a <= b ? i : -i)).join('\n'), ok: true, mutated: false, sample: false } }
      }
      return null;
   }
   const original = global.ShellLabV4.run;
   global.ShellLabV4.run = function (fs, shell, src, history) { const r = smallControl(fs, shell, src, history, original) || original(fs, shell, src, history); try { if (global.document && typeof global.CustomEvent === 'function') global.document.dispatchEvent(new global.CustomEvent('shellv8:run', { detail: { fs, shell, src, result: r } })) } catch { } return r };
   // These commands are inserted into the engine pipeline handler, so Select-Object and redirects remain functional.
   global.ShellLabV8 = { state, scene, spec, isNet, exec, doc, diagnose, commands: names };
})(window);
