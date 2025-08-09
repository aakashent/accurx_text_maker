/* v1.3.0 – handles {url:title} JSON + ENT categories + export */

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
  // Absolute path + cache-buster (works on GitHub Pages)
  const url = `/accurx_text_maker/links_titles.json?v=${Date.now()}`;

  try{
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // ---- NORMALISE YOUR SHAPE ----
    // 1) { "url": "Title", ... }  -> [{ url, title }]
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const valuesAreStrings = Object.values(data).every(v => typeof v === 'string');
      if (valuesAreStrings) {
        STATE.templates = Object.entries(data).map(([u, title], i) => ({
          id: `item-${i}`,
          url: u,
          title: String(title || '').trim() || `Item ${i+1}`,
          text: u, // so preview isn’t blank; we can copy the link
          categories: [ inferCategoryENT(title, u) ] // one category with Paeds override
        }));
      } else {
        // If it’s a grouped object like { Section: [ ... ] }, flatten
        const flat = [];
        for (const v of Object.values(data)) if (Array.isArray(v)) flat.push(...v);
        STATE.templates = flat.map((t,i)=>toTemplate(t,i));
      }
    } else if (Array.isArray(data)) {
      STATE.templates = data.map((t,i)=>toTemplate(t,i));
    } else {
      throw new Error('Unsupported JSON structure');
    }

    els.diag.textContent = `Loaded ${STATE.templates.length} items from ${location.origin}${url.replace(/\?v=.*/,'')}`;
  }catch(e){
    showFatal(`Couldn’t load links_titles.json – ${e.message}`);
    return;
  }

  // Fixed category dropdown
  ENT_CATEGORIES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; els.category.appendChild(o); });

  bindEvents();
  applyFilters();
}

function toTemplate(t,i){
  // accept a variety of keys; fall back to URL if present
  const title = t.title || t.name || t.label || t.heading || t.key || `Item ${i+1}`;
  const url   = t.url || t.link || t.href || t.path || '';
  const body  = t.text || t.body || t.content || t.linkText || url || '';
  return {
    id: t.id || `item-${i}`,
    url, title, text: String(body),
    categories: [ inferCategoryENT(title, body || url) ]
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
  els.list.innerHTML='';
  STATE.filtered.forEach(t=>{
    const li=document.createElement('li'); li.className='card';
    const checked=STATE.selectedIds.includes(t.id);
    const disabled=!checked && STATE.selectedIds.length>=3;
    li.innerHTML=`
      <div class="card-inner">
        <input type="checkbox" value="${t.id}" ${checked?'checked':''} ${disabled?'disabled':''}/>
        <div class="meta">
          <h3>${escapeHTML(t.title||'')}</h3>
          <div class="tags"><span class="tag">${normaliseCat(t.categories)||'H&N'}</span></div>
          <pre class="snippet">${escapeHTML(snippet(t.text||''))}</pre>
        </div>
        <div class="card-actions">
          <a class="icon-btn" href="${t.url||'#'}" target="_blank" rel="noopener">Open</a>
          <button class="icon-btn" data-act="delete">${STATE.deletedIds.has(t.id)?'Undo':'Delete'}</button>
        </div>
      </div>`;
    li.querySelector('input').addEventListener('change', e=>{
      const id=e.target.value;
      if(e.target.checked){ if(!STATE.selectedIds.includes(id)) STATE.selectedIds.push(id); }
      else { STATE.selectedIds=STATE.selectedIds.filter(x=>x!==id); }
      renderList();
    });
    li.querySelector('[data-act="delete"]').addEventListener('click', ()=>{
      if(STATE.deletedIds.has(t.id)){ STATE.deletedIds.delete(t.id); toast('Restored'); }
      else { STATE.deletedIds.add(t.id); toast('Deleted'); }
      applyFilters();
    });
    els.list.appendChild(li);
  });
  updateComposer();
}

function updateComposer(){
  const chosen=STATE.selectedIds.map(id=>STATE.templates.find(t=>t.id===id)).filter(Boolean);
  const combined=chosen.map(t=>(t.text||'').trim()).join('\n\n');
  els.output.value=combined;
  els.copyBtn.disabled=!combined;
  els.counter.textContent=`${STATE.selectedIds.length}/3 selected`;
}

/* ---------- Actions ---------- */
async function copyOutput(){
  try{ await navigator.clipboard.writeText(els.output.value); toast('Copied to clipboard'); }
  catch{ els.output.select(); document.execCommand('copy'); toast('Copied'); }
}

function exportTemplatesJSON(){
  // Export to the array-of-objects format you wanted
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

/* ---------- Helpers ---------- */
function snippet(text,max=160){ const s=(text||'').replace(/\s+/g,' ').trim(); return s.length>max? s.slice(0,max-1)+'…':s; }
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function toast(msg){ els.toast.textContent=msg; els.toast.className='show'; setTimeout(()=>els.toast.className='',1600); }

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
  const s = Array.isArray(cats) ? (cats[0]||'') : (cats||'');
  const v = s.toLowerCase().replace(/\s*&\s*/,'&').trim();
  if(/^oto/.test(v) || v==='ear') return 'Otology';
  if(/^rhin/.test(v) || ['nose','sinus','sinuses'].includes(v)) return 'Rhinology';
  if(v==='h&n' || /head|neck/.test(v)) return 'H&N';
  if(/^paed/.test(v) || /child/.test(v)) return 'Paeds';
  return '';
}