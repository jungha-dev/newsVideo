"use client";

import { useState } from "react";
import { signInWithPopup, FacebookAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function FacebookLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleFacebookLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new FacebookAuthProvider();

      // 이메일 권한을 명시적으로 요청
      provider.addScope("email");
      provider.addScope("public_profile");

      // Facebook Graph API를 통해 추가 정보 요청
      provider.setCustomParameters({
        fields: "id,name,email,picture",
      });

      const result = await signInWithPopup(auth, provider);

      // 로그인 성공 후 상세한 사용자 정보 확인
      console.log("=== Facebook 로그인 성공 ===");
      console.log("전체 result 객체:", result);
      console.log("사용자 객체:", result.user);
      console.log("result.user.email:", result.user.email);
      console.log("result.email:", (result as any).email);
      console.log("이름:", result.user.displayName);
      console.log("프로필 사진:", result.user.photoURL);
      console.log("UID:", result.user.uid);
      console.log("Provider Data:", result.user.providerData);

      // Facebook 제공자 정보 확인
      const facebookProvider = result.user.providerData.find(
        (provider) => provider.providerId === "facebook.com"
      );
      console.log("Facebook Provider Info:", facebookProvider);

      // providerData에서 이메일 찾기
      const emailFromProvider = facebookProvider?.email;
      console.log("Provider에서 가져온 이메일:", emailFromProvider);

      // 여러 방법으로 이메일 확인
      const possibleEmails = [
        result.user.email,
        (result as any).email,
        emailFromProvider,
        facebookProvider?.email,
        result.user.providerData[0]?.email,
      ].filter(Boolean);

      console.log("가능한 이메일들:", possibleEmails);

      // 이메일이 없는 경우 경고
      if (possibleEmails.length === 0) {
        console.warn("⚠️ Facebook에서 이메일을 가져오지 못했습니다!");
        console.log("사용 가능한 정보:", {
          user: result.user,
          providerData: result.user.providerData,
        });
        alert(
          "Facebook에서 이메일 정보를 가져오지 못했습니다.\n\n해결 방법:\n1. Facebook 계정 설정에서 이메일 공유 허용\n2. Facebook 앱에서 이메일 권한 확인\n3. Facebook 계정에 실제 이메일 주소 등록"
        );
      } else {
        console.log("✅ 이메일을 성공적으로 가져왔습니다:", possibleEmails[0]);
        alert(`Facebook 로그인 성공!\n이메일: ${possibleEmails[0]}`);
      }
    } catch (error: any) {
      console.error("Facebook 로그인 실패:", error);

      if (error.code === "auth/popup-closed-by-user") {
        alert("로그인이 취소되었습니다.");
      } else if (error.code === "auth/unauthorized-domain") {
        alert("현재 도메인에서 로그인이 허용되지 않습니다.");
      } else if (
        error.code === "auth/account-exists-with-different-credential"
      ) {
        const email = error.customData?.email;
        alert(
          `${email}로 가입된 계정이 있습니다.\n\n` +
            `해결 방법:\n` +
            `1. Google 로그인으로 기존 계정에 접속\n` +
            `2. 다른 이메일로 Facebook 가입\n` +
            `3. 기존 계정 삭제 후 Facebook으로 재가입`
        );
      } else {
        alert("Facebook 로그인에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleFacebookLogin}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      )}
      <span className="text-sm font-medium">
        {isLoading ? "로그인 중..." : "Facebook 로그인"}
      </span>
    </button>
  );
}
