"use client";

import React from "react";
import { Button } from "@/components/styled";

interface VideoResultsProps {
  videos: string[];
  onDownload: (url: string, index: number) => void;
}

export default function VideoResults({
  videos,
  onDownload,
}: VideoResultsProps) {
  if (videos.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        Generated Videos ({videos.length} videos)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {videos.map((videoUrl, index) => (
          <div
            key={index}
            className="bg-gray-50 border border-gray-200 rounded-lg p-4"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">
                Scene {index + 1}
              </span>
              <Button
                onClick={() => onDownload(videoUrl, index)}
                variant="outline"
                size="sm"
              >
                Download
              </Button>
            </div>

            <video controls className="w-full h-auto rounded" src={videoUrl}>
              Your browser does not support the video tag.
            </video>
          </div>
        ))}
      </div>
    </div>
  );
}
