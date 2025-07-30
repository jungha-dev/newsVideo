"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/styled";
import { ensureFirebaseUrl } from "@/lib/firebase";

interface Video {
  id: string;
  firebaseVideoUrl?: string;
  promptText?: string;
  runwayTaskId?: string;
  imageUrl?: string;
  description?: string;
  createdAt?: string;
}

interface LongVideoGroup {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  totalVideos: number;
  videos: Video[];
  metadata: any;
}

export default function LongVideoDetailPage() {
  const [longvideo, setLongvideo] = useState<LongVideoGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  useEffect(() => {
    const loadLongVideo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/video/longvideos/${groupId}`);

        if (!response.ok) {
          if (response.status === 401) {
            setError("로그인이 필요합니다.");
            return;
          }
          if (response.status === 404) {
            setError("Long Video 그룹을 찾을 수 없습니다.");
            return;
          }
          throw new Error("Failed to load long video group");
        }

        const data = await response.json();
        setLongvideo(data.longvideo);
      } catch (err) {
        console.error("Error loading long video group:", err);
        setError("Long Video 그룹 데이터를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    if (groupId) {
      loadLongVideo();
    }
  }, [groupId]);

  // 영상 URL들을 merge 페이지 쿼리로 넘기기
  const getEditableUrls = () => {
    if (!longvideo) return "";

    return longvideo.videos
      .filter(
        (v): v is Required<Pick<Video, "firebaseVideoUrl" | "id">> =>
          !!v.firebaseVideoUrl
      )
      .map((v) => encodeURIComponent(v.firebaseVideoUrl))
      .join(",");
  };

  // 영상 편집하기 버튼 클릭 핸들러
  const handleEditVideos = () => {
    if (!longvideo) return;

    // 편집할 비디오 데이터 준비
    const editVideos = longvideo.videos
      .filter(
        (
          v
        ): v is Required<
          Pick<Video, "firebaseVideoUrl" | "id" | "promptText">
        > => !!v.firebaseVideoUrl
      )
      .map((video, index) => ({
        url: video.firebaseVideoUrl,
        subtitle: video.promptText || `영상 ${index + 1}`,
        trim: [0, 5] as [number, number],
        speed: "1",
        thumbnail: "",
        isSelected: true,
      }));

    // 세션 스토리지에 데이터 Save
    sessionStorage.setItem("editVideos", JSON.stringify(editVideos));
    sessionStorage.setItem("editSource", `longvideo_${longvideo.id}`);

    // merge 페이지로 이동
    router.push("/video/merge");
  };

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">🎬 Long Video 상세보기</h1>
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </main>
    );
  }

  if (error || !longvideo) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">🎬 Long Video 상세보기</h1>
        <p className="text-red-500">
          {error || "Long Video 그룹 데이터를 찾을 수 없습니다."}
        </p>
        <Link
          href="/video/my-create/video-group"
          className="mt-4 inline-block text-black/90 underline text-sm"
        >
          목록으로 돌아가기
        </Link>
      </main>
    );
  }

  const editableUrls = getEditableUrls();

  // 삭제 모달 열기
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  // 삭제 모달 닫기
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  // 실제 삭제 실행
  const handleConfirmDelete = async () => {
    if (!longvideo) return;

    try {
      setDeleting(true);

      const response = await fetch(`/api/video/longvideos/${longvideo.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "삭제에 실패했습니다.");
      }

      // 성공적으로 삭제되면 목록 페이지로 이동
      router.push("/video/my-create/video-group");
    } catch (err: any) {
      console.error("Delete error:", err);
      alert(err.message || "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold mb-2">🎬 {longvideo.title}</h1>
          {longvideo.description && (
            <p className="text-gray-600 mb-2">{longvideo.description}</p>
          )}
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>📅 생성일: {longvideo.createdAt}</span>
            <span>🔄 수정일: {longvideo.updatedAt}</span>
            <span>🎞 총 {longvideo.totalVideos}개 영상</span>
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                longvideo.status === "completed"
                  ? "bg-gray-100 text-gray-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {longvideo.status === "completed" ? "완료" : "처리중"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/video/my-create/video-group"
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            ← 목록으로
          </Link>
          <button
            onClick={handleDeleteClick}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "삭제 중..." : "🗑️ 삭제"}
          </button>
        </div>
      </div>

      {/* 메타데이터 */}
      {longvideo.metadata && Object.keys(longvideo.metadata).length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">📊 생성 정보</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {longvideo.metadata.runwayModel && (
              <div>
                <span className="text-gray-500">모델:</span>
                <div className="font-medium">
                  {longvideo.metadata.runwayModel}
                </div>
              </div>
            )}
            {longvideo.metadata.ratio && (
              <div>
                <span className="text-gray-500">비율:</span>
                <div className="font-medium">{longvideo.metadata.ratio}</div>
              </div>
            )}
            {longvideo.metadata.duration && (
              <div>
                <span className="text-gray-500">길이:</span>
                <div className="font-medium">
                  {longvideo.metadata.duration}초
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      {editableUrls && (
        <div className="flex gap-3">
          <Button onClick={handleEditVideos}>영상 편집하기</Button>
        </div>
      )}

      {/* 영상 목록 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">🎞 영상 목록</h2>
        {longvideo.videos.length === 0 ? (
          <p className="text-gray-500">영상이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {longvideo.videos.map((video, index) => (
              <div
                key={video.id}
                className="border rounded-lg p-4 bg-white shadow-sm"
              >
                <div className="mb-3">
                  <h3 className="font-semibold mb-2">영상 {index + 1}</h3>
                  {video.promptText && (
                    <p className="text-sm text-gray-600 mb-2">
                      📝 {video.promptText}
                    </p>
                  )}
                  {video.description && (
                    <p className="text-sm text-gray-500">{video.description}</p>
                  )}
                </div>

                {/* 원본 이미지 */}
                {video.imageUrl && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">원본 이미지:</p>
                    <img
                      src={ensureFirebaseUrl(video.imageUrl)}
                      alt={`Original ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                      onError={(e) => {
                        console.warn("Image load failed:", video.imageUrl);
                        (e.target as HTMLImageElement).src =
                          "/placeholder-image.png";
                      }}
                    />
                  </div>
                )}

                {/* 생성된 비디오 */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">생성된 비디오:</p>
                  {video.firebaseVideoUrl ? (
                    <video
                      src={ensureFirebaseUrl(video.firebaseVideoUrl)}
                      controls
                      className="w-full rounded-lg"
                      preload="metadata"
                      onError={(e) => {
                        console.warn(
                          "Video load failed:",
                          video.firebaseVideoUrl
                        );
                      }}
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-gray-500">비디오 로딩 중...</span>
                    </div>
                  )}
                </div>

                {/* 비디오 정보 */}
                <div className="mt-3 text-xs text-gray-500 space-y-1">
                  {video.runwayTaskId && (
                    <div>Task ID: {video.runwayTaskId}</div>
                  )}
                  {video.createdAt && <div>생성일: {video.createdAt}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && longvideo && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                영상 묶음 삭제
              </h3>
            </div>
            <p className="text-gray-700 mb-6">
              <strong>"{longvideo.title}"</strong> 영상 묶음을 삭제하시겠습니까?
              <br />
              <span className="text-sm text-gray-500">
                이 작업은 되돌릴 수 없습니다.
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                disabled={deleting}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
