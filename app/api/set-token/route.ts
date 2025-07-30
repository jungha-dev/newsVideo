// app/api/set-token/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("=== set-token API call ===");

  try {
    const body = await req.json();
    const { token } = body;

    console.log("Token existence:", !!token);
    console.log("Token length:", token?.length);

    if (!token) {
      console.error("❌ Token is missing.");
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    console.log("Setting cookie...");
    const response = NextResponse.json({ success: true });

    // ✅ Setting cookie
    response.cookies.set("__session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 5, // 5 days
    });

    console.log("✅ Token cookie set successfully");
    console.log("Environment:", process.env.NODE_ENV);
    console.log("Cookie settings:", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 5,
    });

    return response;
  } catch (error) {
    console.error("❌ set-token API error:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
