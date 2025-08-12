import React, { useState, useRef, useEffect, useCallback } from "react";
import Button from "./Button";

interface VideoPreviewProps {
  videos: Array<{
    id: string;
    output?: string;
    status: string;
    fromImage: string;
    toImage: string;
    narration?: string;
  }>;
  projectInfo: {
    name: string;
    created_at: string;
    totalVideos: number;
    completedCount: number;
    processingCount: number;
    failedCount: number;
  };
  info?: {
    model?: string;
    status: string;
    createdAt: string;
  };
  onEditProject?: () => void;
  onVideoOrderChange?: (fromIndex: number, toIndex: number) => void;
  subtitleColor?: string;
  subtitleStyle?: "box" | "outline";
  showSubtitles?: boolean;
  // 자막 설정 관련 props
  onSubtitleColorChange?: (color: string) => void;
  onSubtitleStyleChange?: (style: "box" | "outline") => void;
  onShowSubtitlesChange?: (show: boolean) => void;
  // 병합 및 다운로드 관련 props
  onMergeAndDownload?: () => void;
  isMerging?: boolean;
  mergedVideoUrl?: string;
  onDownload?: () => void;
  mergeProgress?: string;
  mergeProgressMessages?: string[];
  // 삭제 관련 props
  onDeleteVideo?: () => void;
  isDeleting?: boolean;
}

