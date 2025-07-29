"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import FacebookLoginButton from "@/components/FacebookLoginButton";
import { Settings, LogOut, User } from "lucide-react";

type MenuGroup = {
  id: string; // 식별자
  label: string; // 표시명
  items: { href: string; label: string }[];
};

const MENUS: MenuGroup[] = [
  {
    id: "image",
    label: "Image",
    items: [
      { href: "/image/charaters", label: "Create" },
      { href: "/image/generated-img", label: "CharacterList" },
    ],
  },
  {
    id: "video",
    label: "Video",
    items: [
      { href: "/video/multi-generate", label: "Generate" },
      {
        href: "/video/kling-v1-6-pro/connected-videos",
        label: "Connected Videos",
      },
      { href: "/video/merge", label: "Merge" },
      { href: "/video/my-create/video-group", label: "My Create" },
      { href: "/video/news", label: "News Videos" },
    ],
  },
  {
    id: "blog",
    label: "Blog",
    items: [
      { href: "/blog/blog", label: "Blog" },
      { href: "/blog/blogNotion", label: "Notion Blog" },
      { href: "/blog/blogGoogle", label: "Google Blog" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { href: "/crawler", label: "Crawler" },
      { href: "/news", label: "News" },
    ],
  },
];

// 단순 링크 메뉴 (드롭다운 없음)
const SIMPLE_LINKS = [
  {
    href: "/video/kling-v1-6-pro/projects",
    label: "AniVideo",
  },
];

export default function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  /* ───────── Firestore 역할 체크 ───────── */
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userNickname, setUserNickname] = useState<string>("");
  const [userPhotoURL, setUserPhotoURL] = useState<string>("");

  useEffect(() => {
    if (!user?.uid) return;
    const fetchRole = async () => {
      try {
        const snap = await getDoc(doc(db, "allowed_users", user.uid));

        if (snap.exists() && snap.data().role === "superadmin") {
          setIsSuperAdmin(true);
        } else {
          setIsSuperAdmin(false);
        }
      } catch (err) {
        console.error("Role check failed:", err);
        setIsSuperAdmin(false);
      }
    };
    fetchRole();
  }, [user?.uid]);

  // 사용자 프로필 정보 가져오기
  useEffect(() => {
    if (!user?.uid) return;
    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserNickname(userData.nickname || user.displayName || "사용자");
          setUserPhotoURL(userData.photoURL || user.photoURL || "");
        } else {
          setUserNickname(user.displayName || "사용자");
          setUserPhotoURL(user.photoURL || "");
        }
      } catch (err) {
        console.error("User profile fetch failed:", err);
        setUserNickname(user.displayName || "사용자");
        setUserPhotoURL(user.photoURL || "");
      }
    };
    fetchUserProfile();
  }, [user?.uid, user?.displayName, user?.photoURL]);

  /* ───────── 드롭다운 오픈 상태 ───────── */
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const toggleMenu = (id: string, open: boolean) => {
    setOpenMenu(open ? id : null);
  };

  const handleLogout = useCallback(async () => {
    await signOut(auth);
    router.replace("/");
  }, [router]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserDropdown) {
        const target = event.target as Element;
        if (!target.closest(".user-dropdown")) {
          setShowUserDropdown(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserDropdown]);

  // 현재 활성화된 메뉴 확인
  const isActive = (href: string) => {
    if (href === "/" && pathname === "/") return true;
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <header className="border-b border-secondary bg-white">
      <nav className="flex justify-between items-center px-8 mx-auto">
        {/* ───── 왼쪽: 로고 ───── */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-2xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
          >
            Palette
          </Link>

          {/* ───── 네비게이션 메뉴 ───── */}
          <div className="flex gap-6">
            {/* 드롭다운 메뉴들 */}
            {MENUS.map(({ id, label, items }) => (
              <div
                key={id}
                className="relative"
                onMouseEnter={() => toggleMenu(id, true)}
                onMouseLeave={() => toggleMenu(id, false)}
              >
                <button
                  className={`cursor-pointer relative py-5 transition-colors flex items-center gap-1 ${
                    items.some((item) => isActive(item.href))
                      ? "text-black font-medium"
                      : "text-gray-600 hover:text-black"
                  }`}
                >
                  {label}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  {items.some((item) => isActive(item.href)) && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"></div>
                  )}
                </button>

                {openMenu === id && (
                  <div className="absolute top-full left-0 w-48 bg-white border border-gray-200 rounded-lg  z-50">
                    {items.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
                          isActive(href)
                            ? "bg-gray-50 font-medium text-black"
                            : "text-gray-700"
                        }`}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* 단순 링크 메뉴들 */}
            {SIMPLE_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`relative py-5 transition-colors ${
                  isActive(href)
                    ? "text-black font-medium"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                {label}
                {isActive(href) && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"></div>
                )}
              </Link>
            ))}

            {isSuperAdmin && (
              <Link
                href="/admin/users"
                className={`relative py-5 transition-colors font-semibold ${
                  isActive("/admin/users")
                    ? "text-black"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                사용자 관리
                {isActive("/admin/users") && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"></div>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* ───── 오른쪽: 계정 영역 ───── */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="relative user-dropdown">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                  {userPhotoURL ? (
                    <img
                      src={userPhotoURL}
                      alt="프로필"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <User size={16} />
                  )}
                </div>
              </button>

              {showUserDropdown && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg  z-50">
                  <div className="py-1">
                    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <span className="text-sm font-medium text-gray-900">
                        {isSuperAdmin && "슈퍼관리자: "}
                        {userNickname}
                      </span>
                      {user.email && (
                        <span className="text-xs text-gray-500">
                          {user.email}
                        </span>
                      )}
                    </div>
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserDropdown(false)}
                    >
                      <Settings size={16} />
                      설정
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowUserDropdown(false);
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      <LogOut size={16} />
                      로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <GoogleLoginButton />
              <FacebookLoginButton />
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
