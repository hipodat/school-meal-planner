import { NextResponse } from "next/server";
import { searchSchool } from "../../../lib/neis.js";

export async function GET(request) {
  const name = request.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "학교명을 입력하세요." }, { status: 400 });
  try {
    const schools = await searchSchool(name);
    return NextResponse.json({ schools });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
