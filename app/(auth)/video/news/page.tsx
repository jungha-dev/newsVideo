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

  useEffect(() => {
    if (user) {
      loadVideos();
    }
  }, [user]);

  const loadVideos = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userVideos = await getNewsVideosByUser(user.uid);
      setVideos(userVideos);
    } catch (err) {
      console.error("Error loading videos:", err);
      setError("비디오를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (!user) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <PageTitle title="뉴스 비디오" />
        <div className="text-center py-8">
          <p className="text-gray-600">로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <PageTitle title="뉴스 비디오" />

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">내 뉴스 비디오</h2>
        <Link href="/news">
          <Button variant="primary" size="sm">
            새 뉴스 비디오 만들기
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-600 mt-2">비디오를 불러오는 중...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🎬</div>
          <p className="text-gray-600 mb-4">
            아직 생성된 뉴스 비디오가 없습니다.
          </p>
          <Link href="/news">
            <Button variant="primary">첫 번째 뉴스 비디오 만들기</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <Link key={video.id} href={`/video/news/${video.id}`}>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                {/* 썸네일 */}
                <div className="aspect-video bg-gray-100 relative">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-4xl">🎬</div>
                    </div>
                  )}

                  {/* 상태 배지 */}
                  <div className="absolute top-2 right-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        video.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : video.status === "processing"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {video.status === "completed"
                        ? "완료"
                        : video.status === "processing"
                        ? "처리중"
                        : "실패"}
                    </span>
                  </div>

                  {/* 처리 중일 때 로딩 애니메이션 */}
                  {video.status === "processing" && (
                    <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>

                {/* 정보 */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {video.title}
                  </h3>

                  {video.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {video.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{video.scenes.length}개 씬</span>
                    <span>{formatDate(video.createdAt)}</span>
                  </div>

                  {video.model && (
                    <div className="mt-2">
                      <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                        {video.model}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
