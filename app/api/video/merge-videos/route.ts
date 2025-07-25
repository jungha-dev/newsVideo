import { NextRequest, NextResponse } from "next/server";
import { tmpdir } from "os";
import { join } from "path";
import fs from "fs/promises";
import { v4 as uuid } from "uuid";
import fetch from "node-fetch";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

export const runtime = "nodejs";

/* ───────── 굵은 Roboto 폰트 절대경로 ───────── */
const fontPath = join(process.cwd(), "public", "fonts", "Roboto-Bold.ttf");

/* ───────── ffmpeg 바이너리 경로 설정 ───────── */
ffmpeg.setFfmpegPath(ffmpegPath);
console.log("✅ effective ffmpegPath →", ffmpegPath);

export async function POST(req: NextRequest) {
  try {
    const { videos, globalColor, subtitleStyle } = await req.json();

    if (!Array.isArray(videos)) {
      return NextResponse.json(
        { error: "videos 배열이 필요합니다." },
        { status: 400 }
      );
    }

    console.log("Received videos:", videos);

    /* 선택된 영상만 필터링 */
    const validVideos = videos.filter(
      (v) => v.url?.startsWith("http") && v.isSelected === true
    );

    console.log("Valid videos:", validVideos);

    if (validVideos.length === 0) {
      return NextResponse.json(
        { error: "처리할 비디오가 없습니다." },
        { status: 400 }
      );
    }

    const sendProgress = (msg: string) => msg;
    const progress: string[] = [
      sendProgress("📥 비디오 다운로드 및 처리 시작"),
    ];

    /* ───────── 개별 비디오 다운로드·편집 ───────── */
    const processedVideos = await Promise.all(
      validVideos.map(async (video, idx) => {
        progress.push(
          sendProgress(`⏳ 비디오 ${idx + 1}/${validVideos.length} 처리 중...`)
        );

        /* 1) 다운로드 */
        const src = join(tmpdir(), `video-${uuid()}.mp4`);
        console.log(`다운로드 시도: ${video.url}`);
        const res = await fetch(video.url);

        if (!res.ok) {
          throw new Error(
            `비디오 다운로드 실패: ${res.status} ${res.statusText}`
          );
        }

        await fs.writeFile(src, await res.buffer());
        progress.push(sendProgress(`✅ 비디오 ${idx + 1} 다운로드 완료`));

        /* 2) 편집용 설정 */
        const out = join(tmpdir(), `processed-${uuid()}.mp4`);
        const filters: string[] = [];

        /* 트리밍 */
        let startTime = 0;
        let duration: number | undefined;
        if (video.trim) {
          // Handle both array format [start, end] and object format {start, end}
          let trimStart = 0;
          let trimEnd = 0;

          if (Array.isArray(video.trim) && video.trim.length === 2) {
            // Array format: [start, end]
            trimStart = video.trim[0];
            trimEnd = video.trim[1];
          } else if (
            typeof video.trim === "object" &&
            video.trim.start !== undefined &&
            video.trim.end !== undefined
          ) {
            // Object format: {start, end}
            trimStart = video.trim.start;
            trimEnd = video.trim.end;
          }

          if (trimStart < trimEnd) {
            startTime = trimStart;
            duration = trimEnd - trimStart;
            progress.push(sendProgress(`✂️ 비디오 ${idx + 1} 트리밍 설정`));
          }
        }

        /* 속도 */
        const speedVal = parseFloat(video.speed ?? "1");
        if (!isNaN(speedVal) && speedVal !== 1) {
          filters.push(`setpts=${(1 / speedVal).toFixed(3)}*PTS`);
          progress.push(sendProgress(`⚡ 비디오 ${idx + 1} 속도 조절 설정`));
        }

        /* 자막 */
        if (video.subtitle?.trim()) {
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
          const wrappedText = splitIntoTwoLines(video.subtitle);

          // 텍스트 파일 생성 (줄바꿈 문제 해결)
          const textFile = join(tmpdir(), `subtitle-${idx}-${uuid()}.txt`);
          await fs.writeFile(textFile, wrappedText);

          let subtitleFilter =
            `drawtext=textfile='${textFile}':` +
            `fontfile='${fontPath}':` +
            `fontcolor=${(globalColor || video.color || "#ffffff").replace(
              "#",
              ""
            )}:` +
            `fontsize=36:x=(w-text_w)/2:y=h-100:line_spacing=10`;

          if ((subtitleStyle || video.subtitleStyle) === "box") {
            subtitleFilter += `:box=1:boxcolor=black@0.6:boxborderw=6`;
          } else if ((subtitleStyle || video.subtitleStyle) === "outline") {
            subtitleFilter += `:bordercolor=black:borderw=3`;
          }

          filters.push(subtitleFilter);
          progress.push(sendProgress(`💬 비디오 ${idx + 1} 자막 설정`));
        }

        /* 3) FFmpeg 실행 */
        progress.push(sendProgress(`🔄 비디오 ${idx + 1} 처리 시작`));
        await new Promise((res, rej) => {
          const cmd = ffmpeg(src).setStartTime(startTime);

          if (duration !== undefined) cmd.setDuration(duration);
          if (filters.length) cmd.videoFilters(filters);

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
              "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
              "-r",
              "30",
            ])
            .output(out)
            .on("progress", (p) =>
              sendProgress(
                `⏳ 비디오 ${idx + 1} 처리 진행률: ${p.percent?.toFixed(1)}% (${
                  p.timemark
                })`
              )
            )
            .on("end", () => {
              sendProgress(`✅ 비디오 ${idx + 1} 처리 완료`);
              res(null);
            })
            .on("error", (err) => {
              console.error(`FFmpeg error for video ${idx + 1}:`, err);
              sendProgress(`❌ 비디오 ${idx + 1} 오류: ${err.message}`);
              rej(err);
            })
            .run();
        });

        return out;
      })
    );

    progress.push(sendProgress("✅ 모든 비디오 처리 완료"));

    /* ───────── 병합 ───────── */
    progress.push(sendProgress("🔄 비디오 병합 시작"));
    const concatList = join(tmpdir(), `list-${uuid()}.txt`);
    await fs.writeFile(
      concatList,
      processedVideos.map((f) => `file '${f}'`).join("\n")
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
          sendProgress("✅ 비디오 병합 완료");
          res(null);
        })
        .on("error", (err) => {
          console.error("FFmpeg merge error:", err);
          sendProgress(`❌ 비디오 병합 오류: ${err.message}`);
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
  } catch (err) {
    console.error("❌ 처리 중 오류:", err);
    console.error("❌ 오류 상세:", {
      message: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : "Unknown error type",
    });
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "알 수 없는 오류",
        details: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
