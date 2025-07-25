import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getUserFromToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = user.uid;

    // 사용자의 연결된 영상 프로젝트 목록 가져오기
    const projectsRef = db
      .collection("users")
      .doc(uid)
      .collection("connectedVideo");
    const snapshot = await projectsRef.get();

    // 클라이언트에서 정렬 (인덱스 없이 작동)
    const projects = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.() || doc.data().created_at,
        updated_at: doc.data().updated_at?.toDate?.() || doc.data().updated_at,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // 최신순 정렬
      });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
