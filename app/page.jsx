"use client";
import React, { useState, useMemo, useEffect } from "react";
import { ALLERGENS } from "../lib/allergens.js";
import { analyzeNutrition, buildOrderSheet } from "../lib/analysis.js";
import { STANDARDS, GRADE_GROUPS, DEFAULT_GRADE } from "../lib/nutritionStandards.js";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, mo, d) => `${y}-${pad(mo + 1)}-${pad(d)}`;
const ymd = (dk) => dk.replaceAll("-", "");

function schoolDays(year, month) {
  const out = [];
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const wd = new Date(year, month, d).getDay();
    if (wd >= 1 && wd <= 5) out.push({ d, wd });
  }
  return out;
}
const allergensOf = (day) => {
  const s = new Set();
  (day?.dishes || []).forEach((x) => x.allergens.forEach((a) => s.add(a)));
  return [...s].sort((a, b) => a - b);
};

export default function Page() {
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), mo: today.getMonth() });
  const [school, setSchool] = useState(null); // {eduCode, schoolCode, name}
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [meals, setMeals] = useState({}); // dateKey -> {dishes,kcal,nutrition} (NEIS 실제 데이터)
  const [generated, setGenerated] = useState({}); // dateKey -> {dishes,kcal,...} (자동 편성 식단)
  const [genInfo, setGenInfo] = useState(null); // { closedDays:[], scheduleAvailable }
  const [genLoading, setGenLoading] = useState(false);
  const [edits, setEdits] = useState({}); // dateKey -> dishes[] (수정본; 로컬)
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState(null);
  const [highlight, setHighlight] = useState(new Set());
  const [showLegend, setShowLegend] = useState(false);
  const [headcount, setHeadcount] = useState(300); // 급식 인원
  const [grade, setGrade] = useState(DEFAULT_GRADE); // 학년군 (영양기준)
  const [panel, setPanel] = useState(null); // 'nutrition' | 'order' | 'students'
  const [students, setStudents] = useState([]); // [{name, allergens:[]}]
  const [showHelp, setShowHelp] = useState(false); // 사용법 (기본 접힘)
  const [deleted, setDeleted] = useState(() => new Set()); // 삭제한 날짜(dateKey) — 로컬 저장

  useEffect(() => {
    try {
      const raw = localStorage.getItem("deletedDays");
      if (raw) setDeleted(new Set(JSON.parse(raw)));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("deletedDays", JSON.stringify([...deleted])); } catch {}
  }, [deleted]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("allergyStudents");
      if (raw) setStudents(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("allergyStudents", JSON.stringify(students)); } catch {}
  }, [students]);

  const studentAllergens = useMemo(() => {
    const s = new Set();
    students.forEach((st) => (st.allergens || []).forEach((a) => s.add(a)));
    return s;
  }, [students]);

  const days = useMemo(() => schoolDays(ym.y, ym.mo), [ym]);
  const dayData = (dk) => {
    if (deleted.has(dk)) return null; // 삭제된 날은 급식 없음으로 표시
    const base = meals[dk] || generated[dk];
    if (edits[dk]) return { ...base, dishes: edits[dk] };
    return base;
  };

  async function findSchools() {
    if (!query.trim()) return;
    setResults([]); setMsg("");
    const r = await fetch(`/api/schools?name=${encodeURIComponent(query)}`);
    const j = await r.json();
    if (j.error) setMsg(j.error);
    else setResults(j.schools || []);
  }

  async function loadMeals() {
    if (!school) return;
    setLoading(true); setMsg("");
    const from = ymd(keyOf(ym.y, ym.mo, 1));
    const to = ymd(keyOf(ym.y, ym.mo, new Date(ym.y, ym.mo + 1, 0).getDate()));
    const r = await fetch(
      `/api/meals?eduCode=${school.eduCode}&schoolCode=${school.schoolCode}&from=${from}&to=${to}`
    );
    const j = await r.json();
    setLoading(false);
    if (j.error) { setMsg(j.error); setMeals({}); return; }
    setMeals(j.days || {});
    if (j.message) setMsg(j.message);
  }

  useEffect(() => { if (school) loadMeals(); /* eslint-disable-next-line */ }, [school, ym]);

  useEffect(() => {
    let ignore = false;
    if (!school) { setGenerated({}); setGenInfo(null); return; }
    const q = `year=${ym.y}&month=${ym.mo + 1}&eduCode=${school.eduCode}&schoolCode=${school.schoolCode}`;
    fetch(`/api/generate-menu?${q}`)
      .then((r) => r.json())
      .then((j) => {
        if (ignore) return;
        setGenerated(j.days || {});
        setGenInfo(j.generatedAt ? { closedDays: j.closedDays || [], scheduleAvailable: j.scheduleAvailable } : null);
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [ym, school]);

  async function generateMenu(regenerate = false) {
    if (!school) return;
    setGenLoading(true); setMsg("");
    try {
      const r = await fetch("/api/generate-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: ym.y, month: ym.mo + 1, regenerate,
          eduCode: school.eduCode, schoolCode: school.schoolCode,
        }),
      });
      const j = await r.json();
      setGenerated(j.days || {});
      setGenInfo({ closedDays: j.closedDays || [], scheduleAvailable: j.scheduleAvailable });
      clearMonthDeleted(); // 새로 편성하면 이 달의 삭제 표시 초기화
    } finally {
      setGenLoading(false);
    }
  }

  // 현재 월의 삭제 표시 제거
  const clearMonthDeleted = () => {
    const prefix = `${ym.y}-${pad(ym.mo + 1)}-`;
    setDeleted((p) => {
      const s = new Set([...p].filter((dk) => !dk.startsWith(prefix)));
      return s;
    });
  };

  // 일자별 삭제
  const deleteDay = (dk) => {
    setDeleted((p) => new Set(p).add(dk));
    setEdits((p) => { const n = { ...p }; delete n[dk]; return n; });
    setSelected(null);
  };

  // 한 달 전체 삭제 (현재 보이는 월의 모든 급식일 숨김)
  const deleteMonth = () => {
    if (!window.confirm(`${ym.y}년 ${ym.mo + 1}월 식단을 전체 삭제할까요? ('AI 식단 자동 생성'으로 다시 편성할 수 있습니다.)`)) return;
    setDeleted((p) => {
      const s = new Set(p);
      days.forEach(({ d }) => s.add(keyOf(ym.y, ym.mo, d)));
      return s;
    });
    setSelected(null);
  };

  const goMonth = (delta) => {
    let { y, mo } = ym; mo += delta;
    if (mo < 0) { mo = 11; y--; } if (mo > 11) { mo = 0; y++; }
    setYm({ y, mo }); setSelected(null);
  };
  const toggleHi = (n) => setHighlight((p) => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s; });

  // 추천: 이 달에 등장 빈도가 낮은/없는 메뉴 우선 (같은 요리명 기준)
  const recommend = () => {
    const count = {};
    Object.values(meals).forEach((day) =>
      (day?.dishes || []).forEach((x) => { count[x.name] = (count[x.name] || 0) + 1; })
    );
    return Object.entries(count).sort((a, b) => a[1] - b[1]).slice(0, 8);
  };

  const setDishes = (dk, dishes) => setEdits((p) => ({ ...p, [dk]: dishes }));

  // 삭제한 날을 제외한 생성 식단 (분석 대상)
  const visibleGenerated = useMemo(() => {
    if (!deleted.size) return generated;
    const out = {};
    for (const [k, v] of Object.entries(generated)) if (!deleted.has(k)) out[k] = v;
    return out;
  }, [generated, deleted]);

  // ① 영양기준 충족률 · ② 발주서/원가 (자동 생성 식단 기준)
  const nutritionResult = useMemo(() => analyzeNutrition(visibleGenerated, STANDARDS[grade]), [visibleGenerated, grade]);
  const orderResult = useMemo(() => buildOrderSheet(visibleGenerated, headcount), [visibleGenerated, headcount]);
  const perServing = useMemo(() => {
    const servings = headcount * orderResult.mealDays;
    return servings ? Math.round(orderResult.totalCost / servings) : 0;
  }, [orderResult, headcount]);

  // ③ 알레르기 학생별 이번 달 위험 급식일
  const studentConflicts = useMemo(() => {
    return students.map((st) => {
      const setA = new Set(st.allergens || []);
      const hits = [];
      days.forEach(({ d }) => {
        const dk = keyOf(ym.y, ym.mo, d);
        const dd = dayData(dk);
        const bad = (dd?.dishes || []).filter((x) => x.allergens.some((a) => setA.has(a)));
        if (bad.length) hits.push({ dk, d, dishes: bad.map((x) => x.name) });
      });
      return { student: st, hits };
    });
    // eslint-disable-next-line
  }, [students, meals, generated, edits, ym, days]);

  const applyStudentHighlight = () => { setHighlight(new Set(studentAllergens)); setPanel(null); };

  const exportOrderCSV = () => {
    const rows = [["식재료", "1인소요(g)", "총소요(kg)", "총소요(g)", "예상금액(원)"]];
    orderResult.rows.forEach((r) => rows.push([r.name, r.perPersonG, r.totalKg, r.totalG, r.cost]));
    rows.push(["합계", "", "", "", orderResult.totalCost]);
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `발주서_${school?.name || ""}_${ym.y}-${pad(ym.mo + 1)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const rows = [["날짜", "요일", "메뉴", "칼로리(kcal)", "알레르기"]];
    days.forEach(({ d, wd }) => {
      const dk = keyOf(ym.y, ym.mo, d); const dd = dayData(dk);
      if (!dd) return;
      rows.push([
        dk, WD[wd],
        (dd.dishes || []).map((x) => x.name).join(" / "),
        String(dd.kcal || ""),
        allergensOf(dd).map((a) => `${a}.${ALLERGENS[a]}`).join(" "),
      ]);
    });
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `급식식단표_${ym.y}-${pad(ym.mo + 1)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const C = getVars();
  const selData = selected ? dayData(selected) : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <style>{`
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .screen-only { display: none !important; }
          .print-only { display: block !important; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
      {/* 헤더 */}
      <header className="no-print" style={{ borderBottom: `1px solid ${C.line}`, background: C.surface }}>
        <div style={wrap()}>
          <b style={{ fontSize: 16 }}>🍚 급식 식단표 도우미</b>
          <span style={{ color: C.sub, fontSize: 13 }}>{school ? school.name : "학교 미선택"}</span>
          <div style={{ flex: 1 }} />
          <button className="no-print" onClick={() => setShowHelp((v) => !v)} style={btn(showHelp)}>❓ 사용법</button>
          <button className="no-print" onClick={() => setShowLegend((v) => !v)} style={btn(showLegend)}>알레르기 안내</button>
          <button className="no-print" onClick={() => window.print()} style={btn(false)}>인쇄·PDF</button>
          <button className="no-print" onClick={exportCSV} style={btn(false)}>엑셀(CSV)</button>
        </div>
        {showHelp && <HelpPanel C={C} onClose={() => setShowHelp(false)} />}
      </header>

      {/* 학교 검색 */}
      {!school && (
        <div style={{ ...wrap(), flexDirection: "column", alignItems: "stretch", gap: 12, paddingTop: 24 }}>
          <div style={{ fontSize: 14, color: C.sub }}>먼저 학교를 검색하세요. (나이스 등록 학교명)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findSchools()}
              placeholder="예: 서울○○초등학교"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 15 }} />
            <button onClick={findSchools} style={btn(true)}>검색</button>
          </div>
          {msg && <div style={{ color: C.red, fontSize: 13 }}>{msg}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map((s, i) => (
              <button key={i} onClick={() => { setSchool(s); setResults([]); }}
                style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.surface }}>
                <b>{s.name}</b> <span style={{ fontSize: 12, color: C.sub }}>{s.kind} · {s.eduName}</span>
                <div style={{ fontSize: 12, color: C.sub }}>{s.address}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {school && (
        <>
          {/* 알레르기 범례 */}
          {showLegend && (
            <div className="no-print" style={{ background: C.greenSoft, borderBottom: `1px solid ${C.greenLine}` }}>
              <div style={{ ...wrap(), flexWrap: "wrap", gap: 6 }}>
                {Object.entries(ALLERGENS).map(([n, name]) => {
                  const on = highlight.has(Number(n));
                  return (
                    <button key={n} onClick={() => toggleHi(Number(n))}
                      style={{ padding: "4px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                        border: `1px solid ${on ? C.red : C.line}`, background: on ? C.redSoft : C.surface, color: on ? C.red : C.ink }}>
                      <b>{n}</b> {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 월 네비 + 추천 */}
          <div style={{ ...wrap(), paddingTop: 16, paddingBottom: 4 }}>
            <button className="no-print" onClick={() => goMonth(-1)} style={nav()}>‹</button>
            <b style={{ fontSize: 20 }}>{ym.y}년 {ym.mo + 1}월</b>
            <button className="no-print" onClick={() => goMonth(1)} style={nav()}>›</button>
            <button className="no-print" onClick={() => setSchool(null)} style={{ ...btn(false), marginLeft: 8 }}>학교 변경</button>
            <div style={{ flex: 1 }} />
            {loading && <span style={{ color: C.sub, fontSize: 13 }}>불러오는 중…</span>}
            <button className="no-print" onClick={() => generateMenu(false)} disabled={genLoading} style={btn(true)}>
              {genLoading ? "생성 중…" : Object.keys(generated).length ? "AI 식단 다시 보기" : "AI 식단 자동 생성"}
            </button>
            {Object.keys(generated).length > 0 && (
              <button className="no-print" onClick={() => generateMenu(true)} disabled={genLoading} style={btn(false)}>재생성</button>
            )}
            {(Object.keys(generated).length > 0 || Object.keys(meals).length > 0) && (
              <button className="no-print" onClick={deleteMonth}
                style={{ ...btn(false), color: C.red, borderColor: C.redSoft }}>🗑️ 한달 전체 삭제</button>
            )}
          </div>
          {msg && <div style={{ ...wrap(), color: C.sub, fontSize: 13, paddingTop: 0 }}>{msg}</div>}
          {Object.keys(generated).length > 0 && (
            <div style={{ ...wrap(), flexDirection: "column", alignItems: "flex-start", color: C.amber, fontSize: 12.5, paddingTop: 0, paddingBottom: 8, gap: 3 }}>
              <div>🤖 실제 나이스 데이터가 없는 날짜는 계절·영양 균형을 고려해 자동 편성한 예상 식단(AI)으로 채워집니다. 실제 편성과 다를 수 있으니 참고용으로 확인 후 수정해 사용하세요.</div>
              {genInfo && (genInfo.scheduleAvailable
                ? <div style={{ color: C.green }}>📅 학사일정을 반영해 방학·휴업일·공휴일{genInfo.closedDays.length ? ` (${genInfo.closedDays.length}일)` : ""}은 자동으로 제외했습니다.</div>
                : <div style={{ color: C.sub }}>📅 이 학교의 학사일정이 아직 나이스에 등록되지 않아 방학 자동 제외는 적용되지 않았습니다. (주말·법정공휴일만 제외)</div>)}
            </div>
          )}

          {/* 영양교사 도구 툴바 */}
          <div className="no-print" style={{ ...wrap(), flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
            <label style={{ fontSize: 12.5, color: C.sub, display: "flex", alignItems: "center", gap: 5 }}>
              급식 인원
              <input type="number" min={1} value={headcount}
                onChange={(e) => setHeadcount(Math.max(1, Number(e.target.value) || 0))}
                style={{ width: 74, padding: "5px 7px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13 }} />명
            </label>
            <label style={{ fontSize: 12.5, color: C.sub, display: "flex", alignItems: "center", gap: 5 }}>
              영양기준
              <select value={grade} onChange={(e) => setGrade(e.target.value)}
                style={{ padding: "5px 7px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13 }}>
                {GRADE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <div style={{ flex: 1 }} />
            <button onClick={() => setPanel(panel === "nutrition" ? null : "nutrition")} style={btn(panel === "nutrition")}>🥗 영양분석</button>
            <button onClick={() => setPanel(panel === "order" ? null : "order")} style={btn(panel === "order")}>📦 발주서·원가</button>
            <button onClick={() => setPanel(panel === "students" ? null : "students")} style={btn(panel === "students")}>⚠️ 알레르기 관리{students.length ? ` (${students.length})` : ""}</button>
            <button onClick={() => window.print()} style={btn(false)}>🖨️ 가정통신문 PDF</button>
          </div>

          {panel === "nutrition" && (
            <NutritionPanel result={nutritionResult} grade={grade} C={C} onClose={() => setPanel(null)} />
          )}
          {panel === "order" && (
            <OrderPanel result={orderResult} headcount={headcount} perServing={perServing} onCSV={exportOrderCSV} C={C} onClose={() => setPanel(null)} />
          )}
          {panel === "students" && (
            <StudentsPanel students={students} setStudents={setStudents} conflicts={studentConflicts}
              onHighlight={applyStudentHighlight} C={C} onClose={() => setPanel(null)} />
          )}

          {/* 달력 */}
          <main className="screen-only" style={{ ...wrap(), display: "block" }}>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, margin: "8px 0" }}>
                  {["월", "화", "수", "목", "금"].map((w) => (
                    <div key={w} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: C.sub }}>{w}</div>
                  ))}
                </div>
                <Weeks days={days} ym={ym} dayData={dayData} highlight={highlight} onPick={setSelected} C={C} />
              </div>
            </div>

            {/* 추천 */}
            <div className="no-print" style={{ marginTop: 20, padding: 14, background: C.greenSoft, border: `1px solid ${C.greenLine}`, borderRadius: 12 }}>
              <b style={{ color: C.green, fontSize: 14 }}>✨ 이번 달 적게 나온 메뉴 (다음 편성 참고)</b>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {recommend().map(([name, c]) => (
                  <span key={name} style={{ fontSize: 13, background: C.surface, border: `1px solid ${C.greenLine}`, borderRadius: 20, padding: "4px 10px" }}>
                    {name} <span style={{ color: C.sub, fontSize: 11 }}>{c}회</span>
                  </span>
                ))}
                {recommend().length === 0 && <span style={{ color: C.sub, fontSize: 13 }}>데이터를 불러오면 표시됩니다.</span>}
              </div>
            </div>
          </main>

          {/* 가정통신문용 인쇄 전용 식단표 */}
          <PrintMenu school={school} ym={ym} days={days} dayData={dayData} C={C} />
        </>
      )}

      {/* 편집 시트 */}
      {selected && selData && (
        <DayEditor dateKey={selected} data={selData} highlight={highlight} C={C}
          onClose={() => setSelected(null)}
          onChange={(dishes) => setDishes(selected, dishes)}
          onDelete={() => deleteDay(selected)} />
      )}
    </div>
  );
}

function Weeks({ days, ym, dayData, highlight, onPick, C }) {
  const rows = []; let row = new Array(days.length ? days[0].wd - 1 : 0).fill(null);
  days.forEach((day) => { row.push(day); if (row.length === 5) { rows.push(row); row = []; } });
  if (row.length) { while (row.length < 5) row.push(null); rows.push(row); }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
          {r.map((day, ci) => day ? (
            <Cell key={ci} day={day} ym={ym} dayData={dayData} highlight={highlight} onPick={onPick} C={C} />
          ) : <div key={ci} />)}
        </div>
      ))}
    </div>
  );
}

function Cell({ day, ym, dayData, highlight, onPick, C }) {
  const dk = keyOf(ym.y, ym.mo, day.d);
  const dd = dayData(dk);
  const alls = allergensOf(dd);
  const flagged = alls.some((a) => highlight.has(a));
  return (
    <button onClick={() => dd && onPick(dk)}
      style={{ textAlign: "left", borderRadius: 12, padding: 9, minHeight: 132, background: C.surface,
        border: `1px solid ${flagged ? C.red : C.line}`, display: "flex", flexDirection: "column", gap: 5,
        opacity: dd ? 1 : 0.55 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <b style={{ fontSize: 14 }}>{day.d}</b>
          {dd?.generated && (
            <span style={{ fontSize: 9, fontWeight: 700, color: C.amber, background: C.amberSoft, borderRadius: 6, padding: "1px 4px" }}>AI</span>
          )}
        </span>
        {dd?.kcal ? <span style={{ fontSize: 10, fontWeight: 700, color: C.sub, background: C.steel, borderRadius: 6, padding: "1px 5px" }}>{dd.kcal}kcal</span> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(dd?.dishes || []).map((x, i) => {
          const hot = x.allergens.some((a) => highlight.has(a));
          return <div key={i} style={{ fontSize: 11.5, lineHeight: 1.25, color: hot ? C.red : C.ink, fontWeight: hot ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</div>;
        })}
        {!dd && <span style={{ fontSize: 11, color: C.sub }}>급식 없음</span>}
      </div>
      {alls.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: "auto" }}>
          {alls.slice(0, 9).map((a) => <Badge key={a} n={a} active={highlight.has(a)} C={C} />)}
        </div>
      )}
    </button>
  );
}

function DayEditor({ dateKey, data, highlight, onClose, onChange, onDelete, C }) {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const wd = WD[new Date(y, mo - 1, d).getDay()];
  const [text, setText] = useState("");
  const dishes = data.dishes || [];

  const removeAt = (i) => onChange(dishes.filter((_, x) => x !== i));
  const add = () => {
    const t = text.trim(); if (!t) return;
    const mm = t.match(/([\d.]+)\s*$/);
    const allergens = mm ? (mm[1].match(/\d{1,2}/g) || []).map(Number).filter((n) => n <= 19) : [];
    const name = mm ? t.slice(0, mm.index).trim() : t;
    onChange([...dishes, { name, allergens }]); setText("");
  };

  return (
    <div className="no-print" style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,30,25,.34)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto",
        background: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <b style={{ fontSize: 18 }}>{mo}월 {d}일 ({wd})</b>
            {data.generated && (
              <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, background: C.amberSoft, borderRadius: 8, padding: "2px 6px" }}>AI 추천 식단</span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => { if (window.confirm(`${mo}월 ${d}일 식단을 삭제할까요?`)) onDelete(); }}
              style={{ fontSize: 13, fontWeight: 600, padding: "6px 10px", borderRadius: 9, border: `1px solid ${C.redSoft}`, background: C.redSoft, color: C.red }}>🗑️ 이 날 삭제</button>
            <button onClick={onClose} style={{ ...nav(), border: "none" }}>✕</button>
          </div>
        </div>
        {data.kcal ? <div style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>총 {data.kcal} kcal{data.generated ? " (예상)" : ""}</div> : null}

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {dishes.map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px" }}>
              <b style={{ fontSize: 14 }}>{x.name}</b>
              <span style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {x.allergens.map((a) => <Badge key={a} n={a} active={highlight.has(a)} C={C} />)}
              </span>
              <div style={{ flex: 1 }} />
              <button onClick={() => removeAt(i)} style={{ color: C.red, background: "none", border: "none", fontSize: 13 }}>삭제</button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="메뉴 추가 (예: 닭갈비 5.6.15.)"
            style={{ flex: 1, padding: "9px 11px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 14 }} />
          <button onClick={add} style={btn(true)}>추가</button>
        </div>

        {data.nutrition?.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: C.sub, lineHeight: 1.7 }}>
            <b style={{ color: C.ink }}>영양정보</b><br />
            {data.nutrition.map((n) => `${n.label}: ${n.value}`).join("  ·  ")}
          </div>
        )}
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

function Badge({ n, active, C }) {
  return (
    <span title={`${n}. ${ALLERGENS[n]}`}
      style={{ fontSize: 10, minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px", fontWeight: 700,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: active ? C.redSoft : C.amberSoft, color: active ? C.red : C.amber,
        border: `1px solid ${active ? C.red : "transparent"}` }}>{n}</span>
  );
}

/* ① 영양기준 충족률 패널 */
function NutritionPanel({ result, grade, C, onClose }) {
  const barColor = (s) => (s === "low" ? C.red : s === "high" ? C.amber : C.green);
  const label = (s) => (s === "low" ? "부족" : s === "high" ? "과다" : "적정");
  return (
    <div className="no-print" style={panelBox(C)}>
      <PanelHead title={`🥗 영양기준 충족률 · ${grade}`} sub={`자동 생성 급식일 ${result.count}일 평균`} onClose={onClose} C={C} />
      {result.count === 0 ? (
        <div style={{ color: C.sub, fontSize: 13 }}>먼저 "AI 식단 자동 생성"으로 식단을 만들면 분석됩니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {result.rows.map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 64, fontSize: 13, fontWeight: 600 }}>{r.label}</div>
              <div style={{ width: 118, fontSize: 12, color: C.sub }}>{r.value}{r.unit} / {r.target}{r.unit}</div>
              <div style={{ flex: 1, height: 16, background: C.steel, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, r.pct)}%`, height: "100%", background: barColor(r.status) }} />
              </div>
              <div style={{ width: 92, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: barColor(r.status) }}>
                {r.pct}% {label(r.status)}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>
            ※ 기준: 학교급식법 시행규칙(예시값). 부족 항목은 관련 식재료 메뉴를 보강하세요.
          </div>
        </div>
      )}
    </div>
  );
}

