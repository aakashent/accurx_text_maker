/* v1.2.6 – bullet-proof loader with on-page diagnostics */

const ENT_CATEGORIES = ["Otology", "Rhinology", "H&N", "Paeds"];
const STATE = { templates: [], filtered: [], selectedIds: [], deletedIds: new Set() };

const els = {
  search:   document.getElementById('search'),
  category: document.getElementById('category'),
  list:     document.getElementById('list'),
  output:   document.getElementById('output'),
  copyBtn:  document.getElementById('copyBtn'),
  counter:  document.getElementById('counter'),
  toast:    document.getElementById('toast'),
  exportBtn:document.getElementById('exportBtn'),
  showDeleted:document.getElementById('showDeleted'),
  // add a tiny diagnostics line under the header if missing
  diag:     document.getElementById('diag') || (() => {
              const d = document.createElement('div');
              d.id = 'diag'; d.style.cssText = 'color:#888;font-size:12px;margin-top:4px';
              document.querySelector('header')?.appendChild(d);
              return d;
            })()
};

init();

async function init() {
  try {
    // 1) relative (works if you’re at /accurx_text_maker/)
    // 2) GitHub Pages absolute (always correct for your repo)
    // 3) raw.githubusercontent.com (robust fallback with CORS)
    const urls = [
      'links_titles.json',
      'https://aakashent.github.io/accurx_text_maker/links_titles.json',
      'https://raw.githubusercontent.com/aakashent/accurx_text_maker/main/links_titles.json'
    ];

    const tried = [];
    let items = [];

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        tried.push(`${url} → ${res.status}`);
        if (!res.ok) continue;
        const data = await res.json();
        items = normaliseTopLevel(data);
        if (items.length) {
          els.diag.textContent = `Loaded: ${url}`;
          break;
        }
      } catch (e) {
        tried.push(`${url} → error`);
      }
    }

    if (!items.length) {
      els.diag.textContent = 'Tried: ' + tried.join('  |  ');
      showFatal('Couldn’t load templates JSON. Tap one of the URLs above to check it opens.');
      return;
    }

    STATE.templates = items.map((t, i) => ({
      id: t.id || `item-${i}`,
      title: t.title || t.name || t.label || t.heading || `Item ${i+1}`,
      text: t.text || t.body || t.content || t.linkText || '',
      categories: [ normaliseCat(t.categories) || inferCategoryENT(t.title || '', t.text || '') ]
    }));

  } catch (e) {
    showFatal('Failed to load JSON data.');
    return;
  }

  ENT_CATEGORIES.forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c;
    els.category.appendChild(o);
  });

  bindEvents();
  applyFilters();
}

