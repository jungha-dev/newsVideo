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

  if (!authorized) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-4">사용자 승인 관리</h1>
      <ul className="space-y-4">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex items-center justify-between border-b pb-2"
          >
            <div>
              <div className="font-medium">{user.email}</div>
              <div className="text-sm text-gray-500">{user.id}</div>
            </div>
            <div className="flex gap-2">
              {user.approved ? (
                <>
                  <span className="-black px-3 py-1">✅ 승인됨</span>
                  <button
                    onClick={() => updateApproval(user.id, false)}
                    className="text-red-500 px-3 py-1 rounded-xl hover:text-red-600"
                  >
                    승인 취소
                  </button>
                </>
              ) : (
                <button
                  onClick={() => updateApproval(user.id, true)}
                  className="bg-primary text-white px-3 py-1 rounded-xl hover:bg-primary/90"
                >
                  승인하기
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
