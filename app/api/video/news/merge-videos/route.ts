import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { getNewsVideoById } from "@/lib/firebase/newsVideo";
import { tmpdir } from "os";
import { join } from "path";
import fs from "fs/promises";
import { v4 as uuid } from "uuid";
import fetch from "node-fetch";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

export const runtime = "nodejs";

/* ───────── 폰트 경로 설정 ───────── */
const fontPath = join(process.cwd(), "public", "fonts", "Roboto-Bold.ttf");
const defaultFontPath = "/System/Library/Fonts/Arial.ttf"; // macOS 기본 폰트

/* ───────── ffmpeg 바이너리 경로 설정 ───────── */
ffmpeg.setFfmpegPath(ffmpegPath);
console.log("✅ effective ffmpegPath →", ffmpegPath);

export async function POST(request: NextRequest) {
  try {
    console.log("병합 API 호출됨");

    // 사용자 인증 확인
    const user = await getUserFromToken();
    if (!user) {
      console.log("인증 실패");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("요청 본문:", body);

    const { videoId, subtitleColor, subtitleStyle, showSubtitles } = body;

    console.log("유효성 검사:", {
      videoId,
      subtitleColor,
      subtitleStyle,
      showSubtitles,
    });

    if (!videoId) {
      console.log("videoId 누락");
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    // 비디오 정보 가져오기
    const video = await getNewsVideoById(user.uid, videoId);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // 완료된 씬들만 필터링
    const completedScenes = video.scenes.filter((scene) => scene.videoUrl);
    if (completedScenes.length === 0) {
      return NextResponse.json(
        { error: "No completed scenes found" },
        { status: 400 }
      );
    }

    console.log(
      "병합할 씬들:",
      completedScenes.map((scene) => ({
        scene_number: scene.scene_number,
        videoUrl: scene.videoUrl,
        narration: scene.narration,
        image_prompt: scene.image_prompt,
      }))
    );

    const sendProgress = (msg: string) => msg;
    const progress: string[] = [sendProgress("📥 뉴스 비디오 병합 시작")];

    /* ───────── 개별 씬 다운로드·편집 ───────── */
    const processedVideos = await Promise.all(
      completedScenes.map(async (scene, idx) => {
        progress.push(
          sendProgress(`⏳ 씬 ${idx + 1}/${completedScenes.length} 처리 중...`)
        );

        /* 1) 다운로드 */
        const src = join(tmpdir(), `scene-${uuid()}.mp4`);
        if (!scene.videoUrl) {
          console.warn(`씬 ${idx + 1}의 비디오 URL이 없습니다. 건너뜁니다.`);
          return null; // Skip this scene
        }

        console.log(`씬 ${idx + 1} 다운로드 시도: ${scene.videoUrl}`);
        const res = await fetch(scene.videoUrl);

        if (!res.ok) {
          console.warn(
            `씬 ${idx + 1} 다운로드 실패: ${res.status} ${
              res.statusText
            }. 건너뜁니다.`
          );
          return null; // Skip this scene
        }

        const buffer = await res.buffer();
        console.log(`씬 ${idx + 1} 다운로드 크기: ${buffer.length} bytes`);

        if (buffer.length === 0) {
          console.warn(
            `씬 ${idx + 1}의 비디오 파일이 비어있습니다. 건너뜁니다.`
          );
          return null; // Skip this scene
        }

        await fs.writeFile(src, buffer);
        progress.push(sendProgress(`✅ 씬 ${idx + 1} 다운로드 완료`));

        // Validate the downloaded file
        try {
          const stats = await fs.stat(src);
          console.log(`씬 ${idx + 1} 파일 크기: ${stats.size} bytes`);

          if (stats.size === 0) {
            console.warn(
              `씬 ${idx + 1}의 다운로드된 파일이 비어있습니다. 건너뜁니다.`
            );
            return null; // Skip this scene
          }

          // Check if file is too small to be a valid video (less than 1KB)
          if (stats.size < 1024) {
            console.warn(
              `씬 ${idx + 1} 파일이 너무 작습니다 (${
                stats.size
              } bytes). 이는 오류 응답일 가능성이 높습니다.`
            );

            // Read the content to see what error message is returned
            try {
              const errorContent = await fs.readFile(src, "utf8");
              console.error(`씬 ${idx + 1} 오류 내용:`, errorContent);
            } catch (readError) {
              console.error(`씬 ${idx + 1} 파일 읽기 실패:`, readError);
            }

            console.warn(
              `씬 ${idx + 1}의 비디오 파일이 유효하지 않습니다. 건너뜁니다.`
            );
            return null; // Skip this scene
          }
        } catch (error) {
          console.warn(`씬 ${idx + 1} 파일 검증 실패: ${error}. 건너뜁니다.`);
          return null; // Skip this scene
        }

        /* 2) 편집용 설정 */
        const out = join(tmpdir(), `processed-scene-${uuid()}.mp4`);
        const filters: string[] = [];

        /* 자막 */
        console.log(`씬 ${idx + 1} 자막 처리:`, {
          showSubtitles,
          narration: scene.narration,
          hasNarration: !!scene.narration?.trim(),
          subtitleColor,
          subtitleStyle,
        });

        if (showSubtitles && scene.narration?.trim()) {
          // 텍스트를 두 줄로 나누는 함수
          const splitIntoTwoLines = (text: string) => {
            const words = text.split(" ");
            const totalLength = text.length;
            const midPoint = Math.floor(totalLength / 2);

            let firstLine = "";
            let secondLine = "";
            let currentLength = 0;

            for (const word of words) {
              if (currentLength < midPoint) {
                firstLine += (firstLine ? " " : "") + word;
                currentLength += word.length + 1; // +1 for space
              } else {
                secondLine += (secondLine ? " " : "") + word;
              }
            }

            // 첫 번째 줄이 너무 길면 조정
            if (firstLine.length > 60) {
              const words = firstLine.split(" ");
              const half = Math.floor(words.length / 2);
              firstLine = words.slice(0, half).join(" ");
              secondLine =
                words.slice(half).join(" ") +
                (secondLine ? " " + secondLine : "");
            }

            return secondLine ? `${firstLine}\\N${secondLine}` : firstLine;
          };

          // 텍스트를 두 줄로 나누기 적용
          const wrappedText = splitIntoTwoLines(scene.narration);
          console.log(`씬 ${idx + 1} 원본 텍스트: "${scene.narration}"`);
          console.log(`씬 ${idx + 1} 줄바꿈 텍스트: "${wrappedText}"`);

          // 텍스트 파일 생성 (줄바꿈 문제 해결)
          const textFile = join(tmpdir(), `subtitle-${idx}-${uuid()}.txt`);
          await fs.writeFile(textFile, wrappedText);

          // 폰트 파일 존재 여부 확인
          let actualFontPath = fontPath;
          try {
            await fs.access(fontPath);
          } catch {
            console.log(`폰트 파일이 없습니다: ${fontPath}, 기본 폰트 사용`);
            actualFontPath = defaultFontPath;
          }

          // textfile을 사용한 필터 (줄바꿈 완벽 지원)
          let subtitleFilter = `drawtext=textfile='${textFile}':fontfile='${actualFontPath}':fontcolor=${(
            subtitleColor || "#ffffff"
          ).replace(
            "#",
            ""
          )}:fontsize=36:x=(w-text_w)/2:y=h-120:line_spacing=10`;

          if (subtitleStyle === "box") {
            subtitleFilter += `:box=1:boxcolor=black@0.6:boxborderw=6`;
          } else if (subtitleStyle === "outline") {
            subtitleFilter += `:bordercolor=black:borderw=3`;
          } else {
            // 기본 그림자 효과
            subtitleFilter += `:shadowcolor=black:shadowx=2:shadowy=2`;
          }

          console.log(`자막 필터 생성:`, subtitleFilter);
          filters.push(subtitleFilter);
          progress.push(
            sendProgress(`💬 씬 ${idx + 1} 자막 설정: "${scene.narration}"`)
          );
        } else {
          console.log(
            `씬 ${
              idx + 1
            } 자막 건너뜀: showSubtitles=${showSubtitles}, narration="${
              scene.narration
            }"`
          );
        }

        /* 3) FFmpeg 실행 */
        progress.push(sendProgress(`🔄 씬 ${idx + 1} 처리 시작`));
        console.log(`씬 ${idx + 1} FFmpeg 필터:`, filters);

        await new Promise((res, rej) => {
          const cmd = ffmpeg(src);

          // Combine subtitle filters with scaling filter
          const scalingFilter =
            "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2";

          let allFilters;
          if (filters.length > 0) {
            try {
              allFilters = `${scalingFilter},${filters.join(",")}`;
              console.log(`씬 ${idx + 1} 최종 필터 (자막 포함):`, allFilters);
            } catch (error) {
              console.warn(
                `씬 ${idx + 1} 자막 필터 생성 실패, 자막 없이 처리:`,
                error
              );
              allFilters = scalingFilter;
            }
          } else {
            allFilters = scalingFilter;
          }

          console.log(`씬 ${idx + 1} 최종 필터:`, allFilters);

          cmd
            .outputOptions([
              "-c:v",
              "libx264",
              "-c:a",
              "aac",
              "-preset",
              "ultrafast",
              "-movflags",
              "+faststart",
              "-profile:v",
              "baseline",
              "-level",
              "3.0",
              "-pix_fmt",
              "yuv420p",
              "-vf",
              allFilters,
              "-r",
              "30",
            ])
            .output(out)
            .on("progress", (p) =>
              sendProgress(
                `⏳ 씬 ${idx + 1} 처리 진행률: ${p.percent?.toFixed(1)}% (${
                  p.timemark
                })`
              )
            )
            .on("end", () => {
              sendProgress(`✅ 씬 ${idx + 1} 처리 완료`);
              res(null);
            })
            .on("error", (err) => {
              console.error(`FFmpeg error for scene ${idx + 1}:`, err);
              console.error(`Scene ${idx + 1} details:`, {
                videoUrl: scene.videoUrl,
                narration: scene.narration,
                filters: filters,
                inputFile: src,
                outputFile: out,
              });

              // 자막 필터가 문제인 경우 자막 없이 다시 시도
              if (filters.length > 0 && err.message.includes("filter")) {
                console.warn(`씬 ${idx + 1} 자막 필터 오류, 자막 없이 재시도`);
                sendProgress(`⚠️ 씬 ${idx + 1} 자막 처리 실패, 자막 없이 처리`);

                // 자막 없이 다시 시도
                const cmdRetry = ffmpeg(src);
                cmdRetry
                  .outputOptions([
                    "-c:v",
                    "libx264",
                    "-c:a",
                    "aac",
                    "-preset",
                    "ultrafast",
                    "-movflags",
                    "+faststart",
                    "-profile:v",
                    "baseline",
                    "-level",
                    "3.0",
                    "-pix_fmt",
                    "yuv420p",
                    "-vf",
                    "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
                    "-r",
                    "30",
                  ])
                  .output(out)
                  .on("end", () => {
                    sendProgress(`✅ 씬 ${idx + 1} 처리 완료 (자막 없음)`);
                    res(null);
                  })
                  .on("error", (retryErr) => {
                    console.error(`씬 ${idx + 1} 재시도 실패:`, retryErr);
                    sendProgress(`❌ 씬 ${idx + 1} 오류: ${retryErr.message}`);
                    rej(retryErr);
                  })
                  .run();
              } else {
                sendProgress(`❌ 씬 ${idx + 1} 오류: ${err.message}`);
                rej(err);
              }
            })
            .run();
        });

        return out;
      })
    );

    // Filter out null values (skipped scenes)
    const validProcessedVideos = processedVideos.filter(
      (video) => video !== null
    );

    if (validProcessedVideos.length === 0) {
      throw new Error("처리할 수 있는 유효한 씬이 없습니다.");
    }

    console.log(
      `처리된 씬: ${validProcessedVideos.length}/${completedScenes.length}`
    );
    progress.push(
      sendProgress(`✅ ${validProcessedVideos.length}개 씬 처리 완료`)
    );

    /* ───────── 병합 ───────── */
    progress.push(sendProgress("🔄 씬 병합 시작"));
    const concatList = join(tmpdir(), `list-${uuid()}.txt`);
    await fs.writeFile(
      concatList,
      validProcessedVideos.map((f) => `file '${f}'`).join("\n")
    );

    const merged = join(tmpdir(), `merged-${uuid()}.mp4`);
    await new Promise((res, rej) =>
      ffmpeg()
        .input(concatList)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions([
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          "-preset",
          "ultrafast",
          "-movflags",
          "+faststart",
          "-profile:v",
          "baseline",
          "-level",
          "3.0",
          "-pix_fmt",
          "yuv420p",
          "-vf",
          "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
          "-r",
          "30",
        ])
        .output(merged)
        .on("progress", (p) =>
          sendProgress(
            `⏳ 병합 진행률: ${p.percent?.toFixed(1)}% (${p.timemark})`
          )
        )
        .on("end", () => {
          sendProgress("✅ 씬 병합 완료");
          res(null);
        })
        .on("error", (err) => {
          sendProgress(`❌ 씬 병합 오류: ${err.message}`);
          rej(err);
        })
        .run()
    );

    /* ───────── 결과 반환 ───────── */
    progress.push(sendProgress("📤 최종 결과 반환 시작"));
    const result = await fs.readFile(merged);
    progress.push(sendProgress("✅ 최종 결과 반환 완료"));

    return new NextResponse(
      JSON.stringify({
        video: Buffer.from(result).toString("base64"),
        progress,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error merging videos:", error);
    return NextResponse.json(
      { error: "Failed to merge videos" },
      { status: 500 }
    );
  }
}
