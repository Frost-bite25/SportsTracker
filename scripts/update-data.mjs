// ===========================================================================
// update-data.mjs — run by GitHub Actions to refresh data.json server-side,
// on a schedule, with NO manual editing and NO dependency on any desktop app.
// Node 20+ (built-in fetch), no dependencies.
//
//  • F1  : Jolpica/Ergast public API — reliable, exact.
//  • MotoGP / Supercross / Motocross / Hard Enduro / Tour de France : no public
//    API exists, so we read each series' Wikipedia season page (its results
//    table is updated by editors within hours of each event) via the MediaWiki
//    API. This is BEST EFFORT — if a page/table can't be parsed, that series is
//    left exactly as-is (never blanked) and retried on the next run.
//
// Design guarantee: a fetch/parse failure for one series can never corrupt the
// file. We only ever fill a winner we successfully extracted; we never clear an
// existing value. So the worst case is "no change this run".
// ===========================================================================
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data.json";
const data = JSON.parse(readFileSync(PATH, "utf8"));
const UA = "race-tracker-bot/2.0 (github pages static site; contact via repo)";

async function getJSON(url){
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if(!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// ---- F1 (reliable API) ----------------------------------------------------
async function updateF1(){
  const base = "https://api.jolpi.ca/ergast/f1/2026";
  const sched = (await getJSON(`${base}/races.json`)).MRData.RaceTable.Races || [];
  const wins  = (await getJSON(`${base}/results/1.json`)).MRData.RaceTable.Races || [];
  const rounds = data.series.f1.rounds;
  sched.forEach(r => { const rd = rounds.find(x => x.r === +r.round); if(rd && r.date) rd.date = r.date; });
  wins.forEach(r => {
    const w = r.Results && r.Results[0] && r.Results[0].Driver;
    const rd = rounds.find(x => x.r === +r.round);
    if(rd && w) rd.winner = `${w.givenName} ${w.familyName}`.trim();
  });
  console.log("F1: updated from Jolpica");
}

// ---- Generic Wikipedia results scraper ------------------------------------
// Reads the rendered HTML of a season page, finds the results table (first
// column = round/stage number, a column header matching /winn/i = the winner),
// and fills winners for matching rounds.
function decodeEntities(s){
  return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
          .replace(/&quot;/g,'"').replace(/&#0*39;|&#x27;/g,"'").replace(/&nbsp;/g," ")
          .replace(/&ndash;/g,"–").replace(/&mdash;/g,"—");
}
function stripCell(html){
  return decodeEntities(
    html.replace(/<sup[\s\S]*?<\/sup>/gi,"")   // footnote refs
        .replace(/<style[\s\S]*?<\/style>/gi,"")
        .replace(/<[^>]+>/g," ")                // all tags
  ).replace(/\[\d+\]/g,"").replace(/\s+/g," ").trim();
}
function cellsOf(rowHtml){
  const out = []; let m;
  const re = /<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  while((m = re.exec(rowHtml))) out.push(stripCell(m[2]));
  return out;
}
async function pageHTML(title){
  const url = `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2`
            + `&redirects=1&prop=text&page=${encodeURIComponent(title)}`;
  const j = await getJSON(url);
  if(!j.parse || !j.parse.text) throw new Error("no parse text for "+title);
  return j.parse.text;
}
function winnersFromHTML(html){
  // Return a map { roundNumber: winnerName } from the best-matching table.
  const tables = html.match(/<table[^>]*wikitable[\s\S]*?<\/table>/gi) || [];
  let best = {};
  for(const t of tables){
    const rows = t.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if(rows.length < 2) continue;
    // header = first row with >=2 <th>
    let hdr = null;
    for(const r of rows){ const c = cellsOf(r); if((r.match(/<th\b/gi)||[]).length >= 2){ hdr = c; break; } }
    if(!hdr) continue;
    const winIdx = hdr.findIndex(h => /winn/i.test(h));   // "Winner" / "Winning rider" / "Winning driver"
    if(winIdx < 0) continue;
    const map = {};
    for(const r of rows){
      const c = cellsOf(r);
      if(c.length <= winIdx) continue;
      const round = parseInt(c[0], 10);
      if(!Number.isFinite(round)) continue;              // first cell must be the round/stage number
      const name = (c[winIdx] || "").replace(/\s*\(.*?\)\s*$/,"").trim();
      if(name) map[round] = name;
    }
    if(Object.keys(map).length > Object.keys(best).length) best = map;
  }
  return best;
}
async function updateFromWikipedia(key, title){
  const rounds = data.series[key].rounds;
  const map = winnersFromHTML(await pageHTML(title));
  let n = 0;
  for(const [round, name] of Object.entries(map)){
    const rd = rounds.find(x => x.r === +round);
    if(rd && name && rd.winner !== name){ rd.winner = name; n++; }
  }
  console.log(`${key}: ${Object.keys(map).length} winner(s) found on Wikipedia, ${n} updated`);
}

// ---- Run each source independently; one failure never aborts the rest ------
const jobs = [
  ["f1",  updateF1()],
  ["motogp", updateFromWikipedia("motogp", "2026 MotoGP World Championship")],
  ["sx",  updateFromWikipedia("sx",  "2026 AMA Supercross Championship")],
  ["mx",  updateFromWikipedia("mx",  "2026 AMA Pro Motocross Championship")],
  ["he",  updateFromWikipedia("he",  "2026 FIM Hard Enduro World Championship")],
  ["tdf", updateFromWikipedia("tdf", "2026 Tour de France")],
];
for(const [name, p] of jobs){
  try { await p; } catch(e){ console.error(`${name} failed (kept as-is):`, e.message); }
}

data.updated = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log("data.json written at", data.updated);
