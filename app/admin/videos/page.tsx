"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button, Card, PageTitle } from "@/components/styled";

type VideoData = {
  id: string;
  uid: string;
  title: string;
  description: string;
  status: string;
  model: string;
  aspectRatio: string;
  duration: number;
  createdAt: any;
  updatedAt: any;
  scenes: Array<{
    scene_number: number;
    image_prompt: string;
    narration: string;
    videoUrl?: string;
  }>;
};

type UserData = {
  email: string;
  displayName?: string;
};

export default function AdminVideosPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<(VideoData & { userEmail: string })[]>(
    []
  );
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const ITEMS_PER_PAGE = 20;

  const checkRole = async () => {
    if (!user) return false;

    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.role === "superadmin";
    }
    return false;
  };

  const loadVideos = async (isInitial = false) => {
    try {
      setLoading(true);

      const hasRole = await checkRole();
      if (!hasRole) {
        alert("접근 권한이 없습니다.");
        router.push("/");
        return;
      }

      // 권한이 있으면 authorized 상태를 true로 설정
      setAuthorized(true);

      // 모든 사용자에서 비디오를 가져와서 필터링
      const usersSnapshot = await getDocs(collection(db, "users"));
      const allVideos: (VideoData & { userEmail: string })[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data() as UserData;

        // 각 사용자의 newsVideo 컬렉션에서 비디오 가져오기
        const videosSnapshot = await getDocs(
          collection(db, "users", userDoc.id, "newsVideo")
        );

        videosSnapshot.forEach((videoDoc) => {
          const videoData = videoDoc.data() as VideoData;

          // 검색어 필터링
          if (
            searchTerm &&
            !videoData.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !videoData.description
              .toLowerCase()
              .includes(searchTerm.toLowerCase())
          ) {
            return;
          }

          allVideos.push({
            ...videoData,
            userEmail: userData.email || "Unknown",
          });
        });
      }

      // 날짜순으로 정렬
      allVideos.sort((a, b) => {
        const dateA = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      // 페이지네이션 적용
      const startIndex = isInitial ? 0 : lastDoc ? lastDoc : 0;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const paginatedVideos = allVideos.slice(startIndex, endIndex);

      if (isInitial) {
        setVideos(paginatedVideos);
      } else {
        setVideos((prev) => [...prev, ...paginatedVideos]);
      }

      setLastDoc(endIndex);
      setHasMore(endIndex < allVideos.length);
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreVideos = () => {
    if (!loading && hasMore) {
      loadVideos(false);
    }
  };

  const handleSearch = () => {
    setLastDoc(null);
    setHasMore(true);
    loadVideos(true);
  };

  const handleUploadToFirebase = async (
    videoId: string,
    sceneIndex: number,
    replicateUrl: string
  ) => {
    try {
      const response = await fetch(`/api/video/news/upload-to-firebase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          sceneIndex,
          replicateUrl,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Firebase 업로드 성공: ${result.firebaseUrl}`);
        // 페이지 새로고침하여 업데이트된 상태 반영
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Firebase 업로드 실패: ${error.error}`);
      }
    } catch (error) {
      console.error("Firebase 업로드 에러:", error);
      alert("Firebase 업로드 중 오류가 발생했습니다.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-100";
      case "processing":
        return "text-yellow-600 bg-yellow-100";
      case "failed":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("ko-KR");
  };

  useEffect(() => {
    if (user) {
      // 사용자가 로그인되어 있으면 권한 확인 및 비디오 로드
      const initializePage = async () => {
        const hasRole = await checkRole();
        if (hasRole) {
          setAuthorized(true);
          loadVideos(true);
        } else {
          setAuthorized(false);
          setLoading(false);
        }
      };

      initializePage();
    } else {
      setAuthorized(false);
      setLoading(false);
    }
  }, [user]);

  if (!authorized) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-600 mt-2">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="전체 영상 관리" />

      {/* 검색 */}
      <div className="mb-8">
        <div
          className="bg-white rounded-2xl p-6 shadow-lg border"
          style={{ borderColor: "var(--color-secondary-dark)" }}
        >
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="🔍 제목 또는 설명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-3 border rounded-full focus:outline-none focus:ring-2 focus:border-transparent"
              style={{
                borderColor: "var(--color-secondary-dark)",
                background: "var(--color-secondary-light)",
              }}
            />
            <button
              onClick={handleSearch}
              className="px-6 py-3 text-white rounded-full transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              style={{ background: "var(--color-primary)" }}
            >
              🔍 검색
            </button>
          </div>
        </div>
      </div>

      {/* 영상 목록 */}
      <div className="space-y-6">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-white rounded-2xl p-8 border border-secondary hover:border-secondary transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{video.title}</h3>
                <p className="text-gray-600 mb-2">{video.description}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>사용자: {video.userEmail}</span>
                  <span>모델: {video.model}</span>
                  <span>비율: {video.aspectRatio}</span>
                  <span>길이: {video.duration}초</span>
                  <span>씬 수: {video.scenes?.length || 0}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    video.status
                  )}`}
                >
                  {video.status}
                </span>
                <div className="text-xs text-gray-500">
                  생성: {formatDate(video.createdAt)}
                </div>
                <div className="text-xs text-gray-500">
                  수정: {formatDate(video.updatedAt)}
                </div>
              </div>
            </div>

            {/* 씬 정보 */}
            {video.scenes && video.scenes.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">씬 정보:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {video.scenes.map((scene, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm font-medium mb-1">
                        씬 {scene.scene_number}
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        프롬프트: {scene.image_prompt?.substring(0, 50)}...
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        나레이션: {scene.narration?.substring(0, 50)}...
                      </div>
                      <div className="text-xs mb-1">
                        비디오:{" "}
                        {scene.videoUrl ? (
                          <span className="flex items-center gap-1">
                            ✅
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                scene.videoUrl.includes(
                                  "firebasestorage.googleapis.com"
                                )
                                  ? "bg-blue-100 text-blue-700"
                                  : scene.videoUrl.includes(
                                      "replicate.delivery"
                                    )
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {scene.videoUrl.includes(
                                "firebasestorage.googleapis.com"
                              )
                                ? "Firebase"
                                : scene.videoUrl.includes("replicate.delivery")
                                ? "Replicate"
                                : "기타"}
                            </span>
                          </span>
                        ) : (
                          "❌"
                        )}
                      </div>
                      {scene.videoUrl && (
                        <div className="text-xs">
                          <a
                            href={scene.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline break-all"
                          >
                            {scene.videoUrl.length > 40
                              ? scene.videoUrl.substring(0, 40) + "..."
                              : scene.videoUrl}
                          </a>
                          {scene.videoUrl &&
                            scene.videoUrl.includes("replicate.delivery") && (
                              <button
                                onClick={() =>
                                  handleUploadToFirebase(
                                    video.id,
                                    scene.scene_number - 1,
                                    scene.videoUrl!
                                  )
                                }
                                className="ml-2 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                title="Firebase에 업로드"
                              >
                                🔄 Firebase 업로드
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 로딩 및 더보기 */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-full px-6 py-4 shadow-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <p className="text-slate-600 font-medium">로딩 중...</p>
          </div>
        </div>
      )}

      {!loading && hasMore && (
        <div className="text-center py-8">
          <button
            onClick={loadMoreVideos}
            className="px-8 py-4 text-white rounded-full transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium"
            style={{ background: "var(--color-primary)" }}
          >
            📄 더 보기
          </button>
        </div>
      )}

      {!loading && !hasMore && videos.length > 0 && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 bg-green-50 px-6 py-3 rounded-full">
            <span className="text-green-600">✅</span>
            <span className="text-green-700 font-medium">
              모든 영상을 불러왔습니다.
            </span>
          </div>
        </div>
      )}

      {!loading && videos.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3 bg-slate-50 px-8 py-6 rounded-2xl">
            <span className="text-4xl">📭</span>
            <div>
              <p className="text-slate-600 font-medium text-lg">
                조건에 맞는 영상이 없습니다.
              </p>
              <p className="text-slate-500 text-sm">
                다른 필터를 시도해보세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
