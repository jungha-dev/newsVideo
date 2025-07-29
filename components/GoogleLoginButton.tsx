"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";
import { useState } from "react";

export default function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // 이미 로딩 중이면 중복 요청 방지
    if (isLoading) return;

    console.log("=== Google 로그인 시작 ===");
    setIsLoading(true);

    try {
      console.log("Google 팝업 열기 중...");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      console.log("=== Google 로그인 성공 ===");
      console.log("사용자 정보:", {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        providerData: user.providerData,
      });

      console.log("Provider Data 상세:", user.providerData);

      // Google 제공자 정보 확인
      const googleProvider = user.providerData.find(
        (provider) => provider.providerId === "google.com"
      );
      console.log("Google Provider Info:", googleProvider);
    } catch (error: any) {
      console.error("=== Google 로그인 실패 ===");
      console.error("에러 코드:", error.code);
      console.error("에러 메시지:", error.message);
      console.error("전체 에러 객체:", error);

      // 팝업 취소나 중복 요청은 일반적인 사용자 행동이므로 에러로 처리하지 않음
      if (
        error.code === "auth/cancelled-popup-request" ||
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/popup-blocked"
      ) {
        console.log("사용자가 로그인을 취소했습니다.");
        return;
      }

      // 기타 오류는 콘솔에 출력
      console.error("❌ 로그인 실패:", error);
    } finally {
      setIsLoading(false);
      console.log("=== Google 로그인 프로세스 완료 ===");
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
