"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { Button, VideoPreview } from "@/components/styled";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ensureFirebaseUrl } from "@/lib/firebase";

interface VideoGeneration {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string;
  error?: string;
  fromImage: string;
  toImage: string;
  index: number;
}

interface Project {
  id: string;
  name: string;
  videos: VideoGeneration[];
  images?: string[];
  created_at: string;
  updated_at: string;
}

export default function ConnectedVideoProjectDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    startImage: "",
    endImage: "",
    positive_prompt: "",
    duration: 5 as 5 | 10,
    cfg_scale: 0.5,
    aspect_ratio: "16:9" as "16:9" | "9:16" | "1:1",
    negative_prompt: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [sortedVideos, setSortedVideos] = useState<VideoGeneration[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 로그인 후 ID 토큰을 __session 쿠키에 Save
  useEffect(() => {
    const setSessionCookie = async () => {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        document.cookie = `__session=${token}; path=/`;
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setSessionCookie();
    });

    return () => unsubscribe();
  }, []);

  // 프로젝트 정보 불러오기
  useEffect(() => {
    if (user && projectId) {
      loadProject();
    }
  }, [user, projectId]);

  // 영상 상태 폴링
  useEffect(() => {
    if (!project) return;

    // 이전 폴링 정리
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // 영상이 없으면 폴링하지 않음
    if (!project.videos || project.videos.length === 0) {
      console.log("폴링 중단: 영상이 없음");
      return;
    }

    // 이미 모든 영상이 완료되었는지 확인
    const initialCompletedCount = project.videos.filter(
      (video: VideoGeneration) =>
        video.status === "succeeded" || video.status === "failed"
    ).length;
    const initialExpectedVideoCount = project.videos.length;

    if (
      initialCompletedCount >= initialExpectedVideoCount &&
      initialExpectedVideoCount > 0
    ) {
      console.log(
        `폴링 중단: 이미 모든 영상 완료 (${initialCompletedCount}/${initialExpectedVideoCount})`
      );
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/video/connected-videos/status?projectId=${projectId}`,
          {
            credentials: "include",
          }
        );
        if (response.ok) {
          const data = await response.json();
          const updatedVideos = data.videos || [];

          setProject((prev) =>
            prev
              ? {
                  ...prev,
                  videos: updatedVideos,
                }
              : null
          );

          // 완료된 영상 개수 계산 (성공 + 실패)
          const completedCount = updatedVideos.filter(
            (video: VideoGeneration) =>
              video.status === "succeeded" || video.status === "failed"
          ).length;

          // 생성할 영상 개수 (실제 영상 개수)
          const expectedVideoCount = updatedVideos.length;

          // 모든 영상이 완료되었는지 확인
          const allCompleted =
            completedCount >= expectedVideoCount && expectedVideoCount > 0;

          console.log(
            `폴링 상태: ${completedCount}/${expectedVideoCount} 영상 완료`,
            {
              projectId,
              totalVideos: updatedVideos.length,
              completedCount,
              expectedVideoCount,
              allCompleted,
              videoStatuses: updatedVideos.map((v) => ({
                id: v.id,
                status: v.status,
              })),
            }
          );

          if (allCompleted) {
            clearInterval(pollInterval);
            pollingRef.current = null;
            console.log(
              `폴링 중단: ${completedCount}/${expectedVideoCount} 영상 완료`
            );
          }
        }
      } catch (error) {
        console.error("Error polling video status:", error);
      }
    }, 3000);

    pollingRef.current = pollInterval;

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [project, projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);

      // 1. 프로젝트 기본 정보 로드
      const projectsResponse = await fetch(
        "/api/video/connected-videos/projects",
        {
          credentials: "include",
        }
      );
      if (!projectsResponse.ok) {
        setError("프로젝트 정보를 불러오는데 실패했습니다.");
        return;
      }

      const projectsData = await projectsResponse.json();
      const foundProject = projectsData.projects?.find(
        (p: any) => p.id === projectId
      );

      if (!foundProject) {
        setError("프로젝트를 찾을 수 없습니다.");
        return;
      }

      // 2. 최신 영상 상태 로드
      const statusResponse = await fetch(
        `/api/video/connected-videos/status?projectId=${projectId}`,
        {
          credentials: "include",
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setProject({
          ...foundProject,
          videos: statusData.videos || [],
        });
      } else {
        // status API 실패 시 기본 프로젝트 정보만 사용
        setProject({
          ...foundProject,
          videos: foundProject.videos || [],
        });
      }
    } catch (error) {
      console.error("Error loading project:", error);
      setError("프로젝트 정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded":
        return "bg-secondary text-black";
      case "failed":
        return "bg-red-100 text-red-800";
      case "processing":
        return "bg-primary/20 text-primary-dark";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "succeeded":
        return "완료";
      case "failed":
        return "실패";
      case "processing":
        return "처리중";
      case "starting":
        return "시작";
      default:
        return status;
    }
  };

  const getCompletedCount = (videos: VideoGeneration[]) => {
    return videos.filter(
      (video) => video.status === "succeeded" || video.status === "failed"
    ).length;
  };

  const getProgressPercentage = (videos: VideoGeneration[]) => {
    if (videos.length === 0) return 0;
    const completed = getCompletedCount(videos);
    return Math.round((completed / videos.length) * 100);
  };

  const getStatusCount = (videos: VideoGeneration[], status: string) => {
    if (status === "processing") {
      // processing과 starting을 모두 처리 중으로 간주
      return videos.filter(
        (video) => video.status === "processing" || video.status === "starting"
      ).length;
    }
    return videos.filter((video) => video.status === status).length;
  };

  const handleCreateVideo = async () => {
    if (!formData.startImage.trim() || !formData.endImage.trim()) {
      setError("시작 이미지와 끝 이미지를 모두 입력해주세요.");
      return;
    }

    if (!project) {
      setError("프로젝트 정보를 찾을 수 없습니다.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/video/connected-videos/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          projectId: project.id,
          project_name: project.name,
          images: [formData.startImage.trim(), formData.endImage.trim()],
          duration: formData.duration,
          cfg_scale: formData.cfg_scale,
          aspect_ratio: formData.aspect_ratio,
          negative_prompt: formData.negative_prompt,
          positive_prompt: formData.positive_prompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "영상 생성에 실패했습니다.");
      }

      const data = await response.json();

      // 성공 시 모달 닫기 및 폼 초기화
      setShowCreateModal(false);
      setFormData({
        startImage: "",
        endImage: "",
        positive_prompt: "",
        duration: 5,
        cfg_scale: 0.5,
        aspect_ratio: "16:9",
        negative_prompt: "",
      });

      // 프로젝트 정보 새로고침
      await loadProject();
    } catch (error) {
      console.error("Error creating video:", error);
      setError(
        error instanceof Error ? error.message : "영상 생성에 실패했습니다."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditProject = async () => {
    if (!editProjectName.trim()) {
      setError("프로젝트 이름을 입력해주세요.");
      return;
    }

    if (!project) {
      setError("프로젝트 정보를 찾을 수 없습니다.");
      return;
    }

    setIsEditing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/video/connected-videos/projects/${project.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: editProjectName.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "프로젝트 수정에 실패했습니다.");
      }

      // 성공 시 모달 닫기 및 프로젝트 정보 새로고침
      setShowEditModal(false);
      setEditProjectName("");
      await loadProject();
    } catch (error) {
      console.error("Error editing project:", error);
      setError(
        error instanceof Error ? error.message : "프로젝트 수정에 실패했습니다."
      );
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) {
      setError("프로젝트 정보를 찾을 수 없습니다.");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/video/connected-videos/projects/${project.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "프로젝트 삭제에 실패했습니다.");
      }

      // 성공 시 프로젝트 목록 페이지로 이동
      window.location.href = "/video/kling-v1-6-pro/projects";
    } catch (error) {
      console.error("Error deleting project:", error);
      setError(
        error instanceof Error ? error.message : "프로젝트 삭제에 실패했습니다."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // 재생 포함 체크박스 토글
  const toggleVideoSelection = (videoId: string) => {
    const newSelectedVideos = new Set(selectedVideos);
    if (newSelectedVideos.has(videoId)) {
      newSelectedVideos.delete(videoId);
    } else {
      newSelectedVideos.add(videoId);
    }
    setSelectedVideos(newSelectedVideos);
  };

  // 완료된 영상들만 자동 선택
  const selectCompletedVideos = () => {
    const completedVideoIds = sortedVideos
      .filter((video) => video.status === "succeeded")
      .map((video) => video.id);
    setSelectedVideos(new Set(completedVideoIds));
  };

  // 영상 순서 초기화
  const resetVideoOrder = () => {
    setSortedVideos([...(project?.videos || [])]);
  };

  // 프로젝트 로드 시 영상 순서 초기화
  useEffect(() => {
    if (project?.videos) {
      setSortedVideos([...project.videos]);
      // 완료된 영상들만 자동 선택
      const completedVideoIds = project.videos
        .filter((video) => video.status === "succeeded")
        .map((video) => video.id);
      setSelectedVideos(new Set(completedVideoIds));
    }
  }, [project?.videos]);

  if (loading) {
    return (
      <div className="mx-auto px-4 py-8">
        <div className="bg-white rounded-lg p-6">
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">로딩 중...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto px-4 py-8">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">
              {error || "프로젝트를 찾을 수 없습니다."}
            </p>
            <Link href="/video/kling-v1-6-pro/projects">
              <Button variant="primary">프로젝트 목록으로 돌아가기</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-4 py-8">
      <div className="bg-white rounded-lg p-6">
        {/* VideoPreview 컴포넌트 추가 */}
        <div className="mb-8">
          <VideoPreview
            videos={sortedVideos.filter((video) =>
              selectedVideos.has(video.id)
            )}
            projectInfo={{
              name: project.name,
              created_at: project.created_at,
              totalVideos: sortedVideos.filter((video) =>
                selectedVideos.has(video.id)
              ).length,
              completedCount: getCompletedCount(
                sortedVideos.filter((video) => selectedVideos.has(video.id))
              ),
              processingCount: getStatusCount(
                sortedVideos.filter((video) => selectedVideos.has(video.id)),
                "processing"
              ),
              failedCount: getStatusCount(
                sortedVideos.filter((video) => selectedVideos.has(video.id)),
                "failed"
              ),
            }}
            onEditProject={() => {
              setEditProjectName(project.name);
              setShowEditModal(true);
            }}
            onVideoOrderChange={(fromIndex, toIndex) => {
              const newVideos = [...sortedVideos];
              [newVideos[fromIndex], newVideos[toIndex]] = [
                newVideos[toIndex],
                newVideos[fromIndex],
              ];
              setSortedVideos(newVideos);
            }}
          />
        </div>

        {/* 영상 목록 */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">
              영상 목록 ({sortedVideos.length}개)
            </h2>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              영상 추가
            </Button>
          </div>

          {sortedVideos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">아직 생성된 영상이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {sortedVideos.map((video, index) => (
                  <div
                    key={video.id}
                    className={`border rounded-lg p-4 ${
                      selectedVideos.has(video.id)
                        ? "border-secondary-light border-2"
                        : "border-secondary-dark"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedVideos.has(video.id)}
                          onChange={() => toggleVideoSelection(video.id)}
                          className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                        />
                        <h3 className="font-medium text-gray-900">
                          영상 {index + 1}
                        </h3>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs ${getStatusColor(
                          video.status
                        )}`}
                      >
                        {getStatusText(video.status)}
                      </span>
                    </div>

                    {/* 이미지 쌍 */}
                    <div className="flex gap-2 mb-3">
                      <div className="flex-1">
                        <img
                          src={video.fromImage}
                          alt={`From ${index + 1}`}
                          className="w-full object-cover rounded"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          시작 이미지
                        </p>
                      </div>
                      <div className="flex items-center text-gray-400">→</div>
                      <div className="flex-1">
                        <img
                          src={video.toImage}
                          alt={`To ${index + 1}`}
                          className="w-full object-cover rounded"
                        />
                        <p className="text-xs text-gray-500 mt-1">끝 이미지</p>
                      </div>
                    </div>

                    {/* 생성된 영상 */}
                    {video.output && !video.output.includes("firebase") && (
                      <div className="mt-3">
                        <video
                          src={video.output || undefined}
                          controls
                          className="w-full object-cover rounded"
                          onError={(e) => {
                            const videoElement = e.currentTarget;
                            const videoUrl = videoElement.src;
                            console.error("Video loading error:", {
                              videoId: video.id,
                              videoUrl: videoUrl,
                              videoStatus: video.status,
                              error: e,
                              networkState: videoElement.networkState,
                              readyState: videoElement.readyState,
                            });

                            videoElement.style.display = "none";
                            const errorDiv = document.createElement("div");
                            errorDiv.className =
                              "text-red-600 text-sm p-2 bg-red-50 rounded";
                            errorDiv.innerHTML = `
                              <div class="font-medium">영상 로드 실패</div>
                              <div class="text-xs text-gray-600 mt-1">
                                URL: ${
                                  videoUrl
                                    ? videoUrl.substring(0, 50) + "..."
                                    : "없음"
                                }<br>
                                상태: ${video.status}<br>
                                네트워크 상태: ${videoElement.networkState}
                              </div>
                            `;
                            videoElement.parentNode?.appendChild(errorDiv);
                          }}
                          onLoadStart={() => {
                            console.log(
                              `영상 로딩 시작: ${video.id}`,
                              video.output
                            );
                          }}
                          onCanPlay={() => {
                            console.log(`영상 재생 가능: ${video.id}`);
                          }}
                        />
                      </div>
                    )}

                    {/* Firebase URL 영상 */}
                    {video.output && video.output.includes("firebase") && (
                      <div className="mt-3">
                        <video
                          src={ensureFirebaseUrl(video.output)}
                          controls
                          className="w-full object-cover rounded"
                          onError={(e) => {
                            const videoElement = e.currentTarget;
                            const videoUrl = videoElement.src;
                            console.error("Firebase video loading error:", {
                              videoId: video.id,
                              videoUrl: videoUrl,
                              videoStatus: video.status,
                              error: e,
                              networkState: videoElement.networkState,
                              readyState: videoElement.readyState,
                            });

                            videoElement.style.display = "none";
                            const errorDiv = document.createElement("div");
                            errorDiv.className =
                              "text-red-600 text-sm p-2 bg-red-50 rounded";
                            errorDiv.innerHTML = `
                              <div class="font-medium">Firebase 영상 로드 실패</div>
                              <div class="text-xs text-gray-600 mt-1">
                                URL: ${
                                  videoUrl
                                    ? videoUrl.substring(0, 50) + "..."
                                    : "없음"
                                }<br>
                                상태: ${video.status}<br>
                                네트워크 상태: ${videoElement.networkState}
                              </div>
                            `;
                            videoElement.parentNode?.appendChild(errorDiv);
                          }}
                          onLoadStart={() => {
                            console.log(
                              `Firebase 영상 로딩 시작: ${video.id}`,
                              video.output
                            );
                          }}
                          onCanPlay={() => {
                            console.log(`Firebase 영상 재생 가능: ${video.id}`);
                          }}
                        />
                      </div>
                    )}

                    {/* 오류 메시지 */}
                    {video.error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-red-600 text-sm">
                          오류: {video.error}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 영상 생성 모달 */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  새 영상 생성
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      startImage: "",
                      endImage: "",
                      positive_prompt: "",
                      duration: 5,
                      cfg_scale: 0.5,
                      aspect_ratio: "16:9",
                      negative_prompt: "",
                    });
                    setError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* 이미지 입력 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      시작 이미지 URL *
                    </label>
                    <input
                      type="url"
                      value={formData.startImage}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          startImage: e.target.value,
                        }))
                      }
                      placeholder="시작 이미지 URL을 입력하세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      끝 이미지 URL *
                    </label>
                    <input
                      type="url"
                      value={formData.endImage}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          endImage: e.target.value,
                        }))
                      }
                      placeholder="끝 이미지 URL을 입력하세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                {/* 프롬프트 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    프롬프트 (선택사항)
                  </label>
                  <textarea
                    value={formData.positive_prompt}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        positive_prompt: e.target.value,
                      }))
                    }
                    placeholder="영상에서 원하는 스타일, 분위기, 요소들을 자세히 설명하세요..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows={3}
                  />
                </div>

                {/* 설정 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      영상 길이
                    </label>
                    <select
                      value={formData.duration}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          duration: parseInt(e.target.value) as 5 | 10,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value={5}>5초</option>
                      <option value={10}>10초</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      화면 비율
                    </label>
                    <select
                      value={formData.aspect_ratio}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          aspect_ratio: e.target.value as
                            | "16:9"
                            | "9:16"
                            | "1:1",
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="16:9">16:9 (가로)</option>
                      <option value="9:16">9:16 (세로)</option>
                      <option value="1:1">1:1 (정사각형)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CFG Scale: {formData.cfg_scale}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={formData.cfg_scale}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          cfg_scale: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>유연함 (0)</span>
                      <span>정확함 (1)</span>
                    </div>
                  </div>
                </div>

                {/* 제외할 요소 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제외할 요소 (선택사항)
                  </label>
                  <textarea
                    value={formData.negative_prompt}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        negative_prompt: e.target.value,
                      }))
                    }
                    placeholder="영상에서 제외하고 싶은 요소들을 입력하세요..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows={2}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({
                        startImage: "",
                        endImage: "",
                        positive_prompt: "",
                        duration: 5,
                        cfg_scale: 0.5,
                        aspect_ratio: "16:9",
                        negative_prompt: "",
                      });
                      setError(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    disabled={isCreating}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleCreateVideo}
                    disabled={
                      !formData.startImage.trim() ||
                      !formData.endImage.trim() ||
                      isCreating
                    }
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? "생성 중..." : "영상 생성"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 프로젝트 수정 모달 */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  프로젝트 수정
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditProjectName("");
                    setError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  프로젝트 이름 *
                </label>
                <input
                  type="text"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  placeholder="프로젝트 이름을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleEditProject();
                    }
                  }}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="flex justify-between items-center">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="px-4 py-2 text-red-600 hover:text-red-800"
                  disabled={isEditing}
                >
                  삭제
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditProjectName("");
                      setError(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    disabled={isEditing}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleEditProject}
                    disabled={!editProjectName.trim() || isEditing}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEditing ? "수정 중..." : "수정"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 프로젝트 삭제 확인 모달 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-red-900">
                  프로젝트 삭제
                </h2>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  정말로 이 프로젝트를 삭제하시겠습니까?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm font-medium mb-2">
                    ⚠️ 주의사항
                  </p>
                  <ul className="text-red-700 text-sm space-y-1">
                    <li>• 프로젝트와 모든 영상이 영구적으로 삭제됩니다</li>
                    <li>• 삭제된 데이터는 복구할 수 없습니다</li>
                    <li>• 프로젝트 목록 페이지로 이동합니다</li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setError(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? "삭제 중..." : "삭제"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
