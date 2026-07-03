/* ============================================================
   DATA LAYER
   - SOURCES: the 25-source registry, one entry per API in the brief.
   - CACHE: a tiny TTL cache simulating "no widget calls an API
     directly" — every widget reads through get(), which returns
     cached data until TTL expires, then regenerates ("revalidates").
   - Mock generators stand in for the real fetch() calls. Swapping
     a generator for a real endpoint call is a single-file change,
     same rule as the brief demands of the real build.
   ============================================================ */

const CATEGORY = { PUBLIC: 'public', KEY: 'key', SCRAPER: 'scraper' };

function rand(min, max){ return Math.random() * (max - min) + min; }
function randInt(min, max){ return Math.floor(rand(min, max + 1)); }
function pick(arr){ return arr[randInt(0, arr.length - 1)]; }
function series(n, base, vol){
  let v = base; const out = [];
  for(let i=0;i<n;i++){ v += rand(-vol, vol); out.push(Math.max(0, +v.toFixed(2))); }
  return out;
}

/* ---------------- Source registry ---------------- */
const SOURCES = [
  // ---- LEVEL 1 · PUBLIC (8) ----
  { id:'A1', level:1, cat:CATEGORY.PUBLIC, name:'CoinGecko', desc:'Crypto KPI cards + 24h sparkline',
    endpoint:'GET api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',
    auth:'none', ttl:60, type:'kpi', unit:'$',
    sop:'Treasury Reserve Review', trigger:'asset moves >10% intraday', assignee:'CFO', sla:4 },
  { id:'A2', level:1, cat:CATEGORY.PUBLIC, name:'Frankfurter', desc:'30-day multi-currency line + rate KPI',
    endpoint:'GET api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP,INR',
    auth:'none', ttl:120, type:'line', unit:'rate',
    sop:'Cross-border Invoicing', trigger:'USD–client >2% WoW', assignee:'Finance Ops', sla:24 },
  { id:'A3', level:1, cat:CATEGORY.PUBLIC, name:'World Bank', desc:'Bar: HQ vs operating geographies',
    endpoint:'GET api.worldbank.org/v2/country/IND/indicator/NY.GDP.MKTP.CD',
    auth:'none', ttl:600, type:'bar', unit:'macro',
    sop:'Pricing Review', trigger:'inflation >2 SD from 10-yr mean', assignee:'Strategy Lead', sla:72 },
  { id:'A4', level:1, cat:CATEGORY.PUBLIC, name:'Hacker News', desc:'Top-20 table + stories-per-domain',
    endpoint:'GET hacker-news.firebaseio.com/v0/topstories.json',
    auth:'none', ttl:180, type:'table', unit:'stories',
    sop:'Inbound Press Response', trigger:'client domain on front page', assignee:'Comms Lead', sla:2 },
  { id:'A5', level:1, cat:CATEGORY.PUBLIC, name:'WHO GHO', desc:'Heatmap of indicators by country',
    endpoint:'GET ghoapi.azureedge.net/api/NCDMORT3070',
    auth:'none', ttl:900, type:'heatmap', unit:'index',
    sop:'Compliance Audit', trigger:'indicator worsens QoQ', assignee:'Compliance', sla:120 },
  { id:'A6', level:1, cat:CATEGORY.PUBLIC, name:'Open-Meteo', desc:'AQI gauge per office + 48h forecast',
    endpoint:'GET air-quality-api.open-meteo.com/v1/air-quality',
    auth:'none', ttl:300, type:'gauge', unit:'AQI',
    sop:'WFH Advisory', trigger:'AQI > 200', assignee:'Office Manager', sla:1 },
  { id:'A7', level:1, cat:CATEGORY.PUBLIC, name:'RandomUser', desc:'HR table + avatar grid (seed data)',
    endpoint:'GET randomuser.me/api/?results=50&nat=us,in,gb',
    auth:'none', ttl:3600, type:'table', unit:'people',
    sop:'—', trigger:'seam for a real HRIS later', assignee:'People Ops', sla:0 },
  { id:'A8', level:1, cat:CATEGORY.PUBLIC, name:'Reddit', desc:'Word cloud of titles + complaints table',
    endpoint:'GET reddit.com/r/Entrepreneur/top.json?limit=25&t=day',
    auth:'none', ttl:300, type:'wordcloud', unit:'sentiment',
    sop:'Competitive Intelligence', trigger:'complaint spike >2× avg', assignee:'Product Marketing', sla:24 },

  // ---- LEVEL 2 · KEY-BASED (10) ----
  { id:'B1', level:2, cat:CATEGORY.KEY, name:'Alpha Vantage', desc:'Candlestick top-5 + daily-change KPI',
    endpoint:'GET alphavantage.co/query?function=GLOBAL_QUOTE&symbol=RELIANCE.BSE',
    auth:'query key · 25/day', ttl:1800, type:'candlestick', unit:'$',
    sop:'Investor Update', trigger:'move >5%', assignee:'IR Lead', sla:6 },
  { id:'B2', level:2, cat:CATEGORY.KEY, name:'OpenWeatherMap', desc:'Multi-city KPI strip',
    endpoint:'GET api.openweathermap.org/data/2.5/weather?appid=…',
    auth:'query appid · 60/min', ttl:300, type:'kpi', unit:'°C',
    sop:'Business Continuity', trigger:'severe weather', assignee:'Ops Manager', sla:2 },
  { id:'B3', level:2, cat:CATEGORY.KEY, name:'NewsAPI', desc:'Industry news table + mentions/day',
    endpoint:'GET newsapi.org/v2/top-headlines?category=business',
    auth:'header X-Api-Key · 100/day', ttl:900, type:'table', unit:'articles',
    sop:'Crisis Comms', trigger:'client + negative tone', assignee:'Comms Lead', sla:3 },
  { id:'B4', level:2, cat:CATEGORY.KEY, name:'FRED', desc:'CPI / unemployment / yield line',
    endpoint:'GET api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL',
    auth:'query key', ttl:3600, type:'line', unit:'%',
    sop:'Pricing Review', trigger:'CPI >0.3% MoM', assignee:'Strategy Lead', sla:48 },
  { id:'B5', level:2, cat:CATEGORY.KEY, name:'USAJOBS', desc:'Job table + openings-by-agency bar',
    endpoint:'GET data.usajobs.gov/api/Search?Keyword=compliance',
    auth:'Authorization-Key + UA email', ttl:1800, type:'bar', unit:'roles',
    sop:'Capture Management', trigger:'new postings', assignee:'BD Lead', sla:24 },
  { id:'B6', level:2, cat:CATEGORY.KEY, name:'Clockify', desc:'Hours/project stacked bar + utilization',
    endpoint:'GET api.clockify.me/api/v1/workspaces/{id}/time-entries',
    auth:'X-Api-Key · 30/hr', ttl:600, type:'bar', unit:'hrs',
    sop:'Capacity Reallocation', trigger:'>90% for 3 wks', assignee:'Delivery Lead', sla:72 },
  { id:'B7', level:2, cat:CATEGORY.KEY, name:'Notion', desc:'SOP kanban: Draft›Review›Published›Retired',
    endpoint:'POST api.notion.com/v1/databases/{id}/query',
    auth:'Bearer + Notion-Version · ~3/s', ttl:300, type:'table', unit:'SOPs',
    sop:'SOP Refresh', trigger:'unreviewed 6+ months', assignee:'Ops Lead', sla:168 },
  { id:'B8', level:2, cat:CATEGORY.KEY, name:'Airtable', desc:'Client pivot + SOP-coverage gauge',
    endpoint:'GET airtable.com/v0/{baseId}/{table}',
    auth:'Bearer PAT · 5/s', ttl:300, type:'gauge', unit:'%',
    sop:'Escalate', trigger:'onboarding incomplete >7 days', assignee:'Account Lead', sla:12 },
  { id:'B9', level:2, cat:CATEGORY.KEY, name:'Trello', desc:'Sankey of cards by list + burn-down',
    endpoint:'GET api.trello.com/1/members/me/boards',
    auth:'key + token (OAuth1) · 300/10s', ttl:180, type:'bar', unit:'cards',
    sop:'Escalate', trigger:'card Blocked >3 days', assignee:'Delivery Lead', sla:24 },
  { id:'B10', level:2, cat:CATEGORY.KEY, name:'AQICN', desc:'City AQI heatmap + alert >150',
    endpoint:'GET api.waqi.info/feed/hyderabad/',
    auth:'query token · 1000/s', ttl:300, type:'gauge', unit:'AQI',
    sop:'WFH Advisory', trigger:'station-measured', assignee:'Office Manager', sla:1 },

  // ---- LEVEL 3 · SCRAPERS (7) ----
  { id:'C1', level:3, cat:CATEGORY.SCRAPER, name:'SEC EDGAR', desc:'Filings timeline + 8-K alert',
    endpoint:'GET data.sec.gov/submissions/CIK0000320193.json',
    auth:'UA name+email · ≤10 req/s', ttl:3600, type:'table', unit:'filings',
    sop:'Material Event Memo', trigger:'new 8-K, 24h SLA', assignee:'Legal Counsel', sla:24 },
  { id:'C2', level:3, cat:CATEGORY.SCRAPER, name:'HN "Who is hiring"', desc:'Hiring volume by month/stack',
    endpoint:'crawl-delay 30 · HN monthly thread',
    auth:'robots.txt honored', ttl:86400, type:'bar', unit:'posts',
    sop:'Org Design Refresh', trigger:'a client is hiring', assignee:'People Ops', sla:120 },
  { id:'C3', level:3, cat:CATEGORY.SCRAPER, name:'RemoteOK', desc:'Bubble: date × salary × applications',
    endpoint:'GET remoteok.com/api',
    auth:'legal notice in payload', ttl:3600, type:'bar', unit:'$k',
    sop:'Market Salary Benchmark', trigger:'quarterly', assignee:'People Ops', sla:720 },
  { id:'C4', level:3, cat:CATEGORY.SCRAPER, name:'Wikipedia infobox', desc:'KPI tiles per client (HQ, revenue)',
    endpoint:'GET en.wikipedia.org/api/rest_v1/page/summary/{title}',
    auth:'UA + contact · 1 req/s', ttl:86400, type:'kpi', unit:'info',
    sop:'Re-introduction Call', trigger:'leadership change', assignee:'Account Lead', sla:48 },
  { id:'C5', level:3, cat:CATEGORY.SCRAPER, name:'Yahoo Finance', desc:'Candlestick + news card',
    endpoint:'GET finance.yahoo.com/quote/AAPL (Playwright)',
    auth:'JS-rendered · training only', ttl:1800, type:'candlestick', unit:'$',
    sop:'Market Event Memo', trigger:'>5% intraday', assignee:'IR Lead', sla:6 },
  { id:'C6', level:3, cat:CATEGORY.SCRAPER, name:'Wikipedia Pageviews', desc:'Client vs competitor line + anomaly',
    endpoint:'GET wikimedia.org/api/rest_v1/metrics/pageviews/…',
    auth:'UA per Wikimedia policy', ttl:3600, type:'line', unit:'views',
    sop:'Reputation Audit', trigger:'views >2× 30-day mean', assignee:'Comms Lead', sla:24 },
  { id:'C7', level:3, cat:CATEGORY.SCRAPER, name:'India MCA', desc:'Legal-entity table + status alert',
    endpoint:'data.gov.in bulk CSV (ROC)',
    auth:'official bulk export, no portal scraping', ttl:86400, type:'table', unit:'entities',
    sop:'KYC/Compliance Refresh', trigger:'status change', assignee:'Compliance', sla:72 },
];

