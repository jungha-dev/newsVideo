"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";
import { useState } from "react";

export default function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // 이미 로딩 중이면 중복 요청 방지
    if (isLoading) return;

    setIsLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
    } catch (error: any) {
      // 팝업 취소나 중복 요청은 일반적인 사용자 행동이므로 에러로 처리하지 않음
      if (
        error.code === "auth/cancelled-popup-request" ||
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/popup-blocked"
      ) {
        return;
      }

      // 기타 오류는 콘솔에 출력
      console.error("❌ 로그인 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className="bg-primary/90 text-white px-4 py-1 rounded-xl hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? "로그인 중..." : "Google 로그인"}
    </button>
  );
}
