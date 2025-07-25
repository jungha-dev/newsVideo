// lib/videoPreview.ts
export async function requestVideoEdit(videos: any[]) {
  const res = await fetch("/api/video/merge-videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videos }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "영상 처리 실패");
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob); // 브라우저에서 미리보기 URL로 사용  가능
}
