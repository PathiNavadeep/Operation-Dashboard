/* ============================================================
   APP SHELL
   ============================================================ */

const state = {
  view: 'overview',
  role: 'founder',
  typeFilters: new Set(['kpi','chart','table','alert']),
  search: '',
};

const CATBADGE = { public:'PUBLIC', key:'KEYED', scraper:'SCRAPE' };
const CATCLASS = { public:'public', key:'key', scraper:'scraper' };

function widgetKind(src){
  if(src.type==='kpi') return 'kpi';
  if(src.type==='table') return 'table';
  return 'chart';
}

function timeAgo(ts){
  const s = Math.floor((Date.now()-ts)/1000);
  if(s < 5) return 'just now';
  if(s < 60) return s+'s ago';
  const m = Math.floor(s/60);
  if(m < 60) return m+'m ago';
  const h = Math.floor(m/60);
  return h+'h ago';
}

/* ---------------- Widget card build ---------------- */
function buildWidgetCard(src){
  const cache = Cache.get(src);
  const fired = Triggers.evaluate(src, cache);

  const card = document.createElement('div');
  card.className = 'widget-card' + (fired || hasOpenAction(src.id) ? ' is-alert' : '');
  card.dataset.id = src.id;
  card.dataset.kind = widgetKind(src);

  card.innerHTML = `
    <div class="wc-head">
      <div class="wc-titles">
        <span class="wc-cat">${String(src.level).padStart(2,'0')} · ${src.id}</span>
        <span class="wc-title">${src.name}</span>
      </div>
      <span class="wc-badge ${CATCLASS[src.cat]}">${CATBADGE[src.cat]}</span>
    </div>
    <div class="wc-body" id="body-${src.id}"></div>
    <div class="wc-trigger">⚡ ${src.sop !== '—' ? src.sop+' · '+src.trigger : src.trigger}</div>
    <div class="wc-foot">
      <span class="wc-updated"><span class="pulse-dot ${cache.fresh?'ok':'warn'}" style="width:5px;height:5px"></span> Updated ${timeAgo(cache.cachedAt)}</span>
      <span>TTL ${src.ttl}s</span>
    </div>
  `;
  card.addEventListener('click', ()=>openModal(src));
  renderBody(card.querySelector('.wc-body'), src, cache.data);
  return card;
}

function hasOpenAction(sourceId){
  return Triggers.all().some(q=>q.sourceId===sourceId && q.status==='open');
}

function renderBody(el, src, data){
  el.innerHTML = '';
  switch(src.type){
    case 'kpi': {
      const up = data.delta >= 0;
      el.innerHTML = `
        <div class="kpi-big">
          <div class="kb-value">${src.unit==='$' ? '$'+data.value.toLocaleString(undefined,{maximumFractionDigits:0}) : data.value.toFixed(1)+(src.unit&&src.unit!=='info'&&src.unit!=='people'?' '+src.unit:'')}</div>
          <div class="kb-delta ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(data.delta).toFixed(2)}%</div>
          <canvas class="kb-spark"></canvas>
        </div>`;
      requestAnimationFrame(()=> drawSparkline(el.querySelector('canvas'), data.spark, up?getVar('--success'):getVar('--danger')));
      break;
    }
    case 'line': {
      const c = document.createElement('canvas'); c.style.height='96px'; el.appendChild(c);
      requestAnimationFrame(()=> drawLineChart(c, data.points, getVar('--cyan')));
      break;
    }
    case 'bar': {
      const c = document.createElement('canvas'); c.style.height='96px'; el.appendChild(c);
      requestAnimationFrame(()=> drawBarChart(c, data.labels, data.values, getVar('--violet')));
      break;
    }
    case 'candlestick': {
      const c = document.createElement('canvas'); c.style.height='96px'; el.appendChild(c);
      requestAnimationFrame(()=> drawCandlestick(c, data.rows));
      break;
    }
    case 'table':
      el.style.width='100%';
      renderTable(el, { cols:data.cols, rows: data.rows.slice(0,4) });
      break;
    case 'heatmap':
      el.style.width='100%';
      renderHeatmap(el, data);
      break;
    case 'gauge': {
      const wrap = document.createElement('div'); wrap.className='gauge-wrap';
      const color = data.value > data.max*0.72 ? getVar('--danger') : data.value > data.max*0.45 ? getVar('--amber') : getVar('--success');
      wrap.innerHTML = renderGaugeSVG(data.value, data.max, color) + `<div class="gauge-val">${Math.round(data.value)}</div>`;
      el.appendChild(wrap);
      break;
    }
    case 'wordcloud':
      el.style.width='100%';
      renderWordcloud(el, data.words);
      break;
  }
}

