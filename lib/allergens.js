// 식품의약품안전처 알레르기 유발식품 19종
export const ALLERGENS = {
  1: "난류", 2: "우유", 3: "메밀", 4: "땅콩", 5: "대두", 6: "밀", 7: "고등어",
  8: "게", 9: "새우", 10: "돼지고기", 11: "복숭아", 12: "토마토", 13: "아황산류",
  14: "호두", 15: "닭고기", 16: "쇠고기", 17: "오징어", 18: "조개류", 19: "잣",
};

// "감자채볶음1.5.10.13." / "닭갈비 (5.6.15.)" → { name, allergens:[...] }
export function parseDish(raw) {
  const s = String(raw).replace(/\s+/g, " ").trim();
  // 끝부분의 "숫자.숫자." 패턴(괄호 포함 가능)을 알레르기 번호로 추출
  const match = s.match(/[\s(]*((?:\d{1,2}\.?)+)\)?\s*$/);
  let name = s;
  let allergens = [];
  if (match) {
    const nums = (match[1].match(/\d{1,2}/g) || [])
      .map(Number)
      .filter((n) => n >= 1 && n <= 19);
    if (nums.length) {
      allergens = [...new Set(nums)].sort((a, b) => a - b);
      name = s.slice(0, match.index).trim();
    }
  }
  return { name, allergens };
}

// "탄수화물(g) : 100.5<br/>단백질(g) : 30.2..." → [{ label, value }]
export function parseNutrition(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/<br\s*\/?>/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [label, value] = p.split(":").map((x) => x.trim());
      return { label, value };
    });
}

// "601.5 Kcal" → 602
export function parseKcal(raw) {
  const n = parseFloat(String(raw || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}
