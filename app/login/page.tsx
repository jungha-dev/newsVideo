"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import GoogleLoginButton from "@/components/GoogleLoginButton";

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  return (
    <main className="flex items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <GoogleLoginButton />
      </div>
    </main>
  );
}