function getVar(name){ return cssVar(name); }

/* ---------------- Filtering ---------------- */
function matchesFilters(src){
  const kind = widgetKind(src);
  const isAlerting = hasOpenAction(src.id);
  if(isAlerting){
    if(!state.typeFilters.has('alert')) return false;
  } else if(!state.typeFilters.has(kind)) return false;
  if(state.search){
    const q = state.search.toLowerCase();
    const hay = `${src.name} ${src.sop} ${src.trigger} ${src.assignee} ${src.id}`.toLowerCase();
    if(!hay.includes(q)) return false;
  }
  if(state.role === 'analyst' && ['B1'].includes(src.id)) return false; // treasury/investor gated from analyst view
  return true;
}

function renderGrid(container, sources){
  container.innerHTML='';
  const filtered = sources.filter(matchesFilters);
  if(filtered.length===0){
    container.innerHTML = `<div class="queue-empty">No widgets match your filters.</div>`;
    return;
  }
  filtered.forEach(src => container.appendChild(buildWidgetCard(src)));
}

function renderAllGrids(){
  renderGrid(document.getElementById('overviewGrid'), SOURCES);
  renderGrid(document.getElementById('level1Grid'), SOURCES.filter(s=>s.level===1));
  renderGrid(document.getElementById('level2Grid'), SOURCES.filter(s=>s.level===2));
  renderGrid(document.getElementById('level3Grid'), SOURCES.filter(s=>s.level===3));
  renderKpiStrip();
  renderRulesTable();
  renderQueue();
  updateHeaderCounts();
}

/* ---------------- KPI strip (overview) ---------------- */
function renderKpiStrip(){
  const el = document.getElementById('kpiStrip');
  const open = Triggers.openCount();
  const avgTtl = Math.round(SOURCES.reduce((a,s)=>a+s.ttl,0)/SOURCES.length);
  const scraperOk = SOURCES.filter(s=>s.cat==='scraper').length;
  el.innerHTML = `
    <div class="kpi-mini"><div class="kmi-label">Sources wired</div><div class="kmi-value cyan">25 / 25</div></div>
    <div class="kpi-mini"><div class="kmi-label">Cache hit rate</div><div class="kmi-value">${Cache.hitRate()}%</div></div>
    <div class="kpi-mini"><div class="kmi-label">Open actions</div><div class="kmi-value ${open? 'danger':''}">${open}</div></div>
    <div class="kpi-mini"><div class="kmi-label">Avg TTL</div><div class="kmi-value">${avgTtl}s</div></div>
    <div class="kpi-mini"><div class="kmi-label">Scrapers respecting robots.txt</div><div class="kmi-value amber">${scraperOk}/7</div></div>
  `;
}

/* ---------------- Rules table ---------------- */
function renderRulesTable(){
  const tbody = document.querySelector('#rulesTable tbody');
  tbody.innerHTML = SOURCES.filter(s=>s.sop!=='—').map(s=>{
    const open = hasOpenAction(s.id);
    return `<tr>
      <td><b>${s.name}</b> <span class="muted">${s.id}</span></td>
      <td class="muted">${s.type}</td>
      <td class="muted">threshold breach</td>
      <td>${s.sop}</td>
      <td>${s.assignee}</td>
      <td>${s.sla}h</td>
      <td><span class="status-pill ${open?'fired':'armed'}">${open?'FIRED':'ARMED'}</span></td>
    </tr>`;
  }).join('');
  document.getElementById('ruleCount').textContent = SOURCES.filter(s=>s.sop!=='—').length;
}

