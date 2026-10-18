// 3-maktab real vaqt API — Cloudflare Workers + Durable Object (WebSocket)
// Deploy: cd api && npx wrangler secret put AUTH_SECRET && npx wrangler secret put BOT_TOKEN && npx wrangler deploy
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
};
const json = (d, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', ...CORS } });


// ---- Xavfsiz kirish: PBKDF2 parol + HMAC imzoli token ----
const enc = new TextEncoder();
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function pbk(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, k, 256));
}
async function hm(env, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
async function mint(env, u) {
  const p = b64(enc.encode(JSON.stringify({ id: u.id, role: u.role, child: u.child || '', exp: Date.now() + 7 * 864e5 })));
  return p + '.' + (await hm(env, p));
}
async function verify(env, tok) {
  try {
    const [p, s] = (tok || '').split('.');
    if (!p || s !== (await hm(env, p))) return null;
    const d = JSON.parse(new TextDecoder().decode(unb64(p)));
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
}
const isAdm = (r) => r === 'admin' || r === 'developer' || r === 'director';
const bearer = (req) => (req.headers.get('authorization') || '').slice(7);

// ---- Umumiy kolleksiyalar: ruxsatlar serverda tekshiriladi ----
// put/del: 'adm' = admin+, 'tch' = o'qituvchi+, 'any' = har kim, 'self' = o'zi yoki admin, 'own' = egasi yoki admin; own:1 = uid/by serverda qo'yiladi
const RULES = {
  news: { put: 'tch', del: 'own', own: 1 }, comments: { put: 'any', del: 'own', own: 1 }, msgs: { put: 'tch', del: 'own', own: 1 },
  sched: { put: 'tch', del: 'tch' }, att: { put: 'tch', del: 'tch' }, classes: { put: 'adm', del: 'adm' }, subjects: { put: 'adm', del: 'adm' }, bells: { put: 'adm', del: 'adm' }, users: { put: 'self', del: 'adm' },
  hw: { put: 'tch', del: 'tch' }, hwdone: { put: 'pre', del: 'pre' }, anns: { put: 'tch', del: 'own', own: 1 }, apps: { put: 'any', del: 'adm', own: 1 },
};

const SYS = {
  ask: "Sen 3-maktab (O‘zbekiston) savol-javob yordamchisisan. O‘zbek tilida qisqa va aniq javob ber. Dars jadvali, uy vazifasi, anonim ariza, Telegram bot, maktab qoidalari haqida yordam ber. Bilmasang, maktab ma’muriyatiga murojaat qilishni ayt.",
  tutor: "Sen AI repetitorsan. Mavzuni o‘quvchiga tushunarli, qadam-baqadam, misollar bilan o‘zbek tilida tushuntir. Oxirida bitta mashq savol ber.",
  snap: "Sen uy vazifasi yordamchisisan. Masalani o‘zbek tilida qadam-baqadam yech va tushuntir, oxirida javobni yoz. Rasm bo‘lsa, undagi masalani o‘qi.",
  plan: "Sen o‘quv rejalashtiruvchisan. Berilgan vazifa va muddatlar bo‘yicha bugundan boshlab kunlar kesimida qisqa, real reja tuz (o‘zbek tilida). Muddati yaqinlarga ustunlik ber.",
  quiz: "Faqat JSON massiv qaytar, boshqa matn yozma: [{\"q\":\"savol\",\"o\":[\"A\",\"B\",\"C\",\"D\"],\"a\":0,\"e\":\"qisqa izoh\"}]. \"a\" — to‘g‘ri variant indeksi (0-3). O‘zbek tilida, berilgan fan va mavzu bo‘yicha.",
  analyze: "Sen maktab murojaatlarini tahlil qiluvchisan. O‘zbek tilida javob ber. Format: 1) Qisqa mazmun 2) Muhimlik (Oddiy/Muhim/Shoshilinch) va sababi 3) Ariza sifati 1-10 va nima yetishmaydi 4) Ma’muriyat uchun tayyor javob loyihasi.",
  improve: "Sen o‘quvchi arizasini yaxshilovchisan. O‘zbek tilida: avval 1-2 gapda nima qo‘shish kerakligini ayt (aniq dalil, vaqt, sinf), so‘ng arizaning hurmatli ohangdagi tahrirlangan variantini yoz.",
};

export class Hub {
  constructor(state, env) { this.state = state; this.env = env; }

  async auth(u, req) {
    const b = await req.json().catch(() => ({}));
    let id = String(b.id || '').toLowerCase().trim();
    const st = this.state.storage;
    if (u.pathname === '/auth/login' && id.includes('@')) {      // email bilan kirish: profil yozuvidan username topiladi
      for (const d of (await st.list({ prefix: 'c:users:' })).values()) if (String(d.email || '').toLowerCase() === id) { id = d.id; break; }
    }
    if (u.pathname === '/auth/telegram') return this.tg(b);
    if (u.pathname === '/auth/passwd') {                 // parolni almashtirish (token egasi uchun)
      const me = await verify(this.env, bearer(req)), cur = me && (await st.get('u:' + me.id));
      if (!cur || !cur.salt || (await pbk(String(b.old || ''), unb64(cur.salt))) !== cur.hash) return json({ error: 'Eski parol xato' }, 401);
      if (String(b.pw || '').length < 6) return json({ error: 'Yangi parol kamida 6 belgi' }, 400);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      cur.salt = b64(salt); cur.hash = await pbk(b.pw, salt); await st.put('u:' + me.id, cur);
      return json({ ok: true });
    }
    if (u.pathname === '/auth/setrole') {
      const me = await verify(this.env, bearer(req)), cur = await st.get('u:' + id);
      if (!me || !isAdm(me.role)) return json({ error: 'forbidden' }, 403);
      if (!cur || cur.role === 'developer') return json({ error: 'topilmadi' }, 404);
      if (cur.role === 'director' && me.role !== 'developer') return json({ error: 'ruxsat yo‘q' }, 403);
      if (!['student', 'parent', 'teacher', 'admin', 'director'].includes(b.role) || (['admin', 'director'].includes(b.role) && me.role !== 'developer'))
        return json({ error: 'ruxsat yo‘q' }, 403);
      cur.role = b.role; await st.put('u:' + id, cur);
      const p = await st.get('c:users:' + id);
      if (p) { p.role = b.role; await st.put('c:users:' + id, p); }
      return this.ping('users');
    }
    if (!/^[a-z0-9_.]{3,30}$/.test(id) || String(b.pw || '').length < 6) return json({ error: 'Username (3+) yoki parol (6+) noto‘g‘ri' }, 400);
    const cur = await st.get('u:' + id);
    if (u.pathname === '/auth/login') {
      if (!cur || !cur.salt || (await pbk(b.pw, unb64(cur.salt))) !== cur.hash) return json({ error: 'Username yoki parol xato' }, 401);
      return json({ token: await mint(this.env, cur), role: cur.role, id: cur.id || id });
    }
    if (cur) return json({ error: 'Username band' }, 409);
    const em = String(b.email || '').toLowerCase().trim();
    if (em && u.pathname === '/auth/register') {
      for (const d of (await st.list({ prefix: 'c:users:' })).values()) if (String(d.email || '').toLowerCase() === em) return json({ error: 'Bu email band' }, 409);
    }
    let role;
    if (u.pathname === '/auth/create') {
      const me = await verify(this.env, bearer(req));
      if (!me || !isAdm(me.role)) return json({ error: 'forbidden' }, 403);
      role = ['admin', 'director'].includes(b.role) && me.role === 'developer' ? b.role : 'teacher';
    } else role = id === String(this.env.DEV_USERNAME || '').toLowerCase() ? 'developer' : b.role === 'parent' ? 'parent' : 'student';
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const rec = { id, salt: b64(salt), hash: await pbk(b.pw, salt), role, child: role === 'parent' ? String(b.child || '').toLowerCase() : '' };
    await st.put('u:' + id, rec);
    return u.pathname === '/auth/create' ? json({ ok: true }) : json({ token: await mint(this.env, rec), role });
  }

  // Telegram Login Widget: imzo BOT_TOKEN orqali serverda tekshiriladi
  async tg(d) {
    const bt = this.env.BOT_TOKEN;
    if (!bt) return json({ error: 'Telegram hali ulanmagan' }, 503);
    const { hash, ...f } = d || {};
    if (!/^[0-9a-f]{64}$/.test(hash || '') || !/^\d{1,15}$/.test(String(f.id)) || Date.now() / 1000 - +f.auth_date > 86400) return json({ error: 'Telegram ma’lumoti yaroqsiz' }, 401);
    const str = Object.keys(f).sort().map((k) => `${k}=${f[k]}`).join('\n');
    const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode(bt)), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, Uint8Array.from(hash.match(/../g).map((h) => parseInt(h, 16))), enc.encode(str));
    if (!ok) return json({ error: 'Telegram imzosi noto‘g‘ri' }, 401);
    const id = 'tg_' + f.id, st = this.state.storage;
    let rec = await st.get('u:' + id);
    if (!rec) {
      rec = { id, salt: '', hash: '', role: 'student', child: '' };
      await st.put('u:' + id, rec);
      const name = [f.first_name, f.last_name].filter(Boolean).join(' ').trim() || f.username || id;
      await st.put('c:users:' + id, { id, name: name.slice(0, 60), tg: String(f.username || ''), photo: String(f.photo_url || ''), email: '', cls: '', bd: '', role: 'student', child: '', ts: Date.now() });
      await this.ping('users');
    }
    return json({ token: await mint(this.env, rec), role: rec.role, id });
  }

  // ---- AI (Cloudflare Workers AI) ----
  async ai(req) {
    const me = await verify(this.env, bearer(req));
    if (!me) return json({ error: 'kirish kerak' }, 401);
    if (!this.env.AI) return json({ error: 'AI hali ulanmagan (wrangler.toml da [ai] bor — qayta deploy qiling).' }, 503);
    const now = Date.now(); this.rl = this.rl || {};
    const r = (this.rl[me.id] || []).filter((x) => now - x < 6e4);
    if (r.length >= 8) return json({ error: 'Juda ko‘p so‘rov. Bir daqiqa kuting.' }, 429);
    r.push(now); this.rl[me.id] = r;
    const b = await req.json().catch(() => ({})), sys = SYS[b.kind];
    if (!sys || (b.kind === 'analyze' && !isAdm(me.role))) return json({ error: 'ruxsat yo‘q' }, 403);
    const hist = (Array.isArray(b.hist) ? b.hist : []).slice(-8).map((x) => ({ role: x.role === 'assistant' ? 'assistant' : 'user', content: String(x.content || '').slice(0, 1500) }));
    let content = String(b.text || '').slice(0, 4000) || 'Rasmdagi masalani yech.', model = '@cf/meta/llama-3.1-8b-instruct';
    if (b.kind === 'snap' && /^data:image\/(jpeg|png|webp);base64,/.test(b.img || '') && b.img.length < 900000) {
      model = '@cf/meta/llama-3.2-11b-vision-instruct';
      content = [{ type: 'text', text: content }, { type: 'image_url', image_url: { url: b.img } }];
    }
    try {
      const o = await this.env.AI.run(model, { messages: [{ role: 'system', content: sys }, ...hist, { role: 'user', content }], max_tokens: b.kind === 'quiz' ? 1800 : 900 });
      return json({ text: String(o.response ?? o.result?.response ?? '') });
    } catch (e) { return json({ error: 'AI xatosi: ' + String(e.message || e).slice(0, 160) }, 502); }
  }

  // ---- Telegram: ota-onani ulash, xabar va eslatmalar ----
  async tglink(req) {
    const me = await verify(this.env, bearer(req)), b = await req.json().catch(() => ({}));
    if (!me || me.role !== 'student') return json({ error: 'kirish kerak' }, 401);
    if (!this.env.BOT_USERNAME || !this.env.HOOK_SECRET || !this.env.BOT_TOKEN) return json({ error: 'Telegram bot hali sozlanmagan' }, 503);
    if (!['father', 'mother'].includes(b.who)) return json({ error: 'noto‘g‘ri so‘rov' }, 400);
    const code = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
    await this.state.storage.put('l:' + code, { uid: me.id, who: b.who, exp: Date.now() + 36e5 });
    return json({ url: `https://t.me/${this.env.BOT_USERNAME}?start=${code}` });
  }
  async hook(req) {
    const sec = this.env.HOOK_SECRET;
    if (!sec || req.headers.get('x-telegram-bot-api-secret-token') !== sec) return json({ error: 'forbidden' }, 403);
    const up = await req.json().catch(() => ({})), m = up.message, st = this.state.storage;
    if (!m || !m.chat) return json({ ok: true });
    const mm = String(m.text || '').trim().match(/^\/start\s+([a-f0-9]{12,32})$/);
    if (!mm) { await this.send(m.chat.id, 'Salom! Ulanish uchun saytdagi «Telegramga ulash» havolasidan foydalaning.'); return json({ ok: true }); }
    const l = await st.get('l:' + mm[1]);
    if (!l || l.exp < Date.now()) { await this.send(m.chat.id, 'Havola eskirgan. Saytdan yangisini yarating.'); return json({ ok: true }); }
    const rec = await st.get('u:' + l.uid);
    if (rec) {
      rec.tgc = { ...(rec.tgc || {}), [l.who]: m.chat.id }; await st.put('u:' + l.uid, rec);
      const p = await st.get('c:users:' + l.uid);
      if (p) { p[l.who] = { ...(p[l.who] || {}), linked: true }; await st.put('c:users:' + l.uid, p); }
      await st.delete('l:' + mm[1]);
      await this.send(m.chat.id, '✅ Ulandi! Endi uy vazifasi va eslatmalar shu yerga keladi.');
      return this.ping('users');
    }
    return json({ ok: true });
  }
  async send(chat, text) {
    const bt = this.env.BOT_TOKEN; if (!bt) return;
    try { await fetch(`https://api.telegram.org/bot${bt}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) }); } catch {}
  }
  async notifyCls(cls, text, hid) {
    const st = this.state.storage, us = [...(await st.list({ prefix: 'c:users:' })).values()].filter((u) => u.cls === cls && u.role === 'student');
    for (const u of us) {
      if (hid && (await st.get(`c:hwdone:${u.id}-${hid}`))?.v === '1') continue;
      const rec = await st.get('u:' + u.id);
      for (const c of Object.values(rec?.tgc || {})) await this.send(c, text);
    }
  }
  async cron(req) {     // har kuni: muddatigacha 2 kun, 1 kun va bugun qolgan vazifalar eslatmasi
    if (!this.env.AUTH_SECRET || req.headers.get('x-cron') !== this.env.AUTH_SECRET) return json({ error: 'forbidden' }, 403);
    const t = Date.parse(new Date(Date.now() + 5 * 36e5).toISOString().slice(0, 10));
    for (const h of (await this.state.storage.list({ prefix: 'c:hw:' })).values()) {
      const n = Math.round((Date.parse(h.due) - t) / 864e5);
      if (n < 0 || n > 2) continue;
      await this.notifyCls(h.cls, `⏰ Eslatma: ${h.subject} — ${h.title}\n${n === 0 ? 'Muddat bugun!' : n + ' kun qoldi'}`, h.id);
    }
    return json({ ok: true });
  }

  ping(col) {
    for (const ws of this.state.getWebSockets()) { try { ws.send(JSON.stringify({ type: 'c', col })); } catch {} }
    return json({ ok: true });
  }

  async coll(req, col, id) {
    const me = await verify(this.env, bearer(req));
    if (!me) return json({ error: 'kirish kerak' }, 401);
    const R = RULES[col];
    if (!R) return json({ error: 'topilmadi' }, 404);
    const st = this.state.storage, adm = isAdm(me.role), tch = adm || me.role === 'teacher';
    if (req.method === 'GET') {
      const l = [...(await st.list({ prefix: `c:${col}:` })).values()];
      if (col === 'users') return json(l.map((d) => { if (d.id === me.id || adm) return d; const o = { ...d, email: '', bd: '' }; if (!tch || d.role !== 'student') { delete o.father; delete o.mother; } return o; }));
      if (col === 'att' && !tch) return json(l.filter((a) => a.student === me.id || a.student === me.child));
      if (col === 'msgs' && !tch) {
        const cls = (await st.get('c:users:' + (me.role === 'parent' ? me.child : me.id)))?.cls || '';
        return json(l.filter((m) => m.to === 'all' || m.to === cls));
      }
      if (col === 'apps') return json(l.filter((a) => adm || a.uid === me.id || a.status === 'accepted').map((a) => (a.anon && a.uid !== me.id ? { ...a, uid: '', by: 'Anonim' } : a)));
      return json(l);
    }
    if (!id) return json({ error: 'id kerak' }, 400);
    const key = `c:${col}:${id}`, cur = await st.get(key);
    if (req.method === 'DELETE') {
      const ok = R.del === 'adm' ? adm : R.del === 'tch' ? tch : R.del === 'pre' ? id.startsWith(me.id + '-') : adm || (cur && cur.uid === me.id);
      if (!ok) return json({ error: 'ruxsat yo‘q' }, 403);
      await st.delete(key);
      if (col === 'users') await st.delete('u:' + id);
      return this.ping(col);
    }
    if (req.method !== 'PUT') return json({ error: 'method' }, 405);
    const d = await req.json().catch(() => null);
    if (!d || typeof d !== 'object' || JSON.stringify(d).length > 150000) return json({ error: 'noto‘g‘ri ma’lumot' }, 400);
    const ok = R.put === 'adm' ? adm : R.put === 'tch' ? tch : R.put === 'any' ? true : R.put === 'pre' ? id.startsWith(me.id + '-') : adm || id === me.id;
    if (!ok) return json({ error: 'ruxsat yo‘q' }, 403);
    if (R.own) {
      if (cur && cur.uid !== me.id && !adm) return json({ error: 'ruxsat yo‘q' }, 403);
      d.uid = cur?.uid || me.id;
      d.by = (await st.get('c:users:' + d.uid))?.name || d.uid;
      if (col === 'comments') d.role = me.role;
    }
    if (col === 'apps') {
      if (cur && !adm) return json({ error: 'ruxsat yo‘q' }, 403);
      if (!adm) { d.status = 'new'; d.reply = ''; }
      d.text = String(d.text || '').slice(0, 2000);
      if (d.anon) d.by = 'Anonim';
    }
    if (col === 'hw' && !/^\d{4}-\d\d-\d\d$/.test(String(d.due || ''))) return json({ error: 'muddat noto‘g‘ri' }, 400);
    if (col === 'users') {
      const rec = await st.get('u:' + id);
      if (!rec) return json({ error: 'hisob topilmadi' }, 404);
      if (rec.role === 'parent' && id === me.id && d.child !== undefined) { rec.child = String(d.child || '').toLowerCase(); await st.put('u:' + id, rec); }
      d.role = rec.role; d.child = rec.child; delete d.pw;     // rol va farzand faqat serverdan
      for (const w of ['father', 'mother']) {
        if (d[w] && typeof d[w] === 'object') d[w] = { name: String(d[w].name || '').slice(0, 60), phone: String(d[w].phone || '').slice(0, 20), linked: !!cur?.[w]?.linked };
        else delete d[w];
      }
    }
    d.id = id;
    await st.put(key, d);
    if (col === 'hw' && !cur && d.cls) this.notifyCls(d.cls, `📚 ${d.kind === 'test' ? 'Nazorat ishi' : 'Yangi uy vazifasi'}: ${d.subject} — ${d.title}\nMuddat: ${d.due}`).catch(() => {});
    return this.ping(col);
  }

  async fetch(req) {
    const u = new URL(req.url);
    const mc = u.pathname.match(/^\/api\/c\/(\w+)(?:\/([\w.%-]+))?$/);
    if (mc) return this.coll(req, mc[1], decodeURIComponent(mc[2] || ''));
    if (req.method === 'POST' && u.pathname === '/api/ai') return this.ai(req);
    if (req.method === 'POST' && u.pathname === '/api/tglink') return this.tglink(req);
    if (req.method === 'POST' && u.pathname === '/tg/hook') return this.hook(req);
    if (req.method === 'POST' && u.pathname === '/cron') return this.cron(req);
    if (req.method === 'POST' && u.pathname.startsWith('/auth/')) return this.auth(u, req);
    if (u.pathname === '/ws') {
      const [client, server] = Object.values(new WebSocketPair());
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (u.pathname === '/api/config') return json({ tg: this.env.BOT_USERNAME || '' });
    return json({ name: '3-maktab API' });
  }
}

export default {
  async scheduled(ev, env, ctx) {
    ctx.waitUntil(env.HUB.get(env.HUB.idFromName('main')).fetch('https://do/cron', { method: 'POST', headers: { 'x-cron': env.AUTH_SECRET || '' } }));
  },
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const res = await env.HUB.get(env.HUB.idFromName('main')).fetch(req);
    if (res.status === 101) return res;
    const h = new Headers(res.headers);
    Object.entries(CORS).forEach(([k, v]) => h.set(k, v));
    return new Response(res.body, { status: res.status, headers: h });
  }
};