/* ② 발주서·원가 패널 */
function OrderPanel({ result, headcount, perServing, onCSV, C, onClose }) {
  return (
    <div className="no-print" style={panelBox(C)}>
      <PanelHead title="📦 식재료 발주서 · 원가" sub={`${headcount}명 × 급식 ${result.mealDays}일 기준`} onClose={onClose} C={C}
        right={<button onClick={onCSV} style={btn(true)}>엑셀(CSV) 내보내기</button>} />
      {result.rows.length === 0 ? (
        <div style={{ color: C.sub, fontSize: 13 }}>먼저 "AI 식단 자동 생성"으로 식단을 만들면 발주량이 계산됩니다.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
            <Stat label="총 식재료비" value={`${result.totalCost.toLocaleString()}원`} C={C} />
            <Stat label="1식 단가" value={`${perServing.toLocaleString()}원`} C={C} />
            <Stat label="품목 수" value={`${result.rows.length}종`} C={C} />
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: C.steel, position: "sticky", top: 0 }}>
                  {["식재료", "1인(g)", "총 소요", "예상금액"].map((h) => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: h === "식재료" ? "left" : "right", color: C.sub }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.name} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: "6px 10px" }}>{r.name}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: C.sub }}>{r.perPersonG}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{r.totalKg}kg</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{r.cost.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>※ 단가는 예시값입니다. lib/ingredientPrices.js 에서 실제 계약단가로 교체하세요.</div>
        </>
      )}
    </div>
  );
}

