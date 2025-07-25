// app/api/set-token/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token } = await req.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });

  // ✅ 쿠키 설정
  response.cookies.set("__session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 5, // 5일
  });

  return response;
}