/* ---------------- Queue ---------------- */
function renderQueue(){
  const list = document.getElementById('queueList');
  const items = Triggers.all().sort((a,b)=>{
    if(a.status!==b.status) return a.status==='open' ? -1 : 1;
    return slaRemainingPct(a) - slaRemainingPct(b);
  });
  if(items.length===0){
    list.innerHTML = `<div class="queue-empty">Queue is empty — nothing has breached threshold yet. Hit "refresh cycle" in the top bar to run another sweep.</div>`;
  } else {
    list.innerHTML = items.map(item=>{
      const sla = slaLabel(item);
      const sev = sla.cls==='crit' ? 'high':'';
      return `<div class="queue-card ${item.status==='resolved'?'resolved':''}">
        <span class="q-sev ${sev}"></span>
        <div class="q-main">
          <span class="q-title">${item.sopName} <span class="muted">· ${item.id}</span></span>
          <span class="q-sub">${item.sourceName} — ${item.trigger}</span>
        </div>
        <div class="q-assignee">${item.assignee}<small>ASSIGNEE</small></div>
        <div class="q-sla ${item.status==='resolved'?'ok':sla.cls}">${item.status==='resolved'?'Resolved':sla.text}</div>
        <div class="q-actions">
          ${item.status==='open' ? `<button class="q-btn" onclick="resolveAction('${item.id}')">Mark done</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('queueCount').textContent = Triggers.openCount();
  document.getElementById('archQueueCount').textContent = Triggers.openCount() + ' open';
}

function resolveAction(id){
  Triggers.resolve(id);
  renderQueue();
  showToast('Action ' + id + ' marked done.');
}

function updateHeaderCounts(){
  document.getElementById('cacheHitRate').textContent = Cache.hitRate()+'%';
  const rate = Cache.hitRate();
  const dot = document.querySelector('#systemHealth .pulse-dot');
  dot.className = 'pulse-dot ' + (rate>70?'ok':rate>40?'warn':'bad');
}

/* ---------------- Modal ---------------- */
function openModal(src){
  const cache = Cache.get(src);
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h2>${src.name}</h2>
    <div class="modal-sub">${src.desc}</div>
    <div class="modal-grid">
      <div class="modal-field"><span>Category</span><b>${CATBADGE[src.cat]}</b></div>
      <div class="modal-field"><span>Auth</span><b>${src.auth}</b></div>
      <div class="modal-field"><span>Cache TTL</span><b>${src.ttl}s</b></div>
      <div class="modal-field"><span>Last updated</span><b>${timeAgo(cache.cachedAt)}</b></div>
      <div class="modal-field"><span>SOP triggered</span><b>${src.sop}</b></div>
      <div class="modal-field"><span>Assignee · SLA</span><b>${src.assignee} · ${src.sla}h</b></div>
    </div>
    <div class="endpoint-block">${src.endpoint}</div>
    <div style="margin-top:16px; display:flex; gap:10px;">
      <button class="btn-ghost" onclick="forceRefreshSource('${src.id}')">Force refresh</button>
      <button class="btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.add('show');
}
function closeModal(){ document.getElementById('modalBackdrop').classList.remove('show'); }

function forceRefreshSource(id){
  const src = SOURCES.find(s=>s.id===id);
  Cache.forceRefresh(src);
  closeModal();
  renderAllGrids();
  showToast(src.name + ' revalidated.');
}

/* ---------------- Toast ---------------- */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}

/* ---------------- Ops view ---------------- */
const HEALTHS = [
  { name:'API Gateway', status:'ok', ms:42 },
  { name:'Cache (Redis)', status:'ok', ms:3 },
  { name:'MongoDB primary', status:'ok', ms:18 },
  { name:'Scraper scheduler', status:'ok', ms:120 },
  { name:'Trigger engine', status:'ok', ms:9 },
  { name:'Auth service', status:'ok', ms:26 },
];
function renderHealthRows(){
  document.getElementById('healthRows').innerHTML = HEALTHS.map(h=>`
    <div class="health-row">
      <span class="hr-name"><span class="pulse-dot ok" style="width:6px;height:6px"></span>${h.name}</span>
      <span class="hr-ms">${h.ms}ms</span>
    </div>`).join('');
}

const LOG_TEMPLATES = [
  ['info','cache revalidate id=%SRC% ttl=%TTL%s'],
  ['info','GET /api/widgets/%SRC% 200 %MS%ms'],
  ['warn','rate-limit near threshold for %SRC% (429 risk)'],
  ['info','trigger evaluated src=%SRC% breach=false'],
  ['error','upstream timeout %SRC% — served stale + flagged'],
  ['info','scheduler: scraper %SRC% run complete'],
];
function pushLog(){
  const stream = document.getElementById('logStream');
  if(!stream) return;
  const src = pick(SOURCES);
  const [lvl, tmpl] = pick(LOG_TEMPLATES);
  const msg = tmpl.replace('%SRC%', src.id).replace('%TTL%', src.ttl).replace('%MS%', randInt(8,180));
  const line = document.createElement('div');
  line.className = 'log-line lvl-'+lvl;
  const time = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="lg-time">${time}</span>${msg}`;
  stream.prepend(line);
  while(stream.children.length > 40) stream.removeChild(stream.lastChild);
}

/* ---------------- Navigation ---------------- */
function switchView(view){
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  if(view==='ops') renderHealthRows();
}

/* ---------------- Theme ---------------- */
function toggleTheme(){
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  renderAllGrids(); // redraw canvases with new theme colors
}

/* ---------------- Refresh cycle ---------------- */
function runRefreshCycle(){
  const btn = document.getElementById('refreshAllBtn');
  btn.classList.add('spinning');
  let n = 0;
  SOURCES.forEach(src=>{
    if((Date.now() - (Cache._store.get(src.id)?.cachedAt || 0)) / 1000 >= src.ttl * 0.4){
      Cache.forceRefresh(src);
      n++;
    }
  });
  setTimeout(()=>{
    btn.classList.remove('spinning');
    renderAllGrids();
    showToast(`Refresh cycle complete — ${n} source${n===1?'':'s'} revalidated.`);
  }, 500);
}

/* ---------------- Wire up ---------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  renderAllGrids();
  renderHealthRows();
  for(let i=0;i<6;i++) pushLog();

  document.querySelectorAll('.nav-item').forEach(btn=>{
    btn.addEventListener('click', ()=> switchView(btn.dataset.view));
  });
  document.querySelectorAll('.role-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.role = btn.dataset.role;
      renderAllGrids();
      showToast('Viewing as ' + state.role + (state.role==='analyst' ? ' — treasury widgets hidden by RBAC' : ''));
    });
  });
  document.querySelectorAll('.typeFilter').forEach(cb=>{
    cb.addEventListener('change', ()=>{
      state.typeFilters = new Set([...document.querySelectorAll('.typeFilter:checked')].map(c=>c.value));
      renderAllGrids();
    });
  });
  document.getElementById('searchInput').addEventListener('input', (e)=>{
    state.search = e.target.value;
    renderAllGrids();
  });
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('refreshAllBtn').addEventListener('click', runRefreshCycle);
  document.getElementById('clearResolvedBtn').addEventListener('click', ()=>{ Triggers.clearResolved(); renderQueue(); });
  document.getElementById('modalBackdrop').addEventListener('click', (e)=>{ if(e.target.id==='modalBackdrop') closeModal(); });

  // live clocks: SLA countdowns + last-updated + occasional new breach + logs
  setInterval(()=>{ renderQueue(); }, 15000);
  setInterval(()=>{ pushLog(); }, 4000);
  setInterval(()=>{
    // background TTL sweep so widgets naturally revalidate like real cron
    let changed = false;
    SOURCES.forEach(src=>{
      const rec = Cache._store.get(src.id);
      if(rec && (Date.now()-rec.cachedAt)/1000 >= src.ttl){ Cache.get(src); changed = true; }
    });
    if(changed) renderAllGrids();
  }, 5000);
});
