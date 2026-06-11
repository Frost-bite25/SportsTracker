// ===========================================================================
// update-data.mjs — run by GitHub Actions to refresh data.json server-side.
// Node 20+ (built-in fetch), no dependencies.
//
//  • F1     : Jolpica/Ergast public API — reliable.
//  • MotoGP : motogp.com (pulselive) unofficial feed — BEST EFFORT. If its
//             shape changes or a call fails, MotoGP is left untouched and the
//             weekly Cowork task fills it in instead.
//
// Only the f1 and motogp series are touched here; sx/mx/he are preserved so
// the weekly task can own those.
// ===========================================================================
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data.json";
const data = JSON.parse(readFileSync(PATH, "utf8"));

async function getJSON(url){
  const r = await fetch(url, { headers: { "User-Agent": "race-tracker-bot/1.0" } });
  if(!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// ---- F1 (reliable) --------------------------------------------------------
async function updateF1(){
  const base = "https://api.jolpi.ca/ergast/f1/2026";
  const sched = (await getJSON(`${base}/races.json`)).MRData.RaceTable.Races || [];
  const wins  = (await getJSON(`${base}/results/1.json`)).MRData.RaceTable.Races || [];
  const rounds = data.series.f1.rounds;
  sched.forEach(r => {
    const rd = rounds.find(x => x.r === +r.round);
    if(rd && r.date) rd.date = r.date;
  });
  wins.forEach(r => {
    const w = r.Results && r.Results[0] && r.Results[0].Driver;
    const rd = rounds.find(x => x.r === +r.round);
    if(rd && w) rd.winner = `${w.givenName} ${w.familyName}`.trim();
  });
  console.log("F1: updated");
}

// ---- MotoGP (best effort) -------------------------------------------------
async function updateMotoGP(){
  const B = "https://api.motogp.pulselive.com/motogp/v1/results";
  const seasons = await getJSON(`${B}/seasons`);
  const season = seasons.find(s => s.year === 2026);
  if(!season) throw new Error("no 2026 season");
  const events = await getJSON(`${B}/events?seasonUuid=${season.id}&isFinished=true`);
  const rounds = data.series.motogp.rounds;
  let n = 0;
  for(const ev of events){
    try{
      const cats = await getJSON(`${B}/categories?eventUuid=${ev.id}`);
      const motogp = cats.find(c => /motogp/i.test(c.name || c.legacy_id || ""));
      if(!motogp) continue;
      const sessions = await getJSON(`${B}/sessions?eventUuid=${ev.id}&categoryUuid=${motogp.id}`);
      const race = sessions.find(s => (s.type || "").toUpperCase() === "RAC");
      if(!race) continue;
      const cls = await getJSON(`${B}/session/${race.id}/classification?test=false`);
      const top = cls.classification && cls.classification[0];
      const name = top && top.rider && (top.rider.full_name || `${top.rider.name||""} ${top.rider.surname||""}`.trim());
      const num = ev.sequence ?? ev.number ?? ev.short_name;
      const rd = rounds.find(x => x.r === +num);
      if(rd && name){ rd.winner = name; n++; }
    }catch(e){ /* skip this event */ }
  }
  console.log(`MotoGP: filled ${n} result(s)`);
}

await updateF1().catch(e => console.error("F1 failed:", e.message));
await updateMotoGP().catch(e => console.error("MotoGP failed (best-effort):", e.message));

data.updated = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log("data.json written at", data.updated);
