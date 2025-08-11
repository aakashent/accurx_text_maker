/* v1.4.0 – templates.json first, fallback to links_titles.json; anchored menus; category picker; ENT categories; export */

const ENT_CATEGORIES = ["Otology","Rhinology","H&N","Paeds"];
const STATE = { templates: [], filtered: [], selectedIds: [], deletedIds: new Set() };

const els = {
  list: document.getElementById('list'),
  category: document.getElementById('category'),
  search: document.getElementById('search'),
  copyBtn: document.getElementById('copyBtn'),
  output: document.getElementById('output'),
  counter: document.getElementById('counter'),
  showDeleted: document.getElementById('showDeleted'),
  exportBtn: document.getElementById('exportBtn'),
  diag: document.getElementById('diag'),
  toast: document.getElementById('toast')
};

init();

async function init(){
  try{
    STATE.templates = await loadData();
    els.diag && (els.diag.textContent = `Loaded ${STATE.templates.length} items`);
  }catch(e){
    showFatal(`Couldn’t load data – ${e.message}`);
    return;
  }

  // Fixed category dropdown options
  ENT_CATEGORIES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; els.category.appendChild(o); });

  bindEvents();

  // Default to list mode, then wire menus and category picker
  document.body.classList.add('list-mode');
  setupViewMenu();
  setupThemeMenu();
  setupCategoryPicker();

  applyFilters();
}

/* ---------- Data loading ---------- */
async function loadData(){
  // 1) templates.json – preferred (array of objects)
  try{
    const res = await fetch('/accurx_text_maker/templates.json?v=' + Date.now(), { cache:'no-store' });
    if (res.ok){
      const data = await res.json();
      if (Array.isArray(data) && data.length){
        return data.map((t,i)=>({
          id: t.id || `item-${i}`,
          url: t.url || t.link || '',
          title: t.title || `Item ${i+1}`,
          text: t.text || t.url || '',
          categories: [ normaliseCat(t.category || t.categories) || inferCategoryENT(t.title||'', t.text||t.url||'') ]
        }));
      }
    }
  }catch{/* ignore and fall back */}

  // 2) links_titles.json – map { "url": "Title", ... }
  const res = await fetch('/accurx_text_maker/links_titles.json?v=' + Date.now(), { cache:'no-store' });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // { url: "Title" }
    return Object.entries(data).map(([u, title], i) => ({
      id: `item-${i}`,
      url: u,
      title: String(title || '').trim() || `Item ${i+1}`,
      text: u, // so preview isn’t blank; copy will include URL
      categories: [ inferCategoryENT(title, u) ]
    }));
  }

  if (Array.isArray(data)) {
    // Array of objects – be permissive
    return data.map((t,i)=>toTemplate(t,i));
  }

  throw new Error('Unsupported JSON structure');
}

function toTemplate(t,i){
  const title = t.title || t.name || t.label || t.heading || t.key || `Item ${i+1}`;
  const url   = t.url || t.link || t.href || t.path || '';
  const body  = t.text || t.body || t.content || t.linkText || url || '';
  return {
    id: t.id || `item-${i}`,
    url, title, text: String(body),
    categories: [ normaliseCat(t.category || t.categories) || inferCategoryENT(title, body || url) ]
  };
}

/* ---------- UI ---------- */
function bindEvents(){
  els.search.addEventListener('input', applyFilters);
  els.category.addEventListener('change', applyFilters);
  els.showDeleted.addEventListener('change', renderList);
  els.copyBtn.addEventListener('click', copyOutput);
  els.exportBtn.addEventListener('click', exportTemplatesJSON);
}

function applyFilters(){
  const q=(els.search.value||'').toLowerCase().trim();
  const cat=els.category.value||'';
  STATE.filtered = STATE.templates.filter(t=>{
    const mt=!q || t.title.toLowerCase().includes(q) || (t.text||'').toLowerCase().includes(q);
    const mc=!cat || normaliseCat(t.categories)===cat;
    const nd=els.showDeleted.checked || !STATE.deletedIds.has(t.id);
    return mt && mc && nd;
  });
  renderList();
}

function renderList(){
  els.list.innerHTML = '';
  const inListMode = document.body.classList.contains('list-mode');

  if (!inListMode) {
    // Cards view: flat
    STATE.filtered.forEach(t => els.list.appendChild(makeCard(t)));
  } else {
    // List view: group by ENT order
    const order = ["Otology","Rhinology","H&N","Paeds"];
    const groups = new Map(order.map(c => [c, []]));
    STATE.filtered.forEach(t => {
      const c = normaliseCat(t.categories) || 'H&N';
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(t);
    });
    for (const cat of order) {
      const items = groups.get(cat) || [];
      if (!items.length) continue;
      const h = document.createElement('li');
      h.className = 'group-head';
      h.textContent = cat;
      els.list.appendChild(h);
      items.forEach(t => els.list.appendChild(makeCard(t)));
    }
  }
  updateComposer();
}

