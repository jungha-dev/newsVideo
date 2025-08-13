"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role === "superadmin") {
            setAuthorized(true);
          } else {
            alert("관리자 권한이 필요합니다.");
            router.push("/");
          }
        } else {
          alert("등록된 사용자가 아닙니다.");
          router.push("/");
        }
      } catch (error) {
        console.error("권한 확인 중 오류:", error);
        alert("권한 확인 중 오류가 발생했습니다.");
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 관리자 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                관리자 대시보드
              </h1>
              <p className="text-sm text-gray-600">시스템 관리 및 모니터링</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                관리자: {user?.email}
              </span>
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                onClick={() => router.push("/")}
              >
                메인으로
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            <Link
              href="/admin/users"
              className="py-4 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              사용자 관리
            </Link>
            <Link
              href="/admin/videos"
              className="py-4 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              영상 관리
            </Link>
          </nav>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-6">{children}</main>
    </div>
  );
}
