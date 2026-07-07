import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { generateMonthMenu } from "../../../lib/menuGenerator.js";
import { fetchClosedDays, fetchElementarySchoolsByOffice, fetchMeals } from "../../../lib/neis.js";
import { validateMenuParams } from "../../../lib/requestValidation.js";

const DIR = path.join(process.cwd(), "data", "generated-menus");
const RESOLVED_DIR = path.resolve(DIR);
const GENERATOR_VERSION = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateBuckets = new Map();

function pad(n) {
  return String(n).padStart(2, "0");
}

function clientKey(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function isRateLimited(key) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

// 학교별로 방학이 다르므로 파일명에 학교코드를 포함한다.
function fileFor({ eduCode, schoolCode, year, month }) {
  const school = eduCode && schoolCode ? `${eduCode}-${schoolCode}` : "default";
  const filePath = path.resolve(DIR, `${school}_${year}-${pad(month)}.json`);
  if (!filePath.startsWith(`${RESOLVED_DIR}${path.sep}`)) {
    throw new Error("Invalid generated menu path");
  }
  return filePath;
}

async function readSaved(args) {
  try {
    const buf = await fs.readFile(fileFor(args), "utf-8");
    return JSON.parse(buf);
  } catch {
    return null;
  }
}

async function loadClosedDays({ eduCode, schoolCode, year, month }) {
  if (!eduCode || !schoolCode) return { closed: [], available: false };
  const from = `${year}${pad(month)}01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}${pad(month)}${pad(last)}`;
  try {
    return await fetchClosedDays({ eduCode, schoolCode, from, to });
  } catch {
    return { closed: [], available: false };
  }
}

async function loadReferenceMeals({ eduCode, schoolCode, year, month }) {
  if (!eduCode || !schoolCode) return { schools: [], dishes: [] };

  try {
    const schools = await fetchElementarySchoolsByOffice({ eduCode, limit: 8 });
    const referenceSchools = schools.filter((s) => s.schoolCode !== schoolCode).slice(0, 5);

    async function collectForYear(referenceYear) {
      const from = `${referenceYear}${pad(month)}01`;
      const last = new Date(referenceYear, month, 0).getDate();
      const to = `${referenceYear}${pad(month)}${pad(last)}`;
      const mealResults = await Promise.all(
        referenceSchools.map(async (school) => {
          try {
            const result = await fetchMeals({ eduCode: school.eduCode, schoolCode: school.schoolCode, from, to });
            return { school, days: result.days || {} };
          } catch {
            return { school, days: {} };
          }
        })
      );

      const dishes = [];
      for (const { school, days } of mealResults) {
        for (const day of Object.values(days)) {
          for (const dish of day.dishes || []) {
            dishes.push({ ...dish, sourceSchool: school.name });
          }
        }
      }
      return dishes;
    }

    let referenceYear = year;
    let dishes = await collectForYear(referenceYear);
    let fallbackUsed = false;
    if (dishes.length === 0) {
      referenceYear = year - 1;
      dishes = await collectForYear(referenceYear);
      fallbackUsed = true;
    }

    return {
      schools: referenceSchools.map((s) => s.name),
      dishes,
      referenceYear,
      referenceMonth: month,
      fallbackUsed,
    };
  } catch {
    return { schools: [], dishes: [], referenceYear: year, referenceMonth: month, fallbackUsed: false };
  }
}

export async function GET(request) {
  const p = request.nextUrl.searchParams;
  const year = Number(p.get("year"));
  const month = Number(p.get("month"));
  const eduCode = p.get("eduCode");
  const schoolCode = p.get("schoolCode");
  const validationError = validateMenuParams({ year, month, eduCode, schoolCode });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const saved = await readSaved({ eduCode, schoolCode, year, month });
  if (saved?.generatorVersion >= GENERATOR_VERSION) return NextResponse.json(saved);
  return NextResponse.json({ days: {}, generatedAt: null });
}

export async function POST(request) {
  if (isRateLimited(clientKey(request))) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const year = Number(body.year);
  const month = Number(body.month);
  const eduCode = body.eduCode || null;
  const schoolCode = body.schoolCode || null;
  const regenerate = Boolean(body.regenerate);
  const validationError = validateMenuParams({ year, month, eduCode, schoolCode });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const args = { eduCode, schoolCode, year, month };

  if (!regenerate) {
    const saved = await readSaved(args);
    if (saved?.generatorVersion >= GENERATOR_VERSION) return NextResponse.json(saved);
  }

  const [{ closed, available }, reference] = await Promise.all([
    loadClosedDays(args),
    loadReferenceMeals(args),
  ]);
  // 재생성 시에는 매번 다른 시드로 새 식단을 만든다. 최초 생성은 연·월 고정 시드(재현 가능).
  const seed = regenerate ? Math.floor(Math.random() * 1e9) : undefined;
  const menu = generateMonthMenu({ year, month, excludeDates: closed, seed, referenceDishes: reference.dishes });
  menu.generatorVersion = GENERATOR_VERSION;
  menu.closedDays = closed;
  menu.scheduleAvailable = available;
  menu.referenceInfo = {
    schoolCount: reference.schools.length,
    dishCount: reference.dishes.length,
    schools: reference.schools,
    year: reference.referenceYear,
    month: reference.referenceMonth,
    fallbackUsed: reference.fallbackUsed,
  };

  // 파일 저장은 best-effort. 서버리스(읽기전용 FS) 환경에서도 앱이 죽지 않도록 한다.
  // 생성기가 연·월 시드 기반이라 저장이 없어도 동일 식단이 재생성된다.
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(fileFor(args), JSON.stringify(menu, null, 2), "utf-8");
  } catch (e) {
    console.warn("generated menu 저장 실패(무시):", e.message);
  }
  return NextResponse.json(menu);
}
