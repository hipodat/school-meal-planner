import { RICE, SOUP, MAIN, ONE_DISH, SIDE, KIMCHI, DESSERT, FIXED_HOLIDAYS, NUTRIENT_KEYS, NUTRIENT_UNITS } from "./menuData.js";

// 메뉴 항목 → 저장용 dish 객체 (영양가 n, 식재료 ing 포함)
function dishOf(item) {
  return {
    name: item.name,
    allergens: item.allergens || [],
    n: item.n || [],
    ing: item.ing || [],
    sourceSchool: item.sourceSchool,
    reference: Boolean(item.reference),
  };
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

function referenceItem(dish, category) {
  return {
    name: dish.name,
    allergens: dish.allergens || [],
    season: "all",
    protein: proteinOf(dish.name),
    n: defaultNutrition(category),
    ing: [],
    reference: true,
    sourceSchool: dish.sourceSchool,
  };
}

function defaultNutrition(category) {
  if (category === "rice") return [320, 6, 10, 1, 5, 0];
  if (category === "soup") return [80, 5, 45, 1.3, 25, 5];
  if (category === "main") return [260, 16, 35, 1.5, 35, 8];
  if (category === "oneDish") return [520, 15, 60, 2, 55, 8];
  if (category === "side") return [80, 4, 35, 1, 35, 8];
  if (category === "kimchi") return [20, 1, 35, 0.5, 25, 10];
  if (category === "dessert") return [90, 2, 45, 0.4, 25, 8];
  return [];
}

function proteinOf(name) {
  if (/닭|치킨/.test(name)) return "닭고기";
  if (/돼지|돈|제육|탕수육|햄|소시지/.test(name)) return "돼지고기";
  if (/소고기|쇠고기|불고기|갈비|너비아니|함박/.test(name)) return "소고기";
  if (/고등어|생선|삼치|임연수|갈치|코다리|가자미/.test(name)) return "생선";
  if (/오징어|새우|낙지|주꾸미|조개|해물/.test(name)) return "해산물";
  return "채소";
}

function categoryOf(name) {
  if (/김치|깍두기|소박이|겉절이/.test(name)) return "kimchi";
  if (/국|탕|찌개|스프/.test(name)) return "soup";
  if (/요구르트|요거트|우유|두유|주스|푸딩|젤리|과일|수박|참외|포도|사과|배|귤|바나나|아이스/.test(name)) return "dessert";
  if (/덮밥|비빔밥|볶음밥|카레|짜장|국수|우동|스파게티|파스타|마요/.test(name)) return "oneDish";
  if (/밥$/.test(name)) return "rice";
  if (/볶음|구이|조림|튀김|까스|찜|강정|스테이크|불고기|갈비|너겟|탕수육/.test(name)) return "main";
  if (/무침|나물|샐러드|묵|장아찌/.test(name)) return "side";
  return null;
}

function buildReferencePools(referenceDishes) {
  const pools = { rice: [], soup: [], main: [], oneDish: [], side: [], kimchi: [], dessert: [] };
  const seen = new Set();
  for (const dish of referenceDishes || []) {
    const name = String(dish.name || "").replace(/\s+/g, " ").trim();
    if (!name || name.length > 40 || seen.has(name)) continue;
    const category = categoryOf(name);
    if (!category) continue;
    seen.add(name);
    pools[category].push(referenceItem({ ...dish, name }, category));
  }
  return pools;
}

function mixReferencePool(basePool, referencePool, maxItems = 18) {
  const picked = referencePool.slice(0, maxItems);
  return [...basePool, ...picked, ...picked];
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

export function generateMonthMenu({ year, month, excludeDates = [], seed, referenceDishes = [] }) {
  const season = isSummerMonth(month) ? "summer" : "all";
  const excludeSet = new Set(excludeDates);
  const days = schoolWeekdays(year, month, excludeSet);
  // seed 미지정 시 연·월 기반 고정 시드(재현 가능). 재생성 시 다른 seed를 넘겨 다른 식단을 얻는다.
  const usedSeed = Number.isFinite(seed) ? seed : year * 100 + month;
  const rand = mulberry32(usedSeed);

  const refs = buildReferencePools(referenceDishes);
  const ricePool = mixReferencePool(weightedSeasonPool(RICE, season), refs.rice, 10);
  const soupPool = mixReferencePool(weightedSeasonPool(SOUP, season), refs.soup, 16);
  const mainPool = mixReferencePool(weightedSeasonPool(MAIN, season), refs.main, 20);
  const oneDishPool = mixReferencePool(weightedSeasonPool(ONE_DISH, season), refs.oneDish, 12);
  const sidePool = mixReferencePool(weightedSeasonPool(SIDE, season), refs.side, 18);
  const kimchiPool = mixReferencePool(weightedSeasonPool(KIMCHI, season), refs.kimchi, 8);
  const dessertPool = mixReferencePool(weightedSeasonPool(DESSERT, season), refs.dessert, 12);

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

  return {
    days: result,
    generatedAt: new Date().toISOString(),
    seed: usedSeed,
    referenceSummary: Object.fromEntries(Object.entries(refs).map(([key, values]) => [key, values.length])),
  };
}
