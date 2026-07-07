import { NextResponse } from "next/server";
import { fetchMeals } from "../../../lib/neis.js";
import { isValidEduCode, isValidSchoolCode, isValidYmdDate } from "../../../lib/requestValidation.js";

export async function GET(request) {
  const p = request.nextUrl.searchParams;
  const eduCode = p.get("eduCode");
  const schoolCode = p.get("schoolCode");
  const from = p.get("from"); // YYYYMMDD
  const to = p.get("to");
  if (!eduCode || !schoolCode || !from || !to) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }
  if (!isValidEduCode(eduCode) || !isValidSchoolCode(schoolCode) || !isValidYmdDate(from) || !isValidYmdDate(to)) {
    return NextResponse.json({ error: "파라미터 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "조회 시작일은 종료일보다 늦을 수 없습니다." }, { status: 400 });
  }
  try {
    const result = await fetchMeals({ eduCode, schoolCode, from, to });
    return NextResponse.json(result);
  } catch (e) {
    console.error("meal lookup failed:", e);
    return NextResponse.json({ error: "급식 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
