"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getNewsVideoById, updateNewsVideo } from "@/lib/firebase/newsVideo";
import { NewsVideo } from "@/lib/types/newsVideo";
import { PageTitle, Section, Button, VideoPreview } from "@/components/styled";
import Link from "next/link";

export default function NewsVideoDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [video, setVideo] = useState<NewsVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [generatedVideos, setGeneratedVideos] = useState<string[]>([]);
  const [videoStatuses, setVideoStatuses] = useState<{ [key: number]: string }>(
    {}
  );
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [regenerateSceneIndex, setRegenerateSceneIndex] = useState<
    number | null
  >(null);
  const [regenerateForm, setRegenerateForm] = useState({
    image_prompt: "",
    narration: "",
    imageUrl: "",
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [modifiedScenes, setModifiedScenes] = useState<any[]>([]);
  const [showAddSceneForm, setShowAddSceneForm] = useState(false);
  const [isAddingScene, setIsAddingScene] = useState(false);
  const [addSceneForm, setAddSceneForm] = useState({
    image_prompt: "",
    narration: "",
    imageUrl: "",
  });

  // 자막 미리보기 관련 상태
  const [subtitleColor, setSubtitleColor] = useState("#ffffff");
  const [subtitleStyle, setSubtitleStyle] = useState<"box" | "outline">("box");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState("");
  const [mergeProgressMessages, setMergeProgressMessages] = useState<string[]>(
    []
  );

  // 씬별 상태 계산
  const getSceneStatus = (scene: any, index: number) => {
    if (scene.videoUrl) return "completed";
    if (video?.status === "processing") return "processing";
    if (video?.status === "failed") return "failed";
    return "pending";
  };
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<string | undefined>(undefined);
  const isRegeneratingRef = useRef<boolean>(false);

  const videoId = params.id as string;

  useEffect(() => {
    if (videoId) {
      loadVideo();
    }
  }, [videoId]);

  // 비디오 상태 폴링
  useEffect(() => {
    const currentStatus = video?.status;

    // 재생성 중이 아니고 처리 중이 아니면 폴링하지 않음
    if (!isRegeneratingRef.current && currentStatus !== "processing") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // 상태가 변경되지 않았으면 아무것도 하지 않음
    if (currentStatus === previousStatusRef.current) {
      return;
    }

    // 이전 상태 업데이트
    previousStatusRef.current = currentStatus;

    if (!video || currentStatus !== "processing") {
      // 처리 중이 아니면 폴링 중단
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // 이미 폴링 중이면 중복 시작하지 않음
    if (pollingRef.current) {
      return;
    }

    // 즉시 한 번 상태 확인
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/video/news/status/${videoId}`);
        if (response.ok) {
          const data = await response.json();
          console.log("Polling update:", data.video.status);
          setVideo(data.video);

          // 완료되면 폴링 중단
          if (
            data.video.status === "completed" ||
            data.video.status === "failed"
          ) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            // 재생성 완료 시 플래그 리셋
            isRegeneratingRef.current = false;
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    // 즉시 실행
    checkStatus();

    // 10초마다 상태 확인 (폴링 간격 증가)
    pollingRef.current = setInterval(checkStatus, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [video?.status, videoId]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      const videoData = await getNewsVideoById(videoId);
      if (videoData) {
        setVideo(videoData);
      } else {
        setError("비디오를 찾을 수 없습니다.");
      }
    } catch (err) {
      console.error("Error loading video:", err);
      setError("비디오를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: any) => {
    try {
      // Firestore Timestamp를 Date로 변환
      const dateObj = date?.toDate ? date.toDate() : new Date(date);

      // 유효한 날짜인지 확인
      if (isNaN(dateObj.getTime())) {
        return "날짜 정보 없음";
      }

      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(dateObj);
    } catch (error) {
      console.error("Date formatting error:", error);
      return "날짜 정보 없음";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "succeeded":
        return "bg-green-100 text-green-800";
      case "processing":
      case "starting":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "완료";
      case "processing":
        return "처리중";
      case "failed":
        return "실패";
      case "pending":
        return "대기";
      case "starting":
        return "시작";
      case "succeeded":
        return "완료";
      default:
        return "알 수 없음";
    }
  };

  const getProgressPercentage = () => {
    if (!video) return 0;

    const totalScenes = video.scenes.length;
    const completedScenes = video.scenes.filter(
      (scene) => scene.videoUrl
    ).length;

    return Math.round((completedScenes / totalScenes) * 100);
  };

  const handleRegenerateScene = (sceneIndex: number) => {
    const scene = video?.scenes[sceneIndex];
    if (scene) {
      setRegenerateForm({
        image_prompt: scene.image_prompt,
        narration: scene.narration,
        imageUrl: scene.imageUrl || "",
      });
      setRegenerateSceneIndex(sceneIndex);
      setShowRegenerateForm(true);
    }
  };

  const handleRegenerateSubmit = async () => {
    if (!video || regenerateSceneIndex === null) return;

    try {
      // 재생성 시작 플래그 설정
      isRegeneratingRef.current = true;

      const response = await fetch(`/api/video/news/regenerate-scene`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId: videoId,
          sceneIndex: regenerateSceneIndex,
          sceneData: regenerateForm,
        }),
      });

      if (response.ok) {
        // 폼 초기화
        setShowRegenerateForm(false);
        setRegenerateSceneIndex(null);
        setRegenerateForm({
          image_prompt: "",
          narration: "",
          imageUrl: "",
        });

        // 비디오 상태를 다시 로드
        await loadVideo();
      } else {
        console.error("Failed to regenerate scene");
        isRegeneratingRef.current = false;
      }
    } catch (error) {
      console.error("Error regenerating scene:", error);
      isRegeneratingRef.current = false;
    }
  };

  const handleCancelRegenerate = () => {
    setShowRegenerateForm(false);
    setRegenerateSceneIndex(null);
    setRegenerateForm({
      image_prompt: "",
      narration: "",
      imageUrl: "",
    });
  };

  const handleAddScene = () => {
    setShowAddSceneForm(true);
    setAddSceneForm({
      image_prompt: "",
      narration: "",
      imageUrl: "",
    });
  };

  const handleAddSceneSubmit = async () => {
    if (!video) return;

    if (!addSceneForm.image_prompt.trim() || !addSceneForm.narration.trim()) {
      setError("프롬프트와 나레이션을 모두 입력해주세요.");
      return;
    }

    setIsAddingScene(true);
    setError("");

    try {
      // 씬 추가 시작 플래그 설정
      isRegeneratingRef.current = true;

      const response = await fetch(`/api/video/news/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId: videoId,
          scenes: [
            {
              scene_number: 0, // 임시 값, 서버에서 자동 할당
              image_prompt: addSceneForm.image_prompt.trim(),
              narration: addSceneForm.narration.trim(),
              imageUrl: addSceneForm.imageUrl.trim() || "",
            },
          ],
          isAddScene: true, // 새로운 씬 추가 플래그
          title: video.title, // 기존 비디오 제목
          prompts: [addSceneForm.image_prompt.trim()], // 임시 값
          narrations: [addSceneForm.narration.trim()], // 임시 값
          model: video.model, // 기존 비디오 모델
          aspectRatio: video.aspectRatio, // 기존 비디오 길이
          duration: video.duration, // 기존 비디오 길이
        }),
      });

      if (response.ok) {
        // 폼 닫기 및 초기화
        setShowAddSceneForm(false);
        setAddSceneForm({
          image_prompt: "",
          narration: "",
          imageUrl: "",
        });

        // 비디오 정보 새로고침
        await loadVideo();
      } else {
        const errorData = await response.json();
        console.error("API Error Response:", errorData);
        throw new Error(errorData.error || "씬 추가에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error adding scene:", error);
      setError(
        error instanceof Error ? error.message : "씬 추가에 실패했습니다."
      );
      // 에러 발생 시 플래그 리셋
      isRegeneratingRef.current = false;
    } finally {
      setIsAddingScene(false);
    }
  };

  const handleCancelAddScene = () => {
    setShowAddSceneForm(false);
    setAddSceneForm({
      image_prompt: "",
      narration: "",
      imageUrl: "",
    });
    setError("");
  };

  const handleSceneOrderChange = (fromIndex: number, toIndex: number) => {
    if (!video) return;

    const newScenes = [...video.scenes];
    const [movedScene] = newScenes.splice(fromIndex, 1);
    newScenes.splice(toIndex, 0, movedScene);

    // 씬 번호 재정렬
    newScenes.forEach((scene, index) => {
      scene.scene_number = index + 1;
    });

    setModifiedScenes(newScenes);
    setHasUnsavedChanges(true);

    // 비디오 상태도 업데이트하여 VideoPreview에 반영
    setVideo((prev) => (prev ? { ...prev, scenes: newScenes } : null));
  };

  const handleNarrationChange = (sceneIndex: number, newNarration: string) => {
    if (!video) return;

    const newScenes = [
      ...(modifiedScenes.length > 0 ? modifiedScenes : video.scenes),
    ];
    newScenes[sceneIndex] = {
      ...newScenes[sceneIndex],
      narration: newNarration,
    };

    setModifiedScenes(newScenes);
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!video || !hasUnsavedChanges) return;

    try {
      const response = await fetch(`/api/video/news/update-scenes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId: videoId,
          scenes: modifiedScenes,
        }),
      });

      if (response.ok) {
        setHasUnsavedChanges(false);
        setModifiedScenes([]);
        await loadVideo(); // 비디오 정보 다시 로드
      } else {
        console.error("Failed to save changes");
      }
    } catch (error) {
      console.error("Error saving changes:", error);
    }
  };

  // 영상 병합 기능
  const handleMergeAndDownload = async () => {
    if (!video || video.status !== "completed") {
      setError("완료된 영상만 병합할 수 있습니다.");
      return;
    }

    setIsMerging(true);
    setMergeProgress("영상을 병합하고 있습니다...");
    setMergeProgressMessages([]);

    try {
      const requestBody = {
        videoId: videoId,
        subtitleColor,
        subtitleStyle,
        showSubtitles,
      };

      console.log("병합 요청 데이터:", requestBody);

      const response = await fetch(`/api/video/news/merge-videos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();

        // 진행 상황 메시지 업데이트
        if (data.progress) {
          setMergeProgressMessages(data.progress);
        }

        // base64 데이터를 Blob으로 변환
        const videoData = atob(data.video);
        const bytes = new Uint8Array(videoData.length);
        for (let i = 0; i < videoData.length; i++) {
          bytes[i] = videoData.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        setMergedVideoUrl(url);
        setMergeProgress("병합 완료!");
      } else {
        const errorData = await response.json();
        console.error("병합 API 에러:", errorData);
        setError(errorData.error || "영상 병합에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error merging videos:", error);
      setError("영상 병합 중 오류가 발생했습니다.");
    } finally {
      setIsMerging(false);
    }
  };

  const handleDownload = () => {
    if (mergedVideoUrl) {
      const link = document.createElement("a");
      link.href = mergedVideoUrl;
      link.download = `${video?.title || "news-video"}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <PageTitle title="뉴스 비디오" />
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-600 mt-2">비디오를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <PageTitle title="뉴스 비디오" />
        <div className="text-center py-8">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-gray-600 mb-4">
            {error || "비디오를 찾을 수 없습니다."}
          </p>
          <Link href="/video/news">
            <Button variant="primary">뉴스 비디오 목록으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* 비디오 정보 */}
        {/* 비디오 플레이어 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {video.status === "failed" ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">비디오 생성에 실패했습니다.</p>
            </div>
          ) : video.scenes.some((scene) => scene.videoUrl) ? (
            <VideoPreview
              videos={(modifiedScenes.length > 0
                ? modifiedScenes
                : video.scenes
              )
                .filter((scene) => scene.videoUrl)
                .map((scene, index) => ({
                  id: `scene-${scene.scene_number}-${scene.videoUrl}`, // videoUrl을 포함하여 고유 ID 생성
                  output: scene.videoUrl,
                  status: "completed",
                  fromImage: "", // 씬 이미지가 없으므로 빈 문자열
                  toImage: "", // 씬 이미지가 없으므로 빈 문자열
                  narration: scene.narration || "", // 나레이션 추가
                }))}
              projectInfo={{
                name: video.title,
                created_at: new Date().toISOString(),
                totalVideos: video.scenes.filter((scene) => scene.videoUrl)
                  .length,
                completedCount: video.scenes.filter((scene) => scene.videoUrl)
                  .length,
                processingCount: 0,
                failedCount: 0,
              }}
              info={{
                model: video.model,
                status: video.status,
                createdAt: (() => {
                  const createdAt = video.createdAt as any;
                  if (createdAt?.toDate) {
                    return createdAt.toDate().toISOString();
                  } else if (createdAt instanceof Date) {
                    return createdAt.toISOString();
                  } else {
                    return new Date().toISOString();
                  }
                })(),
              }}
              onVideoOrderChange={handleSceneOrderChange}
              subtitleColor={subtitleColor}
              subtitleStyle={subtitleStyle}
              showSubtitles={showSubtitles}
              onSubtitleColorChange={setSubtitleColor}
              onSubtitleStyleChange={setSubtitleStyle}
              onShowSubtitlesChange={setShowSubtitles}
              onMergeAndDownload={handleMergeAndDownload}
              isMerging={isMerging}
              mergedVideoUrl={mergedVideoUrl || undefined}
              onDownload={handleDownload}
              mergeProgress={mergeProgress}
              mergeProgressMessages={mergeProgressMessages}
            />
          ) : video.status === "processing" ? (
            <div className="bg-gray-100 rounded aspect-video flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
                <p className="text-gray-600">비디오 생성 중...</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded aspect-video flex items-center justify-center">
              <p className="text-gray-600">비디오가 없습니다</p>
            </div>
          )}
        </div>

        {/* 씬 정보 */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">씬 정보</h3>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <>
                  <span className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    변경사항이 있습니다. 변경사항을 저장하시겠습니까?
                  </span>
                  <Button
                    onClick={handleSaveChanges}
                    variant="primary"
                    size="sm"
                    className="text-xs"
                  >
                    저장
                  </Button>
                </>
              )}
              <Button
                onClick={handleAddScene}
                variant="primary"
                size="sm"
                className="text-xs"
              >
                씬 추가
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {video.scenes.map((scene, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 transition-colors border-gray-200 hover:border-gray-300`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">
                    씬 {scene.scene_number}
                  </h4>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      getSceneStatus(scene, index)
                    )}`}
                  >
                    {getStatusText(getSceneStatus(scene, index))}
                  </span>
                </div>

                {/* 씬 비디오 플레이어 */}
                {scene.videoUrl ? (
                  <div className="mb-3">
                    <div className="bg-gray-100 rounded-lg overflow-hidden">
                      <video
                        controls
                        className="w-full h-auto max-h-90 object-cover"
                        preload="metadata"
                      >
                        <source src={scene.videoUrl} type="video/mp4" />
                        브라우저가 비디오를 지원하지 않습니다.
                      </video>
                    </div>
                  </div>
                ) : getSceneStatus(scene, index) === "processing" ? (
                  <div className="mb-3 bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-1"></div>
                      <p className="text-xs text-gray-600">생성 중...</p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
                    <p className="text-xs text-gray-600">비디오 없음</p>
                  </div>
                )}

                <div className="text-xs text-gray-600 space-y-2">
                  <div>
                    <strong className="block mb-1 text-xs">프롬프트:</strong>
                    <p className="text-gray-700 bg-gray-50 p-1 rounded text-xs line-clamp-2">
                      {scene.image_prompt}
                    </p>
                  </div>
                  <div>
                    <strong className="block mb-1 text-xs">나레이션:</strong>
                    <textarea
                      value={
                        modifiedScenes[index]?.narration || scene.narration
                      }
                      onChange={(e) =>
                        handleNarrationChange(index, e.target.value)
                      }
                      className="w-full text-gray-700 bg-gray-50 p-1 rounded text-xs border border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-300 resize-none"
                      rows={2}
                      placeholder="나레이션을 입력하세요"
                    />
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {scene.videoUrl && (
                    <Button
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = scene.videoUrl!;
                        link.download = `scene-${scene.scene_number}.mp4`;
                        link.click();
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs py-1"
                    >
                      다운로드
                    </Button>
                  )}
                  <Button
                    onClick={() => handleRegenerateScene(index)}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs py-1 bg-blue-50 border-blue-200 hover:bg-blue-100"
                  >
                    재생성
                  </Button>
                </div>
              </div>
            ))}

            {/* 재생성 입력 폼 */}
            {showRegenerateForm && (
              <div className="border rounded-lg p-3 transition-colors border-blue-300 bg-blue-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm text-blue-900">
                    씬 {regenerateSceneIndex! + 1} 재생성
                  </h4>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    편집 모드
                  </span>
                </div>

                <div className="space-y-3">
                  {/* 프롬프트 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      프롬프트:
                    </label>
                    <textarea
                      value={regenerateForm.image_prompt}
                      onChange={(e) =>
                        setRegenerateForm((prev) => ({
                          ...prev,
                          image_prompt: e.target.value,
                        }))
                      }
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                      placeholder="이미지 프롬프트를 입력하세요"
                    />
                  </div>

                  {/* 나레이션 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      나레이션:
                    </label>
                    <textarea
                      value={regenerateForm.narration}
                      onChange={(e) =>
                        setRegenerateForm((prev) => ({
                          ...prev,
                          narration: e.target.value,
                        }))
                      }
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                      placeholder="나레이션을 입력하세요"
                    />
                  </div>

                  {/* 이미지 URL 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      이미지 URL (선택사항):
                    </label>
                    <input
                      type="url"
                      value={regenerateForm.imageUrl}
                      onChange={(e) =>
                        setRegenerateForm((prev) => ({
                          ...prev,
                          imageUrl: e.target.value,
                        }))
                      }
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRegenerateSubmit}
                      variant="primary"
                      size="sm"
                      className="flex-1 text-xs py-1"
                    >
                      재생성 시작
                    </Button>
                    <Button
                      onClick={handleCancelRegenerate}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs py-1"
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 씬 추가 폼 */}
            {showAddSceneForm && (
              <div className="border rounded-lg p-3 transition-colors border-green-300 bg-green-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm text-green-900">
                    새 씬 추가
                  </h4>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    추가 모드
                  </span>
                </div>

                <div className="space-y-3">
                  {/* 프롬프트 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      프롬프트:
                    </label>
                    <textarea
                      value={addSceneForm.image_prompt}
                      onChange={(e) =>
                        setAddSceneForm((prev) => ({
                          ...prev,
                          image_prompt: e.target.value,
                        }))
                      }
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={2}
                      placeholder="이미지 프롬프트를 입력하세요"
                    />
                  </div>

                  {/* 나레이션 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      나레이션:
                    </label>
                    <textarea
                      value={addSceneForm.narration}
                      onChange={(e) =>
                        setAddSceneForm((prev) => ({
                          ...prev,
                          narration: e.target.value,
                        }))
                      }
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={2}
                      placeholder="나레이션을 입력하세요"
                    />
                  </div>

                  {/* 이미지 URL 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      이미지 URL (선택사항):
                    </label>
                    <input
                      type="url"
                      value={addSceneForm.imageUrl}
                      onChange={(e) =>
                        setAddSceneForm((prev) => ({
                          ...prev,
                          imageUrl: e.target.value,
                        }))
                      }
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddSceneSubmit}
                      variant="primary"
                      size="sm"
                      className="flex-1 text-xs py-1 bg-green-600 hover:bg-green-700"
                      disabled={
                        !addSceneForm.image_prompt.trim() ||
                        !addSceneForm.narration.trim() ||
                        isAddingScene
                      }
                    >
                      {isAddingScene ? "추가 중..." : "씬 추가"}
                    </Button>
                    <Button
                      onClick={handleCancelAddScene}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs py-1"
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
