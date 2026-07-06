import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { generateMonthMenu } from "../../../lib/menuGenerator.js";
import { fetchClosedDays } from "../../../lib/neis.js";

const DIR = path.join(process.cwd(), "data", "generated-menus");

function pad(n) {
  return String(n).padStart(2, "0");
}

// 학교별로 방학이 다르므로 파일명에 학교코드를 포함한다.
function fileFor({ eduCode, schoolCode, year, month }) {
  const school = eduCode && schoolCode ? `${eduCode}-${schoolCode}` : "default";
  return path.join(DIR, `${school}_${year}-${pad(month)}.json`);
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

export async function GET(request) {
  const p = request.nextUrl.searchParams;
  const year = Number(p.get("year"));
  const month = Number(p.get("month"));
  const eduCode = p.get("eduCode");
  const schoolCode = p.get("schoolCode");
  if (!year || !month) {
    return NextResponse.json({ error: "year, month 파라미터가 필요합니다." }, { status: 400 });
  }
  const saved = await readSaved({ eduCode, schoolCode, year, month });
  return NextResponse.json(saved || { days: {}, generatedAt: null });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const year = Number(body.year);
  const month = Number(body.month);
  const eduCode = body.eduCode || null;
  const schoolCode = body.schoolCode || null;
  const regenerate = Boolean(body.regenerate);
  if (!year || !month) {
    return NextResponse.json({ error: "year, month 파라미터가 필요합니다." }, { status: 400 });
  }

  const args = { eduCode, schoolCode, year, month };

  if (!regenerate) {
    const saved = await readSaved(args);
    if (saved) return NextResponse.json(saved);
  }

  const { closed, available } = await loadClosedDays(args);
  // 재생성 시에는 매번 다른 시드로 새 식단을 만든다. 최초 생성은 연·월 고정 시드(재현 가능).
  const seed = regenerate ? Math.floor(Math.random() * 1e9) : undefined;
  const menu = generateMonthMenu({ year, month, excludeDates: closed, seed });
  menu.closedDays = closed;
  menu.scheduleAvailable = available;

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
