// app/api/set-token/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("=== set-token API 호출 ===");

  try {
    const body = await req.json();
    const { token } = body;

    console.log("토큰 존재 여부:", !!token);
    console.log("토큰 길이:", token?.length);

    if (!token) {
      console.error("❌ 토큰이 없습니다.");
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    console.log("쿠키 설정 중...");
    const response = NextResponse.json({ success: true });

    // ✅ 쿠키 설정
    response.cookies.set("__session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 5, // 5일
    });

    console.log("✅ 토큰 쿠키 설정 완료");
    console.log("환경:", process.env.NODE_ENV);
    console.log("쿠키 설정:", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 5,
    });

    return response;
  } catch (error) {
    console.error("❌ set-token API 오류:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
