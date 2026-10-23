import { useState } from "react";
import "./BodyWeather.css";

/* ---------- Helpers ---------- */
const KEY = "bw:logs";
const N = (v) => (v === "" || v == null ? null : parseFloat(v));
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* storage full / blocked */ } };
const today = () => new Date().toISOString().slice(0, 10);
const bmiOf = (w, h) => w / Math.pow(h / 100, 2);
const SK = "bw:settings";
const DEF = { units: "metric", theme: "paper", age: "", act: 1.375, goal: "", range: 0 };
const loadS = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(SK)) }; } catch { return DEF; } };
const saveS = (v) => { try { localStorage.setItem(SK, JSON.stringify(v)); } catch { /* blocked */ } };
// Data is always stored in cm and kg; these convert for display and input.
const cv = (u) => { const i = u === "imperial"; return { wu: i ? "lb" : "kg", lu: i ? "in" : "cm", wt: (v) => (i ? v * 2.20462 : v), len: (v) => (i ? v / 2.54 : v), iwt: (v) => (i ? v / 2.20462 : v), ilen: (v) => (i ? v * 2.54 : v) }; };
const conv = (v, f1, f2) => (v === "" ? "" : +f2(f1(+v)).toFixed(1));
const R1 = (x, fn) => (x == null ? null : +fn(x).toFixed(1));
const bmrOf = (e, age) => 10 * e.w + 6.25 * e.h - 5 * age + (e.sex === "male" ? 5 : -161);
const fatOf = (bmi, age, sex) => 1.2 * bmi + 0.23 * age - (sex === "male" ? 10.8 : 0) - 5.4;
const a1cOf = (g) => (g + 46.7) / 28.7;
const pick = (x) => ({ date: String(x.date).slice(0, 10), sex: x.sex === "male" ? "male" : "female", h: +x.h, w: +x.w, wa: +x.wa, fa: +x.fa || null, po: +x.po || null, s: +x.s || null, d: +x.d || null, sl: +x.sl || null, n: String(x.n || "").slice(0, 200) });

const bmiI = (b) => b < 18.5 ? { l: "Underweight", t: "warn" } : b < 25 ? { l: "Healthy weight", t: "good" } : b < 30 ? { l: "Overweight", t: "warn" } : { l: "Obese", t: "bad" };
function waistI(w, h, sex) {
  const [a, b] = sex === "male" ? [94, 102] : [80, 88], r = w / h;
  const t = w >= b || r >= 0.6 ? "bad" : w >= a || r >= 0.5 ? "warn" : "good";
  return { r, t, a, b, l: t === "good" ? "Healthy waist" : t === "warn" ? "Raised belly-fat risk" : "High belly-fat risk" };
}
const fI = (g) => g < 70 ? { l: "Low", t: "warn", p: 0 } : g < 100 ? { l: "Normal", t: "good", p: 0 } : g < 126 ? { l: "Prediabetes range", t: "warn", p: 2 } : { l: "Diabetes range", t: "bad", p: 4 };
const pI = (g) => g < 140 ? { l: "Normal", t: "good", p: 0 } : g < 200 ? { l: "Elevated", t: "warn", p: 2 } : { l: "Diabetes range", t: "bad", p: 4 };
const bI = (s, d) =>
  s > 180 || d > 120 ? { l: "Hypertensive crisis", t: "bad", ok: 0, pen: 25 } :
  s >= 140 || d >= 90 ? { l: "High (Stage 2)", t: "bad", ok: 0, pen: 25 } :
  s >= 130 || d >= 80 ? { l: "High (Stage 1)", t: "bad", ok: 0, pen: 15 } :
  s >= 120 ? { l: "Elevated", t: "warn", ok: 0, pen: 8 } :
  s < 90 || d < 60 ? { l: "Low", t: "warn", ok: 0, pen: 8 } : { l: "Normal", t: "good", ok: 1, pen: 0 };

function analyze(e) {
  const bmi = bmiOf(e.w, e.h), bi = bmiI(bmi), wi = waistI(e.wa, e.h, e.sex);
  const fa = e.fa ? { v: e.fa, ...fI(e.fa) } : null;
  const po = e.po ? { v: e.po, ...pI(e.po) } : null;
  const bp = e.s ? { s: e.s, d: e.d, ...bI(e.s, e.d) } : null;
  // [name, penalty, max penalty, short label for the wind rose]
  const pen = [["body weight", bi.t === "good" ? 0 : bi.t === "bad" ? 20 : 10, 20, "weight"], ["waist size", wi.t === "bad" ? 15 : wi.t === "warn" ? 8 : 0, 15, "waist"]];
  if (fa) pen.push(["fasting sugar", fa.p * 6, 24, "fasting"]);
  if (po) pen.push(["post-meal sugar", po.p * 5, 20, "post-meal"]);
  if (bp) pen.push(["blood pressure", bp.pen, 25, "pressure"]);
  const score = Math.max(0, 100 - pen.reduce((a, x) => a + x[1], 0));
  const lever = pen.reduce((a, x) => (x[1] > a[1] ? x : a), ["", 0]);
  const ax = pen.map(([, p, m, s]) => ({ s, v: 1 - p / m }));
  const sev = (fa && fa.p === 4) || (po && po.p === 4) || (bp && bp.pen === 25);
  const mood = sev || score < 65 ? "bad" : score < 85 ? "warn" : "good";
  const pts = (fa ? fa.p : 0) + (po ? po.p : 0) + (bi.t === "bad" ? 2 : bi.l === "Overweight" ? 1 : 0) + (wi.t === "bad" ? 2 : wi.t === "warn" ? 1 : 0);
  const risk = (fa && fa.p === 4) || (po && po.p === 4) || pts >= 4 ? { l: "High diabetes risk", t: "bad" } : pts >= 2 ? { l: "Moderate diabetes risk", t: "warn" } : { l: "Low diabetes risk", t: "good" };
  return { bmi, bi, wi, fa, po, bp, score, lever, ax, mood, risk, pts };
}

