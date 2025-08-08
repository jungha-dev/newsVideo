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
  const videosPerPage = 40;
  const [deletingVideos, setDeletingVideos] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );

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
    } catch (err) {
      console.error("Error loading videos:", err);
      setError("Failed to load video.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  // 페이징 계산
  const totalPages = Math.ceil(videos.length / videosPerPage);
  const startIndex = (currentPage - 1) * videosPerPage;
  const endIndex = startIndex + videosPerPage;
  const currentVideos = videos.slice(startIndex, endIndex);

  // 영상에서 썸네일 생성
  const generateThumbnail = (videoUrl: string, videoId: string) => {
    if (thumbnails[videoId]) return; // 이미 썸네일이 있으면 생성하지 않음

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = videoUrl;
    video.currentTime = 0.1; // 0.1초 지점에서 썸네일 생성

    video.addEventListener("loadeddata", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.8);
        setThumbnails((prev) => ({
          ...prev,
          [videoId]: thumbnailUrl,
        }));
      }
    });

    video.addEventListener("error", () => {
      console.error("Failed to load video for thumbnail:", videoUrl);
    });

    video.load();
  };

  // 비디오 삭제 함수
  const handleDeleteVideo = async (videoId: string) => {
    if (!user) return;

    try {
      setDeletingVideos((prev) => new Set(prev).add(videoId));
      setShowDeleteConfirm(null);

      const response = await fetch(`/api/video/news/delete/${videoId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // 삭제 성공 시 비디오 목록에서 제거
        setVideos((prev) => prev.filter((video) => video.id !== videoId));
        setError(""); // 에러 메시지 클리어
      } else {
        const errorData = await response.json();
        setError(`Failed to delete video: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error deleting video:", error);
      setError("Failed to delete video. Please try again.");
    } finally {
      setDeletingVideos((prev) => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };

  // 삭제 확인 모달
  const confirmDelete = (videoId: string) => {
    setShowDeleteConfirm(videoId);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {currentVideos.map((video) => (
              <div key={video.id} className="relative group">
                <Link href={`/video/createVideo/${video.id}`}>
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
                          <div className="text-secondary-dark">
                            Landering...
                          </div>
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

                {/* 삭제 메뉴 버튼 */}
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      confirmDelete(video.id);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors"
                    title="Delete video"
                  >
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                {/* 삭제 중 로딩 */}
                {deletingVideos.has(video.id) && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <div className="bg-white p-4 rounded-lg shadow-lg">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Deleting...</p>
                    </div>
                  </div>
                )}
              </div>
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

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 p-3 rounded-full mr-4">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Video
                </h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this video? This will permanently
              remove:
            </p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1">
              <li>• The video data from the database</li>
              <li>• All uploaded video files from storage</li>
              <li>• All scene video data</li>
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteVideo(showDeleteConfirm)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Delete Permanently
              </button>
              <button
                onClick={cancelDelete}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
