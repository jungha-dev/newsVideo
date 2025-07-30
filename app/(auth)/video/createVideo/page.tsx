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
    return new Intl.DateTimeFormat("en-US", {
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
        <PageTitle title="Generated Video" />
        <div className="text-center py-8">
          <p className="text-gray-600">Please login.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Link key={video.id} href={`/video/createVideo/${video.id}`}>
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
                          <span className="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded">
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
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {video.title}
                    </h3>

                    {video.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-1">
                        {video.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{video.scenes.length} Scene</span>
                      <span>{formatDate(video.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