function tips(a, e) {
  const r = [], hi = 24.9 * Math.pow(e.h / 100, 2);
  if (a.bi.l === "Underweight") r.push("Add nutrient-dense calories (nuts, dairy, legumes, whole grains) and do strength training.");
  if (a.bi.t !== "good" && a.bi.l !== "Underweight") r.push(`Aim to lose 0.25 to 0.5 kg a week. About ${hi.toFixed(0)} kg or less puts your BMI in the healthy range.`);
  if (a.bi.l === "Healthy weight") r.push("Your weight is in the healthy range. Keep up regular activity and balanced meals.");
  if (a.bi.t !== "good" || a.wi.t !== "good") r.push("Walk briskly 150+ minutes a week, including 10 to 15 minutes after meals.");
  if (a.wi.t !== "good") r.push("Cut sugary drinks, refined flour and fried snacks. Belly fat raises diabetes and heart risk.");
  if ((a.fa || a.po) && a.pts >= 2) r.push("Repeat glucose tests on different days and ask a doctor about an HbA1c test.");
  if (a.bp && !a.bp.ok && a.bp.l !== "Low") r.push("Keep salt under 5 g a day, limit processed food, sleep 7 to 8 hours and recheck BP at rest.");
  if (!r.length) r.push("Keep logging weekly to catch changes early.");
  return r;
}

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportCsv(logs) {
  const cols = ["date", "sex", "h", "w", "wa", "fa", "po", "s", "d", "sl", "n"];
  const csv = [cols.join(","), ...logs.map((e) => cols.map((c) => (c === "n" ? JSON.stringify(e.n || "") : e[c] ?? "")).join(","))].join("\n");
  download("body-weather.csv", csv, "text/csv");
}

const Tag = ({ t, children }) => <span className={`bw-tag bw-${t}`}>{children}</span>;
const ICON = { good: "☀", warn: "⛅", bad: "⛈" };

/* ---------- Visuals ---------- */
// Isobar chart: the tighter the lines, the stormier the reading. Score sits in the eye.
function Chart({ mood, score }) {
  const m = mood === "none" ? "good" : mood, gap = { good: 20, warn: 14, bad: 9 }[m];
  return (
    <svg viewBox="0 0 300 220" width="100%" role="img" aria-label={score != null ? `Health score ${score} out of 100` : "No reading yet"}>
      {[...Array(8)].map((_, i) => <ellipse key={i} className="bw-iso" cx="150" cy="110" rx={44 + i * gap * 1.5} ry={36 + i * gap} transform="rotate(-12 150 110)" />)}
      <circle className={`bw-eye bw-eye--${m}`} cx="150" cy="110" r="38" />
      <text className="bw-eye-t" x="150" y="122" textAnchor="middle">{score ?? "–"}</text>
      <circle className={`bw-eye bw-eye--${m}`} cx="196" cy="74" r="11" />
      <text className="bw-eye-s" x="196" y="78.5" textAnchor="middle">{m === "bad" ? "L" : "H"}</text>
    </svg>
  );
}

function Scale({ v, min, max, segs }) {
  const p = Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  return (
    <div className="bw-scale" aria-hidden="true">
      <div className="bw-scale-bar">{segs.map(([f, c], i) => <i key={i} style={{ flex: f, background: `var(--${c})` }} />)}</div>
      <div className="bw-scale-pin" style={{ left: `${p}%` }} />
    </div>
  );
}

// Wind rose: one spoke per measurement, longer = healthier.
function Rose({ ax }) {
  const n = ax.length, pt = (i, r) => { const t = ((-90 + (360 / n) * i) * Math.PI) / 180; return [100 + r * Math.cos(t), 100 + r * Math.sin(t)]; };
  const poly = (f) => ax.map((x, i) => pt(i, 70 * f(x)).map((q) => q.toFixed(1)).join(",")).join(" ");
  return (
    <svg viewBox="-20 0 240 200" width="100%" style={{ maxWidth: 280 }} role="img" aria-label={"Balance chart: " + ax.map((x) => `${x.s} ${Math.round(x.v * 100)}%`).join(", ")}>
      {[0.33, 0.66, 1].map((f) => <polygon key={f} className="bw-ring" points={poly(() => f)} />)}
      {ax.map((x, i) => { const [lx, ly] = pt(i, 70), [tx, ty] = pt(i, 88); return <g key={i}><line className="bw-ring" x1="100" y1="100" x2={lx} y2={ly} /><text className="bw-rl" x={tx} y={ty} textAnchor="middle" dominantBaseline="middle">{x.s}</text></g>; })}
      <polygon className="bw-rose" points={poly((x) => Math.max(0.06, x.v))} />
    </svg>
  );
}

