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
  const [filterStatus, setFilterStatus] = useState<string>("all");
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

      let videosQuery = query(
        collection(db, "users"),
        orderBy("createdAt", "desc")
      );

      if (!isInitial && lastDoc) {
        videosQuery = query(
          videosQuery,
          startAfter(lastDoc),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        videosQuery = query(videosQuery, limit(ITEMS_PER_PAGE));
      }

      const usersSnapshot = await getDocs(videosQuery);
      const newVideos: (VideoData & { userEmail: string })[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data() as UserData;

        // 각 사용자의 newsVideo 컬렉션에서 비디오 가져오기
        const videosSnapshot = await getDocs(
          collection(db, "users", userDoc.id, "newsVideo")
        );

        videosSnapshot.forEach((videoDoc) => {
          const videoData = videoDoc.data() as VideoData;

          // 필터링 적용
          if (filterStatus !== "all" && videoData.status !== filterStatus) {
            return;
          }

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

          newVideos.push({
            ...videoData,
            userEmail: userData.email || "Unknown",
          });
        });
      }

      if (isInitial) {
        setVideos(newVideos);
      } else {
        setVideos((prev) => [...prev, ...newVideos]);
      }

      setLastDoc(usersSnapshot.docs[usersSnapshot.docs.length - 1]);
      setHasMore(usersSnapshot.docs.length === ITEMS_PER_PAGE);
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

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
    setLastDoc(null);
    setHasMore(true);
    loadVideos(true);
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

      {/* 필터 및 검색 */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "all" ? "primary" : "secondary"}
              onClick={() => handleFilterChange("all")}
            >
              전체
            </Button>
            <Button
              variant={filterStatus === "completed" ? "primary" : "secondary"}
              onClick={() => handleFilterChange("completed")}
            >
              완료
            </Button>
            <Button
              variant={filterStatus === "processing" ? "primary" : "secondary"}
              onClick={() => handleFilterChange("processing")}
            >
              처리중
            </Button>
            <Button
              variant={filterStatus === "failed" ? "primary" : "secondary"}
              onClick={() => handleFilterChange("failed")}
            >
              실패
            </Button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="제목 또는 설명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button onClick={handleSearch} variant="primary">
              검색
            </Button>
          </div>
        </div>
      </div>

      {/* 영상 목록 */}
      <div className="space-y-4">
        {videos.map((video) => (
          <Card
            key={video.id}
            id={video.id}
            title={video.title}
            className="p-6"
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
          </Card>
        ))}
      </div>

      {/* 로딩 및 더보기 */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-600 mt-2">로딩 중...</p>
        </div>
      )}

      {!loading && hasMore && (
        <div className="text-center py-4">
          <Button onClick={loadMoreVideos} variant="secondary">
            더 보기
          </Button>
        </div>
      )}

      {!loading && !hasMore && videos.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          모든 영상을 불러왔습니다.
        </div>
      )}

      {!loading && videos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          조건에 맞는 영상이 없습니다.
        </div>
      )}
    </div>
  );
}
