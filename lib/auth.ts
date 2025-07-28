// lib/auth.ts
import { getFirebaseAuth } from "./firebase-admin";
import { cookies } from "next/headers";

// export async function getUserFromToken(req: Request) {
export async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("__session")?.value;

    if (!token) return null;

    const decoded = await getFirebaseAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (err) {
    console.error("❌ Firebase 토큰 검증 실패:", err);
    return null;
  }
}
