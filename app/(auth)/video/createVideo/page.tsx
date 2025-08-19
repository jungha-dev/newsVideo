"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getNewsVideosByUser } from "@/lib/firebase/newsVideo";
import { NewsVideo } from "@/lib/types/newsVideo";
import { PageTitle, Section, Button } from "@/components/styled";
import Link from "next/link";

export default function NewsVideoListPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<NewsVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [thumbnails, setThumbnails] = useState<{ [key: string]: string }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const videosPerPage = 40;

  useEffect(() => {
    if (user) {
      loadVideos();
    }
  }, [user]);

  // videos가 로드되면 첫 번째 씬의 영상에서 썸네일 생성
  useEffect(() => {
    videos.forEach((video) => {
      // 첫 번째 씬의 영상이 있는 경우 썸네일 생성
      const firstSceneWithVideo = video.scenes.find((scene) => scene.videoUrl);
      if (firstSceneWithVideo?.videoUrl) {
        generateThumbnail(firstSceneWithVideo.videoUrl, video.id);
      }
    });
  }, [videos]);

  const loadVideos = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log("Loading videos for user:", user.uid);
      const userVideos = await getNewsVideosByUser(user.uid);
      console.log("Loaded videos:", userVideos);
      setVideos(userVideos);

      //  각 비디오의 최신 상태를 확인하여 videoUrl 업데이트
      if (userVideos.length > 0) {
        console.log("🔄 각 비디오의 최신 상태 확인 시작...");
        const updatedVideos = await Promise.all(
          userVideos.map(async (video) => {
            if (video.status === "processing") {
              console.log(` 비디오 ${video.id} 상태 확인 중...`);
              const updatedVideo = await updateVideoStatus(video.id);
              return updatedVideo || video;
            }
            return video;
          })
        );

        // 업데이트된 비디오들로 상태 업데이트
        setVideos(updatedVideos);
        console.log("✅ 모든 비디오 상태 업데이트 완료");
      }
    } catch (err) {
      console.error("Error loading videos:", err);
      setError("Failed to load video.");
    } finally {
      setLoading(false);
    }
  };

  const refreshVideos = async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };

  // 개별 비디오의 상태를 확인하여 videoUrl 업데이트
  const updateVideoStatus = async (videoId: string) => {
    try {
      const response = await fetch(`/api/video/news/status/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        console.log(` 비디오 ${videoId} 상태 업데이트:`, data.video.status);

        // 현재 videos 배열에서 해당 비디오 업데이트
        setVideos((prevVideos) =>
          prevVideos.map((video) => (video.id === videoId ? data.video : video))
        );

        return data.video;
      }
    } catch (error) {
      console.error(`비디오 ${videoId} 상태 업데이트 실패:`, error);
    }
    return null;
  };

  //  자동 Firebase 업로드 트리거 (목록 페이지에서)
  const triggerAutoUploadForVideo = async (videoId: string) => {
    try {
      console.log(` 비디오 ${videoId} 자동 Firebase 업로드 트리거...`);

      const response = await fetch(`/api/video/news/auto-upload-to-firebase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          userId: user?.uid,
        }),
      });

      if (response.ok) {
        console.log(`✅ 비디오 ${videoId} 자동 업로드 트리거 성공`);
        // 상태 업데이트
        await updateVideoStatus(videoId);
      } else {
        console.log(`⚠️ 비디오 ${videoId} 자동 업로드 트리거 실패`);
      }
    } catch (error) {
      console.error(`❌ 비디오 ${videoId} 자동 업로드 트리거 에러:`, error);
    }
  };

  const formatDate = (date: any) => {
    try {
      // Firestore Timestamp를 Date로 변환
      let dateObj: Date;

      if (date?.toDate) {
        // Firestore Timestamp인 경우
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        // 이미 Date 객체인 경우
        dateObj = date;
      } else if (typeof date === "string" || typeof date === "number") {
        // 문자열이나 숫자인 경우
        dateObj = new Date(date);
      } else {
        // 알 수 없는 형식인 경우 현재 시간 사용
        console.warn("Unknown date format:", date);
        dateObj = new Date();
      }

      // 유효한 날짜인지 확인
      if (isNaN(dateObj.getTime())) {
        console.warn("Invalid date:", date);
        return "Invalid Date";
      }

      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const day = String(dateObj.getDate()).padStart(2, "0");
      const hours = String(dateObj.getHours()).padStart(2, "0");
      const minutes = String(dateObj.getMinutes()).padStart(2, "0");

      return `${year}.${month}.${day} ${hours}:${minutes}`;
    } catch (error) {
      console.error("Date formatting error:", error, "Original date:", date);
      return "Date Error";
    }
  };

  // 페이징 계산
  const totalPages = Math.ceil(videos.length / videosPerPage);
  const startIndex = (currentPage - 1) * videosPerPage;
  const endIndex = startIndex + videosPerPage;
  const currentVideos = videos.slice(startIndex, endIndex);

  // 영상에서 썸네일 생성
  const generateThumbnail = (videoUrl: string, videoId: string) => {
    if (thumbnails[videoId]) return; // 이미 썸네일이 있으면 생성하지 않음

    // Firebase Storage URL인지 확인
    const isFirebaseUrl = videoUrl.includes("firebasestorage.googleapis.com");

    // Firebase URL인 경우 더 안전한 방식으로 처리
    if (isFirebaseUrl) {
      // Firebase URL은 CORS 문제가 있을 수 있으므로 기본 썸네일 사용
      setThumbnails((prev) => ({
        ...prev,
        [videoId]: "/placeholder-video.png", // 기본 비디오 썸네일 SVG
      }));
      return;
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true; // 음소거로 자동 재생 방지
    video.playsInline = true;

    // 비디오 로드 타임아웃 설정
    const loadTimeout = setTimeout(() => {
      console.warn("Video thumbnail generation timeout:", videoUrl);
      // 타임아웃 시 기본 썸네일 사용
      setThumbnails((prev) => ({
        ...prev,
        [videoId]: "/placeholder-video.png",
      }));
    }, 10000); // 10초 타임아웃

    video.addEventListener("loadeddata", () => {
      clearTimeout(loadTimeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // 비디오가 로드된 후 0.1초 지점에서 썸네일 생성
          video.currentTime = 0.1;

          video.addEventListener(
            "seeked",
            () => {
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.8);
                setThumbnails((prev) => ({
                  ...prev,
                  [videoId]: thumbnailUrl,
                }));
              } catch (error) {
                console.warn("Failed to generate thumbnail from video:", error);
                // 오류 시 기본 썸네일 사용
                setThumbnails((prev) => ({
                  ...prev,
                  [videoId]: "/placeholder-video.png",
                }));
              }
            },
            { once: true }
          );
        }
      } catch (error) {
        console.warn("Failed to create thumbnail canvas:", error);
        setThumbnails((prev) => ({
          ...prev,
          [videoId]: "/placeholder-video.png",
        }));
      }
    });

    video.addEventListener("error", (error) => {
      clearTimeout(loadTimeout);
      console.warn("Video thumbnail generation failed:", {
        videoUrl,
        error: (error.target as HTMLVideoElement)?.error || "Unknown error",
      });
      // 오류 시 기본 썸네일 사용
      setThumbnails((prev) => ({
        ...prev,
        [videoId]: "/placeholder-video.png",
      }));
    });

    // 비디오 로드 시작
    video.src = videoUrl;
    video.load();
  };

  if (!user) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <PageTitle title="Generated Video" />
        <div className="text-center py-8">
          <p className="text-gray-600">Please login.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-8xl mx-auto px-4 py-16">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center mt-[20vh] py-8">
          <div className="text-4xl mb-4">🎬</div>
          <p className="text-gray-600 mb-4">
            There are no generated videos yet.
          </p>
          <Link href="/create">
            <Button variant="primary">Create the first generated video</Button>
          </Link>
        </div>
      ) : (
        <div>
          {" "}
          <PageTitle title="Generated Video" />
          {/* 새로고침 및 상태 정보 섹션 */}
          {/* <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                🔄 자동 업로드 상태
              </h3>
              <div className="text-xs text-blue-800 space-y-1">
                {videos.some((v) => v.status === "processing") ? (
                  <p>
                    • 일부 비디오가 처리 중입니다. 30초마다 자동으로 상태를
                    확인합니다.
                  </p>
                ) : (
                  <p>• 모든 비디오가 완료되었습니다.</p>
                )}
                <p>• 자동 업로드가 완료되면 상태가 자동으로 업데이트됩니다.</p>
              </div>
            </div>
            <Button
              onClick={refreshVideos}
              disabled={refreshing}
              variant="outline"
              className="whitespace-nowrap"
            >
              {refreshing ? "🔄 새로고침 중..." : "🔄 수동 새로고침"}
            </Button>
          </div> */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {currentVideos.map((video) => (
              <Link key={video.id} href={`/video/createVideo/${video.id}`}>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  {/* 썸네일 */}
                  <div className="aspect-video bg-gray-100 relative">
                    {thumbnails[video.id] ? (
                      <img
                        src={thumbnails[video.id]}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : video.thumbnail ? (
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-secondary-dark">Landering...</div>
                      </div>
                    )}

                    {/* 상태 배지 */}
                    <div className="absolute top-2 right-2 flex gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          video.status === "completed"
                            ? ""
                            : video.status === "processing"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {video.status === "completed"
                          ? ""
                          : video.status === "processing"
                          ? "Processing"
                          : "Failed"}
                      </span>
                      {video.model && (
                        <div>
                          <span className="inline-block bg-black/30 text-white text-xs px-2 py-1 rounded">
                            {video.model}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 처리 중일 때 로딩 애니메이션 */}
                    {video.status === "processing" && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                      {video.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatDate(video.createdAt)}</span>
                      <span>{video.scenes.length} Scene</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {/* 페이징 컨트롤 */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 text-sm border rounded-md ${
                        currentPage === page
                          ? "bg-primary text-white border-primary"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
