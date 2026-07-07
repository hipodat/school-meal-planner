import { NextResponse } from "next/server";
import { searchSchool } from "../../../lib/neis.js";

export async function GET(request) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "학교명을 입력하세요." }, { status: 400 });
  if (name.length > 50) {
    return NextResponse.json({ error: "학교명은 50자 이하로 입력하세요." }, { status: 400 });
  }
  try {
    const schools = await searchSchool(name);
    return NextResponse.json({ schools });
  } catch (e) {
    console.error("school lookup failed:", e);
    return NextResponse.json({ error: "학교 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
