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
  QueryDocumentSnapshot,
  DocumentData,
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

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<
    (VideoData & { userEmail: string }) | null
  >(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const router = useRouter();

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [videosPerPage] = useState(10);
  const [totalVideos, setTotalVideos] = useState(0);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [pageHistory, setPageHistory] = useState<
    QueryDocumentSnapshot<DocumentData>[]
  >([]);

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

  const loadVideos = async (
    isSearch: boolean = false,
    isNextPage: boolean = false
  ) => {
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

      // 검색이거나 첫 페이지인 경우 페이지네이션 상태 초기화
      if (isSearch || !isNextPage) {
        setCurrentPage(1);
        setLastDoc(null);
        setPageHistory([]);
        setHasNextPage(true);
        setHasPrevPage(false);
      }

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

      // 전체 비디오 수 설정
      setTotalVideos(allVideos.length);

      // 페이지네이션 적용
      const startIndex = (currentPage - 1) * videosPerPage;
      const endIndex = startIndex + videosPerPage;
      const paginatedVideos = allVideos.slice(startIndex, endIndex);

      setVideos(paginatedVideos);
      setHasNextPage(endIndex < allVideos.length);
      setHasPrevPage(currentPage > 1);
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadVideos(true, false);
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
      loadVideos(false, true);
    }
  };

  const handlePrevPage = () => {
    if (hasPrevPage) {
      setCurrentPage((prev) => prev - 1);
      loadVideos(false, true);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadVideos(false, true);
  };

  const openDetailModal = (video: VideoData & { userEmail: string }) => {
    setSelectedVideo(video);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setSelectedVideo(null);
    setShowDetailModal(false);
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

  // 페이지 번호 배열 생성
  const getPageNumbers = (): (number | string)[] => {
    const totalPages = Math.ceil(totalVideos / videosPerPage);
    const current = currentPage;
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (current >= totalPages - 3) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = current - 1; i <= current + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  useEffect(() => {
    if (user) {
      // 사용자가 로그인되어 있으면 권한 확인 및 비디오 로드
      const initializePage = async () => {
        const hasRole = await checkRole();
        if (hasRole) {
          setAuthorized(true);
          loadVideos(false, false);
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
    <div className="w-full">
      <PageTitle title="전체 영상 관리" />

      {/* 전체 비디오 통계 */}
      {!loading && (
        <div className="mb-6">
          <div className=" rounded-2xl p-6 border border-secondary-light">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-primary">
                    비디오 통계
                  </h3>
                  <p className="text-primary text-sm">
                    {searchTerm
                      ? `"${searchTerm}" 검색 결과`
                      : "전체 생성된 비디오 현황"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">
                  {totalVideos}
                </div>
                <div className="text-primary text-sm">
                  {searchTerm ? "검색된 비디오 수" : "총 비디오 수"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 검색 */}
      <div className="my-8">
        <div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="제목 또는 설명으로 검색..."
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
              검색
            </button>
          </div>
        </div>
      </div>

      {/* 영상 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-start w-full place-items-start">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-white rounded-2xl p-6 border border-secondary hover:border-secondary transition-all duration-300 hover:-translate-y-1 h-fit"
          >
            <div className="mb-4 text-left">
              <div className="flex-1">
                <button
                  className="cursor-pointer text-left w-full"
                  onClick={() => openDetailModal(video)}
                >
                  <h3 className="text-lg font-semibold mb-2 text-left truncate max-w-[250px]">
                    {video.title}
                  </h3>
                  <div className="text-left">
                    <span className="text-sm text-gray-500">
                      <span
                        className={`px-1 rounded-full text-sm font-medium ${getStatusColor(
                          video.status
                        )}`}
                      >
                        {video.status}
                      </span>
                      {video.id}
                    </span>
                  </div>
                </button>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 text-left">
                  <span>사용자: {video.userEmail}</span>
                  <span>모델: {video.model}</span>
                  <span>비율: {video.aspectRatio}</span>
                  <span>길이: {video.duration}초</span>
                  <span>씬 수: {video.scenes?.length || 0}</span>
                </div>

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
                {/* 씬 현황 요약 */}
                <div className="mb-3 p-3 bg-gradient-to-r rounded-lg border bg-gray-100 border-secondary">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <span className="text-sm font-medium ">
                          씬 생성 현황
                        </span>
                        <div className="text-xs text-left">
                          총 {video.scenes.length}개 씬 중{" "}
                          {
                            video.scenes.filter((scene) => scene.videoUrl)
                              .length
                          }
                          개 성공
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">
                          {
                            video.scenes.filter((scene) => scene.videoUrl)
                              .length
                          }
                        </div>
                        <div className="text-xs">성공</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-600">
                          {
                            video.scenes.filter((scene) => !scene.videoUrl)
                              .length
                          }
                        </div>
                        <div className="text-xs ">실패</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
      {!loading && totalVideos > 0 && (
        <div className="flex justify-center items-center py-8">
          <div className="flex items-center gap-2 bg-white rounded-2xl p-4">
            {/* 이전 페이지 버튼 */}
            <button
              onClick={handlePrevPage}
              disabled={!hasPrevPage}
              className={`px-3 py-2 rounded-lg transition-colors ${
                hasPrevPage
                  ? "bg-primary text-white hover:primary"
                  : "bg-gray-100 text-gray-500 cursor-not-allowed"
              }`}
            >
              ← 이전
            </button>

            {/* 페이지 번호들 */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => (
                <button
                  key={index}
                  onClick={() =>
                    typeof page === "number" ? handlePageChange(page) : null
                  }
                  disabled={page === "..."}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    page === currentPage
                      ? "bg-primary text-white"
                      : page === "..."
                      ? "text-gray-400 cursor-default"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <div className="text-gray-600 text-sm">
              페이지 {currentPage} / {Math.ceil(totalVideos / videosPerPage)}
            </div>
            {/* 다음 페이지 버튼 */}
            <button
              onClick={handleNextPage}
              disabled={!hasNextPage}
              className={`px-3 py-2 rounded-lg transition-colors ${
                hasNextPage
                  ? "bg-primary text-white hover:primary"
                  : "bg-gray-100 text-gray-500 cursor-not-allowed"
              }`}
            >
              다음 →
            </button>
          </div>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-full px-6 py-4 shadow-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <p className="text-slate-600 font-medium">로딩 중...</p>
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

      {/* 상세보기 모달 */}
      {showDetailModal && selectedVideo && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2
                className="text-2xl font-bold"
                style={{ color: "var(--color-primary)" }}
              >
                영상 상세정보
              </h2>
              <button
                onClick={closeDetailModal}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ color: "var(--color-primary)" }}
                >
                  기본 정보
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">제목:</span>{" "}
                    {selectedVideo.title}
                  </div>
                  <div>
                    <span className="font-medium">설명:</span>{" "}
                    {selectedVideo.description}
                  </div>
                  <div>
                    <span className="font-medium">사용자:</span>{" "}
                    {selectedVideo.userEmail}
                  </div>
                  <div>
                    <span className="font-medium">모델:</span>{" "}
                    {selectedVideo.model}
                  </div>
                  <div>
                    <span className="font-medium">비율:</span>{" "}
                    {selectedVideo.aspectRatio}
                  </div>
                  <div>
                    <span className="font-medium">길이:</span>{" "}
                    {selectedVideo.duration}초
                  </div>
                  <div>
                    <span className="font-medium">상태:</span>
                    <span
                      className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(
                        selectedVideo.status
                      )}`}
                    >
                      {selectedVideo.status}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ color: "var(--color-primary)" }}
                >
                  시간 정보
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">생성:</span>{" "}
                    {formatDate(selectedVideo.createdAt)}
                  </div>
                  <div>
                    <span className="font-medium">수정:</span>{" "}
                    {formatDate(selectedVideo.updatedAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* 씬 정보 */}
            {selectedVideo.scenes && selectedVideo.scenes.length > 0 && (
              <div className="mb-8">
                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--color-primary)" }}
                >
                  🎭 씬 정보 ({selectedVideo.scenes.length}개)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedVideo.scenes.map((scene, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4"
                      style={{ borderColor: "var(--color-secondary-dark)" }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium">씬 {scene.scene_number}</h4>
                        <span className="text-xs text-gray-500">
                          {scene.videoUrl ? "✅ 비디오 있음" : "❌ 비디오 없음"}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">프롬프트:</span>
                          <p className="text-gray-600 mt-1">
                            {scene.image_prompt}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">나레이션:</span>
                          <p className="text-gray-600 mt-1">
                            {scene.narration}
                          </p>
                        </div>

                        {scene.videoUrl && (
                          <div>
                            <span className="font-medium">
                              비디오 미리보기:
                            </span>
                            <div className="mt-2">
                              {/* 비디오 플레이어 */}
                              <video
                                controls
                                className="w-full rounded-lg mb-2"
                                style={{ maxHeight: "200px" }}
                              >
                                <source src={scene.videoUrl} type="video/mp4" />
                                <source
                                  src={scene.videoUrl}
                                  type="video/webm"
                                />
                                <source src={scene.videoUrl} type="video/ogg" />
                                브라우저가 비디오를 지원하지 않습니다.
                              </video>

                              {/* 링크 정보 및 액션 버튼 */}
                              <div className="flex items-center justify-between">
                                <a
                                  href={scene.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-primary underline break-all text-xs"
                                >
                                  {scene.videoUrl.length > 30
                                    ? scene.videoUrl.substring(0, 30) + "..."
                                    : scene.videoUrl}
                                </a>
                                {scene.videoUrl.includes(
                                  "replicate.delivery"
                                ) && (
                                  <button
                                    onClick={() => {
                                      handleUploadToFirebase(
                                        selectedVideo.id,
                                        scene.scene_number - 1,
                                        scene.videoUrl!
                                      );
                                      closeDetailModal();
                                    }}
                                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                  >
                                    🔄 Firebase 업로드
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div
              className="flex justify-end gap-3 pt-6 border-t"
              style={{ borderColor: "var(--color-secondary-dark)" }}
            >
              <button
                onClick={closeDetailModal}
                className="px-6 py-2 rounded-lg transition-colors"
                style={{
                  background: "var(--color-secondary)",
                  color: "var(--color-primary)",
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
