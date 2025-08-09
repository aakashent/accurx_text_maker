// v1.2.7 – absolute path + cache-buster + visible diagnostics
const ENT_CATEGORIES = ["Otology","Rhinology","H&N","Paeds"];
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
const STATE = { templates: [], filtered: [], selectedIds: [], deletedIds: new Set() };

init();

async function init(){
  const url = `/accurx_text_maker/links_titles.json?v=${Date.now()}`; // absolute + cache-buster
  try{
    const res = await fetch(url, { cache: 'no-store' });
    els.diag.textContent = `Tried: ${location.origin}${url} → ${res.status}`;
    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const items = normaliseTopLevel(data);
    if(!items.length) throw new Error('JSON structure empty');

    STATE.templates = items.map((t,i)=>({
      id: t.id || `item-${i}`,
      title: t.title || t.name || t.label || t.heading || `Item ${i+1}`,
      text: t.text || t.body || t.content || t.linkText || '',
      categories: [ normaliseCat(t.categories) || inferCategoryENT(t.title||'', t.text||'') ]
    }));
    els.diag.textContent = `Loaded: ${location.origin}${url}  •  ${STATE.templates.length} items`;
  }catch(e){
    showFatal(`Couldn’t load templates: ${e.message}`);
    return;
  }

  ENT_CATEGORIES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; els.category.appendChild(o); });
  bindEvents();
  applyFilters();
}

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
    const mt=!q || t.title.toLowerCase().includes(q) || t.text.toLowerCase().includes(q);
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
          <h3>${t.title||''}</h3>
          <div class="tags"><span class="tag">${normaliseCat(t.categories)||'H&N'}</span></div>
          <pre class="snippet">${escapeHTML(snippet(t.text||''))}</pre>
        </div>
        <div class="card-actions">
          <button class="icon-btn" data-act="delete">${STATE.deletedIds.has(t.id)?'Undo':'Delete'}</button>
          ${STATE.deletedIds.has(t.id)?'<span aria-label="deleted">(deleted)</span>':''}
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

/* Export */
function exportTemplatesJSON(){
  const exportData=STATE.templates.filter(t=>!STATE.deletedIds.has(t.id)).map(t=>({
    id:t.id, title:t.title,
    categories:[ normaliseCat(t.categories) || inferCategoryENT(t.title||'', t.text||'') ],
    text:t.text||''
  }));
  const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='templates.json';
  document.body.appendChild(a); a.click(); a.remove(); toast('Downloaded templates.json');
}

/* Helpers */
function normaliseTopLevel(d){
  if(Array.isArray(d)) return d;
  if(d && Array.isArray(d.items)) return d.items;
  if(d && Array.isArray(d.data)) return d.data;
  if(d && typeof d==='object'){ // flatten grouped {Section:[...]}
    const all=[]; for(const k of Object.keys(d)){ if(Array.isArray(d[k])) all.push(...d[k]); } return all;
  }
  return [];
}
function inferCategoryENT(title, body){
  const t=`${title} ${body}`.toLowerCase(), has=kws=>kws.some(k=>t.includes(k));
  if(has(['paediatric','paeds','child','children','infant','toddler','neonate'])) return 'Paeds';
  if(has(['ear','hearing','tinnitus','vertigo','otitis','eardrum','tympanic','mastoid','cholesteatoma','earwax','grommet','meniere','bppv'])) return 'Otology';
  if(has(['nose','nasal','sinus','rhino','rhinitis','sinusitis','septum','polyps','epistaxis','smell','turbinates'])) return 'Rhinology';
  if(has(['throat','tonsil','neck','larynx','voice','thyroid','parotid','salivary','swallow','dysphagia','snoring','sleep apnoea','osa'])) return 'H&N';
  return 'H&N';
}
function normaliseCat(c){ const s=Array.isArray(c)?(c[0]||''): (c||''); const v=s.toLowerCase().replace(/\s*&\s*/,'&').trim();
  if(/^oto/.test(v)||v==='ear') return 'Otology';
  if(/^rhin/.test(v)||['nose','sinus','sinuses'].includes(v)) return 'Rhinology';
  if(v==='h&n'||/head|neck/.test(v)) return 'H&N';
  if(/^paed/.test(v)||/child/.test(v)) return 'Paeds';
  return '';
}
function snippet(text,max=160){ const s=(text||'').replace(/\s+/g,' ').trim(); return s.length>max? s.slice(0,max-1)+'…':s; }
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function toast(msg){ els.toast.textContent=msg; els.toast.className='show'; setTimeout(()=>els.toast.className='',1600); }
function showFatal(msg){ els.list.innerHTML=`<li style="padding:12px;border:1px solid #e3e3e3;border-radius:8px">⚠️ ${msg}</li>`; }