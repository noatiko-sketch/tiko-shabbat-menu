/**
 * Tiko Shabbat bridge. Deploy as a Google Apps Script web app:
 * Execute as: Me; Who has access: Anyone. Keep the URL and shared token private.
 * Set Script Property TIKO_BRIDGE_TOKEN to a random secret of at least 32 characters.
 * Set the project timezone to Asia/Jerusalem.
 * All durable menu data stays in the existing Google Drive state.json.
 */
const TIKO = {
  folder: '1emAiM56y-9PlMrJQGl9tA0SkTAPBrnml',
  state: '1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI',
  rules: '1QcF7QRPOGgXPc1eQ7J2uF3M-tJwEbpUo',
  food: '1eVmval7caUC1sHWiyrozuA0DpqyX1qoH',
  timezone: 'Asia/Jerusalem'
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('TIKO_BRIDGE_TOKEN');
    if (!expected || expected.length < 32 || body.token !== expected) return reply_({ error: 'Unauthorized' });
    if (!['snapshot','generate','replace','remove','add','approve'].includes(body.type)) return reply_({ error: 'Unknown action' });
    // One lock serializes all menu edits and approvals. No email or calendar calls.
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) return reply_({ error: 'Another update is in progress. Please retry.' });
    try { return reply_(handle_(body)); } finally { lock.releaseLock(); }
  } catch (error) { return reply_({ error: String(error.message || error) }); }
}
function reply_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function fileText_(id) { return DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'); }
function readState_() {
  const s = JSON.parse(fileText_(TIKO.state));
  if (!s || s.anchor_saturday !== '2026-09-26' || s.anchor_week !== 1 || !Array.isArray(s.history) || !Array.isArray(s.deliveries) || !Array.isArray(s.custom_dishes)) throw Error('state.json has an unexpected structure');
  return s;
}
function saveState_(s) { DriveApp.getFileById(TIKO.state).setContent(JSON.stringify(s, null, 2) + '\n'); }
function iso_(d) { return Utilities.formatDate(d, TIKO.timezone, 'yyyy-MM-dd'); }
function date_(s) { return new Date(s + 'T12:00:00+03:00'); }
function addDays_(s, n) { const d = date_(s); d.setUTCDate(d.getUTCDate() + n); return iso_(d); }
function upcoming_() {
  // Noon in Jerusalem avoids midnight and DST boundary errors.
  const now = new Date();
  const local = Utilities.formatDate(now, TIKO.timezone, 'yyyy-MM-dd');
  const day = Number(Utilities.formatDate(now, TIKO.timezone, 'u')); // Mon=1 ... Sun=7
  return addDays_(local, (6 - day + 7) % 7 || (day === 6 ? 7 : 0));
}
function week_(s, saturday) {
  const days = Math.round((date_(saturday).getTime() - date_(s.anchor_saturday).getTime()) / 86400000);
  if (days % 7 !== 0) throw Error('Date is not a Saturday');
  return ((days / 7 + s.anchor_week - 1) % 3 + 3) % 3 + 1;
}
function delivery_(s, saturday) { return s.deliveries.find(x => x.saturday === saturday); }
function history_(s) { return [...s.history].sort((a,b) => String(b.saturday).localeCompare(String(a.saturday))); }
function draft_(s, saturday) { return (s.menu_drafts || {})[saturday] || null; }
function current_(s, saturday) { return draft_(s, saturday) || history_(s).find(x => x.saturday === saturday) || null; }
function norm_(name) { return name.normalize('NFKC').replace(/\([^)]*\)/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase(); }
function family_(name) { return norm_(name).split(' ').slice(0, 2).join(' '); }
function recent_(s, saturday) {
  const two = history_(s).filter(x => x.saturday < saturday).slice(0, 2);
  return new Set(two.flatMap(m => [...m.friday.dishes, ...m.lunch.dishes].filter(Boolean).map(d => family_(d.name))));
}
function listSection_(source, title) {
  const m = source.match(new RegExp('^## ' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm'));
  if (!m) throw Error('Missing catalog section: ' + title);
  return m[1].split('\n').filter(x => /^- /.test(x)).map(x => x.slice(2).split(' (')[0].trim()).filter(Boolean);
}
function catalog_(s) {
  // Re-read both files for every generation and edit; never embed the food database in the site.
  const rules = fileText_(TIKO.rules), text = fileText_(TIKO.food);
  if (!rules.includes('2 שבתות אחרונות') || !text.includes('## סלטים')) throw Error('Rules or catalog are unreadable');
  const sections = {
    salad: listSection_(text,'סלטים'), soup: listSection_(text,'מרקים'),
    pasta: listSection_(text,'פסטות, רביולי וניוקי'), pastry: listSection_(text,'פשטידות ומאפים'),
    fish: listSection_(text,'מנות דגים').concat(listSection_(text,'לביבות וקציצות דגים')),
    meat: listSection_(text,'מנות בשר ועוף'), vegetarian: listSection_(text,'מנות עיקריות צמחוניות'),
    side: listSection_(text,'תוספות')
  };
  const excluded = new Set((s.excluded_dishes || []).map(norm_));
  const dairySalad = /בוראטה|לאבנה|חלומי|קיסר/;
  const safeSoup = /^(מרק כתום|מרק עדשים|מרק כרוב|מרק עגבניות|מרק ירקות|מרק אפונה|מרק בצל|גספאצ'ו)/;
  const safeBaked = /^(כרובית שלמה בתנור|כרובית אפויה עם טחינה|כרוב אפוי במייפל|כרוב צלוי|שומר, עגבניות וקישוא אנטיפסטי|דלעת אפויה|במיה|ירוקים מוקפצים|שעועית ירוקה מוקפצת|ירקות אפויים \/ אנטיפסטי)/;
  const safeSide = /^(אורז רגיל|אורז עם ירקות|אורז עם כרובית|בורגול|אטריות שעועית|קוסקוס$|פירה תפוחי אדמה|תפו"א בתנור|צ'יפס|ברוקולי$)/;
  const custom = s.custom_dishes.filter(x => x && x.name && x.category && x.diet);
  const slots = {
    'friday:0': sections.salad.filter(x => !/בשר|עוף/.test(x)),
    'friday:1': sections.salad.filter(x => !/בשר|עוף/.test(x)),
    'friday:2': sections.side.filter(x => safeBaked.test(x)),
    'friday:3': sections.soup.filter(x => safeSoup.test(x)),
    'friday:4': sections.pasta.filter(x => /גבינ|שמנת|רוזה/.test(x) && !/בולונז/.test(x)),
    'friday:5': sections.pastry.filter(x => /גבינ|בולגרית|בורקס פיצה/.test(x) && !/בשר/.test(x)),
    'lunch:0': sections.salad.filter(x => !dairySalad.test(x) && !/בשר|עוף/.test(x)),
    'lunch:1': sections.salad.filter(x => !dairySalad.test(x) && !/בשר|עוף/.test(x)),
    'lunch:2': sections.side.filter(x => safeBaked.test(x)),
    'lunch:3': sections.fish.concat(sections.vegetarian),
    'lunch:4': sections.side.filter(x => safeSide.test(x))
  };
  const slotsMeat = { ...slots, 'lunch:3': sections.meat, 'lunch:4': sections.side.filter(x => safeSide.test(x)) };
  return { slots, slotsMeat, custom, excluded };
}
function category_(key) { return ['salad','salad','baked','soup','pasta','pastry'][Number(key.split(':')[1])] || 'side'; }
function slotCategory_(key) {
  const index = Number(key.split(':')[1]);
  return key.startsWith('friday:') ? ['salad','salad','baked','soup','pasta','pastry'][index] : ['salad','salad','baked','main','side'][index];
}
function canonicalKey_(key,menu) {
  const [meal,indexText] = key.split(':'), index = Number(indexText);
  const base = meal === 'friday' ? ['salad','salad','baked','soup','pasta','pastry'] : ['salad','salad','baked','main','side'];
  if (index < base.length) return key;
  const category = menu?.[meal]?.slot_categories?.[index] || menu?.[meal]?.dishes?.[index]?.category;
  const canonicalIndex = base.indexOf(category);
  if (canonicalIndex < 0) throw Error('קטגוריית מנה נוספת לא תקינה');
  return meal + ':' + canonicalIndex;
}
function options_(s, saturday, key, catalog, menu) {
  key = canonicalKey_(key,menu);
  const meat = week_(s, saturday) === 3;
  const list = meat ? catalog.slotsMeat[key] : catalog.slots[key];
  const isFriday = key.startsWith('friday:');
  const category = slotCategory_(key);
  const extras = catalog.custom.filter(x => x.category === category && (isFriday ? x.diet !== 'meat' : meat ? x.diet === 'pareve' || (category === 'main' && x.diet === 'meat') : x.diet !== 'meat') && !(meat && category === 'main' && x.diet !== 'meat')).map(x => x.name);
  const used = new Set(menu ? [...menu.friday.dishes, ...menu.lunch.dishes].filter(Boolean).map(d => family_(d.name)) : []);
  const recent = recent_(s, saturday);
  const all = [...new Set([...(list || []), ...extras])].filter(x => !catalog.excluded.has(norm_(x)) && !used.has(family_(x)));
  const fresh = all.filter(x => !recent.has(family_(x)));
  // Only relax history when the category has no fresh alternatives.
  return (fresh.length ? fresh : all).map(name => ({ name, category }));
}
function candidates_(s, saturday, menu) {
  const c = catalog_(s), out = {};
  ['friday','lunch'].forEach(meal => {
    for (let i = 0; i < menu[meal].dishes.length; i++) {
      const clone = JSON.parse(JSON.stringify(menu)); clone[meal].dishes[i] = null;
      out[meal + ':' + i] = options_(s, saturday, meal + ':' + i, c, clone).slice(0, 12);
    }
  });
  return out;
}
function snapshot_(s) {
  const saturday = upcoming_();
  let menu = current_(s, saturday);
  const delivery = delivery_(s,saturday);
  if (menu && delivery?.status === 'sent') menu = { ...menu, sent: true };
  return { api_version:3, status:'ready', current:menu, previous:history_(s).find(x => x.saturday < saturday) || null, candidates:menu && !menu.sent ? candidates_(s,saturday,menu) : {}, already_sent:delivery?.status === 'sent' };
}
function generate_(s,saturday) {
  const menu = { saturday, week:week_(s,saturday), friday:{ date:addDays_(saturday,-1), dishes:Array(6).fill(null) }, lunch:{ date:saturday, dishes:Array(5).fill(null) } };
  const c = catalog_(s);
  const recentlyUsed = recent_(s,saturday);
  let historyException = false;
  for (const meal of ['friday','lunch']) for (let i=0;i<menu[meal].dishes.length;i++) {
    const choices = options_(s,saturday,meal+':'+i,c,menu);
    if (!choices.length) throw Error('אין מספיק מנות מתאימות לקטגוריה: ' + meal + ':' + i);
    menu[meal].dishes[i] = choices[0];
    if (recentlyUsed.has(family_(choices[0].name))) historyException = true;
  }
  s.menu_drafts = s.menu_drafts || {};
  s.menu_drafts[saturday] = menu; saveState_(s);
  return { detail: historyException ? 'ההצעה נשמרה. מנה אחת לפחות חזרה משתי שבתות קודמות כי לא הייתה חלופה מתאימה בקטגוריה.' : 'ההצעה נשמרה בקובץ המצב.', snapshot:snapshot_(s) };
}
function validateCustom_(dish, key, meat) {
  const match = String(dish.category || '').match(/^([^|]+)\|(dairy|pareve|meat)$/);
  if (!match || match[1] !== slotCategory_(key)) throw Error('בחרי קטגוריה והתאמה למנה');
  if (key.startsWith('friday') && match[2] === 'meat') throw Error('שישי אינו בשרי');
  if ((key === 'friday:4' || key === 'friday:5') && match[2] !== 'dairy') throw Error('המנה העיקרית של שישי חייבת להיות חלבית');
  if (key.startsWith('lunch') && meat && (match[2] === 'dairy' || (key === 'lunch:3' && match[2] !== 'meat'))) throw Error('המנה אינה מתאימה לשבת בשרית');
  if (key.startsWith('lunch') && !meat && match[2] === 'meat') throw Error('המנה אינה מתאימה לשבת צמחונית/דגים');
  return { name:dish.name.trim(), category:match[1], diet:match[2] };
}
function edit_(s,b,saturday) {
  const menu = draft_(s,saturday);
  if (!menu || delivery_(s,saturday)) throw Error('אין הצעה פתוחה לעריכה לשבת הזאת');
  const meal = b.meal, index = Number(b.index), key = meal+':'+index;
  if (!['friday','lunch'].includes(meal) || !Number.isInteger(index) || index < 0 || index >= menu[meal].dishes.length) throw Error('מיקום מנה לא תקין');
  if (b.type === 'remove') {
    const old = menu[meal].dishes[index];
    if (!old) throw Error('המקום כבר ריק');
    if (b.removeFromCatalog) {
      s.excluded_dishes = s.excluded_dishes || [];
      if (!s.excluded_dishes.some(x => norm_(x) === norm_(old.name))) s.excluded_dishes.push(old.name);
      s.custom_dishes = s.custom_dishes.filter(x => norm_(x.name) !== norm_(old.name));
    }
    menu[meal].dishes[index] = null;
  } else {
    const name = String(b.dish?.name || '').trim();
    if (!name || name.length > 100) throw Error('שם מנה לא תקין');
    const catalog = catalog_(s), known = options_(s,saturday,key,catalog,{ ...menu, [meal]:{ ...menu[meal], dishes:menu[meal].dishes.map((d,i) => i === index ? null : d) } }).find(x => norm_(x.name) === norm_(name));
    let dish = known;
    if (!dish) {
      // A known but disallowed or recent dish must not be bypassed by reclassifying it as custom.
      const sourceNames = Object.values(catalog.slots).flat().concat(Object.values(catalog.slotsMeat).flat(), catalog.custom.map(x => x.name));
      if (sourceNames.some(x => norm_(x) === norm_(name)) || catalog.excluded.has(norm_(name)) || recent_(s,saturday).has(family_(name))) throw Error('המנה אינה מתאימה למיקום הזה או הופיעה לאחרונה');
      const custom = validateCustom_(b.dish,canonicalKey_(key,menu),week_(s,saturday) === 3);
      if (!s.custom_dishes.some(x => norm_(x.name) === norm_(name))) s.custom_dishes.push(custom);
      dish = { name:custom.name, category:custom.category };
    }
    menu[meal].dishes[index] = dish;
  }
  menu.approved = false; delete menu.approved_at;
  saveState_(s); return { detail:'השינוי נשמר. יש לאשר שוב כדי לעדכן את היסטוריית התפריט.', snapshot:snapshot_(s) };
}
function add_(s,b,saturday) {
  const menu = draft_(s,saturday), meal = b.meal;
  if (!menu || delivery_(s,saturday)) throw Error('אין הצעה פתוחה לעריכה');
  if (!['friday','lunch'].includes(meal)) throw Error('ארוחה לא תקינה');
  if (menu[meal].dishes.length >= 20) throw Error('אפשר להוסיף עד 20 מנות לארוחה');
  const base = meal === 'friday' ? ['salad','salad','baked','soup','pasta','pastry'] : ['salad','salad','baked','main','side'];
  if (!base.includes(b.category)) throw Error('בחרי קטגוריה שמתאימה לארוחה');
  const index = menu[meal].dishes.length;
  menu[meal].slot_categories = menu[meal].slot_categories || [...base];
  menu[meal].slot_categories[index] = b.category;
  menu[meal].dishes.push(null);
  // Resolve and validate through the same replacement rules before any save.
  return edit_(s,{...b,type:'replace',index},saturday);
}
function approve_(s,saturday) {
  const menu = draft_(s,saturday);
  if (!menu) throw Error('אין טיוטה לאישור');
  if (menu.friday.dishes.length < 6 || menu.lunch.dishes.length < 5 || [...menu.friday.dishes,...menu.lunch.dishes].some(x => !x)) throw Error('יש להשלים את כל המקומות בתפריט לפני האישור');
  menu.approved = true; menu.approved_at = new Date().toISOString();
  const saved = JSON.parse(JSON.stringify(menu));
  s.history = s.history.filter(x => x.saturday !== saturday);
  s.history.push(saved); s.history = history_(s).slice(0,2);
  // Keep the draft editable. Later edits invalidate its approval, while the
  // history snapshot remains unchanged until a fresh explicit approval.
  saveState_(s);
  return { detail:'התפריט אושר ונשמר בהיסטוריה לבניית ההצעות הבאות. לא נשלח מייל.', snapshot:snapshot_(s) };
}
function handle_(b) {
  const s = readState_(), saturday = upcoming_();
  if (b.type === 'snapshot') return snapshot_(s);
  if (b.saturday !== saturday && !(b.type === 'generate' && b.saturday === 'upcoming')) return { error:'התאריך השתנה. רענני את הדף לפני הפעולה.' };
  if (b.type === 'generate') {
    if (current_(s,saturday) || delivery_(s,saturday)) return { error:'כבר יש תפריט או שליחה לשבת הזאת' };
    return generate_(s,saturday);
  }
  if (b.type === 'replace' || b.type === 'remove') return edit_(s,b,saturday);
  if (b.type === 'add') return add_(s,b,saturday);
  if (b.type === 'approve') return approve_(s,saturday);
  return { error:'Unknown action' };
}
