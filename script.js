/* v1.2.4 (2025-08-09) robust loader + visible diagnostics + ENT categories */

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
  diag:     document.getElementById('diag')
};

init();

async function init() {
  try {
    STATE.templates = await loadTemplatesWithDiagnostics();
  } catch (e) {
    showFatal(`Couldn’t load templates: ${e.message || e}`);
    return;
  }

  // Fixed category dropdown
  ENT_CATEGORIES.forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c;
    els.category.appendChild(o);
  });

  bindEvents();
  applyFilters();
}

function bindEvents() {
  els.search.addEventListener('input', applyFilters);
  els.category.addEventListener('change', applyFilters);
  els.copyBtn.addEventListener('click', copyOutput);
  els.exportBtn.addEventListener('click', exportTemplatesJSON);
  els.showDeleted.addEventListener('change', renderList);

  // Theme toggle
  (() => {
    const btn = document.getElementById('themeToggle'); if (!btn) return;
    const KEY = 'xtheme';
    const apply = (val) => {
      document.documentElement.dataset.theme = val;
      if (val === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    };
    const saved = localStorage.getItem(KEY); if (saved) apply(saved);
    btn.addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, next); apply(next);
    });
  })();
}

/* ---------------- Loader with diagnostics ---------------- */
async function loadTemplatesWithDiagnostics() {
  const origin = location.origin;
  // repoPath like "/accurx_text_maker/"
  const parts = location.pathname.split('/').filter(Boolean);
  const repoPath = parts.length ? `/${parts[0]}/` : '/';
  const basePath = location.pathname.endsWith('/') ? location.pathname : location.pathname.replace(/[^/]+$/, '');

  const names = ['templates.json', 'link_titles.json', 'links_titles.json'];

  // Try relative, basePath, repoPath, and absolute to be extra safe
  const candidates = [];
  for (const n of names) {
    candidates.push(n);
    candidates.push(basePath + n);
    candidates.push(repoPath + n);
    candidates.push(`${origin}${repoPath}${n}`);
    candidates.push(`${origin}${basePath}${n}`);
  }

  const triedLogs = [];
  for (const url of [...new Set(candidates)]) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      triedLogs.push(`${url} → ${res.status}`);
      if (!res.ok) continue;

      const data = await res.json().catch(() => null);
      const items = normaliseTopLevel(data);
      if (!Array.isArray(items) || !items.length) continue;

      const mapped = items.map((t, i) => ({
        id: t.id || `item-${i}`,
        title: t.title || t.name || t.label || t.heading || `Item ${i+1}`,
        text: t.text || t.body || t.content || t.linkText || '',
        categories: [ normaliseCat(t.categories) || inferCategoryENT(t.title || '', t.text || '') ]
      }));

      els.diag.textContent = `Loaded: ${url}`;
      return mapped;
    } catch (e) {
      triedLogs.push(`${url} → error`);
    }
  }

  els.diag.textContent = 'Tried: ' + triedLogs.join('  |  ');
  throw new Error(`No templates file found (checked: ${names.join(', ')})`);
}

function normaliseTopLevel(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

/* ---------------- Filtering & render ---------------- */
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
  if (STATE.deletedIds.has(id)) {
    STATE.deletedIds.delete(id);
    toast('Restored');
  } else {
    STATE.deletedIds.add(id);
    toast('Deleted');
  }
  applyFilters();
}

function updateComposer() {
  const chosen = STATE.selectedIds.map(id => (STATE.templates || []).find(t => t.id === id)).filter(Boolean);
  const combined = chosen.map(t => (t.text || '').trim()).join('\n\n');
  els.output.value = combined;
  els.copyBtn.disabled = combined.length === 0;
  els.counter.textContent = `${STATE.selectedIds.length}/3 selected`;
}

/* ---------------- Actions ---------------- */
async function copyOutput() {
  try {
    await navigator.clipboard.writeText(els.output.value);
    toast('Copied to clipboard');
  } catch {
    els.output.select();
    document.execCommand('copy');
    toast('Copied');
  }
}

function exportTemplatesJSON() {
  const exportData = (STATE.templates || [])
    .filter(t => !STATE.deletedIds.has(t.id))
    .map(t => ({
      id: t.id,
      title: t.title,
      categories: [ normaliseCat(t.categories) || inferCategoryENT(t.title || '', t.text || '') ],
      text: t.text || ''
    }));
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'templates.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Downloaded templates.json');
}

/* ---------------- Utils ---------------- */
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.className = 'show';
  setTimeout(() => { els.toast.className = ''; }, 1600);
}
function snippet(text, max = 160) {
  const s = (text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
function escapeHTML(s) {
  return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
// ENT-only inference (ONE of: Otology, Rhinology, H&N, Paeds)
function inferCategoryENT(title, body) {
  const t = `${title} ${body}`.toLowerCase();
  const has = (kws) => kws.some(k => t.includes(k));
  if (has(['paediatric','paediatrics','paeds','child','children','toddler','infant','neonate','school-age','young person'])) return 'Paeds';
  if (has(['ear','pinna','hearing','tinnitus','vertigo','otic','otosclerosis','otitis','eardrum','tympanic','mastoid','cholesteatoma','earwax','grommet','meniere','bppv','labyrinthitis'])) return 'Otology';
  if (has(['nose','nasal','sinus','sinuses','rhino','rhinitis','sinusitis','septum','septal','polyps','epistaxis','smell','olfactory','turbinates'])) return 'Rhinology';
  if (has(['throat','tonsil','tonsill','neck','larynx','laryngeal','voice','hoarseness','thyroid','parotid','salivary','gland','swallow','dysphagia','snoring','sleep apnoea','obstructive sleep apnoea','osa'])) return 'H&N';
  if (has(['ent','nose and throat','otolaryngology'])) return 'H&N';
  return 'H&N';
}
// Normalise string/array → one of the fixed set
function normaliseCat(cats) {
  const s = Array.isArray(cats) ? (cats[0] || '') : (cats || '');
  const v = s.toLowerCase().replace(/\s*&\s*/,'&').trim();
  if (/^oto/.test(v) || v === 'ear') return 'Otology';
  if (/^rhin/.test(v) || v === 'nose' || v === 'sinus' || v === 'sinuses') return 'Rhinology';
  if (v === 'h&n' || /head/.test(v) || /neck/.test(v)) return 'H&N';
  if (/^paed/.test(v) || /child/.test(v)) return 'Paeds';
  return '';
}
function showFatal(msg) {
  els.list.innerHTML = `<li style="padding:12px;border:1px solid #e3e3e3;border-radius:8px">⚠️ ${escapeHTML(msg)}</li>`;
  els.diag.textContent = msg;
}
