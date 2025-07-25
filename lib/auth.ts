// lib/auth.ts
import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";

// export async function getUserFromToken(req: Request) {
export async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("__session")?.value;

    if (!token) return null;

    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (err) {
    console.error("❌ Firebase 토큰 검증 실패:", err);
    return null;
  }
}