export default function VideoPreview({
  videos,
  projectInfo,
  info,
  onEditProject,
  onVideoOrderChange,
  subtitleColor = "#ffffff",
  subtitleStyle = "box",
  showSubtitles = true,
  onSubtitleColorChange,
  onSubtitleStyleChange,
  onShowSubtitlesChange,
  onMergeAndDownload,
  isMerging = false,
  mergedVideoUrl,
  onDownload,
  mergeProgress,
  mergeProgressMessages = [],
  onDeleteVideo,
  isDeleting = false,
}: VideoPreviewProps) {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [videoThumbnails, setVideoThumbnails] = useState<{
    [key: string]: string;
  }>({});
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentVideo = videos[currentVideoIndex];

  // 각 영상의 길이를 5초로 가정 (실제로는 API에서 가져와야 함)
  const VIDEO_DURATION = 5;

  // 비디오가 변경될 때 에러 상태 초기화
  useEffect(() => {
    setVideoError(null);
    setIsVideoLoading(false);
  }, [currentVideoIndex]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 비디오 URL 유효성 검사
  const isValidVideoUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  // 비디오 썸네일 생성
  const generateVideoThumbnail = useCallback(
    (videoUrl: string, videoId: string) => {
      // 이미 썸네일이 있으면 생성하지 않음
      if (videoThumbnails[videoId]) {
        return;
      }

      // Firebase Storage URL인지 확인
      const isFirebaseUrl = videoUrl.includes("firebasestorage.googleapis.com");

      // Firebase URL인 경우 더 안전한 방식으로 처리
      if (isFirebaseUrl) {
        // Firebase URL은 CORS 문제가 있을 수 있으므로 기본 썸네일 사용
        setVideoThumbnails((prev) => ({
          ...prev,
          [videoId]: "/placeholder-video.svg", // 기본 비디오 썸네일 SVG
        }));
        return;
      }

      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true; // 음소거로 자동 재생 방지
      video.playsInline = true;

      // 비디오 로드 타임아웃 설정
      const loadTimeout = setTimeout(() => {
        console.warn("Video thumbnail generation timeout:", videoUrl);
        // 타임아웃 시 기본 썸네일 사용
        setVideoThumbnails((prev) => ({
          ...prev,
          [videoId]: "/placeholder-video.svg",
        }));
      }, 10000); // 10초 타임아웃

      video.addEventListener("loadeddata", () => {
        clearTimeout(loadTimeout);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            // 비디오가 로드된 후 0.1초 지점에서 썸네일 생성
            video.currentTime = 0.1;

            video.addEventListener(
              "seeked",
              () => {
                try {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.8);
                  setVideoThumbnails((prev) => ({
                    ...prev,
                    [videoId]: thumbnailUrl,
                  }));
                } catch (error) {
                  console.warn(
                    "Failed to generate thumbnail from video:",
                    error
                  );
                  // 오류 시 기본 썸네일 사용
                  setVideoThumbnails((prev) => ({
                    ...prev,
                    [videoId]: "/placeholder-video.svg",
                  }));
                }
              },
              { once: true }
            );
          }
        } catch (error) {
          console.warn("Failed to create thumbnail canvas:", error);
          setVideoThumbnails((prev) => ({
            ...prev,
            [videoId]: "/placeholder-video.png",
          }));
        }
      });

      video.addEventListener("error", (error) => {
        clearTimeout(loadTimeout);
        console.warn("Video thumbnail generation failed:", {
          videoUrl,
          error: (error.target as HTMLVideoElement)?.error || "Unknown error",
        });
        // 오류 시 기본 썸네일 사용
        setVideoThumbnails((prev) => ({
          ...prev,
          [videoId]: "/placeholder-video.svg",
        }));
      });

      // 비디오 로드 시작
      video.src = videoUrl;
      video.load();
    },
    [videoThumbnails]
  );

  // 전체 영상의 총 길이 계산
  const totalVideoDuration = videos.length * VIDEO_DURATION;

  // 시간 포맷팅 함수
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlay = () => {
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsAutoPlay(true);
          })
          .catch((error) => {
            console.log("Playback was prevented:", error);
            setIsPlaying(false);
            setIsAutoPlay(false);
          });
      }
    }
  };

  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      setIsAutoPlay(false);
    }
  };

  const handleStop = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      setIsAutoPlay(false);
    }
  };

  // 전체 시간을 기준으로 현재 영상 인덱스와 해당 영상의 상대 시간을 계산
  const calculateVideoPosition = (totalTime: number) => {
    const videoIndex = Math.floor(totalTime / VIDEO_DURATION);
    const offsetTime = totalTime % VIDEO_DURATION;
    return { videoIndex: Math.min(videoIndex, videos.length - 1), offsetTime };
  };

  // 시크바 변경 핸들러
  const handleSeek = (seekTime: number) => {
    const { videoIndex, offsetTime } = calculateVideoPosition(seekTime);

    setCurrentVideoIndex(videoIndex);
    setCurrentTime(seekTime);

    // 비디오가 로드된 후 해당 시간으로 이동
    if (videoRef.current) {
      videoRef.current.currentTime = offsetTime;
    }
  };

  // 현재 영상의 시간 업데이트
  const updateCurrentTime = () => {
    if (videoRef.current && isPlaying) {
      const videoTime = videoRef.current.currentTime;
      const totalTime = currentVideoIndex * VIDEO_DURATION + videoTime;
      setCurrentTime(totalTime);
    }
  };

  // 부드러운 시간 업데이트를 위한 인터벌
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPlaying) {
      interval = setInterval(() => {
        if (videoRef.current) {
          const videoTime = videoRef.current.currentTime;
          const totalTime = currentVideoIndex * VIDEO_DURATION + videoTime;
          setCurrentTime(totalTime);
        }
      }, 5); // 0.005초마다 업데이트
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, currentVideoIndex]);

  const handleVideoEnd = () => {
    if (isAutoPlay) {
      // 자동 재생 모드일 때만 다음 영상으로 자동 전환
      if (currentVideoIndex < videos.length - 1) {
        setCurrentVideoIndex(currentVideoIndex + 1);
      } else {
        // 마지막 영상이 끝나면 정지
        setIsPlaying(false);
        setIsAutoPlay(false);
      }
    } else {
      // 수동 모드일 때는 현재 영상만 반복
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.log("Loop play was prevented:", error);
          });
        }
      }
    }
  };

  const nextVideo = () => {
    if (currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  const prevVideo = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
  };

  // 비디오가 변경될 때 자동 재생
  useEffect(() => {
    if (videoRef.current) {
      // 현재 재생 중이면 일단 정지
      if (isPlaying) {
        videoRef.current.pause();
      }

      videoRef.current.currentTime = 0;

      if (isAutoPlay) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((error) => {
              console.log("Auto-play was prevented:", error);
              setIsPlaying(false);
            });
        }
      } else {
        setIsPlaying(false);
      }
    }
  }, [currentVideoIndex, isAutoPlay]);

  // 전체 시간 초기화
  useEffect(() => {
    setTotalDuration(totalVideoDuration);
  }, [totalVideoDuration]);

  // videos 배열이 변경될 때 썸네일 재생성
  useEffect(() => {
    // 새로운 썸네일만 생성 (기존 썸네일은 유지)
    videos.forEach((video) => {
      if (video.output && !videoThumbnails[video.id]) {
        generateVideoThumbnail(video.output, video.id);
      }
    });
  }, [videos, generateVideoThumbnail]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 왼쪽: 프로젝트 정보 */}
      <div className="rounded-lg p-6 space-y-4">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-2xl font-bold text-gray-900">
              {projectInfo.name}
            </h2>
            <div className="flex items-center gap-2">
              {onEditProject && (
                <button
                  onClick={onEditProject}
                  className="text-gray-400 hover:text-gray-600 text-xl p-1"
                  title="Project Settings"
                >
                  ⋯
                </button>
              )}
              {onDeleteVideo && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="text-gray-400 hover:text-red-600 text-xl p-1 transition-colors"
                    title="More Options"
                    disabled={isDeleting}
                  >
                    ⋯
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            onDeleteVideo();
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Delete Video
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            {info && (
              <div className="flex items-center gap-4 mb-2 text-sm text-gray-600">
                {info.model && (
                  <span>
                    Model: <span className="font-medium">{info.model}</span>
                  </span>
                )}
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    info.status === "completed"
                      ? "bg-secondary text-black"
                      : info.status === "processing"
                      ? "bg-yellow-100 text-yellow-800"
                      : info.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {info.status === "completed"
                    ? "Completed"
                    : info.status === "processing"
                    ? "Processing"
                    : info.status === "failed"
                    ? "Failed"
                    : "Pending"}
                </span>
              </div>
            )}
            <p className="text-gray-600 text-xs">
              Created :{" "}
              {info
                ? new Date(info.createdAt).toLocaleDateString()
                : new Date(projectInfo.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* 현재 영상 정보 */}
        {videos.length > 0 ? (
          <div className="border-t border-secondary pt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-900 mb-2">
                Video {currentVideoIndex + 1} / {videos.length}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={prevVideo}
                  disabled={currentVideoIndex === 0}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                >
                  Pre
                </button>
                <button
                  onClick={nextVideo}
                  disabled={currentVideoIndex === videos.length - 1}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
            {/* 시작 이미지 리스트 */}
            <div className="mb-3">
              <div className="grid grid-cols-5 gap-2">
                {videos.map((video, index) => {
                  return (
                    <div key={video.id} className="relative group">
                      <button
                        onClick={() => setCurrentVideoIndex(index)}
                        className={`relative aspect-square rounded-lg border-4 transition-all w-full ${
                          index === currentVideoIndex
                            ? "border-black"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {video.fromImage ? (
                          <img
                            src={video.fromImage}
                            alt={`Start Image ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : videoThumbnails[video.id] ? (
                          <img
                            src={videoThumbnails[video.id]}
                            alt={`Video Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded">
                            <span className="text-gray-500 text-xs">
                              Scene {index + 1}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-1 left-1 bg-black/20 text-white text-xs px-1 rounded">
                          {index + 1}
                        </div>
                      </button>

                      {/* 순서 변경 버튼들 */}
                      {onVideoOrderChange && (
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (index > 0) {
                                  onVideoOrderChange(index, index - 1);
                                }
                              }}
                              disabled={index === 0}
                              className="bg-primary text-white text-xs p-1 rounded hover:bg-primary disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move Up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (index < videos.length - 1) {
                                  onVideoOrderChange(index, index + 1);
                                }
                              }}
                              disabled={index === videos.length - 1}
                              className="bg-primary text-white text-xs p-1 rounded hover:bg-primary disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move Down"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 자막 설정 및 다운로드 섹션 */}
            {videos.length > 0 && (
              <div className="rounded-lg mt-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Subscript settings
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onShowSubtitlesChange?.(!showSubtitles)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                        showSubtitles ? "bg-primary" : "bg-gray-300"
                      }`}
                      title={
                        showSubtitles ? "Hide subtitles" : "Show subtitles"
                      }
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          showSubtitles ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-sm">Show Subtitles</span>
                  </div>
                </div>
                {/* 자막 설정 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-2">
                      Color:
                    </label>
                    <input
                      type="color"
                      value={subtitleColor}
                      onChange={(e) => onSubtitleColorChange?.(e.target.value)}
                      className="w-20 h-10 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-2">
                      Text Style:
                    </label>
                    <div className="flex gap-4 h-10 mx-auto">
                      <label className="flex items-center">
                        <div className="relative mr-2">
                          <input
                            type="radio"
                            value="box"
                            checked={subtitleStyle === "box"}
                            onChange={() => onSubtitleStyleChange?.("box")}
                            className="sr-only"
                          />
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              subtitleStyle === "box"
                                ? "border-primary bg-primary"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {subtitleStyle === "box" && (
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
                        <span className="text-md text-white font-black bg-black/80 p-1.5">
                          Background
                        </span>
                      </label>
                      <label className="flex items-center">
                        <div className="relative mr-2">
                          <input
                            type="radio"
                            value="outline"
                            checked={subtitleStyle === "outline"}
                            onChange={() => onSubtitleStyleChange?.("outline")}
                            className="sr-only"
                          />
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              subtitleStyle === "outline"
                                ? "border-primary bg-primary"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {subtitleStyle === "outline" && (
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
                        <span
                          className="text-md text-white font-black"
                          style={{
                            textShadow:
                              "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                          }}
                        >
                          Outline
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 병합된 영상 프리뷰 */}
                {mergedVideoUrl && (
                  <div className="my-6 border-t border-secondary pt-8">
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Merged Video Preview
                    </h4>
                    <div className="bg-black rounded-lg overflow-hidden">
                      <video
                        src={mergedVideoUrl}
                        controls
                        className="w-full h-auto"
                        onError={(e) => {
                          console.error("병합된 영상 로드 실패:", e);
                        }}
                      />
                    </div>
                  </div>
                )}
                {/* 다운로드 버튼 */}
                <div className="flex gap-2">
                  <Button
                    variant="primary-full"
                    onClick={onMergeAndDownload}
                    disabled={isMerging}
                  >
                    {isMerging ? "Merging..." : "Merge and Download Video"}
                  </Button>
                  {mergedVideoUrl && (
                    <Button onClick={onDownload}>Download</Button>
                  )}
                </div>

                {/* 병합 진행 상태 */}
                {isMerging && (
                  <div className="mt-4 p-3 bg-primary/10 border border-primary/40 rounded-md">
                    <div className="flex items-center mb-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      <span className="text-sm text-primary-dark">
                        {mergeProgress || "Merging Videos..."}
                      </span>
                    </div>
                    {mergeProgressMessages.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto bg-white p-2 rounded text-xs border">
                        {mergeProgressMessages.map((msg, index) => (
                          <div key={index} className="text-gray-600 mb-1">
                            {msg}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="border-t pt-4">
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎬</div>
              <p className="text-gray-600 text-sm">
                No videos have been generated yet.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Click the "Add Video" button to create your first video.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 오른쪽: 비디오 프리뷰 */}
      <div className="bg-black rounded-r-lg overflow-hidden flex flex-col">
        {videos.length > 0 && currentVideo && currentVideo.output ? (
          <>
            <div className="flex-1 relative">
              {/* 비디오 로딩 상태 */}
              {isVideoLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p className="text-sm">Loading video...</p>
                  </div>
                </div>
              )}

              {/* 비디오 에러 상태 */}
              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <div className="text-center text-white max-w-md mx-4">
                    <div className="text-red-400 text-4xl mb-4">⚠️</div>
                    <h3 className="text-lg font-semibold mb-2">Video Error</h3>
                    <p className="text-sm text-gray-300 mb-4">{videoError}</p>
                    <button
                      onClick={() => {
                        setVideoError(null);
                        if (videoRef.current) {
                          videoRef.current.load();
                        }
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* 유효한 URL일 때만 비디오 요소 렌더링 */}
              {isValidVideoUrl(currentVideo.output) ? (
                <video
                  ref={videoRef}
                  src={currentVideo.output}
                  className="w-full h-full object-contain"
                  onEnded={handleVideoEnd}
                  onPlay={() => {
                    setIsPlaying(true);
                    setVideoError(null);
                  }}
                  onPause={() => setIsPlaying(false)}
                  onLoadStart={() => {
                    console.log("Video load started:", currentVideo.output);
                    setIsVideoLoading(true);
                    setVideoError(null);
                  }}
                  onCanPlay={() => {
                    console.log("Video can play:", currentVideo.output);
                    setIsVideoLoading(false);
                    setVideoError(null);
                  }}
                  onLoadedData={() => {
                    console.log("Video data loaded:", currentVideo.output);
                  }}
                  onStalled={() => {
                    console.log("Video stalled:", currentVideo.output);
                  }}
                  onSuspend={() => {
                    console.log("Video suspended:", currentVideo.output);
                  }}
                  onAbort={() => {
                    console.log("Video load aborted:", currentVideo.output);
                  }}
                  onTimeUpdate={updateCurrentTime}
                  onError={(e) => {
                    const videoElement = e.target as HTMLVideoElement;
                    const error = videoElement.error;

                    // 개발 환경에서만 상세 로그 출력
                    if (process.env.NODE_ENV === "development") {
                      console.log("=== Video Error Debug ===");
                      console.log("Error event triggered");
                      console.log("Video element:", videoElement);
                      console.log("Video src:", videoElement.src);
                      console.log("Video readyState:", videoElement.readyState);
                      console.log(
                        "Video networkState:",
                        videoElement.networkState
                      );
                      console.log("Error object:", error);
                    }

                    let errorMessage = "비디오를 재생할 수 없습니다";
                    let errorType = "unknown";

                    if (error) {
                      switch (error.code) {
                        case MediaError.MEDIA_ERR_ABORTED:
                          errorMessage = "비디오 로딩이 중단되었습니다";
                          errorType = "aborted";
                          break;
                        case MediaError.MEDIA_ERR_NETWORK:
                          errorMessage = "네트워크 오류가 발생했습니다";
                          errorType = "network";
                          break;
                        case MediaError.MEDIA_ERR_DECODE:
                          errorMessage = "비디오 형식을 지원하지 않습니다";
                          errorType = "decode";
                          break;
                        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                          errorMessage = "지원하지 않는 비디오 형식입니다";
                          errorType = "unsupported";
                          break;
                        default:
                          errorMessage = "비디오 재생 중 오류가 발생했습니다";
                          errorType = "unknown";
                      }
                    }

                    // 사용자 친화적인 오류 로그 (개발 환경에서만)
                    if (process.env.NODE_ENV === "development") {
                      console.warn("Video playback error:", {
                        errorType,
                        errorMessage,
                        videoSrc: videoElement.src,
                        readyState: videoElement.readyState,
                        networkState: videoElement.networkState,
                      });
                    }

                    setIsPlaying(false);
                    setIsVideoLoading(false);
                    setVideoError(errorMessage);
                  }}
                />
              ) : (
                /* 유효하지 않은 URL일 때 에러 메시지 표시 */
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <div className="text-center text-white max-w-md mx-4">
                    <div className="text-red-400 text-4xl mb-4">⚠️</div>
                    <h3 className="text-lg font-semibold mb-2">
                      비디오 URL이 유효하지 않습니다
                    </h3>
                    <p className="text-sm text-gray-300 mb-4">
                      비디오 URL에 접근할 수 없거나 형식이 올바르지 않습니다
                    </p>
                  </div>
                </div>
              )}

              {/* 비디오 재생 오류 메시지 */}
              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
                  <div className="text-center text-white max-w-md mx-4 p-6 bg-gray-800 rounded-lg border border-red-500">
                    <div className="text-red-400 text-4xl mb-4">🎬</div>
                    <h3 className="text-lg font-semibold mb-2">
                      비디오 재생 오류
                    </h3>
                    <p className="text-sm text-gray-300 mb-4">{videoError}</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => {
                          setVideoError(null);
                          setIsVideoLoading(true);
                          // 비디오 재로드 시도
                          if (videoRef.current) {
                            videoRef.current.load();
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                      >
                        다시 시도
                      </button>
                      <button
                        onClick={() => setVideoError(null)}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* 자막 표시 */}
              {showSubtitles && currentVideo.narration && (
                <div
                  className="absolute bottom-[5%] left-1/2 text-center"
                  style={{
                    color: subtitleColor,
                    fontSize: "1.2vw",
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
                    maxWidth: "95%",
                    lineHeight: "1.2",
                    transform: "translateX(-50%)",
                    textAlign: "center",
                    pointerEvents: "none",
                    width: "fit-content",
                    margin: "0 auto",
                  }}
                >
                  {currentVideo.narration}
                </div>
              )}
            </div>

            {/* 컨트롤 */}
            <div className="bg-black p-4">
              {/* 컨트롤 버튼 */}
              <div className="flex justify-between text-xs text-gray-400">
                <div className="flex gap-4">
                  {!isPlaying ? (
                    <button
                      onClick={handlePlay}
                      className=" text-white text-2xl p-4 rounded "
                    >
                      ▶
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handlePause}
                        className=" text-white text-2xl p-4 rounded"
                      >
                        ⏸
                      </button>
                    </>
                  )}
                </div>
                <div className="text-xl p-4">
                  <span>{formatTime(currentTime)}</span> /{" "}
                  <span>{formatTime(totalDuration)}</span>
                </div>
              </div>
              {/* 시크바 */}
              <input
                type="range"
                min={0}
                max={totalDuration}
                step={0.005}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer transition-all duration-50"
                style={{
                  background: `linear-gradient(to right, #ffffff 0%, #ffffff ${
                    (currentTime / totalDuration) * 100
                  }%, #4b5563 ${
                    (currentTime / totalDuration) * 100
                  }%, #4b5563 100%)`,
                  // 아래 CSS가 핵심!
                  accentColor: "white", // 일부 브라우저 대응
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-6xl mb-4">🎬</div>
              <p className="text-lg font-semibold mb-2">No Video Available</p>
              <p className="text-sm">Please generate a video</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
