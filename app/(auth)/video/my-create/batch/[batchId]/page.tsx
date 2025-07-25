"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface VideoDoc {
  id: string;
  firebaseVideoUrl?: string;
  promptText?: string;
  taskId?: string;
}

interface BatchData {
  batchId: string;
  createdAt: string;
  videos: VideoDoc[];
}

export default function BatchDetailPage() {
  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  const params = useParams();
  const batchId = params.batchId as string;
  const menuRef = useRef<HTMLDivElement>(null);

  // 배치 데이터 로드
  const loadBatchData = async () => {
    if (!batchId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/video/batches/${batchId}`);

      if (!response.ok) {
        if (response.status === 401) {
          setError("로그인이 필요합니다.");
          return;
        }
        if (response.status === 404) {
          setError("배치를 찾을 수 없습니다.");
          return;
        }
        throw new Error("Failed to load batch data");
      }

      const data = await response.json();
      setBatchData(data.batch);
    } catch (err) {
      console.error("Error loading batch data:", err);
      setError("배치 데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 배치 삭제
  const deleteBatch = async () => {
    if (!batchData) return;

    try {
      setDeleting(true);

      const response = await fetch("/api/video/delete-batch", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batchId: batchData.batchId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete batch");
      }

      const result = await response.json();
      console.log("Batch deleted successfully:", result);

      // 성공적으로 삭제되면 목록 페이지로 이동
      router.push("/video/my-create/video-group");
    } catch (err) {
      console.error("Error deleting batch:", err);
      alert(
        `삭제 중 오류가 발생했습니다: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // 삭제 확인 모달 열기
  const openDeleteModal = () => {
    setShowDeleteModal(true);
    setShowMenu(false); // 메뉴 닫기
  };

  // 삭제 확인 모달 닫기
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
  };

  // 메뉴 토글
  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    loadBatchData();
  }, [batchId]);

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">📦 Batch 상세보기</h1>
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </main>
    );
  }

  if (error || !batchData) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">📦 Batch 상세보기</h1>
        <p className="text-red-500">
          {error || "배치 데이터를 찾을 수 없습니다."}
        </p>
        <Link
          href="/video/my-create/video-group"
          className="mt-4 inline-block -black/90 underline text-sm"
        >
          목록으로 돌아가기
        </Link>
      </main>
    );
  }

  // 영상 URL들을 merge 페이지 쿼리로 넘기기
  const editableUrls = batchData.videos
    .filter(
      (v): v is Required<Pick<VideoDoc, "firebaseVideoUrl" | "id">> =>
        !!v.firebaseVideoUrl
    )
    .map((v) => encodeURIComponent(v.firebaseVideoUrl))
    .join(",");

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">📦 Batch 상세보기</h1>
          <p className="text-gray-500">ID: {batchData.batchId}</p>
          <p className="text-gray-500">생성일: {batchData.createdAt}</p>
        </div>
        <div className="flex gap-2">
          {editableUrls && (
            <Link
              href={{ pathname: "/video/merge", query: { urls: editableUrls } }}
              className="inline-block bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary-dark"
            >
              ✂️ 영상 편집
            </Link>
          )}

          {/* 드롭다운 메뉴 */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={toggleMenu}
              disabled={deleting}
              className="p-2 text-black hover:text-gray-800 hover:bg-gray-100 rounded-xl disabled:opacity-50"
              title="옵션 메뉴"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {/* 드롭다운 메뉴 내용 */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md  border-1 border-gray-200 z-10">
                <div className="py-1">
                  <button
                    onClick={openDeleteModal}
                    disabled={deleting}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
                  >
                    <span>🗑️</span>
                    {deleting ? "삭제 중..." : "삭제"}
                  </button>
                  {/* 향후 추가할 수 있는 메뉴 항목들 */}
                  {/* 
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                    <span>📋</span>
                    복사
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                    <span>✏️</span>
                    이름 변경
                  </button>
                  */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {batchData.videos.map((video) => (
          <div
            key={video.id}
            className="border p-4 rounded-xl shadow space-y-2"
          >
            {video.firebaseVideoUrl ? (
              <video src={video.firebaseVideoUrl} controls className="w-full" />
            ) : (
              <div className="w-full h-40 flex items-center justify-center bg-gray-100 text-gray-500">
                🔄 처리 중…
              </div>
            )}

            <p className="text-sm text-gray-600">
              📝 prompt : {video.promptText || "No prompt"}
            </p>
          </div>
        ))}
      </div>

      <Link
        href="/video/my-create/video-group"
        className="-black/90 underline text-sm block mt-2"
      >
        ← 목록으로 돌아가기
      </Link>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
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

            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                <strong>"{batchData.batchId}"</strong> 배치를 삭제하시겠습니까?
              </p>
              <div className="bg-red-50 border-1 border-red-200 rounded-xl p-3">
                <p className="text-red-700 text-sm">
                  ⚠️ <strong>되돌릴 수 없습니다!</strong>
                </p>
                <ul className="text-red-600 text-sm mt-2 space-y-1">
                  <li>
                    • {batchData.videos.length}개의 영상 파일이 영구적으로
                    삭제됩니다
                  </li>
                  <li>
                    • 배치 정보와 영상 데이터가 데이터베이스에서 제거됩니다
                  </li>
                  <li>• 이 작업은 취소할 수 없습니다</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-4 py-2 text-black border-1 border-secondary  rounded-xl hover:bg-secondary-dark/20  disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={deleteBatch}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "정말 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
