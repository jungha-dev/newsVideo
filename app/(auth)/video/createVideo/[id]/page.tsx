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

  // 삭제 관련 상태
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // 더보기 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".relative")) {
        const menus = document.querySelectorAll('[id^="menu-"]');
        menus.forEach((menu) => {
          menu.classList.add("hidden");
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

    // Add Scenes 중이거나 Regenerate 중이거나 처리 중이거나 개별 씬이 미완료 상태면 폴링
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
      incompleteScenes: sceneVideos
        .filter((sv) => sv.status === "starting" || sv.status === "processing")
        .map((sv) => ({
          sceneIndex: sv.sceneIndex,
          status: sv.status,
        })),
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
      reason: isRegeneratingRef.current
        ? "Regenerating"
        : currentStatus === "processing"
        ? "Video processing"
        : hasIncompleteScenes
        ? "Incomplete scenes"
        : "Unknown",
    });

    // 즉시 한 번 상태 확인
    const checkStatus = async () => {
      try {
        console.log("🔄 상태 확인 시작...");
        const response = await fetch(`/api/video/news/status/${videoId}`);
        if (response.ok) {
          const data = await response.json();
          console.log(" 상태 확인 응답:", {
            videoStatus: data.video.status,
            sceneCount: data.video.scenes?.length || 0,
            sceneVideosCount: data.sceneVideos?.length || 0,
          });

          // 씬 데이터 상세 로깅
          if (data.video.scenes) {
            console.log("🔍 씬 데이터 상세:");
            data.video.scenes.forEach((scene: any, index: number) => {
              console.log(`   Scene ${index + 1}:`, {
                videoUrl: scene.videoUrl || "없음",
                firebaseUrl: scene.firebaseUrl || "없음",
                output: scene.output || "없음",
              });
            });
          }

          // sceneVideos 데이터도 로깅
          if (data.sceneVideos) {
            console.log("🔍 Scene Videos 데이터:");
            data.sceneVideos.forEach((sv: any) => {
              console.log(`   Scene ${sv.sceneIndex + 1}:`, {
                status: sv.status,
                replicateStatus: sv.replicateStatus || "unknown",
                videoUrl: sv.videoUrl || "없음",
                firebaseUrl: sv.firebaseUrl || "없음",
                output: sv.output || "없음",
              });
            });
          }

          console.log("Polling update:", data.video.status);
          setVideo(data.video);

          // 씬 비디오 데이터도 함께 업데이트
          await loadSceneVideos();

          // 모든 씬이 완료되었는지 확인
          const updatedSceneVideos = data.sceneVideos || [];
          const allScenesCompleted = updatedSceneVideos.every(
            (sv) => sv.status === "completed" || sv.status === "failed"
          );

          console.log(" 완료 상태 확인:", {
            allScenesCompleted,
            sceneVideosStatus: updatedSceneVideos.map((sv) => sv.status),
            videoStatus: data.video.status,
            incompleteScenes: updatedSceneVideos
              .filter(
                (sv) => sv.status === "starting" || sv.status === "processing"
              )
              .map((sv) => ({
                sceneIndex: sv.sceneIndex,
                status: sv.status,
              })),
          });

          // 모든 씬이 완료되면 폴링 중단
          if (allScenesCompleted) {
            console.log("✅ 모든 씬 완료 - 폴링 중단");
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            // Regenerate 완료 시 플래그 리셋
            isRegeneratingRef.current = false;
          }
        } else {
          console.error(
            "❌ 상태 확인 실패:",
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    // 즉시 실행
    checkStatus();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [video?.status, videoId, sceneVideos.length]);

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
        return "bg-secondary text-black";
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

        // sceneVideos도 다시 로드하여 폴링이 제대로 작동하도록 함
        await loadSceneVideos();

        console.log("✅ Add Scene 완료 - 폴링 시작");
        console.log(
          " 현재 sceneVideos 상태:",
          sceneVideos.map((sv) => ({
            sceneIndex: sv.sceneIndex,
            status: sv.status,
            replicatePredictionId: sv.replicatePredictionId,
          }))
        );
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

  const handleCopyPrompt = async (sceneIndex: number) => {
    if (!video) return;

    const scene = video.scenes[sceneIndex];
    try {
      await navigator.clipboard.writeText(scene.image_prompt);
      console.log("✅ Prompt copied to clipboard");
    } catch (error) {
      console.error("Failed to copy prompt:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = scene.image_prompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      console.log("✅ Prompt copied to clipboard (fallback)");
    }
  };

  const handleDeleteScene = async (sceneIndex: number) => {
    if (!video || video.scenes.length <= 1) return;

    const sceneToDelete = video.scenes[sceneIndex];
    if (
      confirm(
        `Are you sure you want to delete Scene ${sceneToDelete.scene_number}?`
      )
    ) {
      try {
        const updatedScenes = video.scenes
          .filter((_, index) => index !== sceneIndex)
          .map((scene, index) => ({
            ...scene,
            scene_number: index + 1,
          }));

        // Firebase에서 비디오 업데이트 및 Storage에서 비디오 파일 삭제
        const response = await fetch(`/api/video/news/update-scenes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            videoId: videoId,
            scenes: updatedScenes,
            deletedSceneIndex: sceneIndex, // 삭제된 Scene의 인덱스 전달
          }),
        });

        if (response.ok) {
          // 로컬 상태 업데이트
          const updatedVideo = {
            ...video,
            scenes: updatedScenes,
          };

          // 실패한 씬들을 삭제한 후, 남은 씬들이 모두 completed 상태인지 확인
          const remainingScenesAllCompleted = updatedScenes.every(
            (scene) => scene.videoUrl
          );

          // 모든 남은 씬이 completed 상태이고, 현재 비디오 상태가 failed라면 completed로 변경
          if (
            remainingScenesAllCompleted &&
            video.status === "failed" &&
            user
          ) {
            updatedVideo.status = "completed";

            // Firebase에서 비디오 상태도 업데이트
            try {
              await updateNewsVideo(user.uid, video.id, {
                status: "completed",
              });
              console.log(
                "✅ Video status updated to completed after deleting failed scenes"
              );
            } catch (error) {
              console.error("Failed to update video status:", error);
            }
          }

          setVideo(updatedVideo);

          // 선택된 씬들도 업데이트
          const newSelectedScenes = new Set<number>();
          selectedScenes.forEach((selectedIndex) => {
            if (selectedIndex < sceneIndex) {
              newSelectedScenes.add(selectedIndex);
            } else if (selectedIndex > sceneIndex) {
              newSelectedScenes.add(selectedIndex - 1);
            }
          });
          setSelectedScenes(newSelectedScenes);

          console.log(
            `✅ Scene ${sceneToDelete.scene_number} deleted successfully`
          );
        } else {
          const errorData = await response.json();
          console.error("Failed to delete scene:", errorData);
          alert("Failed to delete scene. Please try again.");
        }
      } catch (error) {
        console.error("Error deleting scene:", error);
        alert("Failed to delete scene. Please try again.");
      }
    }
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
    if (!video || !video.scenes.some((scene) => scene.videoUrl)) {
      setError("At least one scene must be completed to merge videos.");
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
        setMergeProgress("Merge completed!");
      } else {
        const errorData = await response.json();
        console.error("Merge API error:", errorData);
        setError(errorData.error || "Video merge failed.");
      }
    } catch (error) {
      console.error("Error merging videos:", error);
      setError("Error merging videos.");
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

  // 삭제 관련 함수들
  const handleDeleteVideo = async () => {
    if (!video || !user) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/video/news/delete/${video.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // 삭제 성공 시 목록 페이지로 이동
        window.location.href = "/video/createVideo";
      } else {
        const error = await response.json();
        console.error("Delete failed:", error);
        alert("Failed to delete video. Please try again.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete video. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  if (!user) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8 mt-8">
        <PageTitle title="Generated Video" />
        <div className="text-center py-8">
          <p className="text-gray-600">Login is required.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8 mt-8">
        <PageTitle title="Generated Video" />
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8 mt-8">
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
    <div className="container max-w-7xl mx-auto px-4 py-8 mt-8">
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          {video.status === "failed" &&
          !video.scenes.some((scene) => scene.videoUrl) ? (
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
              onDeleteVideo={confirmDelete}
              isDeleting={isDeleting}
            />
          ) : video.status === "processing" ? (
            <div className="bg-gray-100 rounded aspect-video flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
                <p className="text-gray-600">Generating video...</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded aspect-video flex items-center justify-center">
              <p className="text-gray-600">No video</p>
            </div>
          )}
        </div>

        {/* Scene Info */}
        <div className="bg-white rounded-lg mt-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Scene Info</h3>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <>
                  <span className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    There are unsaved changes. Would you like to save them?
                  </span>
                  <Button
                    onClick={handleSaveChanges}
                    variant="primary"
                    size="sm"
                    className="text-xs"
                  >
                    Save
                  </Button>
                </>
              )}

              {/* 자동 업로드 상태 표시 */}
              {/* 자동 업로드 상태 표시 */}

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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {video.scenes.map((scene, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 transition-colors border-gray-200 hover:border-gray-300 ${
                  selectedScenes.has(index) ? "" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {/* 개별 씬 체크박스 */}
                    <label className="flex items-center cursor-pointer">
                      <div className="relative mr-2">
                        <input
                          type="checkbox"
                          checked={selectedScenes.has(index)}
                          onChange={() => toggleSceneSelection(index)}
                          className="sr-only"
                        />
                        <div
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                            selectedScenes.has(index)
                              ? "border-primary bg-primary"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {selectedScenes.has(index) && (
                            <svg
                              className="w-4 h-4 text-white"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <h4 className="font-medium text-sm">
                        Scene {scene.scene_number}
                      </h4>
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    {getSceneStatus(scene, index) !== "completed" && (
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          getSceneStatus(scene, index)
                        )}`}
                      >
                        {getStatusText(getSceneStatus(scene, index))}
                      </span>
                    )}
                    {video.scenes.length > 1 && (
                      <div className="relative">
                        <button
                          onClick={() => {
                            const menuId = `menu-${index}`;
                            const menu = document.getElementById(menuId);
                            if (menu) {
                              menu.classList.toggle("hidden");
                            }
                          }}
                          className="text-gray-500 hover:text-gray-700 text-xs bg-transparent border-none cursor-pointer p-1"
                          title="More options"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        <div
                          id={`menu-${index}`}
                          className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 hidden"
                        >
                          <button
                            onClick={() => handleCopyPrompt(index)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            Copy Prompt
                          </button>
                          <button
                            onClick={() => handleDeleteScene(index)}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                    {/* <FirebaseStatusDebug scene={scene} sceneIndex={index} /> */}
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
                        Browser does not support video.
                      </video>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
                    <p className="text-xs text-gray-600">No video</p>
                  </div>
                )}

                <div className="text-xs text-gray-600 space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <strong className="block mb-1 text-xs">
                        Description :
                      </strong>
                    </div>
                    <textarea
                      value={
                        modifiedScenes[index]?.narration || scene.narration
                      }
                      onChange={(e) =>
                        handleNarrationChange(index, e.target.value)
                      }
                      className="w-full text-gray-700 bg-gray-50 p-1 rounded text-xs border border-gray-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/40 resize-none"
                      rows={2}
                      placeholder="Please enter narration"
                    />
                  </div>

                  {/* 자동 업로드 상태 표시 */}
                  {/* <div className="mt-2">
                    <AutoUploadStatus
                      scene={scene}
                      sceneIndex={index}
                      isUploading={uploadingScenes.has(index)}
                    />
                  </div> */}

                  {/* Firebase 업로드 상태 디버깅 */}
                  {/* <FirebaseStatusDebug scene={scene} sceneIndex={index} /> */}
                </div>
              </div>
            ))}

            {/* Regenerate 입력 폼 */}
            {showRegenerateForm && (
              <div className="border rounded-lg p-3 transition-colors ">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm text-primary-dark">
                    Scene {regenerateSceneIndex! + 1} Regenerate Scene
                  </h4>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary-dark">
                    Edit Mode
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
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                      rows={2}
                      placeholder="Please enter image prompt"
                    />
                  </div>

                  {/* 나레이션 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description :
                    </label>
                    <textarea
                      value={regenerateForm.narration}
                      onChange={(e) =>
                        setRegenerateForm((prev) => ({
                          ...prev,
                          narration: e.target.value,
                        }))
                      }
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                      rows={2}
                      placeholder="Please enter narration"
                    />
                  </div>

                  {/* 이미지 URL 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Image URL (optional):
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
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
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
              <div className="border rounded-lg p-3 transition-colors ">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">Add Scene</h4>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-secondary text-black">
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
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                      rows={2}
                      placeholder="Please enter image prompt"
                    />
                  </div>

                  {/* 나레이션 입력 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description :
                    </label>
                    <textarea
                      value={addSceneForm.narration}
                      onChange={(e) =>
                        setAddSceneForm((prev) => ({
                          ...prev,
                          narration: e.target.value,
                        }))
                      }
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
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
                      className="w-full p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddSceneSubmit}
                      variant="primary"
                      size="sm"
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

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Video
                </h3>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this video? This action cannot
                be undone. All video files and data will be permanently removed.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                onClick={cancelDelete}
                variant="outline"
                size="sm"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteVideo}
                variant="primary"
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