function Curve({ fa, po }) {
  const y = (v) => 130 - ((Math.min(260, Math.max(60, v)) - 60) / 200) * 110;
  const col = { good: "var(--moss)", warn: "var(--amber)", bad: "var(--rose)" };
  return (
    <svg viewBox="0 0 320 150" width="100%" style={{ maxWidth: 400 }} role="img" aria-label={`Sugar went from ${fa.v} fasting to ${po.v} after the meal`}>
      <polygon points={`40,${y(99)} 280,${y(139)} 280,${y(70)} 40,${y(70)}`} fill="var(--moss)" opacity="0.2" />
      <text x="48" y={y(70) - 4} fontSize="10" fill="var(--ink)">healthy zone</text>
      <line x1="40" y1={y(fa.v)} x2="280" y2={y(po.v)} stroke="var(--ink)" strokeWidth="2.5" />
      {[[40, fa], [280, po]].map(([x, p], i) => (
        <g key={i}><circle cx={x} cy={y(p.v)} r="8" fill={col[p.t]} stroke="var(--ink)" strokeWidth="2.5" /><text x={x} y={y(p.v) - 14} textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--ink)">{p.v}</text></g>
      ))}
      <text x="40" y="148" textAnchor="middle" fontSize="11" fill="var(--ink)">Fasting</text>
      <text x="280" y="148" textAnchor="middle" fontSize="11" fill="var(--ink)">1.5 h after meal</text>
    </svg>
  );
}

// Last 7 check-ins as a weather forecast strip.
function Strip({ logs }) {
  return (
    <div className="bw-strip">
      {logs.slice(-7).map((e) => {
        const x = analyze(e);
        return (
          <div key={e.date} className={`bw-day bw-day--${x.mood}`}>
            <span className="bw-day-d">{e.date.slice(5)}</span>
            <span className="bw-day-i" aria-hidden="true">{ICON[x.mood]}</span>
            <b>{x.score}</b>
            <span className="visually-hidden">{HEAD[x.mood][0]}</span>
          </div>
        );
      })}
    </div>
  );
}

// Healthy weight range, progress toward it (or your own goal), and pace.
function Goal({ logs, cur, fm, goal }) {
  const hm = cur.h / 100, lo = 18.5 * hm * hm, hi = 24.9 * hm * hm, first = logs[0];
  const days = (new Date(cur.date) - new Date(first.date)) / 864e5;
  const rate = days > 0 ? ((cur.w - first.w) / days) * 7 : null;
  const tgt = goal ? (Math.abs(cur.w - goal) < 0.3 ? null : goal) : cur.w > hi ? hi : cur.w < lo ? lo : null;
  const prog = tgt ? (first.w !== tgt ? Math.min(1, Math.max(0, (first.w - cur.w) / (first.w - tgt))) : 0) : 1;
  const weeks = tgt && rate && Math.sign(tgt - cur.w) === Math.sign(rate) ? Math.ceil(Math.abs((tgt - cur.w) / rate)) : null;
  return (
    <>
      <div className="bw-row"><span className="bw-big">{fm.wt(lo).toFixed(0)}–{fm.wt(hi).toFixed(0)}<small> {fm.wu}</small></span></div>
      <span className="bw-hint">Healthy range at your height{goal ? `. Your goal: ${fm.wt(goal).toFixed(1)} ${fm.wu}` : ""}</span>
      {tgt ? (
        <>
          <div className="bw-prog" role="img" aria-label={`${Math.round(prog * 100)}% of the way to your target`}><i style={{ width: `${prog * 100}%` }} /></div>
          <span className="bw-hint">{fm.wt(Math.abs(cur.w - tgt)).toFixed(1)} {fm.wu} to {tgt < cur.w ? "lose" : "gain"} · {Math.round(prog * 100)}% there</span>
        </>
      ) : <p><Tag t="good">{goal ? "Goal reached" : "You're in range"}</Tag></p>}
      {rate != null && <p>Pace: <b>{rate > 0 ? "+" : ""}{fm.wt(rate).toFixed(2)} {fm.wu} a week</b>{weeks ? `. At this pace you get there in about ${weeks} weeks.` : "."}</p>}
    </>
  );
}

// Calorie, protein and water targets (Mifflin-St Jeor).
function Energy({ cur, st, goal, fm }) {
  const age = +st.age;
  if (!age) return <p className="bw-hint">Add your age under Settings to see calorie, protein and water targets.</p>;
  const hm2 = (cur.h / 100) ** 2, bmr = bmrOf(cur, age), tdee = bmr * st.act;
  const dir = goal ? (Math.abs(cur.w - goal) < 0.3 ? 0 : Math.sign(goal - cur.w)) : cur.w > 24.9 * hm2 ? -1 : cur.w < 18.5 * hm2 ? 1 : 0;
  const kcal = Math.max(cur.sex === "male" ? 1500 : 1200, Math.round(tdee + (dir < 0 ? -500 : dir > 0 ? 300 : 0)));
  const rows = [["Resting burn (BMR)", `${Math.round(bmr)} kcal`], ["Maintenance", `${Math.round(tdee)} kcal`], [dir < 0 ? "Target to lose" : dir > 0 ? "Target to gain" : "Daily target", `${kcal} kcal`], ["Protein", `${Math.round(cur.w * 1.2)} g`], ["Water", `${(cur.w * 0.033).toFixed(1)} L`]];
  return (
    <>
      <dl className="bw-dl">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <span className="bw-hint">A 500 kcal daily deficit is about 0.5 kg a week. Estimates only.</span>
    </>
  );
}