/* ③ 알레르기 학생 관리 패널 */
function StudentsPanel({ students, setStudents, conflicts, onHighlight, C, onClose }) {
  const [name, setName] = useState("");
  const [picks, setPicks] = useState(new Set());
  const togglePick = (n) => setPicks((p) => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s; });
  const addStudent = () => {
    if (!name.trim() || picks.size === 0) return;
    setStudents([...students, { name: name.trim(), allergens: [...picks].sort((a, b) => a - b) }]);
    setName(""); setPicks(new Set());
  };
  const removeStudent = (i) => setStudents(students.filter((_, x) => x !== i));

  return (
    <div className="no-print" style={panelBox(C)}>
      <PanelHead title="⚠️ 알레르기 학생 관리" sub="학생별 알레르기를 등록하면 이번 달 위험 급식일을 표시합니다."
        onClose={onClose} C={C}
        right={students.length > 0 && <button onClick={onHighlight} style={btn(true)}>달력에 위험 메뉴 표시</button>} />

      {/* 등록 폼 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="학생 이름/번호 (예: 3-1 김철수)"
          style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, minWidth: 180 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {Object.entries(ALLERGENS).map(([n, an]) => {
            const on = picks.has(Number(n));
            return (
              <button key={n} onClick={() => togglePick(Number(n))}
                style={{ padding: "3px 8px", borderRadius: 16, fontSize: 11.5, fontWeight: 600,
                  border: `1px solid ${on ? C.red : C.line}`, background: on ? C.redSoft : C.surface, color: on ? C.red : C.ink }}>
                {n} {an}
              </button>
            );
          })}
        </div>
        <button onClick={addStudent} style={btn(true)}>학생 추가</button>
      </div>

      {/* 학생별 위험 급식일 */}
      {conflicts.length === 0 ? (
        <div style={{ color: C.sub, fontSize: 13 }}>등록된 학생이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {conflicts.map(({ student, hits }, i) => (
            <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", background: C.surface }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <b style={{ fontSize: 14 }}>{student.name}</b>
                <span style={{ display: "flex", gap: 3 }}>{student.allergens.map((a) => <Badge key={a} n={a} active C={C} />)}</span>
                <span style={{ fontSize: 12, color: hits.length ? C.red : C.green, fontWeight: 600 }}>
                  {hits.length ? `이번 달 ${hits.length}일 주의` : "이번 달 안전"}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={() => removeStudent(i)} style={{ color: C.red, background: "none", border: "none", fontSize: 12.5 }}>삭제</button>
              </div>
              {hits.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                  {hits.map((h) => (
                    <div key={h.dk}><b style={{ color: C.ink }}>{h.d}일</b> — {h.dishes.join(", ")}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ④ 가정통신문용 인쇄 전용 식단표 */
function PrintMenu({ school, ym, days, dayData, C }) {
  const usedAllergens = new Set();
  days.forEach(({ d }) => {
    const dd = dayData(keyOf(ym.y, ym.mo, d));
    (dd?.dishes || []).forEach((x) => x.allergens.forEach((a) => usedAllergens.add(a)));
  });
  return (
    <div className="print-only" style={{ padding: 8, color: "#000" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{school?.name} {ym.y}년 {ym.mo + 1}월 급식 식단표</div>
        <div style={{ fontSize: 11 }}>※ 숫자는 알레르기 유발식품 번호입니다. / 식단은 사정에 따라 변경될 수 있습니다.</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>{["월", "화", "수", "목", "금"].map((w) => (
            <th key={w} style={{ border: "1px solid #999", padding: 4, background: "#eee" }}>{w}</th>
          ))}</tr>
        </thead>
        <tbody>
          {chunkWeeks(days).map((row, ri) => (
            <tr key={ri}>
              {row.map((day, ci) => {
                if (!day) return <td key={ci} style={{ border: "1px solid #999", padding: 4, verticalAlign: "top", height: 96 }} />;
                const dd = dayData(keyOf(ym.y, ym.mo, day.d));
                return (
                  <td key={ci} style={{ border: "1px solid #999", padding: 4, verticalAlign: "top", height: 96 }}>
                    <div style={{ fontWeight: 700 }}>{day.d}일{dd?.kcal ? ` · ${dd.kcal}kcal` : ""}</div>
                    {(dd?.dishes || []).map((x, i) => (
                      <div key={i}>{x.name}{x.allergens.length ? ` ${x.allergens.join(".")}` : ""}</div>
                    ))}
                    {!dd && <div style={{ color: "#999" }}>급식 없음</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>
        <b>알레르기 유발식품:</b> {[...usedAllergens].sort((a, b) => a - b).map((a) => `${a}.${ALLERGENS[a]}`).join("  ")}
      </div>
    </div>
  );
}

function chunkWeeks(days) {
  const rows = []; let row = new Array(days.length ? days[0].wd - 1 : 0).fill(null);
  days.forEach((day) => { row.push(day); if (row.length === 5) { rows.push(row); row = []; } });
  if (row.length) { while (row.length < 5) row.push(null); rows.push(row); }
  return rows;
}

/* 사용법 안내 (기본 접힘) */
function HelpPanel({ C, onClose }) {
  const steps = [
    ["① 학교 선택", "학교명을 검색해 선택하면 해당 월 급식이 자동으로 표시됩니다. (나이스 등록 학교명 기준)"],
    ["② 월 이동 · AI 식단 자동 생성", "‹ › 로 월을 이동하고 'AI 식단 자동 생성'을 누르면, 실제 급식 데이터가 없는 미래 날짜를 계절·영양·인기 메뉴를 고려해 자동 편성합니다. 학사일정을 반영해 방학·휴업일·공휴일은 자동 제외됩니다. '재생성'으로 다시 뽑을 수 있습니다."],
    ["③ 메뉴 수정", "달력의 날짜를 클릭하면 그날 메뉴를 추가·삭제할 수 있습니다. (AI 배지는 자동 편성된 날)"],
    ["④ 급식 인원 · 영양기준 설정", "달력 위 툴바에서 급식 인원수와 학년군을 설정하면 아래 분석에 반영됩니다."],
    ["🥗 영양분석", "생성된 식단의 월평균 영양가를 학년군 기준과 비교해 충족률(부족/적정/과다)을 보여줍니다."],
    ["📦 발주서·원가", "인원수 기준 식재료 소요량·예상 식재료비·1식 단가를 계산하고 엑셀(CSV)로 내보냅니다."],
    ["⚠️ 알레르기 관리", "학생별 알레르기를 등록하면 이번 달 위험 급식일과 메뉴를 알려주고, 달력에 표시할 수 있습니다."],
    ["🖨️ 가정통신문 PDF", "학부모용 월간 식단표(알레르기 표기 포함)를 인쇄/PDF로 저장합니다."],
  ];
  return (
    <div style={{ background: C.greenSoft, borderTop: `1px solid ${C.greenLine}` }}>
      <div style={{ ...wrap(), flexDirection: "column", alignItems: "stretch", gap: 8, paddingTop: 12, paddingBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <b style={{ fontSize: 14, color: C.green }}>❓ 사용법</b>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ ...nav(), border: "none", width: 30, height: 30, background: "transparent" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
          {steps.map(([t, d]) => (
            <div key={t} style={{ background: C.surface, border: `1px solid ${C.greenLine}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 3 }}>{t}</div>
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: C.sub }}>
          ※ 영양가·식재료 단가는 예시값입니다. 실제 운영 시 담당자가 식품성분표·계약단가로 교체하면 정확한 수치가 산출됩니다.
        </div>
      </div>
    </div>
  );
}

function PanelHead({ title, sub, onClose, right, C }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div>
        <b style={{ fontSize: 15 }}>{title}</b>
        {sub && <div style={{ fontSize: 12, color: C.sub }}>{sub}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {right}
      <button onClick={onClose} style={{ ...nav(), border: "none", width: 32, height: 32 }}>✕</button>
    </div>
  );
}

function Stat({ label, value, C }) {
  return (
    <div style={{ background: C.greenSoft, border: `1px solid ${C.greenLine}`, borderRadius: 10, padding: "8px 14px" }}>
      <div style={{ fontSize: 11, color: C.sub }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.green }}>{value}</div>
    </div>
  );
}
const panelBox = (C) => ({ maxWidth: 1100, margin: "8px auto 0", padding: "16px", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14 });

/* helpers */
function getVars() {
  return {
    bg: "#FBFAF7", surface: "#FFFFFF", ink: "#1E2A23", sub: "#5C6B62", line: "#E7E4DC",
    green: "#3B7A57", greenSoft: "#EAF3ED", greenLine: "#CBE0D3", amber: "#B9770B",
    amberSoft: "#FBF0DA", red: "#C2453D", redSoft: "#F8E5E3", steel: "#F1F3F2",
  };
}
const wrap = () => ({ maxWidth: 1100, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 });
const btn = (a) => ({ fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 10,
  border: `1px solid ${a ? "#3B7A57" : "#E7E4DC"}`, background: a ? "#EAF3ED" : "#FFF", color: a ? "#3B7A57" : "#1E2A23" });
const nav = () => ({ width: 36, height: 36, borderRadius: 10, border: "1px solid #E7E4DC", background: "#FFF", fontSize: 18 });
