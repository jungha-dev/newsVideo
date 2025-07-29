// contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc, enableNetwork } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  approved: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  approved: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);

  // 사용자 정보를 Firestore에 저장하는 함수
  const saveUserToFirestore = async (firebaseUser: User) => {
    try {
      console.log("=== 사용자 정보 저장 시작 ===");
      console.log("사용자 UID:", firebaseUser.uid);
      console.log("사용자 이메일:", firebaseUser.email);
      console.log("사용자 이름:", firebaseUser.displayName);
      console.log("사용자 프로필 사진:", firebaseUser.photoURL);

      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      const now = new Date();

      // 사용자가 이미 존재하지 않는 경우에만 저장
      if (!userSnap.exists()) {
        console.log("새 사용자 - Firestore에 저장");
        const userData = {
          email: firebaseUser.email,
          name:
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0] ||
            "사용자",
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          createdAt: now,
          lastLoginAt: now,
          updatedAt: now,
          approved: false, // 기본적으로 승인되지 않음
          role: "user", // 기본 역할
        };

        await setDoc(userRef, userData);
        console.log("✅ 새 사용자 정보 저장 완료");
      } else {
        console.log("기존 사용자 - 로그인 시간 업데이트");
        // 기존 사용자의 경우 마지막 로그인 시간과 업데이트 시간만 업데이트
        const updateData = {
          lastLoginAt: now,
          updatedAt: now,
        };

        await setDoc(userRef, updateData, { merge: true });
        console.log("✅ 기존 사용자 정보 업데이트 완료");
      }
    } catch (error) {
      console.error("❌ 사용자 정보 저장 중 오류:", error);
      console.error("오류 상세:", {
        code: (error as any)?.code,
        message: (error as any)?.message,
        stack: (error as any)?.stack,
      });
    }
  };

  useEffect(() => {
    console.log("=== AuthContext 초기화 ===");
    console.log("Firebase Auth 객체:", auth);
    console.log("현재 Auth 상태:", auth.currentUser);
    console.log("Auth 초기화 상태:", (auth as any)._isInitialized);

    // Firebase Auth가 초기화되었는지 확인
    if (!auth) {
      console.error("❌ Firebase Auth가 초기화되지 않았습니다!");
      setLoading(false);
      return;
    }

    // Firestore 온라인 연결 강제 활성화
    const enableFirestoreNetwork = async () => {
      try {
        console.log("Firestore 온라인 연결 활성화 시도...");
        await enableNetwork(db);
        console.log("✅ Firestore 온라인 연결 활성화 완료");
      } catch (error) {
        console.error("❌ Firestore 온라인 연결 활성화 실패:", error);
      }
    };

    // Firebase Auth 초기화 강제 완료 시도
    const forceAuthInitialization = async () => {
      try {
        console.log("Firebase Auth 초기화 강제 완료 시도...");

        // Firestore 온라인 연결 활성화
        await enableFirestoreNetwork();

        // 현재 사용자 상태 확인
        const currentUser = auth.currentUser;
        console.log(
          "현재 사용자:",
          currentUser
            ? {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
              }
            : null
        );

        // Auth 초기화가 완료될 때까지 대기
        if ((auth as any)._initializationPromise) {
          console.log("Auth 초기화 Promise 대기 중...");
          await (auth as any)._initializationPromise;
          console.log("✅ Auth 초기화 완료");
        }

        // Persistence Manager가 준비될 때까지 대기
        if ((auth as any)._persistenceManagerAvailable) {
          console.log("Persistence Manager 대기 중...");
          await (auth as any)._persistenceManagerAvailable;
          console.log("✅ Persistence Manager 준비 완료");
        }

        // Auth가 여전히 초기화되지 않았다면 익명 로그인으로 강제 초기화
        if (!(auth as any)._isInitialized) {
          console.log(
            "Auth가 초기화되지 않음, 익명 로그인으로 강제 초기화 시도..."
          );
          try {
            await signInAnonymously(auth);
            console.log("✅ 익명 로그인으로 Auth 초기화 완료");
          } catch (error) {
            console.error("❌ 익명 로그인 실패:", error);
          }
        }
      } catch (error) {
        console.error("❌ Auth 초기화 중 오류:", error);
      }
    };

    const initializeAuth = async () => {
      await forceAuthInitialization();

      console.log("onAuthStateChanged 설정 중...");

      // onAuthStateChanged를 여러 번 시도
      let authStateListener: (() => void) | undefined = undefined;

      const setupAuthListener = () => {
        return new Promise<(() => void) | undefined>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error("❌ onAuthStateChanged 타임아웃");
            reject(new Error("Auth state listener timeout"));
          }, 10000); // 10초 타임아웃

          authStateListener = onAuthStateChanged(
            auth,
            async (firebaseUser) => {
              clearTimeout(timeout);
              console.log("=== onAuthStateChanged 호출 ===");
              console.log(
                "firebaseUser:",
                firebaseUser
                  ? {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      displayName: firebaseUser.displayName,
                      photoURL: firebaseUser.photoURL,
                      emailVerified: firebaseUser.emailVerified,
                    }
                  : null
              );

              setUser(firebaseUser);

              if (firebaseUser) {
                console.log("✅ 사용자 로그인됨");

                // ✅ 새 사용자 정보를 Firestore에 저장
                await saveUserToFirestore(firebaseUser);

                // ✅ Firestore 승인 체크
                try {
                  console.log("Firestore 승인 상태 확인 중...");
                  console.log("사용자 UID:", firebaseUser.uid);
                  const ref = doc(db, "users", firebaseUser.uid);
                  console.log("Firestore 문서 참조:", ref.path);

                  const snap = await getDoc(ref);
                  console.log("Firestore 문서 존재 여부:", snap.exists());

                  if (snap.exists()) {
                    const userData = snap.data();
                    console.log("사용자 데이터:", userData);
                    console.log("approved 필드 값:", userData.approved);
                    const isApproved = userData.approved === true;
                    console.log("승인 상태:", isApproved);

                    // 개발 환경에서 임시로 승인 우회 (선택사항)
                    const bypassApproval =
                      process.env.NODE_ENV === "development" &&
                      process.env.NEXT_PUBLIC_BYPASS_APPROVAL === "true";

                    if (bypassApproval) {
                      console.log("⚠️ 개발 환경에서 승인 상태 우회");
                      setApproved(true);
                    } else {
                      setApproved(isApproved);
                    }
                  } else {
                    console.log("사용자 문서가 존재하지 않음");
                    setApproved(false);
                  }
                } catch (error) {
                  console.error("❌ 승인 상태 확인 실패:", error);
                  console.error("오류 상세:", {
                    code: (error as any)?.code,
                    message: (error as any)?.message,
                    stack: (error as any)?.stack,
                  });
                  setApproved(false);
                }

                // ✅ 토큰을 백엔드로 보내 쿠키 저장
                try {
                  console.log("토큰 생성 중...");
                  const token = await firebaseUser.getIdToken(true);
                  console.log("토큰 생성 완료, 백엔드로 전송 중...");

                  const response = await fetch("/api/set-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                  });

                  if (!response.ok) {
                    console.error(
                      "❌ 토큰 설정 실패:",
                      response.status,
                      response.statusText
                    );
                    const errorText = await response.text();
                    console.error("에러 응답:", errorText);
                  } else {
                    console.log("✅ 토큰 설정 성공");
                  }
                } catch (error) {
                  console.error("❌ 토큰 설정 중 오류:", error);
                }
              } else {
                console.log("사용자 로그아웃됨");
                setApproved(false);
              }

              console.log("setLoading(false) 호출 전");
              setLoading(false);
              console.log("✅ setLoading(false) 호출 완료");
              console.log("=== AuthContext 로딩 완료 ===");
              resolve(authStateListener);
            },
            (error) => {
              clearTimeout(timeout);
              console.error("❌ onAuthStateChanged 에러:", error);
              console.log("에러 발생 시 setLoading(false) 호출");
              setLoading(false);
              reject(error);
            }
          );
        });
      };

      try {
        const listener = await setupAuthListener();
        return listener;
      } catch (error) {
        console.error("❌ Auth 리스너 설정 실패:", error);
        setLoading(false);
        return undefined;
      }
    };

    // 초기화 실행
    let unsubscribe: (() => void) | undefined;
    initializeAuth()
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((error) => {
        console.error("❌ Auth 초기화 실패:", error);
        setLoading(false);
      });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, approved }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
