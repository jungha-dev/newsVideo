import React from "react";

interface AutoUploadStatusProps {
  scene: any;
  sceneIndex: number;
  isUploading?: boolean;
}

export default function AutoUploadStatus({
  scene,
  sceneIndex,
  isUploading = false,
}: AutoUploadStatusProps) {
  const hasVideoUrl = scene.videoUrl;
  const hasFirebaseUrl = (scene as any).firebaseUrl;
  const needsUpload = hasVideoUrl && !hasFirebaseUrl;

  if (!hasVideoUrl) {
    return (
      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
        No video yet
      </div>
    );
  }

  if (hasFirebaseUrl) {
    return (
      <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
        <span>Firebase Ready</span>
      </div>
    );
  }

  if (needsUpload) {
    return (
      <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
        <span>자동 업로드 대기 중...</span>
      </div>
    );
  }

  return null;
}
