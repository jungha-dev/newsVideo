"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/styled";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { v4 as uuidv4 } from "uuid";

interface ConnectedVideoRequest {
  images: string[];
  duration: 5 | 10;
  cfg_scale: number;
  aspect_ratio: "16:9" | "9:16" | "1:1";
  negative_prompt: string;
  positive_prompt: string;
  project_name: string;
}

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

export default function ConnectedVideosPage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ConnectedVideoRequest>({
    images: [],
    duration: 5,
    cfg_scale: 0.5,
    aspect_ratio: "16:9",
    negative_prompt: "",
    positive_prompt: "",
    project_name: "",
  });

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [generatedVideos, setGeneratedVideos] = useState<VideoGeneration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [uploadMethod, setUploadMethod] = useState<"file" | "url">("file");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [selectedProjectImages, setSelectedProjectImages] = useState<string[]>(
    []
  ); // 선택된 프로젝트의 이미지들
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

  // 프로젝트 목록 불러오기
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  const loadProjects = async () => {
    try {
      const response = await fetch("/api/video/connected-videos/projects", {
        credentials: "include", // ✅ 쿠키 전송
      });
      if (response.ok) {
        const data = await response.json();
        // videos 배열이 없으면 빈 배열로 초기화
        const projectsWithVideos = (data.projects || []).map(
          (project: any) => ({
            ...project,
            videos: project.videos || [],
          })
        );
        setProjects(projectsWithVideos);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  };

  // 파일 업로드 처리
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // 최대 2개 이미지 제한
    if (formData.images.length + files.length > 2) {
      setError("최대 2개의 이미지만 업로드할 수 있습니다.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Firebase Storage에 업로드
        const { ref, uploadBytes, getDownloadURL } = await import(
          "firebase/storage"
        );
        const { storage } = await import("@/lib/firebase");

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const ext = file.name.split(".").pop();
        const filename = `${uuidv4()}.${ext}`;

        const { getConnectedVideoImagePath, createSafeFilename } = await import(
          "../../../../../utils/storagePaths"
        );
        const safeFilename = createSafeFilename(file.name, "connected");
        const storagePath = getConnectedVideoImagePath({
          userId: user?.uid || "",
          filename: safeFilename,
        });
        const fileRef = ref(storage, storagePath);

        await uploadBytes(fileRef, buffer, {
          contentType: file.type,
        });

        const imageUrl = await getDownloadURL(fileRef);
        uploadedUrls.push(imageUrl);
      }

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls],
      }));
      setUploadedFiles((prev) => [...prev, ...Array.from(files)]);
    } catch (error) {
      console.error("Upload error:", error);
      setError("이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  // 이미지 순서 변경
  const moveImage = (fromIndex: number, toIndex: number) => {
    setFormData((prev) => {
      const newImages = [...prev.images];
      const [movedImage] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, movedImage);
      return { ...prev, images: newImages };
    });

    setUploadedFiles((prev) => {
      const newFiles = [...prev];
      const [movedFile] = newFiles.splice(fromIndex, 1);
      newFiles.splice(toIndex, 0, movedFile);
      return newFiles;
    });
  };

  // 이미지 제거
  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // URL로 이미지 추가
  const addImageUrl = () => {
    if (newImageUrl.trim()) {
      // 최대 2개 이미지 제한
      if (formData.images.length >= 2) {
        setError("최대 2개의 이미지만 추가할 수 있습니다.");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, newImageUrl.trim()],
      }));
      setNewImageUrl("");
    }
  };

  // 여러 URL 한번에 추가 (Generated Images에서 복사한 링크들)
  const addMultipleUrls = (urlsText: string) => {
    const urls = urlsText.split("\n").filter((url) => url.trim());
    if (urls.length > 0) {
      // 최대 2개 이미지 제한
      if (formData.images.length + urls.length > 2) {
        setError("최대 2개의 이미지만 추가할 수 있습니다.");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...urls],
      }));
    }
  };

  // 진행 상황 관련 함수들
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

  // 연결된 영상 생성
  const handleGenerateConnectedVideos = async () => {
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }

    if (formData.images.length !== 2) {
      setError("정확히 2개의 이미지가 필요합니다.");
      return;
    }

    if (!formData.project_name.trim()) {
      setError("프로젝트 이름을 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 기존 프로젝트가 선택된 경우 해당 프로젝트에 영상 추가
      const requestData = currentProject
        ? {
            ...formData,
            projectId: currentProject.id, // 기존 프로젝트 ID 추가
            project_name: currentProject.name, // 기존 프로젝트 이름 사용
          }
        : formData;

      const response = await fetch("/api/video/connected-videos/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // ✅ 쿠키 전송
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "연결된 영상 생성에 실패했습니다.");
      }

      const data = await response.json();

      // 성공 메시지 표시
      const message = currentProject
        ? `기존 프로젝트 "${currentProject.name}"에 새로운 영상이 추가되었습니다.`
        : `연결된 영상 생성이 시작되었습니다. 프로젝트: ${data.project.name}`;
      setSuccessMessage(message);

      // 생성된 프로젝트의 영상들을 실시간으로 폴링
      setCurrentProject(data.project);
      setGeneratedVideos(data.videos || []);

      // 폼 초기화
      setFormData({
        images: [],
        duration: 5,
        cfg_scale: 0.5,
        aspect_ratio: "16:9",
        negative_prompt: "",
        positive_prompt: "",
        project_name: "",
      });
      setUploadedFiles([]);
      setNewImageUrl("");
      setSelectedProjectImages([]); // 선택된 프로젝트 이미지도 초기화

      // 프로젝트 목록 새로고침
      await loadProjects();
    } catch (error) {
      console.error("Error generating connected videos:", error);
      setError(
        error instanceof Error
          ? error.message
          : "연결된 영상 생성에 실패했습니다."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 기존 프로젝트 선택 시 해당 프로젝트의 이미지들을 사용해서 영상 생성 시작
  const handleGenerateFromExistingProject = async (project: Project) => {
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }

    if (!project.images || project.images.length < 2) {
      setError("선택된 프로젝트에 충분한 이미지가 없습니다.");
      return;
    }

    if (!project.name.trim()) {
      setError("프로젝트 이름을 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/video/connected-videos/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // ✅ 쿠키 전송
        body: JSON.stringify({
          images: project.images || [],
          duration: 5,
          cfg_scale: 0.5,
          aspect_ratio: "16:9",
          negative_prompt: "",
          project_name: project.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "연결된 영상 생성에 실패했습니다.");
      }

      const data = await response.json();

      // 성공 메시지 표시
      setSuccessMessage(
        `연결된 영상 생성이 시작되었습니다. 프로젝트: ${data.project.name}`
      );

      // 생성된 프로젝트의 영상들을 실시간으로 폴링
      setCurrentProject(data.project);
      setGeneratedVideos(data.videos || []);

      // 폼 초기화
      setFormData({
        images: [],
        duration: 5,
        cfg_scale: 0.5,
        aspect_ratio: "16:9",
        negative_prompt: "",
        positive_prompt: "",
        project_name: "",
      });
      setUploadedFiles([]);
      setNewImageUrl("");

      // 프로젝트 목록 새로고침
      await loadProjects();
    } catch (error) {
      console.error("Error generating connected videos:", error);
      setError(
        error instanceof Error
          ? error.message
          : "연결된 영상 생성에 실패했습니다."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 영상 상태 폴링
  useEffect(() => {
    if (!currentProject?.id) return;

    // 이전 폴링 정리
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // 영상이 없으면 폴링하지 않음
    if (!generatedVideos || generatedVideos.length === 0) {
      console.log("폴링 중단: 영상이 없음");
      return;
    }

    // 이미 모든 영상이 완료되었는지 확인
    const initialCompletedCount = generatedVideos.filter(
      (video: VideoGeneration) =>
        video.status === "succeeded" || video.status === "failed"
    ).length;

    // 예상 영상 개수: 실제 생성된 영상 개수
    const initialExpectedVideoCount = generatedVideos.length;

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
          `/api/video/connected-videos/status?projectId=${currentProject.id}`,
          {
            credentials: "include", // ✅ 쿠키 전송
          }
        );
        if (response.ok) {
          const data = await response.json();
          const updatedVideos = data.videos || [];

          // 완료된 영상 개수 계산 (성공 + 실패)
          const completedCount = updatedVideos.filter(
            (video: VideoGeneration) =>
              video.status === "succeeded" || video.status === "failed"
          ).length;

          // 생성할 영상 개수: 실제 생성된 영상 개수
          const expectedVideoCount = updatedVideos.length;

          // 모든 영상이 완료되었는지 확인
          const allCompleted =
            completedCount >= expectedVideoCount && expectedVideoCount > 0;

          console.log(
            `폴링 상태: ${completedCount}/${expectedVideoCount} 영상 완료`,
            {
              projectId: currentProject.id,
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
            setIsGenerating(false);
            setGeneratedVideos(updatedVideos); // 마지막 상태 업데이트
            console.log(
              `폴링 중단: ${completedCount}/${expectedVideoCount} 영상 완료`
            );
            return; // 폴링 중단
          }

          // 상태 업데이트
          setGeneratedVideos(updatedVideos);
        }
      } catch (error) {
        console.error("Error polling video status:", error);
      }
    }, 10000); // 10초마다 폴링

    pollingRef.current = pollInterval;

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [currentProject?.id]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg  p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          연결된 영상 생성 - Kling v1.6 Pro
        </h1>
        <p className="text-gray-600 mb-8">
          정확히 2장의 이미지를 업로드하면 두 이미지 사이를 연결하는 영상이
          자동으로 생성됩니다.
        </p>

        {/* 성공 메시지 */}
        {successMessage && (
          <div className="mb-6 p-4 bg-primary/20 border border-primary/40 rounded-lg">
            <p className="text-primary-dark">{successMessage}</p>
          </div>
        )}

        {/* 프로젝트 선택/생성 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">프로젝트</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                새 프로젝트 이름 *
              </label>
              <input
                type="text"
                value={formData.project_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    project_name: e.target.value,
                  }))
                }
                placeholder="프로젝트 이름을 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                기존 프로젝트
              </label>
              <select
                onChange={(e) => {
                  const project = projects.find((p) => p.id === e.target.value);
                  if (project) {
                    setCurrentProject({
                      ...project,
                      videos: project.videos || [],
                    });
                    setGeneratedVideos(project.videos || []);

                    // 기존 프로젝트 선택 시 해당 프로젝트의 이미지들을 별도 상태로 Save
                    setSelectedProjectImages(project.images || []);
                    setFormData((prev) => ({
                      ...prev,
                      project_name: project.name,
                    }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">프로젝트 선택</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({(project.videos || []).length}개 영상)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 이미지 업로드 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            이미지 업로드
          </h2>

          {/* 업로드 방식 선택 */}
          <div className="mb-4">
            <div className="flex gap-4">
              <button
                onClick={() => setUploadMethod("file")}
                className={`px-4 py-2 rounded-lg border ${
                  uploadMethod === "file"
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                파일 업로드
              </button>
              <button
                onClick={() => setUploadMethod("url")}
                className={`px-4 py-2 rounded-lg border ${
                  uploadMethod === "url"
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                URL 입력
              </button>
            </div>
          </div>

          {/* 파일 업로드 */}
          {uploadMethod === "file" && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
                id="image-upload"
                disabled={isUploading}
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {isUploading ? "업로드 중..." : "이미지 선택"}
              </label>
              <p className="mt-2 text-sm text-gray-500">
                정확히 2개의 이미지를 선택하여 연결 영상을 생성합니다.
              </p>
            </div>
          )}

          {/* URL 입력 */}
          {uploadMethod === "url" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="이미지 URL을 입력하세요"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <Button
                  onClick={addImageUrl}
                  disabled={!newImageUrl.trim()}
                  variant="primary"
                  size="sm"
                >
                  추가
                </Button>
              </div>

              <p className="text-sm text-gray-500">
                정확히 2개의 이미지 URL을 입력하세요. Generated Images에서
                복사한 링크들을 한 줄에 하나씩 입력하거나, 직접 이미지 URL을
                입력할 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* 업로드된 이미지 목록 */}
        {formData.images.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              이미지 순서 ({formData.images.length}개)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {formData.images.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`이미지 ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <div className="absolute top-2 left-2 bg-black/20 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => removeImage(index)}
                      className="bg-red-500 text-white p-1 rounded-full text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    {index > 0 && (
                      <button
                        onClick={() => moveImage(index, index - 1)}
                        className="bg-primary text-white p-1 rounded text-xs hover:bg-primary"
                      >
                        ↑
                      </button>
                    )}
                    {index < formData.images.length - 1 && (
                      <button
                        onClick={() => moveImage(index, index + 1)}
                        className="bg-primary text-white p-1 rounded text-xs hover:bg-primary"
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 설정 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            생성 설정
          </h2>
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
                    aspect_ratio: e.target.value as "16:9" | "9:16" | "1:1",
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

          <div className="mt-4">
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

          <div className="mt-4">
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
              rows={3}
            />
          </div>
        </div>

        {/* 생성 정보 및 버튼 */}
        <div className="mb-8">
          {/* 예상 영상 수 표시 */}
          {formData.images.length === 2 && (
            <div className="text-center mb-4 p-4 bg-primary/10 border border-primary/40 rounded-lg">
              <p className="text-primary-dark font-medium">
                예상 생성 영상: 1개
              </p>
              <p className="text-primary text-sm mt-1">
                2개 이미지 → 1개 연결 영상
              </p>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              onClick={handleGenerateConnectedVideos}
              disabled={
                isGenerating ||
                formData.images.length !== 2 ||
                !formData.project_name.trim()
              }
              variant="primary"
              size="lg"
              className="px-8 py-3"
            >
              {isGenerating ? "연결된 영상 생성 중..." : "연결된 영상 생성하기"}
            </Button>
          </div>
        </div>

        {/* 오류 표시 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* 생성 중인 영상 상태 */}
        {generatedVideos.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                생성 중인 영상들 ({generatedVideos.length}개)
              </h2>
              {/* 진행 상황 표시 */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${getProgressPercentage(generatedVideos)}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">
                    {getCompletedCount(generatedVideos)} /{" "}
                    {generatedVideos.length}
                  </span>
                </div>

                {/* 상태 요약 */}
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-secondary text-black text-xs rounded">
                    완료: {getStatusCount(generatedVideos, "succeeded")}
                  </span>
                  <span className="px-2 py-1 bg-primary/20 text-primary-dark text-xs rounded">
                    처리중: {getStatusCount(generatedVideos, "processing")}
                  </span>
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                    실패: {getStatusCount(generatedVideos, "failed")}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedVideos.map((video, index) => (
                <div key={video.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">영상 {index + 1}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        video.status === "succeeded"
                          ? "bg-secondary text-black"
                          : video.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : video.status === "processing"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {video.status === "succeeded"
                        ? "완료"
                        : video.status === "failed"
                        ? "실패"
                        : video.status === "processing"
                        ? "처리 중"
                        : video.status === "starting"
                        ? "시작 중"
                        : "대기"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <p>
                      이미지 {index + 1} → 이미지 {index + 2}
                    </p>
                  </div>
                  {video.output && (
                    <div className="mt-3">
                      <video
                        src={video.output}
                        controls
                        className="w-full h-32 object-cover rounded"
                      />
                      <div className="mt-2 flex gap-2">
                        <Button
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = video.output!;
                            link.download = `video-${index + 1}.mp4`;
                            link.click();
                          }}
                          variant="outline"
                          size="sm"
                        >
                          다운로드
                        </Button>
                        <Button
                          onClick={() =>
                            navigator.clipboard.writeText(video.output!)
                          }
                          variant="outline"
                          size="sm"
                        >
                          URL 복사
                        </Button>
                      </div>
                    </div>
                  )}
                  {video.output && video.output.includes("firebase") && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-red-600 text-sm">
                        ⚠️ Firebase Storage 접근 권한 문제로 영상을 불러올 수
                        없습니다.
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        관리자가 이 문제를 해결하고 있습니다.
                      </p>
                    </div>
                  )}
                  {video.error && (
                    <p className="text-red-600 text-sm mt-2">
                      오류: {video.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 기존 프로젝트 영상들 */}
        {currentProject &&
          currentProject.videos?.length > 0 &&
          generatedVideos.length === 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                {currentProject.name} 프로젝트 영상들
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(currentProject.videos || []).map((video, index) => (
                  <div key={video.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">영상 {index + 1}</h3>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          video.status === "succeeded"
                            ? "bg-secondary text-black"
                            : video.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {video.status === "succeeded" ? "완료" : "실패"}
                      </span>
                    </div>
                    {video.output && !video.output.includes("firebase") && (
                      <div className="mt-3">
                        <video
                          src={video.output}
                          controls
                          className="w-full h-32 object-cover rounded"
                          onError={(e) => {
                            console.error("Video loading error:", e);
                            e.currentTarget.style.display = "none";
                            const errorDiv = document.createElement("div");
                            errorDiv.className =
                              "text-red-600 text-sm p-2 bg-red-50 rounded";
                            errorDiv.textContent =
                              "영상 로드 실패. 다시 시도해주세요.";
                            e.currentTarget.parentNode?.appendChild(errorDiv);
                          }}
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = video.output!;
                              link.download = `video-${index + 1}.mp4`;
                              link.click();
                            }}
                            variant="outline"
                            size="sm"
                          >
                            다운로드
                          </Button>
                          <Button
                            onClick={() =>
                              navigator.clipboard.writeText(video.output!)
                            }
                            variant="outline"
                            size="sm"
                          >
                            URL 복사
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