// Body fat and HbA1c estimates.
function Est({ a, cur, age }) {
  const fat = age ? fatOf(a.bmi, age, cur.sex) : null, r = cur.sex === "male" ? [10, 22] : [20, 33];
  const a1 = cur.fa ? a1cOf(cur.fa) : null, t1 = a1 >= 6.5 ? "bad" : a1 >= 5.7 ? "warn" : "good";
  return (
    <>
      {fat != null ? <p>Body fat ≈ <b>{fat.toFixed(0)}%</b> <Tag t={fat >= r[0] && fat <= r[1] ? "good" : "warn"}>{fat < r[0] ? "Low" : fat > r[1] ? "High" : "In range"}</Tag><span className="bw-hint">From BMI, age and sex. Typical healthy range {r[0]}–{r[1]}%.</span></p> : <p className="bw-hint">Add your age under Settings for a body fat estimate.</p>}
      {a1 != null ? <p>HbA1c ≈ <b>{a1.toFixed(1)}%</b> <Tag t={t1}>{a1 >= 6.5 ? "Diabetes range" : a1 >= 5.7 ? "Prediabetes range" : "Normal"}</Tag><span className="bw-hint">Rough value worked out from fasting sugar. A lab HbA1c is the real test.</span></p> : <p className="bw-hint">Log fasting sugar to see an HbA1c estimate.</p>}
    </>
  );
}

// First vs latest in the selected range.
function Delta({ logs, fm, a }) {
  const rows = Object.entries(MET).map(([k, m]) => {
    const c = m.c ? fm[m.c] : (v) => v, p = logs.map((e) => m.g(e)).filter((v) => v != null).map(c);
    if (p.length < 2) return null;
    const d = p[p.length - 1] - p[0];
    const low = k === "sl" ? false : k === "w" || k === "bmi" ? (a.bmi >= 25 ? true : a.bmi < 18.5 ? false : null) : true;
    const cls = d === 0 || low === null ? "" : (d < 0) === low ? "bw-imp" : "bw-wor";
    return <tr key={k}><td>{m.n}</td><td>{p[0].toFixed(1)}</td><td>{p[p.length - 1].toFixed(1)}</td><td className={cls}>{d > 0 ? "+" : ""}{d.toFixed(1)} {un(m, fm)}</td></tr>;
  }).filter(Boolean);
  if (!rows.length) return <p className="bw-hint">Log at least two readings in this range to see what changed.</p>;
  return <div className="bw-scroll"><table className="bw-table"><thead><tr><th>Measure</th><th>First</th><th>Latest</th><th>Change</th></tr></thead><tbody>{rows}</tbody></table></div>;
}

const MET = {
  bmi: { n: "BMI", u: "", g: (e) => bmiOf(e.w, e.h), b: [18.5, 24.9] },
  w: { n: "Weight", c: "wt", g: (e) => e.w },
  wa: { n: "Waist", c: "len", g: (e) => e.wa },
  fa: { n: "Fasting sugar", u: "mg/dL", g: (e) => e.fa, b: [70, 99] },
  po: { n: "Post-meal sugar", u: "mg/dL", g: (e) => e.po, b: [70, 139] },
  s: { n: "Systolic BP", u: "mmHg", g: (e) => e.s, b: [90, 119] },
  sl: { n: "Sleep", u: "h", g: (e) => e.sl, b: [7, 9] },
};
const un = (m, fm) => (m.c === "wt" ? fm.wu : m.c === "len" ? fm.lu : m.u);

