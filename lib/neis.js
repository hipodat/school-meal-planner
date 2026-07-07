import { parseDish, parseNutrition, parseKcal } from "./allergens.js";

const BASE = "https://open.neis.go.kr/hub";

function keyOrThrow() {
  const key = process.env.NEIS_KEY;
  if (!key) throw new Error("환경변수 NEIS_KEY 가 설정되어 있지 않습니다 (.env.local 확인).");
  return key;
}

// 학교명으로 학교 검색 → 코드 얻기
export async function searchSchool(name) {
  const url =
    `${BASE}/schoolInfo?KEY=${keyOrThrow()}&Type=json&pSize=20` +
    `&SCHUL_NM=${encodeURIComponent(name)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const rows = data?.schoolInfo?.[1]?.row || [];
  return rows.map((r) => ({
    eduCode: r.ATPT_OFCDC_SC_CODE,
    schoolCode: r.SD_SCHUL_CODE,
    name: r.SCHUL_NM,
    eduName: r.ATPT_OFCDC_SC_NM,
    address: r.ORG_RDNMA,
    kind: r.SCHUL_KND_SC_NM,
  }));
}

// 같은 교육청의 초등학교 목록을 가져온다. 실제 거리 계산 대신 교육청 권역을 "인근지역"으로 사용한다.
export async function fetchElementarySchoolsByOffice({ eduCode, limit = 8 }) {
  const url =
    `${BASE}/schoolInfo?KEY=${keyOrThrow()}&Type=json&pSize=100` +
    `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(eduCode)}` +
    `&SCHUL_KND_SC_NM=${encodeURIComponent("초등학교")}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const rows = data?.schoolInfo?.[1]?.row || [];
  return rows
    .filter((r) => String(r.SCHUL_KND_SC_NM || "").includes("초"))
    .slice(0, limit)
    .map((r) => ({
      eduCode: r.ATPT_OFCDC_SC_CODE,
      schoolCode: r.SD_SCHUL_CODE,
      name: r.SCHUL_NM,
      address: r.ORG_RDNMA,
    }));
}

// 학사일정 조회 → 휴업일(방학/재량휴업)·공휴일 날짜 집합 반환
// SBTR_DD_SC_NM(수업공제일명): "휴업일"(방학·토요휴업 등) / "공휴일" 이면 급식 없는 날.
export async function fetchClosedDays({ eduCode, schoolCode, from, to }) {
  const url =
    `${BASE}/SchoolSchedule?KEY=${keyOrThrow()}&Type=json&pSize=1000` +
    `&ATPT_OFCDC_SC_CODE=${eduCode}&SD_SCHUL_CODE=${schoolCode}` +
    `&AA_FROM_YMD=${from}&AA_TO_YMD=${to}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  // 데이터 없음 등: { RESULT: {...} } → 빈 집합 (조회 실패해도 생성은 계속되도록)
  if (data?.RESULT && !data?.SchoolSchedule) {
    return { closed: [], available: false };
  }

  const rows = data?.SchoolSchedule?.[1]?.row || [];
  const closed = new Set();
  for (const r of rows) {
    const kind = String(r.SBTR_DD_SC_NM || "").trim();
    if (kind === "휴업일" || kind === "공휴일") {
      const ymd = String(r.AA_YMD || "");
      if (ymd.length === 8) {
        closed.add(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`);
      }
    }
  }
  return { closed: [...closed], available: true };
}

// 급식 식단 조회 (기간). MMEAL: 1=조식 2=중식 3=석식 (기본 중식)
export async function fetchMeals({ eduCode, schoolCode, from, to, mmeal = "2" }) {
  const url =
    `${BASE}/mealServiceDietInfo?KEY=${keyOrThrow()}&Type=json&pSize=200` +
    `&ATPT_OFCDC_SC_CODE=${eduCode}&SD_SCHUL_CODE=${schoolCode}` +
    `&MLSV_FROM_YMD=${from}&MLSV_TO_YMD=${to}` +
    (mmeal ? `&MMEAL_SC_CODE=${mmeal}` : "");

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  // 데이터 없음 등: { RESULT: { CODE, MESSAGE } }
  if (data?.RESULT && !data?.mealServiceDietInfo) {
    return { days: {}, message: data.RESULT.MESSAGE || "데이터가 없습니다." };
  }

  const rows = data?.mealServiceDietInfo?.[1]?.row || [];
  const days = {};
  for (const r of rows) {
    const ymd = r.MLSV_YMD; // "20260701"
    const dateKey = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
    const dishes = String(r.DDISH_NM || "")
      .split(/<br\s*\/?>/i)
      .map((x) => x.trim())
      .filter(Boolean)
      .map(parseDish);
    days[dateKey] = {
      dishes,
      kcal: parseKcal(r.CAL_INFO),
      nutrition: parseNutrition(r.NTR_INFO),
      origin: r.ORPLC_INFO || "",
    };
  }
  return { days, message: null };
}
