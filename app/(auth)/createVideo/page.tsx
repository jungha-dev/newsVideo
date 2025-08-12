"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  Button,
  Textarea,
  Input,
  Select,
  Range,
  PageTitle,
  Section,
  VideoScenarioList,
  ConfirmModal,
} from "@/components/styled";
import { saveNewsVideo } from "@/lib/firebase/newsVideo";
import { NewsVideoCreateData } from "@/lib/types/newsVideo";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackgroundCircles from "@/components/common/BackgroundCircles";

interface TextGenerationResponse {
  text: string;
  taskId: string;
}

interface Scene {
  scene_number: number;
  image_prompt: string;
  narration: string;
  imageUrl?: string;
  videoUrl?: string;
  firebaseUrl?: string;
  output?: string; // 원본 Replicate URL
}

interface VideoScenario {
  title: string;
  scenario: string;
  scenes: Scene[];
}

interface VideoItem {
  url: string;
  subtitle: string;
  trim: [number, number];
  speed: string;
  thumbnail: string;
  isSelected: boolean;
}

export default function NewsPage() {
  const { user } = useAuth();

  // 기본 프롬프트 템플릿 상수
  const DEFAULT_BLOG_PROMPT_TEMPLATE = `Below is the blog content.
Please generate a video script in **English** based on this content.

Requirements:
- Video length = {sceneCount} scenes × 5 seconds each (total {sceneCount * 5} seconds)
- Total of {sceneCount} scenes
- For each scene:
  • Image prompt (for AI video generation) — include:
      - Camera angle and camera movement (e.g., dolly, pan, tracking shot)
      - Composition and visual details (environment, mood, lighting)
      - Subject movement (what the people or objects are doing)
      - Transition hint to the next scene for natural flow
  • Narration sentence (for video audio) — short and emotionally resonant
- Ensure the scenes transition naturally and form a cohesive storyline.
- Please output the result in the JSON format example below.
- Keep the visual tone consistent (e.g., warm, cinematic, minimalistic) across all scenes.

[Example Output Format]
{
  "title": "Morning Journey",
  "scenario": "A calming start to the day that gradually builds into an inspiring journey through city life.",
  "scenes": [
    {
      "scene_number": 1,
      "image_prompt": "Low-angle dolly-in shot of a woman slowly lifting a coffee cup by a sunlit window, steam rising, warm cinematic tone, soft focus background, natural morning light, subtle camera movement forward.",
      "narration": "The day begins with a warm cup of coffee."
    },
    {
      "scene_number": 2,
      "image_prompt": "Side-tracking shot following a man walking through a bustling city street, morning sunlight reflecting on glass buildings, people passing by in motion blur, smooth tracking camera movement, transition fade toward next scene.",
      "narration": "Even in busy daily life, we move forward toward our dreams."
    }
  ]
}

Please compose the video based on the following blog content:

[Blog Content]
{blogContent}`;

  const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `You are a professional video scenario writer. Please generate a 1-minute video scenario in JSON format based on the blog content. Each scene should be approximately {sceneDuration} seconds long with a total of {sceneCount} scenes, and must include image prompts and narration.`;

  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoSeed, setVideoSeed] = useState<number | undefined>(undefined);
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [generatedVideoId, setGeneratedVideoId] = useState("");
  const [videoStatus, setVideoStatus] = useState("");
  const [generatedVideos, setGeneratedVideos] = useState<string[]>([]);
  const [videoScenario, setVideoScenario] = useState<VideoScenario | null>(
    null
  );
  const [temperature, setTemperature] = useState(1);
  const [topP, setTopP] = useState(1);
  const [maxCompletionTokens, setMaxCompletionTokens] = useState(4096);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [generatedText, setGeneratedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideoModel, setSelectedVideoModel] = useState<
    "kling-v2" | "veo-3" | "hailuo-02"
  >("kling-v2");
  const [hailuoDuration, setHailuoDuration] = useState<6 | 10>(6);
  const [hailuoResolution, setHailuoResolution] = useState<"768p" | "1080p">(
    "1080p"
  );
  const [hailuoPromptOptimizer, setHailuoPromptOptimizer] = useState(true);
  const [klingDuration, setKlingDuration] = useState<5 | 10>(5);
  const [klingCfgScale, setKlingCfgScale] = useState(0.5);
  const [klingAspectRatio, setKlingAspectRatio] = useState<
    "16:9" | "9:16" | "1:1"
  >("16:9");
  const [klingStartImage, setKlingStartImage] = useState("");
  const [veo3Resolution, setVeo3Resolution] = useState<"720p" | "1080p">(
    "720p"
  );
  const [activeTab, setActiveTab] = useState<"text" | "scenario" | "video">(
    "scenario"
  );
  const [sceneCount, setSceneCount] = useState<number>(2);
  const [isScenarioCollapsed, setIsScenarioCollapsed] = useState(false);
  const [isVideoModelDetailsCollapsed, setIsVideoModelDetailsCollapsed] =
    useState(true);

  // 아나운서 포함 상태
  const [newsAnchorIncluded, setNewsAnchorIncluded] = useState<{
    [key: number]: boolean;
  }>({});

  // Blog Content 프롬프트 설정 관련 상태
  const [blogPromptTemplate, setBlogPromptTemplate] = useState(
    DEFAULT_BLOG_PROMPT_TEMPLATE
  );
  const [systemPromptTemplate, setSystemPromptTemplate] = useState(
    DEFAULT_SYSTEM_PROMPT_TEMPLATE
  );
  const [showPromptSettings, setShowPromptSettings] = useState(false);

  // 직접 Add Scenes 관련 상태
  const [showManualSceneInput, setShowManualSceneInput] = useState(false);
  const [manualScenes, setManualScenes] = useState<Scene[]>([]);
  const [newSceneImagePrompt, setNewSceneImagePrompt] = useState("");
  const [newSceneNarration, setNewSceneNarration] = useState("");

  // 영상 편집 관련 상태
  const [videoItems, setVideoItems] = useState<VideoItem[]>([]);
  const [globalColor, setGlobalColor] = useState("#ffffff");
  const [subtitleStyle, setSubtitleStyle] = useState<"box" | "outline">("box");
  const [isLoadingMerge, setIsLoadingMerge] = useState(false);
  const [currentProgress, setCurrentProgress] = useState("");
  const [mergedBlobUrl, setMergedBlobUrl] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

  // 확인 팝업 관련 상태
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    title: string;
    message: string;
    apiInfo?: {
      url: string;
      method: string;
      data: any;
    };
    onConfirm: () => void;
  } | null>(null);

  const router = useRouter();

  const handleGenerateText = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    setLoading(true);
    setError("");
    setGeneratedText("");

    try {
      const response = await fetch("/api/replicateText/text-to-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          system_prompt: systemPrompt.trim() || null,
          temperature,
          top_p: topP,
          max_completion_tokens: maxCompletionTokens,
          presence_penalty: presencePenalty,
          frequency_penalty: frequencyPenalty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Text generation failed.");
      }

      setGeneratedText(data.text);
    } catch (err) {
      console.error("Text generation error:", err);
      setError(err instanceof Error ? err.message : "expected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateScenario = async () => {
    if (!blogContent.trim()) {
      setError("please enter blog content.");
      return;
    }

    setLoading(true);
    setError("");
    setVideoScenario(null);

    try {
      // 동적 프롬프트 생성
      const sceneDuration = Math.round(60 / sceneCount);
      const videoPrompt = blogPromptTemplate
        .replace(/{sceneCount}/g, sceneCount.toString())
        .replace(/{blogContent}/g, blogContent.trim());

      const systemPrompt = systemPromptTemplate
        .replace(/{sceneDuration}/g, sceneDuration.toString())
        .replace(/{sceneCount}/g, sceneCount.toString());

      const response = await fetch("/api/replicateText/text-to-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: videoPrompt,
          system_prompt: systemPrompt,
          temperature: 0.7,
          top_p: 0.9,
          max_completion_tokens: 2048,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "video scenario generation failed.");
      }

      try {
        const scenario = JSON.parse(data.text);
        setVideoScenario(scenario);
        // 시나리오 생성 후 Input Settings 자동 접기
        setIsScenarioCollapsed(true);
      } catch (parseError) {
        console.error("JSON error:", parseError);
        setError("response parsing failed. Please check the format.");
      }
    } catch (err) {
      console.error("Video scenario generation error:", err);
      setError(
        err instanceof Error ? err.message : "video scenario generation failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) {
      setError("please enter a video prompt.");
      return;
    }

    setLoading(true);
    setError("");
    setGeneratedVideoId("");

    try {
      // News Video 시스템을 통해 단일 비디오 생성
      const response = await fetch("/api/video/news/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Single Video Generation",
          description: "Generated from createVideo page",
          prompts: [videoPrompt.trim()],
          narrations: [""],
          scenes: [
            {
              scene_number: 1,
              image_prompt: videoPrompt.trim(),
              narration: "",
            },
          ],
          model: "veo-3",
          aspectRatio: "16:9",
          duration: 5,
          veo3Resolution: "720p",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "video generation failed.");
      }

      // 생성된 비디오 ID를 저장하여 상태 확인 가능하게 함
      setGeneratedVideoId(data.videoId);
    } catch (err) {
      console.error("Video generation error:", err);
      setError(
        err instanceof Error ? err.message : "unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAllVideos = async (
    prompts: string[],
    narrations: string[]
  ) => {
    if (!user || !videoScenario) {
      setError("cannot generate videos without user or scenario.");
      return;
    }

    // API 요청 데이터 준비
    const requestData = {
      title: videoScenario.title,
      description: videoScenario.scenario,
      prompts: prompts,
      narrations: narrations,
      scenes: videoScenario.scenes,
      model: selectedVideoModel,
      aspectRatio:
        selectedVideoModel === "kling-v2" ? klingAspectRatio : "16:9",
      duration: selectedVideoModel === "kling-v2" ? klingDuration : 5,
      veo3Resolution:
        selectedVideoModel === "veo-3" ? veo3Resolution : undefined,
    };

    // 확인 팝업 표시
    setConfirmModalData({
      title: "video generation confirmation",
      message: `SelectedVideoModel: ${
        selectedVideoModel === "veo-3"
          ? "Veo-3 (Google)"
          : selectedVideoModel === "kling-v2"
          ? "Kling V2.0 (Kwaivgi)"
          : "Hailuo-02 (Minimax)"
      }\n\nWould you like to start video generation?`,
      apiInfo: {
        url: "/api/video/news/generate",
        method: "POST",
        data: requestData,
      },
      onConfirm: async () => {
        setShowConfirmModal(false);
        setGeneratingVideos(true);
        setError("");
        setGeneratedVideos([]);
        setVideoItems([]);

        try {
          const response = await fetch("/api/video/news/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Video generation failed.");
          }

          const data = await response.json();
          const videoId = data.videoId;
          setCurrentVideoId(videoId);

          console.log("News video generation started:", videoId);
          console.log("Scene videos:", data.sceneVideos);

          // 성공 메시지 표시
          setError("");
        } catch (err) {
          console.error("News video generation error:", err);
          setError(
            err instanceof Error ? err.message : "Video generation failed."
          );
        } finally {
          setGeneratingVideos(false);
        }
      },
    });
    setShowConfirmModal(true);
  };

  const handleDownloadVideo = (url: string, index: number) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `scene-${index + 1}.mp4`;
    link.click();
  };

  const handleCopyText = () => {
    if (generatedText) {
      navigator.clipboard.writeText(generatedText);
      alert("text copied to clipboard.");
    }
  };

  const handleClear = () => {
    setPrompt("");
    setSystemPrompt("");
    setBlogContent("");
    setVideoPrompt("");
    setVideoSeed(undefined);
    setEnhancePrompt(true);
    setNegativePrompt("");
    setGeneratedText("");
    setGeneratedVideoId("");
    setGeneratedVideos([]);
    setVideoScenario(null);
    setError("");
    setSelectedVideoModel("veo-3");
    setHailuoDuration(6);
    setHailuoResolution("1080p");
    setHailuoPromptOptimizer(true);
    setKlingDuration(5);
    setKlingCfgScale(0.5);
    setKlingAspectRatio("16:9");
    setKlingStartImage("");
    setActiveTab("scenario");
    setSceneCount(2);
    setIsScenarioCollapsed(false);
    // 직접 Add Scenes 관련 초기화
    setShowManualSceneInput(false);
    setManualScenes([]);
    setNewSceneImagePrompt("");
    setNewSceneNarration("");
    // 영상 편집 관련 초기화
    setVideoItems([]);
    setGlobalColor("#ffffff");
    setSubtitleStyle("box");
    setMergedBlobUrl(null);
    setMergeError(null);
    // 프롬프트 설정 관련 초기화
    setShowPromptSettings(false);
    setBlogPromptTemplate(DEFAULT_BLOG_PROMPT_TEMPLATE);
    setSystemPromptTemplate(DEFAULT_SYSTEM_PROMPT_TEMPLATE);
  };

  // 영상 편집 관련 함수들
  const createEmptyVideo = (url = ""): VideoItem => ({
    url,
    subtitle: "",
    trim: [0, 5],
    speed: "1",
    thumbnail: "",
    isSelected: true,
  });

  const addVideoUrl = (url: string) => {
    if (url.trim()) {
      setVideoItems((prev) => [...prev, createEmptyVideo(url.trim())]);
    }
  };

  const updateVideoField = (
    idx: number,
    field: keyof VideoItem,
    value: any
  ) => {
    setVideoItems((prev) =>
      prev.map((video, i) => (i === idx ? { ...video, [field]: value } : video))
    );
  };

  const removeVideo = (idx: number) => {
    setVideoItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // 직접 Add Scenes 관련 함수들
  const addManualScene = () => {
    if (newSceneImagePrompt.trim() && newSceneNarration.trim()) {
      const newScene: Scene = {
        scene_number: manualScenes.length + 1,
        image_prompt: newSceneImagePrompt.trim(),
        narration: newSceneNarration.trim(),
      };
      setManualScenes((prev) => [...prev, newScene]);
      setNewSceneImagePrompt("");
      setNewSceneNarration("");
    }
  };

  const removeManualScene = (index: number) => {
    setManualScenes((prev) => {
      const updatedScenes = prev.filter((_, i) => i !== index);
      // Scene 번호 재정렬
      return updatedScenes.map((scene, i) => ({
        ...scene,
        scene_number: i + 1,
      }));
    });
  };

  const createManualVideoScenario = () => {
    if (manualScenes.length > 0) {
      const scenario: VideoScenario = {
        title: "Manual Creation Scenario",
        scenario: `${manualScenes.length}This is a manually created video scenario consisting of [number] scenes.`,
        scenes: manualScenes.map((scene, index) => ({
          ...scene,
          scene_number: index + 1, // Scene 번호를 1부터 시작하도록 보장
        })),
      };
      setVideoScenario(scenario);
      setIsScenarioCollapsed(true);
    }
  };

  const handleAddImageUrl = (url: string) => {
    if (url.trim()) {
      addVideoUrl(url);
    }
  };

  const handleAddSceneImage = (sceneIndex: number, imageUrl: string) => {
    if (imageUrl.trim()) {
      addVideoUrl(imageUrl);
    }
  };

  const handleAddSceneVideo = (sceneIndex: number, videoUrl: string) => {
    if (videoUrl.trim()) {
      addVideoUrl(videoUrl);
    }
  };

  const handleUpdateScene = (sceneIndex: number, updatedScene: Scene) => {
    if (videoScenario) {
      const updatedScenes = [...videoScenario.scenes];
      updatedScenes[sceneIndex] = updatedScene;
      setVideoScenario({
        ...videoScenario,
        scenes: updatedScenes,
      });
    }
  };

  const handleAddScene = () => {
    if (videoScenario) {
      const newScene: Scene = {
        scene_number: videoScenario.scenes.length + 1,
        image_prompt: "",
        narration: "",
      };
      setVideoScenario({
        ...videoScenario,
        scenes: [...videoScenario.scenes, newScene],
      });
    }
  };

  const handleDeleteScene = (sceneIndex: number) => {
    if (!videoScenario || videoScenario.scenes.length <= 1) return;

    const updatedScenes = videoScenario.scenes
      .filter((_, index) => index !== sceneIndex)
      .map((scene, index) => ({
        ...scene,
        scene_number: index + 1,
      }));

    setVideoScenario({
      ...videoScenario,
      scenes: updatedScenes,
    });
  };

  const handleMerge = async () => {
    setIsLoadingMerge(true);
    setMergeError(null);
    setCurrentProgress("Merging video…");

    try {
      const response = await fetch("/api/video/merge-videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videos: videoItems.filter((v) => v.isSelected === true),
          globalColor,
          subtitleStyle,
        }),
      });

      if (!response.ok) {
        throw new Error("video merge failed.");
      }

      const data = await response.json();

      if (data.video) {
        // base64를 blob으로 변환
        const binaryString = atob(data.video);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        });
        const url = URL.createObjectURL(blob);
        setMergedBlobUrl(url);
        setCurrentProgress("merge complete.");

        // 메모리 정리
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 60000); // 1분 후 메모리 정리
      } else {
        throw new Error("No video data returned from merge API.");
      }
    } catch (err) {
      console.error("Merge error:", err);
      setMergeError(
        err instanceof Error ? err.message : "An unknown error has occurred"
      );
    } finally {
      setIsLoadingMerge(false);
    }
  };

  const handleSaveNewsVideo = async () => {
    if (!user || !videoScenario || !mergedBlobUrl) {
      setError("There is no data available to save.");
      return;
    }

    // 테스트: 간단한 업로드 테스트
    const testUpload = async () => {
      try {
        console.log("Testing upload...");
        const testResponse = await fetch("/api/upload-from-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: "https://replicate.delivery/pbxt/4kW7nw0IBIscFIOEj8UjSBQdOoTqgIS0Vkjsbt3Kf8uAeTkB/out-0.mp4",
            path: `users/${user.uid}/test-video.mp4`,
          }),
        });

        console.log("Test upload response:", testResponse.status);
        if (testResponse.ok) {
          const testData = await testResponse.json();
          console.log("Test upload success:", testData);
        } else {
          const errorText = await testResponse.text();
          console.error("Test upload failed:", errorText);
        }
      } catch (error) {
        console.error("Test upload error:", error);
      }
    };

    // 테스트 실행
    await testUpload();

    try {
      setLoading(true);
      setError("");

      // Blob을 File로 변환
      const response = await fetch(mergedBlobUrl);
      const blob = await response.blob();
      const file = new File([blob], "news-video.mp4", { type: "video/mp4" });

      // Firebase Storage에 업로드
      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", `users/${user.uid}/newsVideos/${Date.now()}`);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload video file.");
      }

      const uploadData = await uploadResponse.json();
      const videoUrl = uploadData.url;

      // Firebase Firestore에 Save
      const newsVideoData: NewsVideoCreateData = {
        title: videoScenario.title,
        description: videoScenario.scenario,
        videoUrl: videoUrl,
        prompts: videoScenario.scenes.map((scene) => scene.image_prompt),
        narrations: videoScenario.scenes.map((scene) => scene.narration),
        scenes: videoScenario.scenes,
        model: selectedVideoModel,
        aspectRatio:
          selectedVideoModel === "kling-v2" ? klingAspectRatio : "16:9",
        duration: selectedVideoModel === "kling-v2" ? klingDuration : 5,
      };

      const videoId = await saveNewsVideo(user.uid, newsVideoData);

      // 성공 시 상세 페이지로 이동
      router.push(`/video/createVideo/${videoId}`);
    } catch (err) {
      console.error("Save news video error:", err);
      setError(err instanceof Error ? err.message : "video saving failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <BackgroundCircles />
      <div className="mt-[20vh] flex flex-col justify-center items-center text-center">
        <span className="text-5xl font-bold">AI Content Generation</span>
        <span className="py-4">Turn Your Content into Stunning Videos</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* 입력 섹션 */}
        <Section className={isScenarioCollapsed ? "!mb-0 !pb-0" : ""}>
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-xl font-semibold"></h2>
            <div className="flex items-center gap-2">
              <div>
                {(prompt.trim() ||
                  systemPrompt.trim() ||
                  blogContent.trim() ||
                  videoPrompt.trim() ||
                  generatedText ||
                  videoScenario ||
                  generatedVideoId ||
                  manualScenes.length > 0) && (
                  <Button
                    onClick={handleClear}
                    variant="secondary"
                    size="sm"
                    className="w-full"
                  >
                    Clear All
                  </Button>
                )}
              </div>
              <Button
                onClick={() => setShowPromptSettings(!showPromptSettings)}
                variant="normal"
                size="sm"
                title={
                  showPromptSettings
                    ? "Close prompt settings"
                    : "Open prompt settings"
                }
              >
                <svg
                  className={`w-5 h-5 transition-transform ${
                    showPromptSettings ? "rotate-90" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Button>
              {videoScenario && (
                <Button
                  onClick={() => setIsScenarioCollapsed(!isScenarioCollapsed)}
                  variant="normal"
                  size="sm"
                >
                  {isScenarioCollapsed ? "View Details" : "Collapse"}
                  <svg
                    className={`w-4 h-4 ml-2 transition-transform ${
                      isScenarioCollapsed ? "" : "rotate-180"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </Button>
              )}
            </div>
          </div>

          {!isScenarioCollapsed && (
            <>
              {/* 탭 네비게이션 */}

              <div className="space-y-6">
                {/* 텍스트 생성 탭 */}
                {activeTab === "text" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Prompt
                      </label>
                      <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter the prompt for the text you want to generate..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        System Prompt (Optional)
                      </label>
                      <Textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Enter a system prompt to set AI behavior..."
                        rows={2}
                      />
                    </div>

                    <Button
                      onClick={handleGenerateText}
                      disabled={loading || !prompt.trim()}
                      className="w-full"
                    >
                      {loading ? "Generating..." : "Generate Text"}
                    </Button>
                  </div>
                )}

                {/* 비디오 시나리오 생성 탭 */}
                {activeTab === "scenario" && (
                  <div className="space-y-3">
                    <div>
                      <Textarea
                        value={blogContent}
                        onChange={(e) => setBlogContent(e.target.value)}
                        placeholder="Enter blog content. A video scenario will be generated based on this content..."
                        rows={4}
                      />
                    </div>

                    {/* 프롬프트 설정 섹션 */}
                    {showPromptSettings && (
                      <div className="border border-secondary rounded-lg p-4 space-y-4 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-900">
                          Prompt Settings
                        </h4>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-700">
                            Blog Content Prompt Template
                          </label>
                          <Textarea
                            value={blogPromptTemplate}
                            onChange={(e) =>
                              setBlogPromptTemplate(e.target.value)
                            }
                            placeholder="Blog content prompt template..."
                            rows={8}
                            className="text-xs"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Available Variables: {"{sceneCount}"},{" "}
                            {"{blogContent}"}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-700">
                            System Prompt Template
                          </label>
                          <Textarea
                            value={systemPromptTemplate}
                            onChange={(e) =>
                              setSystemPromptTemplate(e.target.value)
                            }
                            placeholder="System prompt template..."
                            rows={4}
                            className="text-xs"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Available Variables: {"{sceneDuration}"},{" "}
                            {"{sceneCount}"}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setBlogPromptTemplate(
                                DEFAULT_BLOG_PROMPT_TEMPLATE
                              );
                              setSystemPromptTemplate(
                                DEFAULT_SYSTEM_PROMPT_TEMPLATE
                              );
                            }}
                            size="sm"
                          >
                            Reset
                          </Button>
                        </div>
                      </div>
                    )}

                    {blogContent.trim() && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Number of Scenes
                          </label>
                          <Select
                            value={sceneCount.toString()}
                            onChange={(value) => setSceneCount(parseInt(value))}
                            options={Array.from(
                              { length: 30 },
                              (_, i) => i + 1
                            ).map((num) => ({
                              value: num.toString(),
                              label: `${num} scenes (${num * 5}s total)`,
                            }))}
                            className="w-full"
                          />
                        </div>

                        <Button
                          variant="primary"
                          onClick={handleGenerateScenario}
                          disabled={loading || !blogContent.trim()}
                          className="w-full"
                        >
                          {loading ? "Generating..." : "Generate Scenario"}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* 직접 Add Scenes 섹션 - 시나리오가 생성된 후에만 보임 */}
                {videoScenario && (
                  <div className="border-t border-secondary-light pt-4 mt-20">
                    {showManualSceneInput && (
                      <div className="space-y-4">
                        {/* 새 Scene 입력 폼 */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Image Prompt
                            </label>
                            <Textarea
                              value={newSceneImagePrompt}
                              onChange={(e) =>
                                setNewSceneImagePrompt(e.target.value)
                              }
                              placeholder="이미지 프롬프트를 입력하세요 (예: A woman drinking coffee by a sunny window. Warm tone, elegant feeling.)"
                              rows={3}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Narration
                            </label>
                            <Textarea
                              value={newSceneNarration}
                              onChange={(e) =>
                                setNewSceneNarration(e.target.value)
                              }
                              placeholder="나레이션을 입력하세요 (예: The day begins with a warm cup of coffee.)"
                              rows={2}
                            />
                          </div>

                          <Button
                            onClick={() => {
                              addManualScene();
                              // 입력 필드에 포커스 다시 설정
                              setTimeout(() => {
                                const imagePromptInput = document.querySelector(
                                  'textarea[placeholder*="이미지 프롬프트"]'
                                ) as HTMLTextAreaElement;
                                if (imagePromptInput) {
                                  imagePromptInput.focus();
                                }
                              }, 100);
                            }}
                            disabled={
                              !newSceneImagePrompt.trim() ||
                              !newSceneNarration.trim()
                            }
                            variant="primary"
                            size="sm"
                            className="w-full"
                          >
                            Add Scene
                          </Button>
                        </div>

                        {/* 추가된 Scene 목록 */}
                        {manualScenes.length > 0 && (
                          <div className="space-y-3">
                            <h5 className="text-sm font-medium">
                              Added Scenes ({manualScenes.length})
                            </h5>
                            <div className="space-y-3">
                              {manualScenes.map((scene, index) => (
                                <div
                                  key={index}
                                  className="bg-gray-50 border rounded-lg p-3"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">
                                      Scene {scene.scene_number}
                                    </span>
                                    <button
                                      onClick={() => removeManualScene(index)}
                                      className="text-red-500 hover:text-red-700 text-sm"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Image Prompt
                                      </label>
                                      <p className="text-xs text-gray-800 bg-white p-2 rounded border">
                                        {scene.image_prompt}
                                      </p>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Narration
                                      </label>
                                      <p className="text-xs text-gray-800 bg-white p-2 rounded border">
                                        {scene.narration}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <Button
                              onClick={createManualVideoScenario}
                              disabled={manualScenes.length === 0}
                              variant="primary"
                              className="w-full"
                            >
                              Generate Scenario ({manualScenes.length} scenes)
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Veo-3 비디오 생성 탭 */}
                {activeTab === "video" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Video Prompt
                      </label>
                      <Textarea
                        value={videoPrompt}
                        onChange={(e) => setVideoPrompt(e.target.value)}
                        placeholder="Enter the prompt for the video you want to generate..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Negative Prompt (Optional)
                      </label>
                      <Textarea
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="Enter elements you want to exclude from the video..."
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Seed (Optional)
                        </label>
                        <Input
                          type="number"
                          value={videoSeed?.toString() || ""}
                          onChange={(e) =>
                            setVideoSeed(
                              e.target.value
                                ? parseInt(e.target.value)
                                : undefined
                            )
                          }
                          placeholder="Random seed value"
                          className="w-full"
                        />
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="enhancePrompt"
                          checked={enhancePrompt}
                          onChange={(e) => setEnhancePrompt(e.target.checked)}
                          className="mr-2"
                        />
                        <label htmlFor="enhancePrompt" className="text-sm">
                          Enhance Prompt
                        </label>
                      </div>
                    </div>

                    <Button
                      onClick={handleGenerateVideo}
                      disabled={loading || !videoPrompt.trim()}
                      className="w-full"
                    >
                      {loading ? "Generating..." : "Generate Video"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </Section>

        {/* 결과 섹션 */}
        {videoScenario && (
          <Section className="pt-0">
            <h2 className="text-xl font-semibold mb-4">Generation Results</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {loading && (
              <div className="bg-primary/20 border border-primary-light text-primary-dark px-4 py-3 rounded mb-4">
                Generating text...
              </div>
            )}

            {/* 텍스트 결과 */}
            {generatedText && (
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-semibold">Generated Text</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="whitespace-pre-wrap text-gray-800">
                    {generatedText}
                  </div>
                </div>

                <Button
                  onClick={handleCopyText}
                  variant="outline"
                  className="w-full"
                >
                  Copy to Clipboard
                </Button>
              </div>
            )}

            {/* 비디오 시나리오 결과 */}
            {videoScenario && (
              <div className="my-6">
                <VideoScenarioList
                  scenario={videoScenario}
                  onGenerateAll={handleGenerateAllVideos}
                  generating={generatingVideos}
                  generatedVideos={generatedVideos}
                  videoItems={videoItems}
                  onVideoItemsChange={setVideoItems}
                  onMerge={handleMerge}
                  isMerging={isLoadingMerge}
                  mergedVideoUrl={mergedBlobUrl || undefined}
                  globalColor={globalColor}
                  subtitleStyle={subtitleStyle}
                  onGlobalColorChange={setGlobalColor}
                  onSubtitleStyleChange={setSubtitleStyle}
                  onAddImageUrl={handleAddImageUrl}
                  onAddSceneImage={handleAddSceneImage}
                  onAddSceneVideo={handleAddSceneVideo}
                  onUpdateScene={handleUpdateScene}
                  onAddScene={handleAddScene}
                  onDeleteScene={handleDeleteScene}
                  onSaveNewsVideo={handleSaveNewsVideo}
                  isSaving={loading}
                  selectedVideoModel={selectedVideoModel}
                  newsAnchorIncluded={newsAnchorIncluded}
                  onNewsAnchorIncludedChange={setNewsAnchorIncluded}
                />
              </div>
            )}

            <div>
              <h4 className="text-md my-2 font-semibold">Video Model</h4>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedVideoModel}
                  onChange={(value) =>
                    setSelectedVideoModel(value as "veo-3" | "hailuo-02")
                  }
                  options={[
                    { value: "kling-v2", label: "Kling V2.0 (Kwaivgi)" },
                    { value: "veo-3", label: "Veo-3 (Google)" },
                    // { value: "hailuo-02", label: "Hailuo-02 (Minimax)" },
                  ]}
                  className="flex-1 !mb-0"
                />
                <Button
                  onClick={() =>
                    setIsVideoModelDetailsCollapsed(
                      !isVideoModelDetailsCollapsed
                    )
                  }
                  variant="normal"
                  size="md"
                  className="w-54 mb-6"
                >
                  {isVideoModelDetailsCollapsed
                    ? "View settings"
                    : "Close settings"}
                  <svg
                    className={`w-4 h-4 ml-2 transition-transform ${
                      isVideoModelDetailsCollapsed ? "" : "rotate-180"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </Button>
              </div>
            </div>
            {generatingVideos && (
              <div className="bg-black mt-4 border border-secondary-light text-white px-4 py-3 rounded mb-4">
                Generating videos... (This may take a while)
              </div>
            )}

            {!isVideoModelDetailsCollapsed &&
              selectedVideoModel === "hailuo-02" && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Duration (seconds)
                    </label>
                    <Select
                      value={hailuoDuration.toString()}
                      onChange={(value) =>
                        setHailuoDuration(parseInt(value) as 6 | 10)
                      }
                      options={[
                        { value: "6", label: "6 seconds" },
                        { value: "10", label: "10 seconds (768p only)" },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Resolution
                    </label>
                    <Select
                      value={hailuoResolution}
                      onChange={(value) =>
                        setHailuoResolution(value as "768p" | "1080p")
                      }
                      options={[
                        { value: "768p", label: "768p (Standard)" },
                        { value: "1080p", label: "1080p (Pro)" },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="hailuoPromptOptimizer"
                      checked={hailuoPromptOptimizer}
                      onChange={(e) =>
                        setHailuoPromptOptimizer(e.target.checked)
                      }
                      className="mr-2"
                    />
                    <label htmlFor="hailuoPromptOptimizer" className="text-sm">
                      Prompt Optimizer
                    </label>
                  </div>
                </div>
              )}

            {!isVideoModelDetailsCollapsed &&
              selectedVideoModel === "veo-3" && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Resolution
                    </label>
                    <Select
                      value={veo3Resolution}
                      onChange={(value) =>
                        setVeo3Resolution(value as "720p" | "1080p")
                      }
                      options={[
                        { value: "720p", label: "720p (Standard)" },
                        { value: "1080p", label: "1080p (High Quality)" },
                      ]}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

            {!isVideoModelDetailsCollapsed &&
              selectedVideoModel === "kling-v2" && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Duration (seconds)
                    </label>
                    <Select
                      value={klingDuration.toString()}
                      onChange={(value) =>
                        setKlingDuration(parseInt(value) as 5 | 10)
                      }
                      options={[
                        { value: "5", label: "5 seconds" },
                        { value: "10", label: "10 seconds" },
                      ]}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Aspect Ratio
                    </label>
                    <Select
                      value={klingAspectRatio}
                      onChange={(value) =>
                        setKlingAspectRatio(value as "16:9" | "9:16" | "1:1")
                      }
                      options={[
                        { value: "16:9", label: "16:9 (Landscape)" },
                        { value: "9:16", label: "9:16 (Portrait)" },
                        { value: "1:1", label: "1:1 (Square)" },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Start Image URL (Optional)
                    </label>
                    <Input
                      type="url"
                      value={klingStartImage}
                      onChange={(e) => setKlingStartImage(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If an image is added to a scene, that image will
                      automatically be used as the start_image.
                    </p>
                  </div>

                  {/* Scene별 이미지 상태 표시 */}
                  {videoScenario && (
                    <div className="mt-3 p-2 bg-primary/10 border border-primary/40 rounded">
                      <p className="text-xs font-medium text-primary-dark mb-2">
                        Image status by scene:
                      </p>
                      <div className="space-y-1">
                        {videoScenario.scenes.map((scene, index) => {
                          // 안전한 이미지 URL인지 확인하는 함수
                          const isSafeImageUrl = (url: string) => {
                            try {
                              const urlObj = new URL(url);

                              // 안전하지 않은 도메인 블랙리스트
                              const unsafeDomains = [
                                "yna.co.kr",
                                "unsafe",
                                "localhost",
                                "127.0.0.1",
                                "0.0.0.0",
                              ];

                              return (
                                urlObj.protocol === "https:" &&
                                !unsafeDomains.some((domain) =>
                                  urlObj.hostname.includes(domain)
                                ) &&
                                urlObj.hostname.length > 0 &&
                                urlObj.hostname.includes(".")
                              ); // 최소한 하나의 점이 있어야 함
                            } catch {
                              return false;
                            }
                          };

                          const isSafe = scene.imageUrl
                            ? isSafeImageUrl(scene.imageUrl)
                            : false;

                          return (
                            <div
                              key={index}
                              className="flex items-center justify-between text-xs"
                            >
                              <span>Scene {scene.scene_number}:</span>
                              <span
                                className={
                                  scene.imageUrl
                                    ? isSafe
                                      ? "text-primary"
                                      : "text-orange-600"
                                    : "text-gray-500"
                                }
                              >
                                {scene.imageUrl
                                  ? isSafe
                                    ? "✅ Safe Image"
                                    : "⚠️ Unsafe Image"
                                  : "❌ No Image"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        ⚠️ Unsafe images cannot be used as a start image.
                      </p>

                      {/* 안전하지 않은 이미지가 있는 경우 경고 메시지 */}
                      {videoScenario.scenes.some((scene) => {
                        if (!scene.imageUrl) return false;
                        const isSafeImageUrl = (url: string) => {
                          try {
                            const urlObj = new URL(url);
                            const unsafeDomains = [
                              "yna.co.kr",
                              "unsafe",
                              "localhost",
                              "127.0.0.1",
                              "0.0.0.0",
                            ];
                            return (
                              urlObj.protocol === "https:" &&
                              !unsafeDomains.some((domain) =>
                                urlObj.hostname.includes(domain)
                              ) &&
                              urlObj.hostname.length > 0 &&
                              urlObj.hostname.includes(".")
                            );
                          } catch {
                            return false;
                          }
                        };
                        return !isSafeImageUrl(scene.imageUrl);
                      }) && (
                        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                          <p className="text-xs text-orange-800">
                            🚨 Some scene images have been blocked due to SSL
                            security issues. Please use a secure HTTPS image
                            URL.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Generate All 버튼 */}
            {videoScenario && (
              <Button
                onClick={() => {
                  // 각 scene의 image_prompt를 실제로 업데이트
                  videoScenario.scenes.forEach((scene, index) => {
                    if (
                      selectedVideoModel === "veo-3" &&
                      newsAnchorIncluded[index]
                    ) {
                      const updatedScene = {
                        ...scene,
                        image_prompt: `The news anchor is wearing a clean and elegant white blouse with no logos or prints, sleeves neatly rolled up, confidently standing in a modern news studio.  and a short-haired, neat-looking Asian female news anchor excitedly says: ${scene.narration}`,
                      };
                      handleUpdateScene(index, updatedScene);
                    }
                  });

                  // 업데이트된 scene들의 image_prompt를 사용
                  const prompts = videoScenario.scenes.map(
                    (scene) => scene.image_prompt
                  );
                  // 아나운서 포함이 체크된 scene의 경우 나레이션을 빈 문자열로 설정
                  const narrations = videoScenario.scenes.map(
                    (scene, index) => {
                      if (
                        selectedVideoModel === "veo-3" &&
                        newsAnchorIncluded[index]
                      ) {
                        return ""; // 나레이션을 빈 문자열로 설정
                      }
                      return scene.narration;
                    }
                  );
                  handleGenerateAllVideos(prompts, narrations);
                }}
                disabled={generatingVideos}
                className="w-full mt-4"
                variant="primary"
              >
                {generatingVideos
                  ? "Generating All Videos..."
                  : "Generate All Scenes To Videos"}
              </Button>
            )}

            {/* 생성 상태 표시 */}
            {generatingVideos && (
              <div className="mt-4 p-4 bg-primary/10 border border-primary/40 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <p className="text-primary-dark font-medium">
                    Generating news video...
                  </p>
                  <p className="text-primary text-sm">Please wait a moment.</p>
                </div>
              </div>
            )}

            {/* 생성 완료 시 상세 페이지 링크 */}
            {currentVideoId && !generatingVideos && (
              <div className="mt-4 p-4 border border-primary/10 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-primary-dark font-bold">
                      News video generation complete!
                    </p>
                    <p className="text-primary text-sm">
                      Check the results on the details page.
                    </p>
                  </div>
                  <Link href={`/video/createVideo/${currentVideoId}`}>
                    <Button variant="secondary" size="sm">
                      View Details Page
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 단일 비디오 결과 */}
            {generatedVideoId && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Generated Video</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🎬</div>
                    <p className="text-lg font-semibold mb-2">
                      Video Generation Started
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      Your video is being generated. Check the status on the
                      details page.
                    </p>
                    <Link href={`/video/createVideo/${generatedVideoId}`}>
                      <Button variant="secondary" size="sm">
                        View Details Page
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {!generatedText &&
              !videoScenario &&
              !generatedVideoId &&
              generatedVideos.length === 0 &&
              !loading &&
              !error && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  Complete the settings on the left and click the desired
                  function button.
                </div>
              )}
          </Section>
        )}
      </div>

      {/* 확인 팝업 */}
      {showConfirmModal && confirmModalData && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={confirmModalData.onConfirm}
          title={confirmModalData.title}
          message={confirmModalData.message}
          apiInfo={confirmModalData.apiInfo}
        />
      )}
    </div>
  );
}
