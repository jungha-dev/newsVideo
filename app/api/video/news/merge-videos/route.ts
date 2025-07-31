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

    // 완료된 Scene들만 필터링
    const completedScenes = video.scenes.filter((scene) => scene.videoUrl);
    if (completedScenes.length === 0) {
      return NextResponse.json(
        { error: "No completed scenes found" },
        { status: 400 }
      );
    }

    console.log(
      "병합할 Scene들:",
      completedScenes.map((scene) => ({
        scene_number: scene.scene_number,
        videoUrl: scene.videoUrl,
        narration: scene.narration,
        image_prompt: scene.image_prompt,
      }))
    );

    const sendProgress = (msg: string) => msg;
    const progress: string[] = [sendProgress("📥 Generated Video merge start")];

    /* ───────── 개별 Scene 다운로드·편집 ───────── */
    const processedVideos = await Promise.all(
      completedScenes.map(async (scene, idx) => {
        progress.push(
          sendProgress(
            `⏳ Scene ${idx + 1}/${completedScenes.length} processing...`
          )
        );

        /* 1) 다운로드 */
        const src = join(tmpdir(), `scene-${uuid()}.mp4`);
        if (!scene.videoUrl) {
          console.warn(`Scene ${idx + 1} video URL is missing. Skipping.`);
          return null; // Skip this scene
        }

        console.log(`Scene ${idx + 1} download attempt: ${scene.videoUrl}`);
        const res = await fetch(scene.videoUrl);

        if (!res.ok) {
          console.warn(
            `Scene ${idx + 1} download failed: ${res.status} ${
              res.statusText
            }. Skipping.`
          );
          return null; // Skip this scene
        }

        const buffer = await res.buffer();
        console.log(`Scene ${idx + 1} download size: ${buffer.length} bytes`);

        if (buffer.length === 0) {
          console.warn(`Scene ${idx + 1} video file is empty. Skipping.`);
          return null; // Skip this scene
        }

        await fs.writeFile(src, buffer);
        progress.push(sendProgress(`✅ Scene ${idx + 1} download complete`));

        // Validate the downloaded file
        try {
          const stats = await fs.stat(src);
          console.log(`Scene ${idx + 1} file size: ${stats.size} bytes`);

          if (stats.size === 0) {
            console.warn(
              `Scene ${idx + 1} downloaded file is empty. Skipping.`
            );
            return null; // Skip this scene
          }

          // Check if file is too small to be a valid video (less than 1KB)
          if (stats.size < 1024) {
            console.warn(
              `Scene ${idx + 1} 파일이 너무 작습니다 (${
                stats.size
              } bytes). 이는 오류 응답일 가능성이 높습니다.`
            );

            // Read the content to see what error message is returned
            try {
              const errorContent = await fs.readFile(src, "utf8");
              console.error(`Scene ${idx + 1} error content:`, errorContent);
            } catch (readError) {
              console.error(`Scene ${idx + 1} file read failed:`, readError);
            }

            console.warn(`Scene ${idx + 1} video file is invalid. Skipping.`);
            return null; // Skip this scene
          }
        } catch (error) {
          console.warn(
            `Scene ${idx + 1} file validation failed: ${error}. Skipping.`
          );
          return null; // Skip this scene
        }

        /* 2) Editing settings */
        const out = join(tmpdir(), `processed-scene-${uuid()}.mp4`);
        const filters: string[] = [];

        /* Subtitles */
        console.log(`Scene ${idx + 1} subtitles processing:`, {
          showSubtitles,
          narration: scene.narration,
          hasNarration: !!scene.narration?.trim(),
          subtitleColor,
          subtitleStyle,
        });

        if (showSubtitles && scene.narration?.trim()) {
          // Function to split text into two lines
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

            // If the first line is too long, adjust it
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

          // Apply text splitting into two lines
          const wrappedText = splitIntoTwoLines(scene.narration);
          console.log(`Scene ${idx + 1} original text: "${scene.narration}"`);
          console.log(`Scene ${idx + 1} wrapped text: "${wrappedText}"`);

          // Create text file (to fix line break issue)
          const textFile = join(tmpdir(), `subtitle-${idx}-${uuid()}.txt`);
          await fs.writeFile(textFile, wrappedText);

          // Check if font file exists
          let actualFontPath = fontPath;
          try {
            await fs.access(fontPath);
          } catch {
            console.log(`Font file not found: ${fontPath}, using default font`);
            actualFontPath = defaultFontPath;
          }

          // Filter using textfile (to support line breaks perfectly)
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

          console.log(`Subtitle filter created:`, subtitleFilter);
          filters.push(subtitleFilter);
          progress.push(
            sendProgress(
              `💬 Scene ${idx + 1} subtitles set: "${scene.narration}"`
            )
          );
        } else {
          console.log(
            `Scene ${
              idx + 1
            } Subtitles skipped: showSubtitles=${showSubtitles}, narration="${
              scene.narration
            }"`
          );
        }

        /* 3) FFmpeg 실행 */
        progress.push(sendProgress(`🔄 Scene ${idx + 1} processing start`));
        console.log(`Scene ${idx + 1} FFmpeg filter:`, filters);

        await new Promise((res, rej) => {
          const cmd = ffmpeg(src);

          // Combine subtitle filters with scaling filter
          const scalingFilter =
            "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2";

          let allFilters;
          if (filters.length > 0) {
            try {
              allFilters = `${scalingFilter},${filters.join(",")}`;
              console.log(
                `Scene ${idx + 1} final filter (with subtitles):`,
                allFilters
              );
            } catch (error) {
              console.warn(
                `Scene ${
                  idx + 1
                } subtitle filter creation failed, processing without subtitles:`,
                error
              );
              allFilters = scalingFilter;
            }
          } else {
            allFilters = scalingFilter;
          }

          console.log(`Scene ${idx + 1} final filter:`, allFilters);

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
                `⏳ Scene ${idx + 1} processing progress: ${p.percent?.toFixed(
                  1
                )}% (${p.timemark})`
              )
            )
            .on("end", () => {
              sendProgress(`✅ Scene ${idx + 1} processing complete`);
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

              // If the subtitle filter is the problem, try processing without subtitles
              if (filters.length > 0 && err.message.includes("filter")) {
                console.warn(
                  `Scene ${
                    idx + 1
                  } subtitle filter error, processing without subtitles`
                );
                sendProgress(
                  `⚠️ Scene ${
                    idx + 1
                  } subtitle processing failed, processing without subtitles`
                );

                // Try processing without subtitles
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
                    sendProgress(
                      `✅ Scene ${idx + 1} processing complete (no subtitles)`
                    );
                    res(null);
                  })
                  .on("error", (retryErr) => {
                    console.error(`Scene ${idx + 1} retry failed:`, retryErr);
                    sendProgress(
                      `❌ Scene ${idx + 1} error: ${retryErr.message}`
                    );
                    rej(retryErr);
                  })
                  .run();
              } else {
                sendProgress(`❌ Scene ${idx + 1} error: ${err.message}`);
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
      throw new Error("No valid scenes to process.");
    }

    console.log(
      `Processed scenes: ${validProcessedVideos.length}/${completedScenes.length}`
    );
    progress.push(
      sendProgress(`✅ ${validProcessedVideos.length} scenes processed`)
    );

    /* ───────── Merge videos ───────── */
    progress.push(sendProgress("🔄 Scene merge start"));
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
            `⏳ Merge progress: ${p.percent?.toFixed(1)}% (${p.timemark})`
          )
        )
        .on("end", () => {
          sendProgress("✅ Scene merge complete");
          res(null);
        })
        .on("error", (err) => {
          sendProgress(`❌ Scene merge error: ${err.message}`);
          rej(err);
        })
        .run()
    );

    /* ───────── Return result ───────── */
    console.log("Final result return start");
    progress.push(sendProgress("📤 Final result return start"));
    const result = await fs.readFile(merged);
    progress.push(sendProgress("✅ Final result return complete"));

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
      {
        error:
          "Failed to merge videos. Please try again. If the problem persists, please contact the administrator.      ",
      },
      { status: 500 }
    );
  }
}