function makeCard(t){
  const li = document.createElement('li'); li.className = 'card';
  const checked = STATE.selectedIds.includes(t.id);
  const disabled = !checked && STATE.selectedIds.length >= 3;
  const cat = normaliseCat(t.categories) || 'H&N';
  li.innerHTML = `
    <div class="card-inner">
      <input type="checkbox" value="${t.id}" ${checked?'checked':''} ${disabled?'disabled':''}/>
      <div class="meta">
        <h3>${escapeHTML(t.title||'')}</h3>
        <div class="tags">
          <span class="tag tag--${cat}" data-cat="${cat}" data-id="${t.id}" role="button" tabindex="0" title="Click to change category">${cat}</span>
        </div>
        <pre class="snippet">${escapeHTML(snippet(t.text||''))}</pre>
      </div>
      <div class="card-actions">
        <a class="icon-btn" href="${t.url||'#'}" target="_blank" rel="noopener">Open</a>
        <button class="icon-btn" data-act="delete">${STATE.deletedIds.has(t.id)?'Undo':'Delete'}</button>
      </div>
    </div>`;
  li.querySelector('input').addEventListener('change', e=>{
    const id = e.target.value;
    if (e.target.checked){ if (!STATE.selectedIds.includes(id)) STATE.selectedIds.push(id); }
    else { STATE.selectedIds = STATE.selectedIds.filter(x => x !== id); }
    renderList();
  });
  li.querySelector('[data-act="delete"]').addEventListener('click', ()=>{
    if (STATE.deletedIds.has(t.id)){ STATE.deletedIds.delete(t.id); toast('Restored'); }
    else { STATE.deletedIds.add(t.id); toast('Deleted'); }
    applyFilters();
  });
  return li;
}

function updateComposer(){
  const chosen = STATE.selectedIds
    .map(id => STATE.templates.find(t => t.id === id))
    .filter(Boolean);

  if (chosen.length) {
    const plural = chosen.length > 1 ? 'leaflets' : 'leaflet';
    const lines = chosen.map(t => `${t.title}:\n${t.url}`);
    els.output.value = `Please see the below ${plural}:\n` + lines.join('\n\n');
  } else {
    els.output.value = '';
  }

  els.copyBtn.disabled = !chosen.length;
  els.counter.textContent = `${STATE.selectedIds.length}/3 selected`;
}

/* ---------- Actions ---------- */
async function copyOutput(){
  try{ await navigator.clipboard.writeText(els.output.value); toast('Copied to clipboard'); }
  catch{ els.output.select(); document.execCommand('copy'); toast('Copied'); }
}

function exportTemplatesJSON(){
  const exportData = STATE.templates
    .filter(t=>!STATE.deletedIds.has(t.id))
    .map(t=>({
      url: t.url || '',
      title: t.title || '',
      category: normaliseCat(t.categories) || inferCategoryENT(t.title||'', t.text||t.url||'')
    }));
  const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='templates.json';
  document.body.appendChild(a); a.click(); a.remove(); toast('Downloaded templates.json');
}

/* ---------- View & Theme menus (anchored under their buttons) ---------- */
function setupViewMenu(){
  const btn  = document.getElementById('viewBtn');
  const menu = document.getElementById('viewMenu');
  if (!btn || !menu) return;

  // Anchor the menu under the button
  if (!btn.parentElement.classList.contains('menu-anchor')) {
    const wrap = document.createElement('span');
    wrap.className = 'menu-anchor';
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
    wrap.appendChild(menu);
  }
  menu.classList.add('menu--below');
  menu.hidden = true;

  const apply = (mode) => {
    document.body.classList.toggle('list-mode', mode === 'list');
    localStorage.setItem('xview', mode);
    btn.textContent = `View: ${mode === 'list' ? 'List' : 'Cards'}`;
    applyFilters();
  };
  // Restore saved (default list)
  apply(localStorage.getItem('xview') || 'list');

  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const willOpen = menu.hidden;
    document.querySelectorAll('.menu').forEach(m => m.hidden = true);
    menu.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
  });

  menu.addEventListener('click', (e)=>{
    const choice = e.target.closest('button')?.dataset.view;
    if (!choice) return;
    apply(choice);
    menu.hidden = true;
    btn.setAttribute('aria-expanded','false');
  });

  document.addEventListener('click', ()=>{
    if (!menu.hidden) { menu.hidden = true; btn.setAttribute('aria-expanded','false'); }
  });
}

function setupThemeMenu(){
  const btn  = document.getElementById('themeBtn');
  const menu = document.getElementById('themeMenu');
  if (!btn || !menu) return;

  if (!btn.parentElement.classList.contains('menu-anchor')) {
    const wrap = document.createElement('span');
    wrap.className = 'menu-anchor';
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
    wrap.appendChild(menu);
  }
  menu.classList.add('menu--below');
  menu.hidden = true;

  const KEY = 'xtheme';
  const apply = (mode) => {
    if (mode === 'system'){ document.documentElement.removeAttribute('data-theme'); }
    else { document.documentElement.dataset.theme = mode; }
    localStorage.setItem(KEY, mode);
    btn.textContent = `Theme: ${mode[0].toUpperCase()+mode.slice(1)}`;
  };
  apply(localStorage.getItem(KEY) || 'system');

  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const willOpen = menu.hidden;
    document.querySelectorAll('.menu').forEach(m => m.hidden = true);
    menu.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
  });

  menu.addEventListener('click', (e)=>{
    const val = e.target.closest('button')?.dataset.theme;
    if (!val) return;
    apply(val);
    menu.hidden = true;
    btn.setAttribute('aria-expanded','false');
  });

  document.addEventListener('click', ()=>{
    if (!menu.hidden) { menu.hidden = true; btn.setAttribute('aria-expanded','false'); }
  });
}

