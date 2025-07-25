"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Range } from "react-range";
import { Input } from "@/components/styled";

const MIN = 0;
const MAX = 5;

/* ───────── 타입 및 헬퍼 ───────── */
type VideoItem = {
  url: string;
  subtitle: string;
  trim: [number, number];
  speed: string;
  thumbnail: string;
  isSelected: boolean;
};

const createEmptyVideo = (url = ""): VideoItem => ({
  url,
  subtitle: "",
  trim: [0, 5],
  speed: "1",
  thumbnail: "",
  isSelected: true, // 기본 선택
});

export default function MergeVideosPage() {
  const searchParams = useSearchParams();
  const rawUrls = searchParams.get("urls");

  /* 쿼리 파라미터로 들어온 URL 수 만큼 초기화 */
  const incoming = rawUrls ? rawUrls.split(",").map(decodeURIComponent) : [];

  // 세션 스토리지에서 편집 데이터 확인
  const [videos, setVideos] = useState<VideoItem[]>(() => {
    // 세션 스토리지에서 데이터 확인
    const sessionVideos = sessionStorage.getItem("editVideos");
    if (sessionVideos) {
      try {
        const parsedVideos = JSON.parse(sessionVideos);
        console.log("Session storage videos:", parsedVideos);

        // Ensure all videos have isSelected property
        const videosWithSelection = parsedVideos.map((video: any) => ({
          ...video,
          isSelected: video.isSelected !== undefined ? video.isSelected : true,
        }));

        console.log("Videos with selection:", videosWithSelection);

        // 세션 스토리지 데이터 사용 후 삭제
        sessionStorage.removeItem("editVideos");
        sessionStorage.removeItem("editSource");
        return videosWithSelection;
      } catch (error) {
        console.error("Failed to parse session videos:", error);
      }
    }

    // 기존 URL 파라미터 방식 (하위 호환성)
    return incoming.length
      ? incoming.map((u) => createEmptyVideo(u))
      : [createEmptyVideo()]; // 최소 1칸
  });

  const [previewUrls, setPreviewUrls] = useState<string[]>(
    Array(videos.length).fill("")
  );
  const [globalColor, setGlobalColor] = useState("#ffffff");
  const [subtitleStyle, setSubtitleStyle] = useState<"box" | "outline">("box");
  const [isLoading, setIsLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState("");
  const [mergedBlobUrl, setMergedBlobUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [preloadedVideos, setPreloadedVideos] = useState<Set<number>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  /* ───────── slots 추가될 때 previewUrls 길이 맞추기 ───────── */
  useEffect(() => {
    if (previewUrls.length < videos.length) {
      setPreviewUrls((prev) => [
        ...prev,
        ...Array(videos.length - prev.length).fill(""),
      ]);
    }
  }, [videos.length, previewUrls.length]);

  /* ───────── 썸네일 생성 ───────── */
  useEffect(() => {
    videos.forEach((v, i) => {
      if (v.url && !v.thumbnail) generateThumbnail(v.url, i);
    });
  }, [videos]);

  // 비디오 요소 초기화
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, videos.length);
  }, [videos.length]);

  // 실시간 미리보기 업데이트
  useEffect(() => {
    videos.forEach((video, index) => {
      const videoElement = videoRefs.current[index];
      if (videoElement && video.url) {
        videoElement.currentTime = video.trim[0];
        videoElement.playbackRate = parseFloat(video.speed);
      }
    });
  }, [videos]);

  const updateField = (idx: number, field: keyof VideoItem, value: any) => {
    setVideos((prev) => {
      const copy = [...prev];
      (copy[idx] as any)[field] = value;
      return copy;
    });

    if (
      field === "url" &&
      typeof value === "string" &&
      value.startsWith("http")
    )
      generateThumbnail(value, idx);
  };

  const generateThumbnail = (url: string, idx: number) => {
    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = 0.5;
    });

    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 135;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setVideos((prev) => {
          const copy = [...prev];
          copy[idx].thumbnail = dataUrl;
          return copy;
        });
      }
    });
  };

  const updateProgress = (msg: string) => setCurrentProgress(msg);

  /* ───────── 병합 ───────── */
  const handleMerge = async () => {
    try {
      setError(null);
      setIsLoading(true);
      updateProgress("🔄 비디오 병합 시작");

      console.log("All videos before filtering:", videos);

      const formatted = videos
        .filter((v) => v.isSelected && v.url.startsWith("http"))
        .map((v) => ({
          url: v.url,
          subtitle: v.subtitle,
          color: globalColor,
          speed: parseFloat(v.speed),
          trim: { start: v.trim[0], end: v.trim[1] },
          subtitleStyle,
          isSelected: true, // Explicitly include isSelected
        }));

      console.log("Filtered videos:", formatted);

      if (formatted.length === 0) {
        setError("병합할 영상이 선택되지 않았습니다.");
        return;
      }

      // URL 유효성 검사
      const invalidUrls = formatted.filter(
        (v) => !v.url || !v.url.startsWith("http")
      );
      if (invalidUrls.length > 0) {
        setError("유효하지 않은 영상 URL이 있습니다.");
        return;
      }

      // 구간 유효성 검사
      const invalidTrims = formatted.filter((v) => v.trim.start >= v.trim.end);
      if (invalidTrims.length > 0) {
        setError(
          "영상 구간이 올바르지 않습니다. 시작 시간이 종료 시간보다 작아야 합니다."
        );
        return;
      }

      console.log("Sending merge request with data:", { videos: formatted });

      const res = await fetch("/api/video/merge-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: formatted }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("API Error Response:", errorData);
        throw new Error(
          errorData.error || errorData.message || "병합 중 오류가 발생했습니다."
        );
      }

      const { video: base64, progress } = await res.json();
      for (const msg of progress) {
        updateProgress(msg);
        await new Promise((r) => setTimeout(r, 100));
      }

      const blob = new Blob(
        [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
        { type: "video/mp4" }
      );
      const url = URL.createObjectURL(blob);
      setMergedBlobUrl(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "병합 중 오류가 발생했습니다."
      );
      console.error("Merge error:", err);
    } finally {
      setIsLoading(false);
      setCurrentProgress("");
    }
  };

  /* ───────── 슬롯 추가 ───────── */
  const addVideoSlot = () => {
    setVideos((prev) => [...prev, createEmptyVideo()]);
    setPreviewUrls((prev) => [...prev, ""]);
  };

  // 다음 비디오 미리 로드
  const preloadNextVideo = (currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < videos.length && !preloadedVideos.has(nextIndex)) {
      const video = document.createElement("video");
      video.src = videos[nextIndex].url;
      video.preload = "auto";
      video.muted = true;
      video.onloadeddata = () => {
        setPreloadedVideos((prev) => new Set([...prev, nextIndex]));
      };
    }
  };

  // 비디오 순차 재생 처리
  const handleVideoEnd = (index: number) => {
    if (index < videos.length - 1) {
      // 현재 비디오 정리
      const currentVideo = videoRefs.current[index];
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.currentTime = videos[index].trim[0];
      }

      // 다음 비디오로 전환
      setCurrentVideoIndex(index + 1);
      const nextVideo = videoRefs.current[index + 1];
      if (nextVideo) {
        nextVideo.currentTime = videos[index + 1].trim[0];
        nextVideo.play();
      }

      // 다다음 비디오 미리 로드
      preloadNextVideo(index + 1);
    } else {
      setIsPlaying(false);
      setCurrentVideoIndex(0);
      // 모든 비디오를 초기 상태로 리셋
      videoRefs.current.forEach((video, idx) => {
        if (video) {
          video.pause();
          video.currentTime = videos[idx].trim[0];
        }
      });
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    const currentVideo = videoRefs.current[currentVideoIndex];
    if (currentVideo) {
      currentVideo.currentTime = videos[currentVideoIndex].trim[0];
      currentVideo.playbackRate = parseFloat(videos[currentVideoIndex].speed);
      currentVideo.play();
      // 다음 비디오 미리 로드
      preloadNextVideo(currentVideoIndex);
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    const currentVideo = videoRefs.current[currentVideoIndex];
    if (currentVideo) {
      currentVideo.pause();
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentVideoIndex(0);
    videoRefs.current.forEach((video, index) => {
      if (video) {
        video.pause();
        video.currentTime = videos[index].trim[0];
      }
    });
  };

  // 비디오 URL이 변경될 때 미리 로드된 비디오 초기화
  useEffect(() => {
    setPreloadedVideos(new Set());
  }, [videos.map((v) => v.url).join(",")]);

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">
        영상 자르기 / 자막 / 밝기 / 그림자 / 샤프닝 편집기
      </h1>
      {/* 병합 */}
      <div className="space-y-2">
        <button
          onClick={handleMerge}
          disabled={isLoading}
          className="bg-black text-white px-4 py-2 rounded-xl mt-4 disabled:opacity-50 hover:bg-gray-800 transition-colors"
        >
          {isLoading ? "병합 중..." : "병합하기"}
        </button>
        {error && <div className="text-red-500 text-sm">❌ {error}</div>}
        {isLoading && (
          <p className="text-sm text-gray-600">{currentProgress}</p>
        )}
      </div>
      {mergedBlobUrl && (
        <div className="mt-6 space-y-2">
          <video src={mergedBlobUrl} controls className="w-full" />
          <a
            href={mergedBlobUrl}
            download="merged.mp4"
            className="-black underline"
          >
            다운로드
          </a>
        </div>
      )}
      {/* 글로벌 옵션 */}
      <div className="flex gap-4 items-center">
        <label>자막 색상:</label>
        <input
          type="color"
          value={globalColor}
          onChange={(e) => setGlobalColor(e.target.value)}
        />
      </div>

      <div className="flex gap-4 items-center">
        <label>자막 스타일:</label>
        <label>
          <input
            type="radio"
            value="box"
            checked={subtitleStyle === "box"}
            onChange={() => setSubtitleStyle("box")}
          />{" "}
          배경
        </label>
        <label>
          <input
            type="radio"
            value="outline"
            checked={subtitleStyle === "outline"}
            onChange={() => setSubtitleStyle("outline")}
          />{" "}
          테두리
        </label>
      </div>

      {/* 통합 비디오 플레이어 */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-6">
        {videos.map((v, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-300 ${
              currentVideoIndex === i
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
            }`}
          >
            <video
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              src={v.url || undefined}
              className="w-full h-full object-contain"
              preload="auto"
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                if (video.currentTime >= v.trim[1]) {
                  if (isPlaying) {
                    handleVideoEnd(i);
                  } else {
                    video.currentTime = v.trim[0];
                  }
                }
              }}
              onEnded={() => {
                if (isPlaying) {
                  handleVideoEnd(i);
                }
              }}
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                video.playbackRate = parseFloat(v.speed);
              }}
            />
            {v.subtitle && (
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
                    subtitleStyle === "box" ? "rgba(0,0,0,0.5)" : "transparent",
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
                {v.subtitle}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 mt-4">
        {/* ▶ 재생 : 정지 상태일 때만 */}
        {!isPlaying && (
          <button
            onClick={handlePlay}
            className="bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary transition-colors"
          >
            ▶ 재생
          </button>
        )}

        {/* ⏸ 일시정지 + ⏹ 중지 : 재생 중일 때만 */}
        {isPlaying && (
          <>
            <button
              onClick={handlePause}
              className="bg-yellow-500 text-white px-4 py-2 rounded-xl hover:bg-yellow-600 transition-colors"
            >
              ⏸
            </button>
            <button
              onClick={handleStop}
              className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-colors"
            >
              ⏹
            </button>
          </>
        )}

        {/* 진행 인덱스 표시 */}
        <span className="text-sm text-gray-700">
          {currentVideoIndex + 1} / {videos.length} 영상
        </span>
      </div>

      {/* 비디오 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {videos.map((v, i) => (
          <div key={i} className="rounded-xl space-y-2">
            {/* ✅ 병합 여부 선택 */}
            <div className="relative h-20 px-2">
              <Range
                step={0.1}
                min={MIN}
                max={MAX}
                values={v.trim}
                onChange={(values) => updateField(i, "trim", values as any)}
                renderTrack={({ props, children }) => (
                  <div
                    {...props}
                    className="h-20 rounded-xl relative"
                    style={{
                      ...props.style,
                      /* ✅ 썸네일이 있으면 반복 배경, 없으면 회색 */
                      backgroundImage: v.thumbnail
                        ? `url(${v.thumbnail})`
                        : undefined,
                      backgroundRepeat: v.thumbnail ? "repeat-x" : undefined,
                      backgroundSize: v.thumbnail ? "auto 100%" : undefined, // 높이 기준
                      backgroundColor: v.thumbnail ? "transparent" : "#d1d5db",
                    }}
                  >
                    {v.url && (
                      <video
                        src={v.url || undefined}
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                        muted
                        playsInline
                        onTimeUpdate={(e) => {
                          const video = e.currentTarget;
                          const progress =
                            (video.currentTime / video.duration) * 100;
                          video.style.transform = `translateX(-${
                            100 - progress
                          }%)`;
                        }}
                        onLoadedMetadata={(e) => {
                          const video = e.currentTarget;
                          video.currentTime = v.trim[0];
                          video.playbackRate = 4; // 빠른 재생으로 프리뷰
                          video.play();
                        }}
                      />
                    )}
                    {children}
                  </div>
                )}
                renderThumb={({ props, index }) => {
                  const { key: _, ...rest } = props;
                  return (
                    <div
                      key={index}
                      {...rest}
                      className="w-6 h-20 bg-black text-white flex items-center justify-center rounded-xl shadow-md text-xs"
                    >
                      {index === 0 ? "▶" : "◀"}
                    </div>
                  );
                }}
              />
            </div>
            <div className="w-full flex justify-between text-xs text-gray-600">
              <span>시작: {v.trim[0]}s</span>
              <span>종료: {v.trim[1]}s</span>
            </div>
            {/* 트리밍 Range */}
            <input
              type="text"
              value={v.subtitle}
              onChange={(e) => updateField(i, "subtitle", e.target.value)}
              placeholder="자막 입력"
              className="w-full border-1 p-2"
            />
            <input
              type="number"
              min="0.5"
              max="2"
              step="0.1"
              value={v.speed}
              onChange={(e) => updateField(i, "speed", e.target.value)}
              placeholder="재생 속도"
              className="w-full border-1 p-2"
            />
            <input
              type="url"
              value={v.url}
              onChange={(e) => updateField(i, "url", e.target.value)}
              placeholder="영상 URL"
              className="w-full border-1 p-2"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={v.isSelected}
                onChange={(e) => updateField(i, "isSelected", e.target.checked)}
              />
              병합에 포함
            </label>
          </div>
        ))}
      </div>
      {/* 슬롯 추가 버튼 */}
      <button
        onClick={addVideoSlot}
        className="bg-gray-200 px-4 py-2 rounded-xl shadow-md"
      >
        ➕ 영상 슬롯 추가
      </button>
    </main>
  );
}
