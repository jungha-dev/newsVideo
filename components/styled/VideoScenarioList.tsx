"use client";

import React, { useState } from "react";
import { Button } from "@/components/styled";

const NEWS_ANCHOR_PROMPT =
  "The news anchor is wearing a clean and elegant white blouse with no logos or prints, sleeves neatly rolled up, confidently standing in a modern news studio. A breaking news opening screen appears, and a short-haired, neat-looking Asian female news anchor excitedly says:";

interface Scene {
  scene_number: number;
  image_prompt: string;
  narration: string;
  videoUrl?: string;
  imageUrl?: string;
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

interface VideoScenarioListProps {
  scenario: VideoScenario | null;
  onGenerateAll: (prompts: string[], narrations: string[]) => void;
  generating: boolean;
  generatedVideos?: string[];
  // 편집 관련 props
  videoItems?: VideoItem[];
  onVideoItemsChange?: (items: VideoItem[]) => void;
  onMerge?: () => void;
  isMerging?: boolean;
  mergedVideoUrl?: string;
  globalColor?: string;
  subtitleStyle?: "box" | "outline";
  onGlobalColorChange?: (color: string) => void;
  onSubtitleStyleChange?: (style: "box" | "outline") => void;
  // 이미지 링크 추가 관련 props
  onAddImageUrl?: (url: string) => void;
  // Scene별 미디어 추가 관련 props
  onAddSceneImage?: (sceneIndex: number, imageUrl: string) => void;
  onAddSceneVideo?: (sceneIndex: number, videoUrl: string) => void;
  onUpdateScene?: (sceneIndex: number, updatedScene: Scene) => void;
  // Add Scenes 관련 props
  onAddScene?: () => void;
  // Delete Scene 관련 props
  onDeleteScene?: (sceneIndex: number) => void;
  // Generated Video Save 관련 props
  onSaveNewsVideo?: () => void;
  isSaving?: boolean;
  // Video Model 관련 props
  selectedVideoModel?: "kling-v2" | "veo-3" | "hailuo-02";
  // 아나운서 포함 관련 props
  newsAnchorIncluded?: { [key: number]: boolean };
  onNewsAnchorIncludedChange?: (value: { [key: number]: boolean }) => void;
}

export default function VideoScenarioList({
  scenario,
  onGenerateAll,
  generating,
  generatedVideos = [],
  videoItems = [],
  onVideoItemsChange,
  onMerge,
  isMerging = false,
  mergedVideoUrl,
  globalColor = "#ffffff",
  subtitleStyle = "box",
  onGlobalColorChange,
  onSubtitleStyleChange,
  onAddImageUrl,
  onAddSceneImage,
  onAddSceneVideo,
  onUpdateScene,
  onAddScene,
  onDeleteScene,
  onSaveNewsVideo,
  isSaving = false,
  selectedVideoModel,
  newsAnchorIncluded = {},
  onNewsAnchorIncludedChange,
}: VideoScenarioListProps) {
  const [showImageUrlModal, setShowImageUrlModal] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [sceneMediaModals, setSceneMediaModals] = useState<{
    [key: number]: { show: boolean; type: "image" | "video"; url: string };
  }>({});
  const [originalPrompts, setOriginalPrompts] = useState<{
    [key: number]: string;
  }>({});

  if (!scenario) return null;

  const handleGenerateAll = () => {
    // 각 scene의 image_prompt를 실제로 업데이트
    scenario.scenes.forEach((scene, index) => {
      if (selectedVideoModel === "veo-3" && newsAnchorIncluded[index]) {
        const updatedScene = {
          ...scene,
          image_prompt: `${NEWS_ANCHOR_PROMPT} ${scene.narration}`,
        };
        if (onUpdateScene) {
          onUpdateScene(index, updatedScene);
        }
      }
    });

    // 업데이트된 scene들의 image_prompt를 사용
    const prompts = scenario.scenes.map((scene) => scene.image_prompt);
    // 아나운서 포함이 체크된 scene의 경우 나레이션을 빈 문자열로 설정
    const narrations = scenario.scenes.map((scene, index) => {
      if (selectedVideoModel === "veo-3" && newsAnchorIncluded[index]) {
        return ""; // 나레이션을 빈 문자열로 설정
      }
      return scene.narration;
    });
    onGenerateAll(prompts, narrations);
  };

  const handleAddImageUrl = () => {
    if (imageUrlInput.trim() && onAddImageUrl) {
      onAddImageUrl(imageUrlInput.trim());
      setImageUrlInput("");
      setShowImageUrlModal(false);
    }
  };

  const openSceneMediaModal = (sceneIndex: number, type: "image" | "video") => {
    setSceneMediaModals((prev) => ({
      ...prev,
      [sceneIndex]: { show: true, type, url: "" },
    }));
  };

  const closeSceneMediaModal = (sceneIndex: number) => {
    setSceneMediaModals((prev) => ({
      ...prev,
      [sceneIndex]: { show: false, type: "image", url: "" },
    }));
  };

  const handleAddSceneMedia = (sceneIndex: number) => {
    const modal = sceneMediaModals[sceneIndex];
    if (modal && modal.url.trim()) {
      const scene = scenario.scenes[sceneIndex];
      const updatedScene = { ...scene };

      if (modal.type === "image") {
        updatedScene.imageUrl = modal.url.trim();
        // 이미지 추가 시 프롬프트를 자동으로 변경
        updatedScene.image_prompt =
          "Keep the image content unchanged and minimize actions.";
        if (onAddSceneImage) {
          onAddSceneImage(sceneIndex, modal.url.trim());
        }
      } else if (modal.type === "video") {
        updatedScene.videoUrl = modal.url.trim();
        if (onAddSceneVideo) {
          onAddSceneVideo(sceneIndex, modal.url.trim());
        }
      }

      if (onUpdateScene) {
        onUpdateScene(sceneIndex, updatedScene);
      }

      closeSceneMediaModal(sceneIndex);
    }
  };

  const createEmptyVideo = (url = ""): VideoItem => ({
    url,
    subtitle: "",
    trim: [0, 5],
    speed: "1",
    thumbnail: "",
    isSelected: false,
  });

  const addVideoUrl = (url: string) => {
    if (url.trim() && onVideoItemsChange) {
      onVideoItemsChange([...videoItems, createEmptyVideo(url.trim())]);
    }
  };

  const updateVideoField = (
    idx: number,
    field: keyof VideoItem,
    value: any
  ) => {
    if (onVideoItemsChange) {
      onVideoItemsChange(
        videoItems.map((video, i) =>
          i === idx ? { ...video, [field]: value } : video
        )
      );
    }
  };

  const removeVideo = (idx: number) => {
    if (onVideoItemsChange) {
      onVideoItemsChange(videoItems.filter((_, i) => i !== idx));
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-secondary-dark rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">{scenario.title}</h3>
        <p className=" text-sm">{scenario.scenario}</p>
      </div>

      {/* 전체 영상 프리뷰 */}
      {videoItems.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold">전체 영상 프리뷰</h4>
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            {videoItems.map((video, index) => (
              <div
                key={index}
                className="absolute inset-0 transition-opacity duration-300"
                style={{ opacity: index === 0 ? 1 : 0 }}
              >
                <video
                  src={video.url || undefined}
                  className="w-full h-full object-contain"
                  controls
                  onTimeUpdate={(e) => {
                    const videoEl = e.currentTarget;
                    if (videoEl.currentTime >= video.trim[1]) {
                      videoEl.currentTime = video.trim[0];
                    }
                  }}
                  onLoadedMetadata={(e) => {
                    const videoEl = e.currentTarget;
                    videoEl.playbackRate = parseFloat(video.speed);
                  }}
                />
                {video.subtitle && (
                  <div
                    className="absolute bottom-[5%] left-1/2 text-center"
                    style={{
                      color: globalColor,
                      fontSize: "1.8vw",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: "bold",
                      textShadow:
                        subtitleStyle === "outline"
                          ? "2px 2px 2px black, -2px -2px 2px black, 2px -2px 2px black, -2px 2px 2px black"
                          : "none",
                      backgroundColor:
                        subtitleStyle === "box"
                          ? "rgba(0,0,0,0.5)"
                          : "transparent",
                      padding: subtitleStyle === "box" ? "0.1vw 0.3vw" : "0",
                      borderRadius: subtitleStyle === "box" ? "0.3vw" : "0",
                      whiteSpace: "pre-wrap",
                      maxWidth: "90%",
                      lineHeight: "1.2",
                      transform: "translateX(-50%)",
                      textAlign: "center",
                      pointerEvents: "none",
                      width: "fit-content",
                      margin: "0 auto",
                    }}
                  >
                    {video.subtitle}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-md font-semibold">
            Scene List ({scenario.scenes.length} scenes)
          </h4>
          <div className="flex gap-2">
            {onAddScene && (
              <Button onClick={onAddScene} variant="outline" size="sm">
                Add Scenes
              </Button>
            )}
          </div>
        </div>

        {/* 생성된 영상들을 자동으로 추가 */}
        {generatedVideos.length > 0 && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/40 rounded-lg">
            <p className="text-sm font-medium text-primary-dark mb-2">
              생성된 영상들:
            </p>
            <div className="flex flex-wrap gap-2">
              {generatedVideos.map((url, index) => (
                <Button
                  key={index}
                  onClick={() => addVideoUrl(url)}
                  variant="outline"
                  size="sm"
                >
                  영상 {index + 1} 추가
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* 병합된 영상 프리뷰 */}
        {mergedVideoUrl && (
          <div className="mb-4 p-3 bg-primary/20 border border-primary/40 rounded-lg">
            <h5 className="text-sm font-medium text-primary-dark mb-2">
              병합된 영상
            </h5>
            <video
              src={mergedVideoUrl}
              controls
              preload="metadata"
              className="w-full rounded"
              onError={(e) => {
                console.error("Video loading error:", e);
                console.error("Video error details:", e.currentTarget.error);
              }}
              onLoadedMetadata={(e) => {
                console.log(
                  "Video loaded successfully:",
                  e.currentTarget.duration,
                  "seconds"
                );
              }}
              onCanPlay={(e) => {
                console.log("Video can play:", e.currentTarget.readyState);
              }}
              onLoadStart={(e) => {
                console.log("Video load started");
              }}
            />
            <div className="flex gap-2 mt-2">
              <Button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = mergedVideoUrl;
                  link.download = "merged-video.mp4";
                  link.click();
                }}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                다운로드
              </Button>
              {onSaveNewsVideo && (
                <Button
                  onClick={onSaveNewsVideo}
                  disabled={isSaving}
                  variant="primary"
                  size="sm"
                  className="flex-1"
                >
                  {isSaving ? "Save 중..." : "Generated Video로 Save"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 글로벌 설정 */}
        {videoItems.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <h5 className="text-sm font-medium mb-2">전체 설정</h5>
            <div className="flex gap-4 items-center mb-2">
              <label className="text-xs">자막 색상:</label>
              <input
                type="color"
                value={globalColor}
                onChange={(e) => onGlobalColorChange?.(e.target.value)}
                className="w-8 h-6 border rounded"
              />
            </div>
            <div className="flex gap-4 items-center">
              <label className="text-xs">자막 스타일:</label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="box"
                  checked={subtitleStyle === "box"}
                  onChange={() => onSubtitleStyleChange?.("box")}
                  className="mr-1"
                />
                <span className="text-xs">배경</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="outline"
                  checked={subtitleStyle === "outline"}
                  onChange={() => onSubtitleStyleChange?.("outline")}
                  className="mr-1"
                />
                <span className="text-xs">테두리</span>
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {scenario.scenes.map((scene, index) => (
            <div
              key={`${scene.scene_number}-${index}`}
              className="bg-gray-50 border border-gray-200 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium text-gray-600">
                  Scene {scene.scene_number}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {selectedVideoModel === "veo-3" ? "8s" : "5s"}
                  </span>
                  {onDeleteScene && scenario.scenes.length > 1 && (
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Are you sure you want to delete Scene ${scene.scene_number}?`
                          )
                        ) {
                          onDeleteScene(index);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 text-xs bg-transparent border-none p-1 cursor-pointer"
                      title="Delete Scene"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {/* 생성된 영상 표시 */}
              {generatedVideos[index] && (
                <div className="mb-3">
                  <video
                    controls
                    className="w-full h-auto rounded"
                    src={generatedVideos[index]}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* 추가된 이미지 표시 */}
              {scene.imageUrl && (
                <div className="mb-3 relative">
                  <img
                    src={scene.imageUrl}
                    alt={`Scene ${scene.scene_number} image`}
                    className="w-full h-auto rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <button
                    onClick={() => {
                      const updatedScene = { ...scene, imageUrl: undefined };
                      if (onUpdateScene) {
                        onUpdateScene(index, updatedScene);
                      }
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    title="이미지 삭제"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* 추가된 영상 표시 및 편집 */}
              {scene.videoUrl && (
                <div className="mb-3 relative">
                  <video
                    controls
                    className="w-full h-auto rounded"
                    src={scene.videoUrl}
                  >
                    Your browser does not support the video tag.
                  </video>
                  <button
                    onClick={() => {
                      const updatedScene = { ...scene, videoUrl: undefined };
                      if (onUpdateScene) {
                        onUpdateScene(index, updatedScene);
                      }
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    title="영상 삭제"
                  >
                    ×
                  </button>

                  {/* 영상 편집 옵션 */}
                  <div className="mt-2 space-y-2 p-2 bg-gray-50 rounded border">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        자막
                      </label>
                      <textarea
                        placeholder="자막을 입력하세요"
                        rows={2}
                        className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-light"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        재생 속도
                      </label>
                      <select
                        value="1"
                        className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-light"
                      >
                        <option value="0.5">0.5x (느리게)</option>
                        <option value="0.75">0.75x</option>
                        <option value="1">1x (보통)</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x (빠르게)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        구간 선택 (초)
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          placeholder="시작"
                          min="0"
                          step="0.1"
                          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-light"
                        />
                        <input
                          type="number"
                          placeholder="끝"
                          min="0"
                          step="0.1"
                          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-light"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`scene-${index}-selected`}
                        checked={false}
                        className="mr-1"
                      />
                      <label
                        htmlFor={`scene-${index}-selected`}
                        className="text-xs"
                      >
                        병합에 포함 (선택 필요)
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {selectedVideoModel === "veo-3" && (
                <div className="flex gap-2 mb-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newsAnchorIncluded[index] || false}
                      onChange={(e) => {
                        if (onNewsAnchorIncludedChange) {
                          onNewsAnchorIncludedChange({
                            ...newsAnchorIncluded,
                            [index]: e.target.checked,
                          });
                        }

                        // Image Prompt 실시간 업데이트
                        if (onUpdateScene) {
                          const scene = scenario.scenes[index];

                          if (e.target.checked) {
                            // 체크할 때: 원래 프롬프트를 저장하고 아나운서 프롬프트로 변경
                            setOriginalPrompts((prev) => ({
                              ...prev,
                              [index]: scene.image_prompt,
                            }));

                            const updatedScene = {
                              ...scene,
                              image_prompt: `${NEWS_ANCHOR_PROMPT} ${scene.narration}`,
                            };
                            onUpdateScene(index, updatedScene);
                          } else {
                            // 체크 해제할 때: 원래 프롬프트로 복원
                            const originalPrompt =
                              originalPrompts[index] || scene.image_prompt;
                            const updatedScene = {
                              ...scene,
                              image_prompt: originalPrompt,
                            };
                            onUpdateScene(index, updatedScene);
                          }
                        }
                      }}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-500">
                      including the news anchor
                    </span>
                  </div>
                </div>
              )}
              {/* 미디어 추가 버튼들 */}
              <div className="flex gap-2 mb-3">
                <Button
                  onClick={() => openSceneMediaModal(index, "image")}
                  variant="normal"
                  size="sm"
                  className="flex-1 text-xs"
                  disabled={selectedVideoModel === "veo-3"}
                >
                  {selectedVideoModel === "veo-3" ? "" : "📷 Add Image"}
                </Button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Image Prompt
                    {scene.imageUrl && (
                      <span className="text-secondary-dark ml-1">
                        (이미지 추가됨)
                      </span>
                    )}
                  </label>
                  <textarea
                    value={scene.image_prompt}
                    onChange={(e) => {
                      const updatedScene = {
                        ...scene,
                        image_prompt: e.target.value,
                      };
                      if (onUpdateScene) {
                        onUpdateScene(index, updatedScene);
                      }
                    }}
                    placeholder="이미지 프롬프트를 입력하세요..."
                    className="w-full text-xs text-gray-800 bg-white p-2 rounded border border-secondary-light resize-none"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Narration
                  </label>
                  <textarea
                    value={scene.narration}
                    onChange={(e) => {
                      const updatedScene = {
                        ...scene,
                        narration: e.target.value,
                      };

                      // 아나운서 포함이 체크된 경우 Image Prompt도 함께 업데이트
                      if (
                        selectedVideoModel === "veo-3" &&
                        newsAnchorIncluded[index]
                      ) {
                        updatedScene.image_prompt = `${NEWS_ANCHOR_PROMPT} ${e.target.value}`;
                      }

                      if (onUpdateScene) {
                        onUpdateScene(index, updatedScene);
                      }
                    }}
                    placeholder="나레이션을 입력하세요..."
                    className="w-full text-xs text-gray-800 bg-white p-2 rounded border border-secondary-light resize-none"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 이미지 URL 입력 모달 */}
      {showImageUrlModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                이미지 URL 추가
              </h3>
              <button
                onClick={() => {
                  setShowImageUrlModal(false);
                  setImageUrlInput("");
                }}
                className="text-gray-400 hover:text-black text-xl bg-transparent border-none p-0 cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  이미지 URL
                </label>
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddImageUrl();
                    }
                  }}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowImageUrlModal(false);
                    setImageUrlInput("");
                  }}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAddImageUrl}
                  disabled={!imageUrlInput.trim()}
                  className="flex-1"
                >
                  추가
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scene별 미디어 추가 모달 */}
      {Object.entries(sceneMediaModals).map(([sceneIndex, modal]) => {
        if (!modal.show) return null;
        const index = parseInt(sceneIndex);
        const scene = scenario.scenes[index];

        return (
          <div
            key={sceneIndex}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          >
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Scene {scene.scene_number} -{" "}
                  {modal.type === "image" ? "이미지" : "영상"} 추가
                </h3>
                <button
                  onClick={() => closeSceneMediaModal(index)}
                  className="text-gray-400 hover:text-black text-xl bg-transparent border-none p-0 cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {modal.type === "image" && (
                  <div className="p-3 bg-primary/10 border border-primary/40 rounded-lg">
                    <p className="text-xs text-primary-dark">
                      💡 이미지 추가 시 해당 Scene의 프롬프트가 자동으로 "Keep
                      the image content unchanged and minimize actions."로
                      변경됩니다.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {modal.type === "image" ? "이미지" : "영상"} URL
                  </label>
                  <input
                    type="url"
                    value={modal.url}
                    onChange={(e) =>
                      setSceneMediaModals((prev) => ({
                        ...prev,
                        [sceneIndex]: {
                          ...prev[sceneIndex],
                          url: e.target.value,
                        },
                      }))
                    }
                    placeholder={
                      modal.type === "image"
                        ? "https://example.com/image.jpg"
                        : "https://example.com/video.mp4"
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddSceneMedia(index);
                      }
                    }}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => closeSceneMediaModal(index)}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleAddSceneMedia(index)}
                    disabled={!modal.url.trim()}
                    className="flex-1"
                  >
                    추가
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