function Trend({ logs, fm, goal }) {
  const [k, setK] = useState("bmi"), [ma, setMa] = useState(true);
  const m = MET[k], c = m.c ? fm[m.c] : (v) => v;
  const pts = logs.map((e) => ({ d: e.date, v: m.g(e) })).filter((p) => p.v != null).map((p) => ({ ...p, v: c(p.v) }));
  const vals = pts.map((p) => p.v), n = pts.length, gl = k === "w" && goal ? c(goal) : null;
  const avg = vals.reduce((x, y) => x + y, 0) / (n || 1);
  const sm = vals.map((_, i) => { const w = vals.slice(Math.max(0, i - 2), i + 1); return w.reduce((x, y) => x + y, 0) / w.length; });
  const ex = [...(m.b || []), ...(gl ? [gl] : [])];
  const lo0 = Math.min(...vals, ...ex), hi0 = Math.max(...vals, ...ex);
  const sp = (hi0 - lo0) * 0.1 || 1, lo = lo0 - sp, hi = hi0 + sp;
  const X = (i) => 30 + (n > 1 ? i / (n - 1) : 0.5) * 540, Y = (v) => 164 - ((v - lo) / (hi - lo)) * 134;
  return (
    <div>
      <div className="btn-row bw-chips" role="group" aria-label="Choose a measurement">
        {Object.entries(MET).map(([id, x]) => <button key={id} type="button" className={"bw-chip" + (id === k ? " is-on" : "")} aria-pressed={id === k} onClick={() => setK(id)}>{x.n}</button>)}
      </div>
      {n < 2 ? (
        <p className="bw-hint mt">Log at least two readings in this range that include {m.n.toLowerCase()} to see its trend.</p>
      ) : (
        <div className="mt">
          <svg viewBox="0 0 600 190" width="100%" role="img" aria-label={`${m.n} trend, ${vals[0].toFixed(1)} to ${vals[n - 1].toFixed(1)}`}>
            {m.b && <rect x="30" width="540" y={Y(m.b[1])} height={Y(m.b[0]) - Y(m.b[1])} fill="var(--moss)" opacity="0.2" />}
            {gl != null && <line x1="30" x2="570" y1={Y(gl)} y2={Y(gl)} stroke="var(--rose)" strokeWidth="2" strokeDasharray="6 5" />}
            {ma && n > 2 && <polyline fill="none" stroke="var(--sea)" strokeWidth="3" strokeDasharray="2 5" strokeLinecap="round" points={sm.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} />}
            <polyline fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" points={pts.map((p, i) => `${X(i)},${Y(p.v)}`).join(" ")} />
            {pts.map((p, i) => (
              <g key={i}><circle cx={X(i)} cy={Y(p.v)} r="6" fill="var(--amber)" stroke="var(--ink)" strokeWidth="2.5" />{n <= 9 && <text x={X(i)} y={Y(p.v) - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">{p.v.toFixed(1)}</text>}</g>
            ))}
            <text x="30" y="186" fontSize="11" fill="var(--ink)">{pts[0].d}</text>
            <text x="570" y="186" textAnchor="end" fontSize="11" fill="var(--ink)">{pts[n - 1].d}</text>
          </svg>
          <div className="bw-stats">
            <span>Lowest <b>{Math.min(...vals).toFixed(1)}</b></span><span>Highest <b>{Math.max(...vals).toFixed(1)}</b></span><span>Average <b>{avg.toFixed(1)}</b></span><span>Unit <b>{un(m, fm) || "–"}</b></span>
            <label className="bw-check"><input type="checkbox" checked={ma} onChange={(e) => setMa(e.target.checked)} /> 3-reading average</label>
          </div>
          <span className="bw-hint">{m.b ? "Green band is the healthy range. " : ""}{gl != null ? "Red dashed line is your goal. " : ""}</span>
        </div>
      )}
    </div>
  );
}

// Slide your weight and watch the forecast change.
function WhatIf({ cur, fm, base }) {
  const [d, setD] = useState(0);
  const w = cur.w + d, x = analyze({ ...cur, w, wa: cur.wa + d * 0.9 });
  return (
    <>
      <label className="field"><span className="field-label">If my weight were {fm.wt(w).toFixed(1)} {fm.wu} ({d > 0 ? "+" : ""}{fm.wt(d).toFixed(1)})</span>
        <input className="bw-range" type="range" min="-15" max="15" step="0.5" value={d} onChange={(e) => setD(+e.target.value)} /></label>
      <div className="bw-row mt"><span className="bw-big" aria-hidden="true">{ICON[x.mood]}</span><span className="bw-big">{x.score}</span><Tag t={x.bi.t}>BMI {x.bmi.toFixed(1)}</Tag></div>
      <span className="bw-hint">Score {x.score - base >= 0 ? "+" : ""}{x.score - base} compared with now. Waist is assumed to move about 0.9 cm for every kg.</span>
    </>
  );
}

// Stamps you earn by logging and improving.
function Badges({ logs, a, cur, goal }) {
  const sl = logs.filter((e) => e.sl).map((e) => e.sl), avgSl = sl.length ? sl.reduce((x, y) => x + y, 0) / sl.length : 0;
  const list = [
    ["First step", "Logged a check-in", true],
    ["Regular", "5 check-ins", logs.length >= 5],
    ["Committed", "12 check-ins", logs.length >= 12],
    ["Trimming down", "1 kg lighter than your first reading", logs[0].w - cur.w >= 1],
    ["Clear skies", "Score of 85 or more", a.score >= 85],
    ["Healthy BMI", "BMI 18.5 to 24.9", a.bi.t === "good"],
    ["Well rested", "Average sleep of 7 h or more", avgSl >= 7],
    ["Goal reached", "Hit your goal weight", !!goal && Math.abs(cur.w - goal) < 0.3],
  ];
  return (
    <>
      <p className="bw-hint">{list.filter((x) => x[2]).length} of {list.length} stamps earned</p>
      <ul className="bw-badges">{list.map(([n, d, ok]) => <li key={n} className={ok ? "is-on" : ""}><b>{n}</b><span>{d}</span><span className="visually-hidden">{ok ? "Earned" : "Locked"}</span></li>)}</ul>
    </>
  );
}

/* ---------- Main component ---------- */
const HEAD = {
  good: ["Clear skies", "High pressure. Your readings look healthy."],
  warn: ["Partly cloudy", "Mostly fine, with a few readings to watch."],
  bad: ["Storm warning", "Low pressure. Some readings need attention. See a doctor if they persist."],
  none: ["No reading yet", "Log your first check-in below to see today's forecast."],
};

export default function BodyWeather() {
  const [logs, setLogs] = useState(load);
  const [st, setSt] = useState(loadS);
  const fm = cv(st.units);
  const [f, setF] = useState(() => {
    const l = load().slice(-1)[0] || {};
    return { date: today(), sex: l.sex || "female", h: l.h ? +cv(loadS().units).len(l.h).toFixed(1) : "", w: "", wa: "", fa: "", po: "", s: "", d: "", sl: "", n: "" };
  });
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [tab, setTab] = useState("today");
  const imp_ = st.units === "imperial";

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const store = (l) => { setLogs(l); save(l); };
  const up = (p) => {
    const nx = { ...st, ...p };
    setSt(nx); saveS(nx);
    if (p.units && p.units !== st.units) {
      const a = cv(st.units), b = cv(p.units);
      setF((x) => ({ ...x, h: conv(x.h, a.ilen, b.len), w: conv(x.w, a.iwt, b.wt), wa: conv(x.wa, a.ilen, b.len) }));
    }
  };
  const num = (label, k, ph, hint) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="input" type="number" inputMode="decimal" min="0" step="any" value={f[k]} placeholder={ph} onChange={set(k)} />
      {hint && <span className="bw-hint">{hint}</span>}
    </label>
  );

  function add() {
    const h = R1(N(f.h), fm.ilen), w = R1(N(f.w), fm.iwt), wa = R1(N(f.wa), fm.ilen), fa = N(f.fa), po = N(f.po), s = N(f.s), d = N(f.d), sl = N(f.sl);
    if (!h || !w || !wa) return setErr("Enter your height, weight and waist to log a reading.");
    if (h < 100 || h > 250 || w < 25 || w > 300 || wa < 40 || wa > 200) return setErr(`A body measurement looks out of range. Check you are using ${fm.lu} and ${fm.wu}.`);
    if (!!s !== !!d) return setErr("Enter both blood pressure numbers: top and bottom.");
    if (s && s <= d) return setErr("The top number (systolic) must be higher than the bottom (diastolic).");
    if (sl != null && (sl < 0 || sl > 24)) return setErr("Sleep must be between 0 and 24 hours.");
    setErr("");
    const e = { date: f.date || today(), sex: f.sex, h, w, wa, fa, po, s, d, sl, n: f.n.trim() };
    store([...logs.filter((x) => x.date !== e.date && x.date !== edit), e].sort((a, b) => (a.date < b.date ? -1 : 1)));
    setEdit(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editRow(e) {
    setF({ date: e.date, sex: e.sex, h: R1(e.h, fm.len), w: R1(e.w, fm.wt), wa: R1(e.wa, fm.len), fa: e.fa ?? "", po: e.po ?? "", s: e.s ?? "", d: e.d ?? "", sl: e.sl ?? "", n: e.n || "" });
    setEdit(e.date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function imp(ev) {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    file.text().then((t) => {
      try {
        const ok = JSON.parse(t).filter((x) => x && x.date && x.h > 0 && x.w > 0 && x.wa > 0).map(pick);
        if (!ok.length) throw new Error("empty");
        const m = new Map([...logs, ...ok].map((x) => [x.date, x]));
        store([...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1)));
        setErr("");
      } catch { setErr("That file is not a Body Weather export (.json)."); }
    });
  }

  function sample() {
    const b = Date.now();
    store([0, 1, 2, 3, 4, 5].map((i) => ({
      date: new Date(b - (5 - i) * 7 * 864e5).toISOString().slice(0, 10), sex: "male", h: 172,
      w: +(84 - i * 1.1).toFixed(1), wa: +(98 - i * 1.2).toFixed(1), fa: 112 - i * 3, po: 168 - i * 6, s: 138 - i * 3, d: 88 - i * 2,
      sl: +(6 + i * 0.3).toFixed(1), n: i === 5 ? "Walking after dinner most days" : "",
    })));
  }

  const cutoff = st.range ? new Date(Date.now() - st.range * 864e5).toISOString().slice(0, 10) : "";
  const shown = logs.filter((e) => e.date >= cutoff);
  const goal = +st.goal || null;
  const cur = logs[logs.length - 1], prev = logs[logs.length - 2];
  const a = cur && analyze(cur), mood = a ? a.mood : "none", head = HEAD[mood];
  const dw = prev ? cur.w - prev.w : 0;
  const tb = a ? tab : "today", pane = (id) => "bw-pane" + (tb === id ? " is-on" : "");

  return (
    <div className="bw" data-theme={st.theme} data-mood={mood}>
      <section className={`bw-sky bw-sky--${mood}`}>
        <div className="bw-fx" aria-hidden="true">{[...Array(16)].map((_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, "--t": `${(i * 53) % 90}%`, animationDelay: `${(i % 8) * 0.45}s` }} />)}</div>
        <div>
          <h2 className="bw-forecast">{head[0]}</h2>
          <p>{head[1]}</p>
          {a && <p className="bw-score">Score {a.score} out of 100 · BMI {a.bmi.toFixed(1)} · {a.bi.l}</p>}
          {a && a.lever[1] > 0 && <p>Biggest thing to work on: <b>{a.lever[0]}</b>.</p>}
          {a && prev && <p>Weight {dw > 0 ? "+" : ""}{fm.wt(dw).toFixed(1)} {fm.wu} since {prev.date}.</p>}
          {!a && <div className="mt"><button type="button" className="btn btn--ghost" onClick={sample}>Try sample data</button></div>}
        </div>
        <Chart mood={mood} score={a ? a.score : null} />
      </section>

      <nav className="bw-dock bw-noprint" aria-label="Sections">
        {[["today", "Check-in", "✎"], ["insights", "Insights", "◎"], ["trends", "Trends", "∿"], ["journal", "Journal", "☰"]].map(([id, l, ic]) => (
          <button key={id} type="button" className={"bw-tab" + (tb === id ? " is-on" : "")} aria-current={tb === id ? "page" : undefined} disabled={id !== "today" && !a} onClick={() => setTab(id)}><span aria-hidden="true">{ic}</span> {l}</button>
        ))}
      </nav>

      <div className={pane("today")}>
      <details className="panel mt bw-noprint">
        <summary className="bw-h">Settings and data</summary>
        <div className="bw-grid">
          <label className="field"><span className="field-label">Units</span>
            <select className="input" value={st.units} onChange={(e) => up({ units: e.target.value })}><option value="metric">Metric (cm, kg)</option><option value="imperial">Imperial (in, lb)</option></select></label>
          <label className="field"><span className="field-label">Theme</span>
            <select className="input" value={st.theme} onChange={(e) => up({ theme: e.target.value })}><option value="paper">Day</option><option value="night">Night</option></select></label>
          <label className="field"><span className="field-label">Age</span>
            <input className="input" type="number" min="14" max="110" value={st.age} placeholder="35" onChange={(e) => up({ age: e.target.value })} /></label>
          <label className="field"><span className="field-label">Activity level</span>
            <select className="input" value={st.act} onChange={(e) => up({ act: parseFloat(e.target.value) })}>
              <option value="1.2">Desk job, little exercise</option><option value="1.375">Light: 1–3 workouts a week</option><option value="1.55">Moderate: 3–5 workouts a week</option><option value="1.725">Very active: 6–7 workouts a week</option>
            </select></label>
          <label className="field"><span className="field-label">Goal weight ({fm.wu})</span>
            <input className="input" type="number" min="0" step="any" value={st.goal === "" ? "" : +fm.wt(st.goal).toFixed(2)} placeholder="Healthy range" onChange={(e) => up({ goal: e.target.value === "" ? "" : fm.iwt(+e.target.value) })} /></label>
          <label className="field"><span className="field-label">Show trends for</span>
            <select className="input" value={st.range} onChange={(e) => up({ range: +e.target.value })}><option value="0">All time</option><option value="90">Last 90 days</option><option value="30">Last 30 days</option><option value="7">Last 7 days</option></select></label>
        </div>
        <div className="btn-row mt">
          <button type="button" className="btn btn--ghost" disabled={!logs.length} onClick={() => download("body-weather.json", JSON.stringify(logs, null, 2), "application/json")}>Export JSON</button>
          <button type="button" className="btn btn--ghost" disabled={!logs.length} onClick={() => exportCsv(logs)}>Download CSV</button>
          <label className="btn btn--ghost">Import JSON<input type="file" accept="application/json,.json" className="visually-hidden" onChange={imp} /></label>
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>Print report</button>
        </div>
      </details>

      <section className="panel mt bw-noprint">
        <h2 className="bw-h">{edit ? "Edit check-in" : "Today's check-in"}</h2>
        {edit && <p className="bw-editing">Editing the reading from {edit}. <button type="button" className="bw-del" onClick={() => setEdit(null)}>Cancel</button></p>}
        <div className="bw-sec">Body</div>
        <div className="bw-grid">
          <label className="field"><span className="field-label">Date</span><input className="input" type="date" value={f.date} onChange={set("date")} /></label>
          <label className="field"><span className="field-label">Sex</span>
            <select className="input" value={f.sex} onChange={set("sex")}><option value="female">Female</option><option value="male">Male</option></select>
          </label>
          {num(`Height (${fm.lu})`, "h", imp_ ? "67" : "170")}{num(`Weight (${fm.wu})`, "w", imp_ ? "154" : "70")}{num(`Waist (${fm.lu})`, "wa", imp_ ? "33" : "85", "At navel level")}
        </div>
        <div className="bw-sec">Blood sugar, mg/dL (optional)</div>
        <div className="bw-grid">{num("Fasting", "fa", "95", "Empty stomach, 8+ hours")}{num("After meal", "po", "130", "1.5 hours after eating")}</div>
        <div className="bw-sec">Blood pressure, mmHg (optional)</div>
        <div className="bw-grid">{num("Systolic (top)", "s", "120")}{num("Diastolic (bottom)", "d", "80")}</div>
        <div className="bw-sec">Lifestyle (optional)</div>
        <div className="bw-grid">
          {num("Sleep last night (hours)", "sl", "7.5")}
          <label className="field"><span className="field-label">Note</span><input className="input" type="text" maxLength={200} value={f.n} placeholder="Stress, travel, new medicine" onChange={set("n")} /></label>
        </div>
        <div className="btn-row mt"><button type="button" className="btn" onClick={add}>{edit ? "Save changes" : "Log this reading"}</button></div>
        {err && <p className="alert" role="alert">{err}</p>}
      </section>
      </div>

      {a && (
        <>
          <div className={pane("insights")}>
          <section className="panel mt">
            <h2 className="bw-h">Your forecast, last {Math.min(7, shown.length)} check-ins</h2>
            <Strip logs={shown} />
          </section>

          <div className="bw-ins mt">
            <section className={`panel panel--${a.bi.t}`}>
              <h2 className="bw-h">BMI</h2>
              <div className="bw-row"><span className="bw-big">{a.bmi.toFixed(1)}</span><Tag t={a.bi.t}>{a.bi.l}</Tag></div>
              <Scale v={a.bmi} min={15} max={40} segs={[[3.5, "amber"], [6.5, "moss"], [5, "amber"], [10, "rose"]]} />
              <span className="bw-hint">Under 18.5 · Healthy 18.5–24.9 · Overweight 25–29.9 · Obese 30+</span>
            </section>
            <section className={`panel panel--${a.wi.t}`}>
              <h2 className="bw-h">Waist check</h2>
              <div className="bw-row"><span className="bw-big">{fm.len(cur.wa).toFixed(0)}<small> {fm.lu}</small></span><Tag t={a.wi.t}>{a.wi.l}</Tag></div>
              <Scale v={a.wi.r} min={0.35} max={0.7} segs={[[15, "moss"], [10, "amber"], [10, "rose"]]} />
              <span className="bw-hint">Waist-to-height ratio {a.wi.r.toFixed(2)}; aim for under 0.50. Raised risk from {fm.len(a.wi.a).toFixed(0)} {fm.lu}, high from {fm.len(a.wi.b).toFixed(0)} {fm.lu}.</span>
            </section>
            <section className="panel">
              <h2 className="bw-h">Balance chart</h2>
              {a.ax.length >= 3 ? <Rose ax={a.ax} /> : <p className="bw-hint">Add blood sugar or blood pressure to your next check-in to see how your measurements balance.</p>}
              <span className="bw-hint">Each spoke is one measurement. The further it reaches, the healthier the reading.</span>
            </section>
            <section className="panel"><h2 className="bw-h">Weight goal</h2><Goal logs={logs} cur={cur} fm={fm} goal={goal} /></section>
            <section className="panel"><h2 className="bw-h">Energy and fuel</h2><Energy cur={cur} st={st} goal={goal} fm={fm} /></section>
            <section className="panel"><h2 className="bw-h">Estimates</h2><Est a={a} cur={cur} age={+st.age} /></section>
            <section className="panel"><h2 className="bw-h">What if?</h2><WhatIf cur={cur} fm={fm} base={a.score} /></section>
            <section className="panel bw-wide"><h2 className="bw-h">Your stamps</h2><Badges logs={logs} a={a} cur={cur} goal={goal} /></section>
            {(a.fa || a.po) && (
              <section className={`panel panel--${a.risk.t}`}>
                <h2 className="bw-h">Blood sugar</h2>
                <Tag t={a.risk.t}>{a.risk.l}</Tag>
                {a.fa && a.po && <div className="mt"><Curve fa={a.fa} po={a.po} /></div>}
                {a.fa && <p>Fasting {a.fa.v}: <Tag t={a.fa.t}>{a.fa.l}</Tag><span className="bw-hint">Normal under 100 · Prediabetes 100–125 · Diabetes 126+</span></p>}
                {a.po && <p>After meal {a.po.v}: <Tag t={a.po.t}>{a.po.l}</Tag><span className="bw-hint">Normal under 140 · Elevated 140–199 · Diabetes 200+. The standard test is at 2 hours, so 1.5-hour values run slightly higher.</span></p>}
                {a.fa && a.po && a.fa.p === 0 && a.po.p > 0 && <span className="bw-hint">Normal fasting with a high post-meal value is a common early pattern.</span>}
              </section>
            )}
            {a.bp && (
              <section className={`panel panel--${a.bp.t}`}>
                <h2 className="bw-h">Blood pressure</h2>
                <div className="bw-row">
                  <svg className={`bw-heart bw-heart--${a.bp.t}`} width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="var(--ink)" strokeWidth="1.2" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2 0 3.6 1 5.4 3 1.8-2 3.4-3 5.4-3 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z" /></svg>
                  <span className="bw-big">{a.bp.s}/{a.bp.d}</span><Tag t={a.bp.t}>{a.bp.ok ? "Healthy" : "Unhealthy"}</Tag>
                </div>
                <p>Category: <b>{a.bp.l}</b>. Healthy is below 120/80 mmHg.</p>
                {a.bp.l === "Hypertensive crisis" && <p className="alert">Dangerously high. Rest and recheck in 5 minutes. If it stays this high, or you have chest pain, breathlessness, severe headache or weakness, get emergency care now.</p>}
                {a.bp.l === "Low" && <p>Low readings can be normal, but see a doctor if you feel faint or dizzy.</p>}
              </section>
            )}
          </div>

          </div>
          <div className={pane("trends")}>
          <section className="panel mt"><h2 className="bw-h">Trends</h2><Trend logs={shown} fm={fm} goal={goal} /></section>
          <section className="panel mt"><h2 className="bw-h">What changed</h2><Delta logs={shown} fm={fm} a={a} /></section>
          <section className="panel mt"><h2 className="bw-h">What to do next</h2><ul className="bw-list">{tips(a, cur).map((t, i) => <li key={i}>{t}</li>)}</ul></section>

          </div>
          <div className={pane("journal")}>
          <section className="panel mt">
            <h2 className="bw-h">History</h2>
            <div className="bw-scroll">
              <table className="bw-table">
                <thead><tr><th>Date</th><th>Weight</th><th>BMI</th><th>Waist</th><th>Sugar</th><th>BP</th><th>Sleep</th><th>Note</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>
                  {[...logs].reverse().map((e) => (
                    <tr key={e.date}>
                      <td>{e.date}</td><td>{fm.wt(e.w).toFixed(1)} {fm.wu}</td><td>{bmiOf(e.w, e.h).toFixed(1)}</td><td>{fm.len(e.wa).toFixed(1)} {fm.lu}</td>
                      <td>{e.fa || "–"} / {e.po || "–"}</td><td>{e.s ? `${e.s}/${e.d}` : "–"}</td><td>{e.sl ? `${e.sl} h` : "–"}</td><td className="bw-note" title={e.n}>{e.n || "–"}</td>
                      <td className="bw-noprint">
                        <button type="button" className="bw-del" aria-label={`Edit reading from ${e.date}`} onClick={() => editRow(e)}>Edit</button>{" "}
                        <button type="button" className="bw-del" aria-label={`Delete reading from ${e.date}`} onClick={() => store(logs.filter((x) => x.date !== e.date))}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btn-row mt bw-noprint">
              <button type="button" className="btn btn--ghost" onClick={() => { if (confirmClear) { store([]); setConfirmClear(false); } else setConfirmClear(true); }}>
                {confirmClear ? "Tap again to delete all history" : "Clear all history"}
              </button>
            </div>
          </section>
          </div>
        </>
      )}
      <p className="bw-hint mt">Readings are saved only in this browser. This is a screening aid, not a diagnosis. Share your numbers with a doctor before making medical decisions.</p>
    </div>
  );
}