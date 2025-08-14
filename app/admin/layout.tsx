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
    <div className="min-h-screen">
      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-8 px-6">{children}</main>
    </div>
  );
}
