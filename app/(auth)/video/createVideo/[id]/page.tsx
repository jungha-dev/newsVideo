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

  // 각 씬의 개별 상태를 관리하는 상태 추가
  const [sceneVideos, setSceneVideos] = useState<any[]>([]);

  // Scene별 상태 계산 - 개별 씬 비디오 상태 확인
  const getSceneStatus = (scene: any, index: number) => {
    // 씬에 videoUrl이 있으면 완료
    if (scene.videoUrl) return "completed";

    // sceneVideos에서 해당 씬의 상태 확인
    const sceneVideo = sceneVideos.find((sv) => sv.sceneIndex === index);
    if (sceneVideo) {
      return sceneVideo.status;
    }

    // 기본 상태
    if (video?.status === "processing") return "processing";
    if (video?.status === "failed") return "failed";
    return "pending";
  };
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<string | undefined>(undefined);
  const isRegeneratingRef = useRef<boolean>(false);

  // 체크된 씬들을 관리하는 상태 - scene_number로 관리
  const [selectedScenes, setSelectedScenes] = useState<Set<number>>(new Set());

  // 비디오가 로드되면 모든 씬을 기본으로 체크 (scene_number 사용)
  useEffect(() => {
    if (video && video.scenes.length > 0 && selectedScenes.size === 0) {
      setSelectedScenes(
        new Set(video.scenes.map((scene) => scene.scene_number - 1))
      );
    }
  }, [video]);

  // 씬 체크박스 토글 함수 - scene_number 사용
  const toggleSceneSelection = (sceneIndex: number) => {
    setSelectedScenes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sceneIndex)) {
        newSet.delete(sceneIndex);
      } else {
        newSet.add(sceneIndex);
      }
      return newSet;
    });
  };

  // 모든 씬 선택/해제 함수
  const toggleAllScenes = () => {
    if (!video) return;

    if (selectedScenes.size === video.scenes.length) {
      setSelectedScenes(new Set());
    } else {
      setSelectedScenes(new Set(video.scenes.map((_, index) => index)));
    }
  };

  // 체크된 씬들만 필터링
  const selectedSceneList =
    video?.scenes?.filter((_, index) => selectedScenes.has(index)) || [];

  const videoId = params.id as string;

  useEffect(() => {
    if (videoId) {
      loadVideo();
    }
  }, [videoId]);

  // 비디오 상태 폴링
  useEffect(() => {
    const currentStatus = video?.status;

    // 각 씬의 개별 상태 확인
    const hasIncompleteScenes = sceneVideos.some(
      (sv) => sv.status === "starting" || sv.status === "processing"
    );

    // Add Scenes 중이거나 Regenerate 중이거나 처리 중이면 폴링
    const shouldPoll =
      isRegeneratingRef.current ||
      currentStatus === "processing" ||
      hasIncompleteScenes;

    console.log("Polling check:", {
      isRegenerating: isRegeneratingRef.current,
      currentStatus,
      hasIncompleteScenes,
      sceneVideosCount: sceneVideos.length,
      shouldPoll,
    });

    if (!shouldPoll) {
      if (pollingRef.current) {
        console.log("Stopping polling - no active processes");
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // 이미 폴링 중이면 중복 시작하지 않음
    if (pollingRef.current) {
      console.log("Polling already active, skipping");
      return;
    }

    console.log("Starting polling...", {
      isRegenerating: isRegeneratingRef.current,
      currentStatus,
      hasIncompleteScenes,
      sceneVideosCount: sceneVideos.length,
    });

    // 즉시 한 번 상태 확인
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/video/news/status/${videoId}`);
        if (response.ok) {
          const data = await response.json();
          console.log("Polling update:", data.video.status);
          setVideo(data.video);

          // 씬 비디오 데이터도 함께 업데이트
          await loadSceneVideos();

          // 모든 씬이 완료되었는지 확인
          const updatedSceneVideos = data.sceneVideos || [];
          const allScenesCompleted = updatedSceneVideos.every(
            (sv) => sv.status === "completed" || sv.status === "failed"
          );

          // 완료되면 폴링 중단
          if (
            (data.video.status === "completed" ||
              data.video.status === "failed") &&
            allScenesCompleted
          ) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            // Regenerate 완료 시 플래그 리셋
            isRegeneratingRef.current = false;
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    // 즉시 실행
    checkStatus();

    // 10초마다 상태 확인
    pollingRef.current = setInterval(checkStatus, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [video?.status, videoId, sceneVideos]); // sceneVideos 의존성 다시 추가

  const loadVideo = async () => {
    try {
      setLoading(true);
      const videoData = await getNewsVideoById(user?.uid || "", videoId);
      if (videoData) {
        setVideo(videoData);
        // 씬 비디오 데이터도 함께 로드
        await loadSceneVideos();
      } else {
        setError("Video not found.");
      }
    } catch (err) {
      console.error("Error loading video:", err);
      setError("Failed to load video.");
    } finally {
      setLoading(false);
    }
  };

  // 씬 비디오 데이터 로드
  const loadSceneVideos = async () => {
    if (!user || !videoId) return;

    try {
      const response = await fetch(`/api/video/news/scene-videos/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        setSceneVideos(data.sceneVideos || []);
      }
    } catch (error) {
      console.error("Error loading scene videos:", error);
    }
  };

  const formatDate = (date: any) => {
    try {
      // Firestore Timestamp를 Date로 변환
      const dateObj = date?.toDate ? date.toDate() : new Date(date);

      // 유효한 날짜인지 확인
      if (isNaN(dateObj.getTime())) {
        return "No date information available.";
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
      return "No date information available.";
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
        return "Completed";
      case "processing":
        return "Processing";
      case "failed":
        return "Failed";
      case "pending":
        return "Pending";
      case "starting":
        return "Starting";
      case "succeeded":
        return "Completed";
      default:
        return "Unknown";
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
      // Regenerate 시작 플래그 설정
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
      setError("Please enter both the prompt and the narration.");
      return;
    }

    setIsAddingScene(true);
    setError("");

    try {
      // Add Scenes 시작 플래그 설정
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
          isAddScene: true, // 새로운 Add Scenes 플래그
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
        throw new Error(errorData.error || "SceneFailed to add.");
      }
    } catch (error) {
      console.error("Error adding scene:", error);
      setError(error instanceof Error ? error.message : "SceneFailed to add.");
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

    // Scene 번호 재정렬
    newScenes.forEach((scene, index) => {
      scene.scene_number = index + 1;
    });

    // selectedScenes 인덱스 재매핑
    const newSelectedScenes = new Set<number>();
    selectedScenes.forEach((selectedIndex) => {
      let newIndex = selectedIndex;

      if (selectedIndex === fromIndex) {
        // 이동된 씬
        newIndex = toIndex;
      } else if (fromIndex < toIndex) {
        // 뒤로 이동하는 경우
        if (selectedIndex > fromIndex && selectedIndex <= toIndex) {
          newIndex = selectedIndex - 1;
        }
      } else if (fromIndex > toIndex) {
        // 앞으로 이동하는 경우
        if (selectedIndex >= toIndex && selectedIndex < fromIndex) {
          newIndex = selectedIndex + 1;
        }
      }

      newSelectedScenes.add(newIndex);
    });

    setSelectedScenes(newSelectedScenes);
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
      setError("Only completed videos can be merged. ");
      return;
    }

    setIsMerging(true);
    setMergeProgress("Merging videos…");
    setMergeProgressMessages([]);

    try {
      const requestBody = {
        videoId: videoId,
        subtitleColor,
        subtitleStyle,
        showSubtitles,
      };

      console.log("Merge request data:", requestBody);

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

  // Firebase Storage 업로드 기능
  const handleUploadToFirebase = async () => {
    if (!video || !user) return;

    try {
      console.log("📤 Firebase Storage 업로드 시작...");

      // 각 Scene에 대해 Firebase Storage 업로드
      for (let i = 0; i < video.scenes.length; i++) {
        const scene = video.scenes[i];
        if (scene.videoUrl) {
          console.log(
            `📤 Scene ${i + 1} Firebase Storage 업로드: ${scene.videoUrl}`
          );

          const response = await fetch(`/api/video/news/status/${videoId}`);
          if (response.ok) {
            const data = await response.json();
            console.log(
              `✅ Scene ${i + 1} Firebase Storage 업로드 완료:`,
              data
            );

            // 업데이트된 Scene Info 확인
            const updatedScene = data.video?.scenes?.[i];
            if (updatedScene?.firebaseUrl) {
              console.log(
                `🔗 Scene ${i + 1} Firebase URL: ${updatedScene.firebaseUrl}`
              );

              // 비디오 데이터 업데이트
              const updatedScenes = [...video.scenes];
              updatedScenes[i] = {
                ...updatedScenes[i],
                videoUrl: updatedScene.firebaseUrl,
                firebaseUrl: updatedScene.firebaseUrl,
              } as any;
              setVideo({ ...video, scenes: updatedScenes });
            }
          } else {
            console.error(
              `❌ Scene ${i + 1} Firebase Storage 업로드 실패:`,
              response.statusText
            );
          }
        }
      }

      console.log("🎉 Firebase Storage 업로드 완료!");

      // 업데이트된 데이터 다시 로드
      await loadVideo();
    } catch (error) {
      console.error("❌ Firebase Storage 업로드 실패:", error);
    }
  };

  // 개별 Scene Firebase Storage 업로드 기능
  const handleUploadSceneToFirebase = async (sceneIndex: number) => {
    if (!video || !user) return;

    try {
      const scene = video.scenes[sceneIndex];
      if (!scene.videoUrl) {
        console.log(`❌ Scene ${sceneIndex + 1}: 비디오 URL이 없습니다.`);
        return;
      }

      console.log(`📤 Scene ${sceneIndex + 1} Firebase Storage 업로드 시작...`);
      console.log(`📤 원본 URL: ${scene.videoUrl}`);

      const response = await fetch(`/api/video/news/status/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        console.log(
          `✅ Scene ${sceneIndex + 1} Firebase Storage 업로드 완료:`,
          data
        );

        // 업데이트된 Scene Info 확인
        const updatedScene = data.video?.scenes?.[sceneIndex];
        if (updatedScene?.firebaseUrl) {
          console.log(
            `🔗 Scene ${sceneIndex + 1} Firebase URL: ${
              updatedScene.firebaseUrl
            }`
          );

          // 비디오 데이터 업데이트
          const updatedScenes = [...video.scenes];
          updatedScenes[sceneIndex] = {
            ...updatedScenes[sceneIndex],
            videoUrl: updatedScene.firebaseUrl,
            firebaseUrl: updatedScene.firebaseUrl,
          } as any;
          setVideo({ ...video, scenes: updatedScenes });
        }

        // 업데이트된 데이터 다시 로드
        await loadVideo();
      } else {
        console.error(
          `❌ Scene ${sceneIndex + 1} Firebase Storage 업로드 실패:`,
          response.statusText
        );
      }
    } catch (error) {
      console.error(
        `❌ Scene ${sceneIndex + 1} Firebase Storage 업로드 실패:`,
        error
      );
    }
  };

  if (!user) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <PageTitle title="Generated Video" />
        <div className="text-center py-8">
          <p className="text-gray-600">로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <PageTitle title="Generated Video" />
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
        <PageTitle title="Generated Video" />
        <div className="text-center py-8">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-gray-600 mb-4">{error || "Video not found."}</p>
          <Link href="/video/news">
            <Button variant="primary">Generated Video 목록으로 돌아가기</Button>
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
              <p className="text-red-800">Video generation failed.</p>
            </div>
          ) : video.scenes.some((scene) => scene.videoUrl) ? (
            <VideoPreview
              videos={(selectedSceneList.length > 0
                ? selectedSceneList
                : modifiedScenes.length > 0
                ? modifiedScenes
                : video.scenes
              )
                .filter((scene) => scene.videoUrl)
                .map((scene, index) => ({
                  id: `scene-${scene.scene_number}-${scene.videoUrl}`, // videoUrl을 포함하여 고유 ID 생성
                  output: scene.videoUrl,
                  status: "completed",
                  fromImage: "", // Scene 이미지가 없으므로 빈 문자열
                  toImage: "", // Scene 이미지가 없으므로 빈 문자열
                  narration: scene.narration || "", // 나레이션 추가
                }))}
              projectInfo={{
                name: video.title,
                created_at: new Date().toISOString(),
                totalVideos: (selectedSceneList.length > 0
                  ? selectedSceneList
                  : video.scenes
                ).filter((scene) => scene.videoUrl).length,
                completedCount: (selectedSceneList.length > 0
                  ? selectedSceneList
                  : video.scenes
                ).filter((scene) => scene.videoUrl).length,
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

        {/* Scene Info */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Scene Info</h3>
            <div className="flex items-center gap-2">
              {/* 전체 선택/해제 체크박스 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    selectedScenes.size === video.scenes.length &&
                    video.scenes.length > 0
                  }
                  onChange={toggleAllScenes}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-600">전체 선택</span>
              </div>

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
                Add Scenes
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {video.scenes.map((scene, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 transition-colors border-gray-200 hover:border-gray-300 ${
                  selectedScenes.has(index) ? "border-blue-300 bg-blue-50" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {/* 개별 씬 체크박스 */}
                    <input
                      type="checkbox"
                      checked={selectedScenes.has(index)}
                      onChange={() => toggleSceneSelection(index)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <h4 className="font-medium text-sm">
                      Scene {scene.scene_number}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        getSceneStatus(scene, index)
                      )}`}
                    >
                      {getStatusText(getSceneStatus(scene, index))}
                    </span>
                  </div>
                </div>

                {/* Scene 비디오 플레이어 */}
                {(scene as any).firebaseUrl || scene.videoUrl ? (
                  <div className="mb-3">
                    <div className="bg-gray-100 rounded-lg overflow-hidden">
                      <video
                        controls
                        className="w-full h-auto max-h-90 object-cover"
                        preload="metadata"
                      >
                        <source
                          src={(scene as any).firebaseUrl || scene.videoUrl}
                          type="video/mp4"
                        />
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
                    <strong className="block mb-1 text-xs">Prompt :</strong>
                    <p className="text-gray-700 bg-gray-50 p-1 rounded text-xs line-clamp-2">
                      {scene.image_prompt}
                    </p>
                  </div>
                  <div>
                    <strong className="block mb-1 text-xs">Narration :</strong>
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
                  {(scene as any).firebaseUrl || scene.videoUrl ? (
                    <Button
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href =
                          (scene as any).firebaseUrl || scene.videoUrl!;
                        link.download = `scene-${scene.scene_number}.mp4`;
                        link.click();
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs py-1"
                    >
                      Download
                    </Button>
                  ) : null}
                  {scene.videoUrl && !(scene as any).firebaseUrl && (
                    <Button
                      onClick={() => handleUploadSceneToFirebase(index)}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs py-1 bg-green-50 border-green-200 hover:bg-green-100"
                    >
                      Upload
                    </Button>
                  )}
                  <Button
                    onClick={() => handleRegenerateScene(index)}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs py-1 bg-blue-50 border-blue-200 hover:bg-blue-100"
                  >
                    Regenerate
                  </Button>
                </div>
              </div>
            ))}

            {/* Regenerate 입력 폼 */}
            {showRegenerateForm && (
              <div className="border rounded-lg p-3 transition-colors border-blue-300 bg-blue-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm text-blue-900">
                    Scene {regenerateSceneIndex! + 1} Regenerate
                  </h4>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    편집 모드
                  </span>
                </div>

                <div className="space-y-3">
                  {/* 프롬프트 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Prompt :
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
                      Narration :
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
                      Regenerate start
                    </Button>
                    <Button
                      onClick={handleCancelRegenerate}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs py-1"
                    >
                      cancle
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Scenes 폼 */}
            {showAddSceneForm && (
              <div className="border rounded-lg p-3 transition-colors border-green-300 bg-green-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm text-green-900">
                    Add Scene
                  </h4>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Add Scene Mode
                  </span>
                </div>

                <div className="space-y-3">
                  {/* 프롬프트 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Prompt:
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
                      placeholder="Please enter image prompt"
                    />
                  </div>

                  {/* 나레이션 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Narration:
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
                      placeholder="please enter narration"
                    />
                  </div>

                  {/* 이미지 URL 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Image URL (optional):
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
                      {isAddingScene ? "Generating..." : "Add Scenes"}
                    </Button>
                    <Button
                      onClick={handleCancelAddScene}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs py-1"
                    >
                      cancel
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