function normaliseTopLevel(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function bindEvents() {
  els.search.addEventListener('input', applyFilters);
  els.category.addEventListener('change', applyFilters);
  els.copyBtn.addEventListener('click', copyOutput);
  els.exportBtn.addEventListener('click', exportTemplatesJSON);
  els.showDeleted.addEventListener('change', renderList);
}

function applyFilters() {
  const q = (els.search.value || '').trim().toLowerCase();
  const cat = els.category.value || '';
  STATE.filtered = (STATE.templates || []).filter(t => {
    const matchesText = !q || (t.title?.toLowerCase().includes(q) || t.text?.toLowerCase().includes(q));
    const matchesCat  = !cat || (normaliseCat(t.categories) === cat);
    const notDeleted  = els.showDeleted.checked ? true : !STATE.deletedIds.has(t.id);
    return matchesText && matchesCat && notDeleted;
  });
  renderList();
}

function renderList() {
  els.list.innerHTML = '';
  STATE.filtered.forEach(t => {
    const li = document.createElement('li');
    li.className = 'card';
    const isChecked = STATE.selectedIds.includes(t.id);
    const disabled = !isChecked && STATE.selectedIds.length >= 3;
    li.innerHTML = `
      <div class="card-inner">
        <input type="checkbox" value="${t.id}" ${isChecked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
        <div class="meta">
          <h3>${t.title || ''}</h3>
          <div class="tags"><span class="tag">${normaliseCat(t.categories) || 'H&N'}</span></div>
          <pre class="snippet">${escapeHTML(snippet(t.text || ''))}</pre>
        </div>
        <div class="card-actions">
          <button class="icon-btn" data-act="delete" title="${STATE.deletedIds.has(t.id) ? 'Undo delete' : 'Delete'}">
            ${STATE.deletedIds.has(t.id) ? 'Undo' : 'Delete'}
          </button>
          ${STATE.deletedIds.has(t.id) ? '<span aria-label="deleted">(deleted)</span>' : ''}
        </div>
      </div>`;
    li.querySelector('input').addEventListener('change', onSelectChange);
    li.querySelector('[data-act="delete"]').addEventListener('click', () => onDelete(t.id));
    els.list.appendChild(li);
  });
  updateComposer();
}

/* actions */
function onSelectChange(e) {
  const id = e.target.value;
  if (e.target.checked) {
    if (!STATE.selectedIds.includes(id)) STATE.selectedIds.push(id);
  } else {
    STATE.selectedIds = STATE.selectedIds.filter(x => x !== id);
  }
  renderList();
}
function onDelete(id) {
  if (STATE.deletedIds.has(id)) { STATE.deletedIds.delete(id); toast('Restored'); }
  else { STATE.deletedIds.add(id); toast('Deleted'); }
  applyFilters();
}
function updateComposer() {
  const chosen = STATE.selectedIds.map(id => (STATE.templates || []).find(t => t.id === id)).filter(Boolean);
  const combined = chosen.map(t => (t.text || '').trim()).join('\n\n');
  els.output.value = combined;
  els.copyBtn.disabled = combined.length === 0;
  els.counter.textContent = `${STATE.selectedIds.length}/3 selected`;
}
async function copyOutput() {
  try { await navigator.clipboard.writeText(els.output.value); toast('Copied to clipboard'); }
  catch { els.output.select(); document.execCommand('copy'); toast('Copied'); }
}
function exportTemplatesJSON() {
  const exportData = (STATE.templates || [])
    .filter(t => !STATE.deletedIds.has(t.id))
    .map(t => ({
      id: t.id, title: t.title,
      categories: [ normaliseCat(t.categories) || inferCategoryENT(t.title || '', t.text || '') ],
      text: t.text || ''
    }));
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'templates.json';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Downloaded templates.json');
}

/* utils */
function toast(msg){ els.toast.textContent = msg; els.toast.className='show'; setTimeout(()=>els.toast.className='',1600); }
function snippet(text,max=160){ const s=(text||'').replace(/\s+/g,' ').trim(); return s.length>max? s.slice(0,max-1)+'…':s; }
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function inferCategoryENT(title, body){
  const t = `${title} ${body}`.toLowerCase();
  const has = kws => kws.some(k => t.includes(k));
  if (has(['paediatric','paediatrics','paeds','child','children','toddler','infant','neonate','school-age','young person'])) return 'Paeds';
  if (has(['ear','pinna','hearing','tinnitus','vertigo','otic','otosclerosis','otitis','eardrum','tympanic','mastoid','cholesteatoma','earwax','grommet','meniere','bppv','labyrinthitis'])) return 'Otology';
  if (has(['nose','nasal','sinus','sinuses','rhino','rhinitis','sinusitis','septum','septal','polyps','epistaxis','smell','olfactory','turbinates'])) return 'Rhinology';
  if (has(['throat','tonsil','tonsill','neck','larynx','laryngeal','voice','hoarseness','thyroid','parotid','salivary','gland','swallow','dysphagia','snoring','sleep apnoea','obstructive sleep apnoea','osa'])) return 'H&N';
  if (has(['ent','nose and throat','otolaryngology'])) return 'H&N';
  return 'H&N';
}
function normaliseCat(cats){
  const s = Array.isArray(cats) ? (cats[0] || '') : (cats || '');
  const v = s.toLowerCase().replace(/\s*&\s*/,'&').trim();
  if (/^oto/.test(v) || v==='ear') return 'Otology';
  if (/^rhin/.test(v) || v==='nose' || v==='sinus' || v==='sinuses') return 'Rhinology';
  if (v==='h&n' || /head/.test(v) || /neck/.test(v)) return 'H&N';
  if (/^paed/.test(v) || /child/.test(v)) return 'Paeds';
  return '';
}
function showFatal(msg){
  els.list.innerHTML = `<li style="padding:12px;border:1px solid #e3e3e3;border-radius:8px">⚠️ ${escapeHTML(msg)}</li>`;
  els.diag.textContent = msg;
}