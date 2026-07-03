# API Reference — all 25 sources

Endpoints, auth, and rate limits as specified in the brief. Use this when replacing
`Cache.generate()` in `js/data.js` with real `fetch()` calls behind your backend.

## Category A — Public, no key (8)

| ID | Source | Endpoint | Auth | Limit |
|---|---|---|---|---|
| A1 | CoinGecko | `GET api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd` | none | ~30/min |
| A2 | Frankfurter | `GET api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP,INR` | none | none documented |
| A3 | World Bank | `GET api.worldbank.org/v2/country/IND/indicator/NY.GDP.MKTP.CD?format=json` | none | 1 req/sec etiquette |
| A4 | Hacker News | `GET hacker-news.firebaseio.com/v0/topstories.json` + `/v0/item/{id}.json` | none | cache aggressively |
| A5 | WHO GHO | `GET ghoapi.azureedge.net/api/NCDMORT3070` | none | OData JSON |
| A6 | Open-Meteo | `GET air-quality-api.open-meteo.com/v1/air-quality?latitude=..&longitude=..&hourly=pm2_5,pm10,ozone` | none | — |
| A7 | RandomUser | `GET randomuser.me/api/?results=50&nat=us,in,gb` | none | seam for real HRIS |
| A8 | Reddit | `GET reddit.com/r/Entrepreneur/top.json?limit=25&t=day` | none | set descriptive User-Agent |

## Category B — free key, registration required (10)

| ID | Source | Endpoint | Auth | Limit |
|---|---|---|---|---|
| B1 | Alpha Vantage | `GET alphavantage.co/query?function=GLOBAL_QUOTE&symbol=RELIANCE.BSE&apikey=KEY` | query key | 25/day (binding) |
| B2 | OpenWeatherMap | `GET api.openweathermap.org/data/2.5/weather?lat=..&lon=..&appid=KEY&units=metric` | query `appid` | 60/min |
| B3 | NewsAPI | `GET newsapi.org/v2/top-headlines?country=in&category=business&apiKey=KEY` | header `X-Api-Key` | 100/day |
| B4 | FRED | `GET api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=KEY&file_type=json` | query key | — |
| B5 | USAJOBS | `GET data.usajobs.gov/api/Search?Keyword=compliance&LocationName=Washington,DC` | header `Authorization-Key` + UA=email | — |
| B6 | Clockify | `GET api.clockify.me/api/v1/workspaces/{workspaceId}/time-entries` | header `X-Api-Key` | 30/hr |
| B7 | Notion | `POST api.notion.com/v1/databases/{database_id}/query` | Bearer + `Notion-Version: 2022-06-28` | ~3/s |
| B8 | Airtable | `GET api.airtable.com/v0/{baseId}/{tableName}` | Bearer (PAT) | 5/s |
| B9 | Trello | `GET api.trello.com/1/members/me/boards?key=KEY&token=TOKEN` | key+token (OAuth1) | 300/10s |
| B10 | AQICN | `GET api.waqi.info/feed/hyderabad/?token=KEY` | query token | 1000/s |

## Category C — scraping, no formal API (7)

| ID | Source | Endpoint | Catch |
|---|---|---|---|
| C1 | SEC EDGAR | `GET data.sec.gov/submissions/CIK0000320193.json` | UA must carry name+email; ≤10 req/s |
| C2 | HN "Who is hiring" | latest monthly thread → Firebase item API | `robots.txt` sets `Crawl-delay: 30` |
| C3 | RemoteOK | `GET remoteok.com/api` | first JSON element is a legal notice — respect it |
| C4 | Wikipedia infobox | `GET en.wikipedia.org/api/rest_v1/page/summary/{title}` | UA + contact, 1 req/s |
| C5 | Yahoo Finance | `finance.yahoo.com/quote/AAPL` | JS-rendered, needs Playwright — training use only |
| C6 | Wikipedia Pageviews | `GET wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/{Article}/daily/{START}/{END}` | UA per Wikimedia policy |
| C7 | India MCA | bulk CSV per ROC via data.gov.in | do NOT scrape the portal — CAPTCHA + sessions |

## The rules that never bend

- Every API call goes through the cache — no exceptions.
- No key or secret ever appears in git history; if one does, rotate it immediately.
- Every scraper respects `robots.txt` and rate limits.
- Swapping a provider is a single-file change.
- Every widget shows a visible "Last Updated" timestamp.
- Everything lives in version control from the first commit.
