"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, approved } = useAuth();

  // loading 상태 변화 추적
  useEffect(() => {
    console.log("🔄 AuthLayout loading 상태 변화:", loading);
  }, [loading]);

  // user 상태 변화 추적
  useEffect(() => {
    console.log(
      "🔄 AuthLayout user 상태 변화:",
      user
        ? {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          }
        : null
    );
  }, [user]);

  // approved 상태 변화 추적
  useEffect(() => {
    console.log("🔄 AuthLayout approved 상태 변화:", approved);
  }, [approved]);

  console.log("=== AuthLayout 상태 ===");
  console.log("loading:", loading);
  console.log(
    "user:",
    user
      ? {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        }
      : null
  );
  console.log("approved:", approved);

  if (loading) {
    console.log("⏳ 로그인 확인 중...");
    return <div className="p-6">⏳ 로그인 확인 중...</div>;
  }

  if (!user) {
    console.log("🔒 로그인이 필요합니다.");
    return <div className="p-6 text-red-600">🔒 로그인이 필요합니다.</div>;
  }

  if (!approved) {
    console.log("❌ 승인되지 않은 사용자입니다.");
    return (
      <div className="p-6 text-red-600">
        ❌ 승인되지 않은 사용자입니다. <br />
        🔔 <strong>관리자에게 승인 요청을 해주세요.</strong>
      </div>
    );
  }

  console.log("✅ 인증된 사용자 - 페이지 렌더링");
  return <>{children}</>;
}
