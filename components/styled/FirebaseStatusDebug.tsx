import React from "react";

interface Scene {
  scene_number: number;
  image_prompt: string;
  narration: string;
  imageUrl?: string;
  videoUrl?: string;
  firebaseUrl?: string;
  output?: string;
}

interface FirebaseStatusDebugProps {
  scene: Scene;
  sceneIndex: number;
}

export default function FirebaseStatusDebug({
  scene,
  sceneIndex,
}: FirebaseStatusDebugProps) {
  const getStatusInfo = () => {
    if (scene.firebaseUrl) {
      return {
        status: "✅ Firebase 업로드 완료",
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
      };
    } else if (scene.output || scene.videoUrl) {
      return {
        status: "⚠️ Replicate URL만 있음 (Firebase 업로드 필요)",
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
      };
    } else {
      return {
        status: "❌ 데이터 없음",
        color: "text-gray-500",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div
      className={`mt-2 p-2 ${statusInfo.bgColor} rounded border ${statusInfo.borderColor}`}
    >
      <div className="text-xs font-medium text-gray-800 mb-1">
        Scene {sceneIndex + 1} debuging info
      </div>
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">firebaseUrl:</span>
          <span
            className={`${
              scene.firebaseUrl ? "text-green-600" : "text-gray-400"
            }`}
          >
            {scene.firebaseUrl ? "링크있음" : "없음"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600">output:</span>
          <span
            className={`${scene.output ? "text-orange-600" : "text-gray-400"}`}
          >
            {scene.output ? "링크있음" : "없음"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600">videoUrl:</span>
          <span
            className={`${scene.videoUrl ? "text-blue-600" : "text-gray-400"}`}
          >
            {scene.videoUrl ? "링크있음" : "없음"}
          </span>
        </div>
      </div>
      <div className="mt-2 text-xs">
        <span className="text-gray-600">상태: </span>
        <span className={statusInfo.color}>{statusInfo.status}</span>
      </div>
    </div>
  );
}
