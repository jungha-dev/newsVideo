"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/styled";
import Link from "next/link";

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

export default function ConnectedVideoProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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

  // 프로젝트 목록 불러오기
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  // 실시간 상태 업데이트 (10초마다)
  useEffect(() => {
    if (!user || projects.length === 0) return;

    const updateInterval = setInterval(async () => {
      try {
        // 각 프로젝트의 최신 상태 가져오기
        const updatedProjects = await Promise.all(
          projects.map(async (project) => {
            try {
              // 완료된 프로젝트는 폴링하지 않음
              const completedCount = (project.videos || []).filter(
                (video: VideoGeneration) =>
                  video.status === "succeeded" || video.status === "failed"
              ).length;
              const expectedVideoCount = (project.videos || []).length;
              const isCompleted =
                completedCount >= expectedVideoCount && expectedVideoCount > 0;

              if (isCompleted) {
                return project; // 완료된 프로젝트는 업데이트하지 않음
              }

              const response = await fetch(
                `/api/video/connected-videos/status?projectId=${project.id}`,
                {
                  credentials: "include",
                }
              );
              if (response.ok) {
                const data = await response.json();
                return {
                  ...project,
                  videos: data.videos || [],
                };
              }
            } catch (error) {
              console.error(`Error updating project ${project.id}:`, error);
            }
            return project;
          })
        );

        setProjects(updatedProjects);
      } catch (error) {
        console.error("Error updating projects status:", error);
      }
    }, 10000); // 10초마다 업데이트

    return () => clearInterval(updateInterval);
  }, [user, projects]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/video/connected-videos/projects", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const projectsWithVideos = (data.projects || []).map(
          (project: any) => ({
            ...project,
            videos: project.videos || [],
          })
        );
        setProjects(projectsWithVideos);
      } else {
        setError("프로젝트 목록을 불러오는데 실패했습니다.");
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      setError("프로젝트 목록을 불러오는데 실패했습니다.");
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

  const getStatusCount = (videos: VideoGeneration[], status: string) => {
    if (status === "processing") {
      // processing과 starting을 모두 처리 중으로 간주
      return videos.filter(
        (video) => video.status === "processing" || video.status === "starting"
      ).length;
    }
    return videos.filter((video) => video.status === status).length;
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError("프로젝트 이름을 입력해주세요.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/video/connected-videos/create-project",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            project_name: newProjectName.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "프로젝트 생성에 실패했습니다.");
      }

      const data = await response.json();

      // 성공 메시지 표시
      setError(null);
      setShowCreateModal(false);
      setNewProjectName("");

      // 프로젝트 목록 새로고침
      await loadProjects();

      // 새로 생성된 프로젝트 페이지로 이동
      window.location.href = `/video/kling-v1-6-pro/projects/${data.project.id}`;
    } catch (error) {
      console.error("Error creating project:", error);
      setError(
        error instanceof Error ? error.message : "프로젝트 생성에 실패했습니다."
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg  p-6">
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">로딩 중...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg  p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            연결된 영상 프로젝트
          </h1>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            새 프로젝트 생성
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">
              아직 생성된 프로젝트가 없습니다.
            </p>
            <Link href="/video/kling-v1-6-pro/connected-videos">
              <Button variant="primary">첫 번째 프로젝트 생성하기</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="border border-gray-200 rounded-lg p-6 hover: transition-shadow"
              >
                {/* 대표 이미지 미리보기 */}
                <div className="w-full aspect-video mb-3">
                  {project.images && project.images[0] ? (
                    <img
                      src={project.images[0]}
                      alt={`${project.name} 대표 이미지`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : project.videos && project.videos[0]?.fromImage ? (
                    <img
                      src={project.videos[0].fromImage}
                      alt={`${project.name} 대표 이미지`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-lg text-gray-400 text-sm">
                      No Image
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {project.name}
                  </h3>
                  <Link href={`/video/kling-v1-6-pro/projects/${project.id}`}>
                    <Button variant="outline" size="sm">
                      보기
                    </Button>
                  </Link>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600">
                    생성일: {new Date(project.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    영상 수: {(project.videos || []).length}개
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 새 프로젝트 생성 모달 */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  새 프로젝트 생성
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewProjectName("");
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
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="프로젝트 이름을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleCreateProject();
                    }
                  }}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewProjectName("");
                    setError(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={isCreating}
                >
                  취소
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || isCreating}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? "생성 중..." : "생성"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
