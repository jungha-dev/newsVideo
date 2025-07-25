"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageLayout, Card } from "@/components/styled";
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

export default function MyCreatePage() {
  const [longvideos, setLongvideos] = useState<LongVideoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<LongVideoGroup | null>(
    null
  );
  const router = useRouter();

  // longvideos 데이터 로드
  const loadLongvideos = async () => {
    try {
      console.log("Fetching longvideos...");
      const response = await fetch("/api/video/longvideos");

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        if (response.status === 401) {
          setError("로그인이 필요합니다.");
          return;
        }
        const errorText = await response.text();
        console.error("Response error text:", errorText);
        throw new Error(`Failed to load longvideos: ${response.status}`);
      }

      const data = await response.json();
      console.log("Response data:", data);
      setLongvideos(data.longvideos || []);
    } catch (err) {
      console.error("Error loading longvideos:", err);
      setError("롱비디오 데이터를 불러오는데 실패했습니다.");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await loadLongvideos();
      setLoading(false);
    };
    loadData();
  }, []);

  // 삭제 모달 열기
  const handleDeleteClick = (group: LongVideoGroup) => {
    setGroupToDelete(group);
    setShowDeleteModal(true);
  };

  // 삭제 모달 닫기
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setGroupToDelete(null);
  };

  // 실제 삭제 실행
  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;

    try {
      setDeletingGroupId(groupToDelete.id);

      const response = await fetch(
        `/api/video/longvideos/${groupToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "삭제에 실패했습니다.");
      }

      // 성공적으로 삭제되면 목록에서 제거
      setLongvideos((prev) =>
        prev.filter((group) => group.id !== groupToDelete.id)
      );

      // 모달 닫기
      setShowDeleteModal(false);
      setGroupToDelete(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      alert(err.message || "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingGroupId(null);
    }
  };

  if (loading) {
    return (
      <PageLayout title="내가 생성한 영상 묶음">
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="내가 생성한 영상 묶음">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => {
            setError(null);
            loadLongvideos();
          }}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark"
        >
          다시 시도
        </button>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="내가 생성한 영상 묶음">
      {/* Long Videos 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {longvideos.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500 mb-4">
              아직 생성한 Long Video가 없습니다.
            </p>
            <Link
              href="/video/multi-generate"
              className="inline-block px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
            >
              🎬 Long Video 생성하기
            </Link>
          </div>
        ) : (
          longvideos.map((longvideo) => (
            <div key={longvideo.id} className="relative">
              <Card
                id={longvideo.id}
                title={`🎬 ${longvideo.title}`}
                subtitle={longvideo.description}
                className="hover:shadow-md transition-shadow relative"
                onTitleClick={() =>
                  router.push(`/video/my-create/longvideo/${longvideo.id}`)
                }
                editable={false}
                showMenu={true}
                customMenuItems={[
                  {
                    id: "detail",
                    label: "상세보기",
                    icon: "📄",
                    onClick: () =>
                      router.push(`/video/my-create/longvideo/${longvideo.id}`),
                  },
                  {
                    id: "delete",
                    label:
                      deletingGroupId === longvideo.id ? "삭제 중..." : "삭제",
                    icon: "🗑️",
                    onClick: () => handleDeleteClick(longvideo),
                    disabled: deletingGroupId === longvideo.id,
                    className: "text-red-600 hover:bg-red-50",
                  },
                ]}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>📅 {longvideo.createdAt}</span>
                      <span>🎞 {longvideo.totalVideos}개 영상</span>
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
                </div>

                {/* 썸네일 미리보기 */}
                {longvideo.videos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                    {longvideo.videos.slice(0, 4).map((video, index) => (
                      <div key={video.id} className="relative">
                        {video.imageUrl ? (
                          <img
                            src={ensureFirebaseUrl(video.imageUrl)}
                            alt={`Video ${index + 1}`}
                            className="w-full h-20 object-cover rounded-lg"
                            onError={(e) => {
                              console.warn(
                                "Image load failed:",
                                video.imageUrl
                              );
                              (e.target as HTMLImageElement).src =
                                "/placeholder-image.png";
                            }}
                          />
                        ) : (
                          <div className="w-full h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-gray-400 text-xs">
                              이미지 없음
                            </span>
                          </div>
                        )}
                        {video.promptText && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/20 text-white text-xs p-1 rounded-b-lg truncate">
                            {video.promptText}
                          </div>
                        )}
                      </div>
                    ))}
                    {longvideo.videos.length > 4 && (
                      <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-gray-500 text-sm">
                          +{longvideo.videos.length - 4}개 더
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          ))
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && groupToDelete && (
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
              <strong>"{groupToDelete.title}"</strong> 영상 묶음을
              삭제하시겠습니까?
              <br />
              <span className="text-sm text-gray-500">
                이 작업은 되돌릴 수 없습니다.
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                disabled={deletingGroupId === groupToDelete.id}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingGroupId === groupToDelete.id}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingGroupId === groupToDelete.id ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
