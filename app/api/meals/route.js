import { NextResponse } from "next/server";
import { fetchMeals } from "../../../lib/neis.js";

export async function GET(request) {
  const p = request.nextUrl.searchParams;
  const eduCode = p.get("eduCode");
  const schoolCode = p.get("schoolCode");
  const from = p.get("from"); // YYYYMMDD
  const to = p.get("to");
  if (!eduCode || !schoolCode || !from || !to) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }
  try {
    const result = await fetchMeals({ eduCode, schoolCode, from, to });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
