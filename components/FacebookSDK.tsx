"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

export default function FacebookSDK() {
  useEffect(() => {
    // Facebook SDK가 이미 로드되어 있는지 확인
    if (window.FB) {
      return;
    }

    // Facebook SDK 초기화 함수
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "",
        cookie: true,
        xfbml: true,
        version: "v23.0",
      });

      // 페이지 뷰 이벤트 로깅
      window.FB.AppEvents.logPageView();
    };

    // Facebook SDK 스크립트 로드
    const loadFacebookSDK = () => {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";

      document.head.appendChild(script);
    };

    loadFacebookSDK();

    // 컴포넌트 언마운트 시 정리
    return () => {
      const existingScript = document.getElementById("facebook-jssdk");
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return null; // 이 컴포넌트는 UI를 렌더링하지 않음
}
