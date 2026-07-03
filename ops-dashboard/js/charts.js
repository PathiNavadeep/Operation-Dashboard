/* ============================================================
   CHART RENDERERS — plain canvas & SVG, themed to the dashboard.
   Kept dependency-free so the dashboard works fully offline.
   ============================================================ */

function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function fitCanvas(canvas){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 60), h = Math.max(rect.height, 40);
  canvas.width = w*dpr; canvas.height = h*dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  return { ctx, w, h };
}

function drawSparkline(canvas, data, color){
  if(!canvas) return;
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0,0,w,h);
  const min = Math.min(...data), max = Math.max(...data);
  const pad = 3;
  const step = (w-pad*2) / (data.length-1);
  ctx.beginPath();
  data.forEach((v,i)=>{
    const x = pad + i*step;
    const y = h-pad - ((v-min)/(max-min||1))*(h-pad*2);
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin='round'; ctx.stroke();
  // fill gradient under line
  const grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0, color+'33'); grad.addColorStop(1, color+'00');
  ctx.lineTo(w-pad, h-pad); ctx.lineTo(pad, h-pad); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
}

function drawLineChart(canvas, points, color){
  if(!canvas) return;
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0,0,w,h);
  const pad = 10;
  const min = Math.min(...points), max = Math.max(...points);
  const step = (w-pad*2)/(points.length-1);
  // gridlines
  ctx.strokeStyle = cssVar('--border-soft'); ctx.lineWidth = 1;
  for(let i=0;i<=3;i++){
    const y = pad + i*(h-pad*2)/3;
    ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(w-pad,y); ctx.stroke();
  }
  ctx.beginPath();
  points.forEach((v,i)=>{
    const x = pad+i*step;
    const y = h-pad-((v-min)/(max-min||1))*(h-pad*2);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
  points.forEach((v,i)=>{
    const x=pad+i*step, y=h-pad-((v-min)/(max-min||1))*(h-pad*2);
    if(i===points.length-1){
      ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
    }
  });
}

function drawBarChart(canvas, labels, values, color){
  if(!canvas) return;
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0,0,w,h);
  const pad = 8, gap = 6;
  const max = Math.max(...values, 1);
  const bw = (w - pad*2 - gap*(values.length-1)) / values.length;
  values.forEach((v,i)=>{
    const bh = (v/max) * (h-pad*2-14);
    const x = pad + i*(bw+gap);
    const y = h-pad-bh;
    const grad = ctx.createLinearGradient(0,y,0,h-pad);
    grad.addColorStop(0,color); grad.addColorStop(1,color+'55');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, bw, bh, 3); ctx.fill();
  });
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawCandlestick(canvas, rows){
  if(!canvas) return;
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0,0,w,h);
  const pad = 8;
  const all = rows.flatMap(r=>[r.h,r.l]);
  const min = Math.min(...all), max = Math.max(...all);
  const cw = (w-pad*2)/rows.length;
  rows.forEach((r,i)=>{
    const x = pad + i*cw + cw/2;
    const up = r.c >= r.o;
    const color = up ? cssVar('--success') : cssVar('--danger');
    const yHigh = h-pad-((r.h-min)/(max-min||1))*(h-pad*2);
    const yLow  = h-pad-((r.l-min)/(max-min||1))*(h-pad*2);
    const yO = h-pad-((r.o-min)/(max-min||1))*(h-pad*2);
    const yC = h-pad-((r.c-min)/(max-min||1))*(h-pad*2);
    ctx.strokeStyle = color; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x,yHigh); ctx.lineTo(x,yLow); ctx.stroke();
    ctx.fillStyle = color;
    const top = Math.min(yO,yC), bh = Math.max(Math.abs(yC-yO),1.5);
    ctx.fillRect(x-cw*0.28, top, cw*0.56, bh);
  });
}

function renderGaugeSVG(value, max, color){
  const pct = Math.min(1, value/max);
  const angle = Math.PI * pct; // 0..PI semicircle
  const r = 42, cx=52, cy=50;
  const x = cx - r*Math.cos(angle);
  const y = cy - r*Math.sin(angle);
  const largeArc = pct > 0.5 ? 1 : 0;
  return `
  <svg viewBox="0 0 104 58" width="120" height="66">
    <path d="M ${cx-r} ${cy} A ${r} ${r} 0 1 1 ${cx+r} ${cy}" fill="none" stroke="var(--border)" stroke-width="8" stroke-linecap="round"/>
    <path d="M ${cx-r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="2.5" fill="${color}"/>
  </svg>`;
}

function renderHeatmap(container, cfg){
  container.innerHTML='';
  const grid = document.createElement('div');
  grid.className='heatmap-grid';
  grid.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
  cfg.cells.forEach(v=>{
    const cell = document.createElement('div');
    cell.className='heatmap-cell';
    const c = v>0.75 ? '#F2565C' : v>0.5 ? '#F2A93B' : v>0.25 ? '#43D9C8' : '#2A3142';
    cell.style.background = c;
    cell.style.opacity = (0.35 + v*0.65).toFixed(2);
    grid.appendChild(cell);
  });
  container.appendChild(grid);
}

function renderWordcloud(container, words){
  container.innerHTML='';
  const wrap = document.createElement('div');
  wrap.className='wordcloud';
  const colors = ['var(--cyan)','var(--violet)','var(--amber)','var(--text-1)'];
  words.forEach((item,i)=>{
    const span = document.createElement('span');
    span.textContent = item.w;
    span.style.fontSize = (11 + item.weight*8) + 'px';
    span.style.color = colors[i % colors.length];
    span.style.fontWeight = item.weight > 1.4 ? '700' : '500';
    wrap.appendChild(span);
  });
  container.appendChild(wrap);
}

function renderTable(container, cfg){
  container.innerHTML='';
  const table = document.createElement('table');
  table.className='wc-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr>' + cfg.cols.map(c=>`<th>${c}</th>`).join('') + '</tr>';
  const tbody = document.createElement('tbody');
  cfg.rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = r.map(c=>`<td>${c}</td>`).join('');
    tbody.appendChild(tr);
  });
  table.appendChild(thead); table.appendChild(tbody);
  container.appendChild(table);
}
