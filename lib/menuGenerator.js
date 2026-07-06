import { RICE, SOUP, MAIN, ONE_DISH, SIDE, KIMCHI, DESSERT, FIXED_HOLIDAYS, NUTRIENT_KEYS, NUTRIENT_UNITS } from "./menuData.js";

// 메뉴 항목 → 저장용 dish 객체 (영양가 n, 식재료 ing 포함)
function dishOf(item) {
  return { name: item.name, allergens: item.allergens, n: item.n || [], ing: item.ing || [] };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function isSummerMonth(month) {
  // month: 1~12
  return month >= 6 && month <= 8;
}

function schoolWeekdays(year, month, excludeSet) {
  // month: 1~12. excludeSet: "YYYY-MM-DD" 형식의 방학·휴업·공휴일 집합
  const last = new Date(year, month, 0).getDate();
  const out = [];
  for (let d = 1; d <= last; d++) {
    const wd = new Date(year, month - 1, d).getDay();
    const mmdd = `${pad(month)}-${pad(d)}`;
    const dateKey = `${year}-${pad(month)}-${pad(d)}`;
    if (wd >= 1 && wd <= 5 && !FIXED_HOLIDAYS.has(mmdd) && !excludeSet.has(dateKey)) {
      out.push(d);
    }
  }
  return out;
}

function weightedSeasonPool(list, season) {
  // 계절 재료를 우대하되, 목록이 부족해지지 않도록 전체 후보를 유지하고
  // 계절 일치 항목의 가중치만 3배로 늘린다.
  const pool = [];
  list.forEach((item) => {
    const weight = item.season === season || item.season === "all" ? (item.season === season ? 3 : 1) : 1;
    for (let i = 0; i < weight; i++) pool.push(item);
  });
  return pool;
}

function pickAvoiding(pool, recentNames, recentWindow, rand) {
  const candidates = pool.filter((x) => !recentNames.slice(-recentWindow).includes(x.name));
  const from = candidates.length ? candidates : pool;
  return from[Math.floor(rand() * from.length)];
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMonthMenu({ year, month, excludeDates = [] }) {
  const season = isSummerMonth(month) ? "summer" : "all";
  const excludeSet = new Set(excludeDates);
  const days = schoolWeekdays(year, month, excludeSet);
  const rand = mulberry32(year * 100 + month);

  const ricePool = weightedSeasonPool(RICE, season);
  const soupPool = weightedSeasonPool(SOUP, season);
  const mainPool = weightedSeasonPool(MAIN, season);
  const oneDishPool = weightedSeasonPool(ONE_DISH, season);
  const sidePool = weightedSeasonPool(SIDE, season);
  const kimchiPool = weightedSeasonPool(KIMCHI, season);
  const dessertPool = weightedSeasonPool(DESSERT, season);

  const recentMain = [];
  const recentProtein = [];
  const recentRice = [];
  const recentSoup = [];
  const recentSide = [];
  const recentKimchi = [];

  const result = {};

  days.forEach((d, idx) => {
    const dateKey = `${year}-${pad(month)}-${pad(d)}`;
    const weekday = new Date(year, month - 1, d).getDay(); // 1=월 ... 5=금
    const isOneDish = rand() < 0.2;

    const dishes = [];

    const kimchi = pickAvoiding(kimchiPool, recentKimchi, 2, rand);
    const side = pickAvoiding(sidePool, recentSide, 3, rand);
    const soup = pickAvoiding(soupPool, recentSoup, 3, rand);

    if (isOneDish) {
      // 단백질 다양성: 최근 3일과 같은 계열이면 다시 뽑는다(최대 5회 시도).
      let dish = pickAvoiding(oneDishPool, recentMain, 5, rand);
      for (let tries = 0; tries < 5 && recentProtein.slice(-2).includes(dish.protein); tries++) {
        dish = oneDishPool[Math.floor(rand() * oneDishPool.length)];
      }
      dishes.push(dishOf(dish));
      recentMain.push(dish.name);
      recentProtein.push(dish.protein);
    } else {
      const rice = pickAvoiding(ricePool, recentRice, 3, rand);
      let main = pickAvoiding(mainPool, recentMain, 6, rand);
      for (let tries = 0; tries < 5 && recentProtein.slice(-2).includes(main.protein); tries++) {
        main = mainPool[Math.floor(rand() * mainPool.length)];
      }
      dishes.push(dishOf(rice));
      dishes.push(dishOf(main));
      recentRice.push(rice.name);
      recentMain.push(main.name);
      recentProtein.push(main.protein);
    }

    dishes.push(dishOf(soup));
    dishes.push(dishOf(side));
    dishes.push(dishOf(kimchi));
    recentSoup.push(soup.name);
    recentSide.push(side.name);
    recentKimchi.push(kimchi.name);

    // 금요일 또는 여름철 40% 확률로 후식 추가
    const wantsDessert = weekday === 5 || rand() < (season === "summer" ? 0.4 : 0.25);
    if (wantsDessert) {
      const dessert = dessertPool[Math.floor(rand() * dessertPool.length)];
      dishes.push(dishOf(dessert));
    }

    // 실제 영양가(n) 합산으로 열량·영양정보 산출
    const totals = NUTRIENT_KEYS.map((_, i) => dishes.reduce((s, x) => s + (x.n[i] || 0), 0));
    const nutrition = NUTRIENT_KEYS.map((label, i) => ({
      label,
      value: `${Math.round(totals[i] * 10) / 10}${NUTRIENT_UNITS[i]}`,
    }));

    result[dateKey] = {
      dishes,
      kcal: Math.round(totals[0]),
      nutrition,
      totals, // 분석용 원시 합계
      origin: "",
      generated: true,
    };
  });

  return { days: result, generatedAt: new Date().toISOString() };
}
