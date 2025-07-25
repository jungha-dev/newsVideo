import React, { useState, useRef, useEffect, useCallback } from "react";

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
}: VideoPreviewProps) {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [videoThumbnails, setVideoThumbnails] = useState<{
    [key: string]: string;
  }>({});
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentVideo = videos[currentVideoIndex];

  // 각 영상의 길이를 5초로 가정 (실제로는 API에서 가져와야 함)
  const VIDEO_DURATION = 5;

  // 비디오 썸네일 생성
  const generateVideoThumbnail = useCallback(
    (videoUrl: string, videoId: string) => {
      // 이미 썸네일이 있으면 생성하지 않음
      if (videoThumbnails[videoId]) {
        return;
      }

      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      video.currentTime = 0.1; // 0.1초 지점에서 썸네일 생성

      video.addEventListener("loadeddata", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.8);
          setVideoThumbnails((prev) => ({
            ...prev,
            [videoId]: thumbnailUrl,
          }));
        }
      });

      video.addEventListener("error", () => {
        console.error("Failed to load video for thumbnail:", videoUrl);
      });

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
      {/* 왼쪽: 프로젝트 정보 */}
      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-2xl font-bold text-gray-900">
              {projectInfo.name}
            </h2>
            {onEditProject && (
              <button
                onClick={onEditProject}
                className="text-gray-400 hover:text-gray-600 text-xl p-1"
                title="프로젝트 수정"
              >
                ⋯
              </button>
            )}
          </div>
          {info && (
            <div className="flex items-center gap-4 mb-2 text-sm text-gray-600">
              {info.model && (
                <span>
                  모델: <span className="font-medium">{info.model}</span>
                </span>
              )}
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  info.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : info.status === "processing"
                    ? "bg-yellow-100 text-yellow-800"
                    : info.status === "failed"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {info.status === "completed"
                  ? "완료"
                  : info.status === "processing"
                  ? "처리중"
                  : info.status === "failed"
                  ? "실패"
                  : "대기"}
              </span>
            </div>
          )}
          <p className="text-gray-600">
            생성일:{" "}
            {info
              ? new Date(info.createdAt).toLocaleDateString()
              : new Date(projectInfo.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* 현재 영상 정보 */}
        {videos.length > 0 ? (
          <div className="border-t border-secondary pt-4">
            <h3 className="font-medium text-gray-900 mb-2">
              영상 {currentVideoIndex + 1} / {videos.length}
            </h3>

            {/* 시작 이미지 리스트 */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">
                시작 이미지 선택 (순서 변경 가능):
              </p>
              <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto">
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
                            alt={`시작 이미지 ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : videoThumbnails[video.id] ? (
                          <img
                            src={videoThumbnails[video.id]}
                            alt={`비디오 썸네일 ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded">
                            <span className="text-gray-500 text-xs">
                              씬 {index + 1}
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
                              className="bg-blue-500 text-white text-xs p-1 rounded hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="위로 이동"
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
                              className="bg-blue-500 text-white text-xs p-1 rounded hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="아래로 이동"
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

            <div className="flex gap-2">
              <button
                onClick={prevVideo}
                disabled={currentVideoIndex === 0}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={nextVideo}
                disabled={currentVideoIndex === videos.length - 1}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
              >
                다음
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t pt-4">
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎬</div>
              <p className="text-gray-600 text-sm">
                아직 생성된 영상이 없습니다.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                영상 추가 버튼을 클릭하여 첫 번째 영상을 생성하세요.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 오른쪽: 비디오 프리뷰 */}
      <div className="bg-black rounded-lg overflow-hidden flex flex-col">
        {videos.length > 0 && currentVideo && currentVideo.output ? (
          <>
            <div className="flex-1 relative">
              <video
                ref={videoRef}
                src={currentVideo.output}
                className="w-full h-full object-contain"
                onEnded={handleVideoEnd}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={updateCurrentTime}
                onError={(e) => {
                  console.error("Video playback error:", e);
                  setIsPlaying(false);
                }}
              />
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
              <p>영상을 생성해주세요</p>
            </div>
          </div>
        )}

        {/* 자막 설정 및 다운로드 섹션 */}
        {videos.length > 0 && (
          <div className="rounded-lg mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              자막 설정 및 다운로드
            </h3>

            {/* 자막 설정 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  자막 색상:
                </label>
                <input
                  type="color"
                  value={subtitleColor}
                  onChange={(e) => onSubtitleColorChange?.(e.target.value)}
                  className="w-full h-10 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  자막 스타일:
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="box"
                      checked={subtitleStyle === "box"}
                      onChange={() => onSubtitleStyleChange?.("box")}
                      className="mr-2"
                    />
                    <span className="text-sm">배경</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="outline"
                      checked={subtitleStyle === "outline"}
                      onChange={() => onSubtitleStyleChange?.("outline")}
                      className="mr-2"
                    />
                    <span className="text-sm">테두리</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  자막 표시:
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showSubtitles}
                    onChange={(e) => onShowSubtitlesChange?.(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">자막 표시</span>
                </label>
              </div>
            </div>

            {/* 다운로드 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={onMergeAndDownload}
                disabled={isMerging}
                className="flex-1 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isMerging ? "병합 중..." : "영상 병합 및 다운로드"}
              </button>
              {mergedVideoUrl && (
                <button
                  onClick={onDownload}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  📥 다운로드
                </button>
              )}
            </div>

            {/* 병합 진행 상태 */}
            {isMerging && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-sm text-blue-700">
                    {mergeProgress || "영상을 병합하고 있습니다..."}
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

            {/* 병합된 영상 프리뷰 */}
            {mergedVideoUrl && (
              <div className="mt-4">
                <h4 className="text-md font-medium text-gray-900 mb-2">
                  병합된 영상 프리뷰
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
          </div>
        )}
      </div>
    </div>
  );
}
