import { NUTRIENT_KEYS, NUTRIENT_UNITS } from "./menuData.js";
import { priceOf } from "./ingredientPrices.js";

// 자동 생성 식단(각 dish에 n, ing 포함)만 분석 대상. 실제 NEIS 데이터는 식재료 정보가 없어 제외.
function analyzableDays(daysMap) {
  return Object.entries(daysMap)
    .filter(([, v]) => v && v.generated && (v.dishes || []).some((x) => x.ing || x.n))
    .map(([k, v]) => ({ dateKey: k, ...v }));
}

// 월 평균 영양가 + 학년군 기준 대비 충족률
export function analyzeNutrition(daysMap, standard) {
  const days = analyzableDays(daysMap);
  const count = days.length;
  const sums = NUTRIENT_KEYS.map(() => 0);
  days.forEach((day) => {
    const t = day.totals || NUTRIENT_KEYS.map((_, i) => (day.dishes || []).reduce((s, x) => s + ((x.n || [])[i] || 0), 0));
    t.forEach((v, i) => { sums[i] += v; });
  });
  const avg = sums.map((s) => (count ? s / count : 0));
  const rows = NUTRIENT_KEYS.map((label, i) => {
    const value = Math.round(avg[i] * 10) / 10;
    const target = standard[i];
    const pct = target ? Math.round((value / target) * 100) : 0;
    // 열량·단백질은 90~110%, 그 외는 90% 이상 권장. 과다(>150%)도 표시.
    let status = "ok";
    if (pct < 90) status = "low";
    else if (pct > (i <= 1 ? 110 : 150)) status = "high";
    return { label, unit: NUTRIENT_UNITS[i], value, target, pct, status };
  });
  return { count, rows };
}

// 발주서: 식재료별 총 소요량(g/kg) + 원가
export function buildOrderSheet(daysMap, headcount) {
  const days = analyzableDays(daysMap);
  const totals = {}; // 재료명 -> 총 g (1인 기준 합계)
  days.forEach((day) => {
    (day.dishes || []).forEach((dish) => {
      (dish.ing || []).forEach(([name, grams]) => {
        totals[name] = (totals[name] || 0) + grams;
      });
    });
  });
  const rows = Object.entries(totals)
    .map(([name, perPerson]) => {
      const totalG = perPerson * headcount;
      const unitPrice = priceOf(name);
      return {
        name,
        perPersonG: Math.round(perPerson * 10) / 10,
        totalKg: Math.round((totalG / 1000) * 100) / 100,
        totalG: Math.round(totalG),
        cost: Math.round(totalG * unitPrice),
      };
    })
    .sort((a, b) => b.cost - a.cost);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  return { rows, totalCost, mealDays: days.length };
}

// 1식 단가(1인 1식 평균 원가)
export function costPerServing(daysMap, headcount) {
  const { rows, mealDays } = buildOrderSheet(daysMap, headcount);
  const total = rows.reduce((s, r) => s + r.cost, 0);
  const servings = headcount * mealDays;
  return servings ? Math.round(total / servings) : 0;
}
