"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, approved } = useAuth();

  if (loading) {
    return <div className="p-6">⏳ 로그인 확인 중...</div>;
  }

  if (!user) {
    return <div className="p-6 text-red-600">🔒 로그인이 필요합니다.</div>;
  }

  if (!approved) {
    return (
      <div className="p-6 text-red-600">
        ❌ 승인되지 않은 사용자입니다. <br />
        🔔 <strong>관리자에게 승인 요청을 해주세요.</strong>
      </div>
    );
  }

  return <>{children}</>;
}
