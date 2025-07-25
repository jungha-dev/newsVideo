// contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      const now = new Date();

      // 사용자가 이미 존재하지 않는 경우에만 저장
      if (!userSnap.exists()) {
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
      } else {
        // 기존 사용자의 경우 마지막 로그인 시간과 업데이트 시간만 업데이트
        const updateData = {
          lastLoginAt: now,
          updatedAt: now,
        };

        await setDoc(userRef, updateData, { merge: true });
      }
    } catch (error) {
      console.error("사용자 정보 저장 중 오류:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // ✅ 새 사용자 정보를 Firestore에 저장
        await saveUserToFirestore(firebaseUser);

        // ✅ Firestore 승인 체크
        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);
        const isApproved = snap.exists() && snap.data().approved === true;
        setApproved(isApproved);

        // ✅ 토큰을 백엔드로 보내 쿠키 저장
        try {
          const token = await firebaseUser.getIdToken(true);
          const response = await fetch("/api/set-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });

          if (!response.ok) {
            console.error("Failed to set token:", response.status);
          }
        } catch (error) {
          console.error("Error setting token:", error);
        }
      } else {
        setApproved(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, approved }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
