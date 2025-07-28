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
} from "@/components/styled";
import { NewsVideoCreateData } from "@/lib/types/newsVideo";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
Please generate 1-minute video script in **English** based on this content.

Requirements:
- 1-minute video scenario
- Total of {sceneCount} scenes (e.g., 6)
- For each scene:
  • Image prompt (for AI video generation) — include visual elements such as camera angle, composition, mood, or environment  
  • Narration sentence (for video audio) — short and emotionally resonant  
- Ensure the scenes transition naturally and form a cohesive storyline.
- Please output the result in the JSON format example below.
- Keep the visual tone consistent (e.g., warm, cinematic, minimalistic) across all scenes.

[Example Output Format]
{
  "title": "Video Title",
  "scenario": "Summary of the overall video flow in 1-2 sentences.",
  "scenes": [
    {
      "scene_number": 1,
      "image_prompt": "Low-angle shot of a woman drinking coffee by a sunny window. Warm tone, elegant and cozy mood.",
      "narration": "The day begins with a warm cup of coffee."
    },
    {
      "scene_number": 2,
      "image_prompt": "Side-tracking shot of people commuting through a busy city street. Morning light, business suits, bustling atmosphere.",
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
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState("");
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
  const [activeTab, setActiveTab] = useState<"text" | "scenario" | "video">(
    "scenario"
  );
  const [sceneCount, setSceneCount] = useState<number>(2);
  const [isScenarioCollapsed, setIsScenarioCollapsed] = useState(false);
  const [isVideoModelDetailsCollapsed, setIsVideoModelDetailsCollapsed] =
    useState(true);

  // Blog Content 프롬프트 설정 관련 상태
  const [blogPromptTemplate, setBlogPromptTemplate] = useState(
    DEFAULT_BLOG_PROMPT_TEMPLATE
  );
  const [systemPromptTemplate, setSystemPromptTemplate] = useState(
    DEFAULT_SYSTEM_PROMPT_TEMPLATE
  );
  const [showPromptSettings, setShowPromptSettings] = useState(false);

  // 직접 씬 추가 관련 상태
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
  const router = useRouter();

  const handleGenerateText = async () => {
    if (!prompt.trim()) {
      setError("프롬프트를 입력해주세요.");
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
        throw new Error(data.error || "텍스트 생성에 실패했습니다.");
      }

      setGeneratedText(data.text);
    } catch (err) {
      console.error("Text generation error:", err);
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateScenario = async () => {
    if (!blogContent.trim()) {
      setError("블로그 본문을 입력해주세요.");
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
        throw new Error(data.error || "비디오 시나리오 생성에 실패했습니다.");
      }

      try {
        const scenario = JSON.parse(data.text);
        setVideoScenario(scenario);
        // 시나리오 생성 후 Input Settings 자동 접기
        setIsScenarioCollapsed(true);
      } catch (parseError) {
        console.error("JSON 파싱 오류:", parseError);
        setError("시나리오 파싱에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (err) {
      console.error("Video scenario generation error:", err);
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) {
      setError("비디오 프롬프트를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setGeneratedVideoUrl("");

    try {
      const response = await fetch("/api/replicateVideo/veo-3", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: videoPrompt.trim(),
          seed: videoSeed,
          enhance_prompt: enhancePrompt,
          negative_prompt: negativePrompt.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "비디오 생성에 실패했습니다.");
      }

      setGeneratedVideoUrl(data.videoUrl);
    } catch (err) {
      console.error("Video generation error:", err);
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
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
      setError("사용자 정보나 비디오 시나리오가 없습니다.");
      return;
    }

    setGeneratingVideos(true);
    setError("");
    setGeneratedVideos([]);
    setVideoItems([]);

    try {
      // 새로운 뉴스 비디오 생성 API 사용
      const response = await fetch("/api/video/news/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: videoScenario.title,
          description: videoScenario.scenario,
          prompts: prompts,
          narrations: narrations,
          scenes: videoScenario.scenes,
          model: selectedVideoModel,
          aspectRatio:
            selectedVideoModel === "kling-v2" ? klingAspectRatio : "16:9",
          duration: selectedVideoModel === "kling-v2" ? klingDuration : 5,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "비디오 생성에 실패했습니다.");
      }

      const data = await response.json();
      const videoId = data.videoId;
      setCurrentVideoId(videoId);

      console.log("News video generation started:", videoId);
      console.log("Scene videos:", data.sceneVideos);

      // 성공 메시지 표시
      setError("");
      // 여기서는 상세 페이지로 이동하지 않고 현재 페이지에서 생성 상태를 보여줌
    } catch (err) {
      console.error("News video generation error:", err);
      setError(
        err instanceof Error ? err.message : "비디오 생성에 실패했습니다."
      );
    } finally {
      setGeneratingVideos(false);
    }
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
      alert("텍스트가 클립보드에 복사되었습니다.");
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
    setGeneratedVideoUrl("");
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
    // 직접 씬 추가 관련 초기화
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

  // 직접 씬 추가 관련 함수들
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
      // 씬 번호 재정렬
      return updatedScenes.map((scene, i) => ({
        ...scene,
        scene_number: i + 1,
      }));
    });
  };

  const createManualVideoScenario = () => {
    if (manualScenes.length > 0) {
      const scenario: VideoScenario = {
        title: "수동 생성 시나리오",
        scenario: `${manualScenes.length}개의 씬으로 구성된 수동 생성 비디오 시나리오입니다.`,
        scenes: manualScenes.map((scene, index) => ({
          ...scene,
          scene_number: index + 1, // 씬 번호를 1부터 시작하도록 보장
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

  const handleMerge = async () => {
    setIsLoadingMerge(true);
    setMergeError(null);
    setCurrentProgress("영상을 병합하는 중...");

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
        throw new Error("영상 병합에 실패했습니다.");
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
        setCurrentProgress("병합 완료!");

        // 메모리 정리
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 60000); // 1분 후 메모리 정리
      } else {
        throw new Error("영상 데이터를 받지 못했습니다.");
      }
    } catch (err) {
      console.error("Merge error:", err);
      setMergeError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoadingMerge(false);
    }
  };

  const handleSaveNewsVideo = async () => {
    if (!user || !videoScenario || !mergedBlobUrl) {
      setError("저장할 수 있는 데이터가 없습니다.");
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
        throw new Error("비디오 업로드에 실패했습니다.");
      }

      const uploadData = await uploadResponse.json();
      const videoUrl = uploadData.url;

      // Firebase Firestore에 저장
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

      // API를 통해 뉴스 비디오 저장
      const saveResponse = await fetch("/api/video/news/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.uid,
          newsVideoData,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("뉴스 비디오 저장에 실패했습니다.");
      }

      const saveData = await saveResponse.json();
      const videoId = saveData.videoId;

      // 성공 시 상세 페이지로 이동
      router.push(`/video/news/${videoId}`);
    } catch (err) {
      console.error("Save news video error:", err);
      setError(
        err instanceof Error ? err.message : "뉴스 비디오 저장에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <PageTitle title="AI Content Generation" />

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* 입력 섹션 */}
        <Section
          variant="underline"
          className={isScenarioCollapsed ? "!mb-0 !pb-0" : ""}
        >
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-xl font-semibold">Input Settings</h2>
            {videoScenario && (
              <Button
                onClick={() => setIsScenarioCollapsed(!isScenarioCollapsed)}
                variant="normal"
                size="sm"
              >
                {isScenarioCollapsed ? "상세보기" : "접기"}
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

          {!isScenarioCollapsed && (
            <>
              {/* 탭 네비게이션 */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab("scenario")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "scenario"
                        ? "border-primary-light text-primary"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Video Scenario Generation
                  </button>
                  <button
                    onClick={() => setActiveTab("text")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "text"
                        ? "border-primary-light text-primary"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Text Generation
                  </button>
                  <button
                    onClick={() => setActiveTab("video")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "video"
                        ? "border-primary-light text-primary"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Veo-3 Video Generation
                  </button>
                </nav>
              </div>

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
                      <label className="block text-sm font-medium mb-2">
                        Blog Content
                      </label>
                      <Textarea
                        value={blogContent}
                        onChange={(e) => setBlogContent(e.target.value)}
                        placeholder="Enter blog content. A 1-minute video scenario will be generated based on this content..."
                        rows={4}
                      />
                    </div>

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
                          label: `${num} scenes (${Math.round(
                            60 / num
                          )}s each)`,
                        }))}
                        className="w-full"
                      />
                    </div>

                    {/* 프롬프트 설정 버튼 */}
                    <div className="border-t pt-4">
                      <Button
                        onClick={() =>
                          setShowPromptSettings(!showPromptSettings)
                        }
                        variant="normal"
                        size="sm"
                        className="w-full"
                      >
                        {showPromptSettings
                          ? "prompt settings close"
                          : "prompt settings open"}
                      </Button>
                    </div>

                    {/* 프롬프트 설정 섹션 */}
                    {showPromptSettings && (
                      <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-900">
                          프롬프트 설정
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
                            사용 가능한 변수: {"{sceneCount}"},{" "}
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
                            사용 가능한 변수: {"{sceneDuration}"},{" "}
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
                            variant="outline"
                            size="sm"
                          >
                            기본값으로 복원
                          </Button>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleGenerateScenario}
                      disabled={loading || !blogContent.trim()}
                      className="w-full"
                    >
                      {loading ? "Generating..." : "Generate Scenario"}
                    </Button>
                  </div>
                )}

                {/* 직접 씬 추가 섹션 - 모든 탭에서 보임 */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium">직접 씬 추가</h4>
                    <Button
                      onClick={() =>
                        setShowManualSceneInput(!showManualSceneInput)
                      }
                      variant="normal"
                      size="sm"
                    >
                      {showManualSceneInput ? "접기" : "씬 추가"}
                    </Button>
                  </div>

                  {showManualSceneInput && (
                    <div className="space-y-4">
                      {/* 새 씬 입력 폼 */}
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
                          씬 추가
                        </Button>
                      </div>

                      {/* 추가된 씬 목록 */}
                      {manualScenes.length > 0 && (
                        <div className="space-y-3">
                          <h5 className="text-sm font-medium">
                            추가된 씬들 ({manualScenes.length})
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
                                    삭제
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
                            시나리오 생성 ({manualScenes.length}개 씬)
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

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
                <Button
                  onClick={handleClear}
                  variant="normal"
                  className="w-full"
                >
                  Clear All
                </Button>
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
                  onSaveNewsVideo={handleSaveNewsVideo}
                  isSaving={loading}
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
                    { value: "hailuo-02", label: "Hailuo-02 (Minimax)" },
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
                  {isVideoModelDetailsCollapsed ? "세부설정 보기" : "접기"}
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
                      씬에 이미지가 추가된 경우 해당 이미지가 자동으로
                      start_image로 사용됩니다.
                    </p>
                  </div>

                  {/* 씬별 이미지 상태 표시 */}
                  {videoScenario && (
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs font-medium text-blue-800 mb-2">
                        씬별 이미지 상태:
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
                                      ? "text-green-600"
                                      : "text-orange-600"
                                    : "text-gray-500"
                                }
                              >
                                {scene.imageUrl
                                  ? isSafe
                                    ? "✅ 안전한 이미지"
                                    : "⚠️ 안전하지 않은 이미지"
                                  : "❌ 이미지 없음"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        ⚠️ 안전하지 않은 이미지는 start_image로 사용되지
                        않습니다.
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
                            🚨 일부 씬의 이미지가 SSL 보안 문제로
                            차단되었습니다. 안전한 HTTPS 이미지 URL을
                            사용해주세요.
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
                  const prompts = videoScenario.scenes.map(
                    (scene) => scene.image_prompt
                  );
                  const narrations = videoScenario.scenes.map(
                    (scene) => scene.narration
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
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <div>
                    <p className="text-blue-800 font-medium">
                      뉴스 비디오 생성 중...
                    </p>
                    <p className="text-blue-600 text-sm">
                      잠시만 기다려주세요.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 생성 완료 시 상세 페이지 링크 */}
            {currentVideoId && !generatingVideos && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-800 font-medium">
                      ✅ 뉴스 비디오 생성 완료!
                    </p>
                    <p className="text-green-600 text-sm">
                      상세 페이지에서 결과를 확인하세요.
                    </p>
                  </div>
                  <Link href={`/video/news/${currentVideoId}`}>
                    <Button variant="primary" size="sm">
                      상세 페이지 보기
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 단일 비디오 결과 */}
            {generatedVideoUrl && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Generated Video</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <video
                    controls
                    className="w-full h-auto rounded"
                    src={generatedVideoUrl}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

                <Button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = generatedVideoUrl;
                    link.download = "generated-video.mp4";
                    link.click();
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Download Video
                </Button>
              </div>
            )}

            {!generatedText &&
              !videoScenario &&
              !generatedVideoUrl &&
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
    </div>
  );
}