/* ---------- Category picker (click the chip to open a menu) ---------- */
function setupCategoryPicker(){
  // Build once
  let menu = document.getElementById('catMenu');
  if (!menu){
    menu = document.createElement('div');
    menu.id = 'catMenu';
    menu.className = 'menu';
    menu.hidden = true;
    menu.innerHTML = ENT_CATEGORIES.map(c => `<button type="button" data-cat="${c}">${c}</button>`).join('');
    document.body.appendChild(menu);

    // Choose a category
    menu.addEventListener('click', (e)=>{
      const btn = e.target.closest('button'); if (!btn) return;
      const id  = menu.dataset.targetId;
      const item = STATE.templates.find(t => t.id === id);
      if (item){ item.categories = [btn.dataset.cat]; }
      menu.hidden = true;
      applyFilters();
    });
  }

  // Open on chip click
  els.list.addEventListener('click', (e)=>{
    const tag = e.target.closest('.tag[data-id]');
    if (!tag) return;
    e.stopPropagation();
    openCatMenu(tag, menu);
  });
  // Keyboard activation
  els.list.addEventListener('keydown', (e)=>{
    const tag = e.target.closest('.tag[data-id]');
    if (!tag) return;
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openCatMenu(tag, menu); }
  });

  // Close on outside click
  document.addEventListener('click', ()=>{ menu.hidden = true; });
}

function openCatMenu(tag, menu){
  menu.dataset.targetId = tag.dataset.id;
  // Pre-highlight current
  const current = tag.dataset.cat;
  menu.querySelectorAll('button').forEach(b => b.style.fontWeight = (b.dataset.cat === current ? '700' : '400'));
  // Place under the tag
  const r = tag.getBoundingClientRect();
  menu.style.left = r.left + 'px';
  menu.style.top  = (r.bottom + 4 + window.scrollY) + 'px';
  menu.hidden = false;
}

/* ---------- Helpers ---------- */
function snippet(text,max=160){ const s=(text||'').replace(/\s+/g,' ').trim(); return s.length>max? s.slice(0,max-1)+'…':s; }
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function toast(msg){ els.toast && (els.toast.textContent=msg, els.toast.className='show', setTimeout(()=>els.toast.className='',1600)); }
function showFatal(msg){ els.list.innerHTML=`<li style="padding:12px;border:1px solid #e3e3e3;border-radius:8px">⚠️ ${escapeHTML(msg)}</li>`; els.diag && (els.diag.textContent = msg); }

// ENT-only inference with Paeds override
function inferCategoryENT(title, body){
  const t=`${title} ${body}`.toLowerCase();
  const has = kws => kws.some(k => t.includes(k));
  // Paeds override
  if (has(['paediatric','paediatrics','paeds','child','children','toddler','infant','neonate','school-age','young person','your child'])) return 'Paeds';
  // Otology (ear + balance)
  if (has(['ear','pinna','hearing','deafness','tinnitus','vertigo','otic','otosclerosis','otitis','eardrum','tympanic','mastoid','cholesteatoma','earwax','grommet','meniere','bppv','labyrinthitis','cawthorne-cooksey'])) return 'Otology';
  // Rhinology (nose & sinuses)
  if (has(['nose','nasal','sinus','sinuses','rhino','rhinitis','sinusitis','septum','septal','polyps','epistaxis','smell','olfactory','turbinates','rhinoplasty','nasal irrigation','nasal sprays','nasal drops','nasal ointment'])) return 'Rhinology';
  // Head & Neck
  if (has(['head and neck','larynx','laryngeal','voice','hoarseness','thyroid','parotid','salivary','gland','neck','tonsillectomy','microlaryngoscopy','oesophagoscopy','pharyngoscopy','hpv','cancer','facial skin lesions','thyroglossal','neck lump','submandibular'])) return 'H&N';
  // Default
  return 'H&N';
}
function normaliseCat(cats){
  if (!cats) return '';
  const s = Array.isArray(cats) ? (cats[0]||'') : cats;
  const v = String(s).toLowerCase().replace(/\s*&\s*/,'&').trim();
  if(/^oto/.test(v) || v==='ear') return 'Otology';
  if(/^rhin/.test(v) || ['nose','sinus','sinuses'].includes(v)) return 'Rhinology';
  if(v==='h&n' || /head|neck/.test(v)) return 'H&N';
  if(/^paed/.test(v) || /child/.test(v)) return 'Paeds';
  // If it’s already a valid label
  if (ENT_CATEGORIES.includes(s)) return s;
  return '';
}