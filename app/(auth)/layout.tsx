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
    console.log("🔄 AuthLayout loading state change:", loading);
  }, [loading]);

  // user 상태 변화 추적
  useEffect(() => {
    console.log(
      "🔄 AuthLayout user state change:",
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
    console.log("🔄 AuthLayout approved state change:", approved);
  }, [approved]);

  console.log("=== AuthLayout state ===");
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
    console.log("Checking login...");
    return <div className="p-6">⏳ Checking login...</div>;
  }

  if (!user) {
    console.log("Login is required.");
    return <div className="p-6 text-red-600">Login is required.</div>;
  }

  if (!approved) {
    console.log("❌ Unauthorized user.");
    return (
      <div className="p-6 text-red-600">
        ❌ Unauthorized user. <br />
        🔔 <strong>Please request approval from the administrator.</strong>
      </div>
    );
  }

  console.log("Authenticated user - rendering page");
  return <>{children}</>;
}
