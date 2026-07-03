/* ============================================================
   TRIGGER ENGINE
   metric › comparator › threshold → SOP_ID, assignee, SLA_hours
   Fires idempotently: a source can only have ONE open action at
   a time (matches the brief's "one real event, one card" rule).
   ============================================================ */

const Triggers = (() => {
  let queue = []; // { id, sourceId, sourceName, sopName, assignee, slaHours, createdAt, status }
  let seq = 1;

  function evaluate(src, cacheEntry){
    if(src.sop === '—') return false; // no SOP wired (e.g. RandomUser seam)
    const already = queue.find(q => q.sourceId === src.id && q.status === 'open');
    if(already) return false;

    // Simple, source-shape-aware breach probability — simulates
    // "did this metric cross its threshold on this refresh."
    let breach = false;
    const d = cacheEntry.data;
    if(src.type === 'kpi' && d.delta !== undefined) breach = Math.abs(d.delta) > 6.5;
    else if(src.type === 'gauge') breach = d.value > d.max * 0.72;
    else if(src.type === 'line') breach = Math.max(...d.points) - d.points[0] > (Math.max(...d.points)*0.35);
    else if(src.type === 'heatmap') breach = Math.max(...d.cells) > 0.86;
    else breach = Math.random() < 0.16; // table/bar/candlestick/wordcloud baseline

    if(!breach) return false;

    queue.unshift({
      id: 'ACT-' + String(seq++).padStart(4,'0'),
      sourceId: src.id,
      sourceName: src.name,
      sopName: src.sop,
      trigger: src.trigger,
      assignee: src.assignee,
      slaHours: src.sla || 24,
      createdAt: Date.now(),
      status: 'open',
    });
    return true;
  }

  function resolve(actionId){
    const item = queue.find(q => q.id === actionId);
    if(item) item.status = 'resolved';
  }

  function clearResolved(){
    queue = queue.filter(q => q.status !== 'resolved');
  }

  function openCount(){ return queue.filter(q=>q.status==='open').length; }
  function all(){ return queue; }

  return { evaluate, resolve, clearResolved, openCount, all };
})();

function slaRemainingPct(item){
  const elapsedH = (Date.now() - item.createdAt) / 3600000;
  const pct = 1 - (elapsedH / item.slaHours);
  return Math.max(0, pct);
}

function slaLabel(item){
  const elapsedMs = Date.now() - item.createdAt;
  const totalMs = item.slaHours * 3600000;
  const remainMs = Math.max(0, totalMs - elapsedMs);
  const remainH = remainMs/3600000;
  if(remainMs <= 0) return { text:'SLA breached', cls:'crit' };
  if(remainH < 1) return { text: Math.round(remainH*60)+'m left', cls:'crit' };
  if(remainH < item.slaHours*0.3) return { text: remainH.toFixed(1)+'h left', cls:'warn' };
  return { text: remainH.toFixed(1)+'h left', cls:'ok' };
}
