"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type UserEntry = {
  id: string;
  email: string;
  approved: boolean;
};

export default function AdminUserPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  const loadUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    const data: UserEntry[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      data.push({
        id: docSnap.id,
        email: d.email,
        approved: d.approved,
      });
    });
    setUsers(data);
  };

  const updateApproval = async (id: string, status: boolean) => {
    await updateDoc(doc(db, "users", id), { approved: status });
    loadUsers();
  };

  useEffect(() => {
    const checkRole = async () => {
      if (!user) return;

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.role === "superadmin") {
          setAuthorized(true);
          loadUsers();
        } else {
          alert("접근 권한이 없습니다.");
          router.push("/");
        }
      } else {
        alert("등록된 사용자가 아닙니다.");
        router.push("/");
      }
    };

    checkRole();
  }, [user]);

  if (!authorized) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-gray-600 mt-2">권한 확인 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">사용자 승인 관리</h1>
        <p>시스템 접근 권한을 관리합니다.</p>
      </div>
      <div>
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-300 hover:opacity-80 transition-all duration-200"
            >
              <div>
                <div
                  className="font-semibold"
                  style={{ color: "var(--color-primary)" }}
                >
                  {user.email}
                </div>
                <div className="text-sm font-mono text-gray-400">{user.id}</div>
              </div>
              <div className="flex gap-3">
                {user.approved ? (
                  <>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium">
                      승인됨
                    </span>
                    <button
                      onClick={() => updateApproval(user.id, false)}
                      className="text-red-500 px-4 py-2 rounded-full transition-all duration-200 text-sm font-medium"
                    >
                      승인 취소
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => updateApproval(user.id, true)}
                    className="px-6 py-2 bg-primary text-white rounded-full transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium"
                  >
                    승인
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