/* ---------------- TTL cache ---------------- */
const Cache = (() => {
  const store = new Map(); // id -> { data, cachedAt, ttl }
  let hits = 0, misses = 0;

  function generate(src){
    switch(src.type){
      case 'kpi': {
        const base = src.unit === '$' ? rand(80, 60000) : rand(10, 40);
        const delta = rand(-9, 9);
        return { value: base, delta, spark: series(16, base, base*0.03) };
      }
      case 'line':
        return { points: series(24, rand(2, 100), rand(1,6)), labels: Array.from({length:24},(_,i)=>i) };
      case 'bar':
        return { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].slice(0, randInt(4,7)),
                 values: series(6, rand(10,80), rand(5,20)) };
      case 'candlestick': {
        let p = rand(100,400); const rows=[];
        for(let i=0;i<10;i++){ const o=p; const c=o+rand(-8,8); const h=Math.max(o,c)+rand(0,4); const l=Math.min(o,c)-rand(0,4); rows.push({o,h,l,c}); p=c; }
        return { rows };
      }
      case 'table': {
        const rowsN = randInt(4,6);
        const cols = ['Item','Status','Owner','Updated'];
        const statuses = ['On track','Watch','Blocked','Done'];
        const rows = Array.from({length:rowsN},(_,i)=>[
          `${src.name} record #${randInt(100,999)}`, pick(statuses), pick(['A. Rao','J. Chen','M. Silva','P. Iyer']), `${randInt(1,23)}h ago`
        ]);
        return { cols, rows };
      }
      case 'heatmap':
        return { rows:4, cols:6, cells: Array.from({length:24},()=>rand(0,1)) };
      case 'gauge':
        return { value: rand(0, src.unit==='AQI'?300:100), max: src.unit==='AQI'?300:100 };
      case 'wordcloud': {
        const words = ['pricing','support','latency','onboarding','billing','SLA','refund','roadmap','uptime','docs','API','churn'];
        return { words: words.map(w=>({ w, weight: rand(0.6,2.2) })).sort(()=>Math.random()-0.5).slice(0, 9) };
      }
      default: return {};
    }
  }

  function get(src){
    const now = Date.now();
    const entry = store.get(src.id);
    if(entry && (now - entry.cachedAt) < src.ttl*1000){
      hits++;
      return { ...entry, fresh:true };
    }
    misses++;
    const data = generate(src);
    const record = { data, cachedAt: now, ttl: src.ttl };
    store.set(src.id, record);
    return { ...record, fresh:false };
  }

  function forceRefresh(src){
    const data = generate(src);
    const record = { data, cachedAt: Date.now(), ttl: src.ttl };
    store.set(src.id, record);
    return record;
  }

  function hitRate(){
    const total = hits+misses;
    return total===0 ? 100 : Math.round((hits/total)*100);
  }

  return { get, forceRefresh, hitRate, _store:store };
})();
