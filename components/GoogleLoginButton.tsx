"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";
import { useState } from "react";

export default function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // Prevent duplicate requests if already loading
    if (isLoading) return;

    console.log("=== Google Login started ===");
    setIsLoading(true);

    try {
      console.log("Opening Google popup...");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      console.log("=== Google Login success ===");
      console.log("User info:", {
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
      console.error("=== Google Login failed ===");
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Full error object:", error);

      // 팝업 취소나 중복 요청은 일반적인 사용자 행동이므로 에러로 처리하지 않음
      if (
        error.code === "auth/cancelled-popup-request" ||
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/popup-blocked"
      ) {
        console.log("User cancelled login.");
        return;
      }

      // 기타 오류는 콘솔에 출력
      console.error("❌ Login failed:", error);
    } finally {
      setIsLoading(false);
      console.log("=== Google Login process completed ===");
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className=" px-4 py-1 rounded-xl font-bold hover:bg-secondary-light disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? "Loading..." : "Google Login"}
    </button>
  );
}
