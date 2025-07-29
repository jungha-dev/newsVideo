"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/styled";
import { useAuth } from "@/contexts/AuthContext";

interface VideoGenerationRequest {
  prompt: string;
  duration: 5 | 10;
  cfg_scale: number;
  end_image?: string;
  start_image?: string;
  aspect_ratio: "16:9" | "9:16" | "1:1";
  negative_prompt: string;
  reference_images: string[];
}

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string;
  error?: string;
}

export default function KlingV16ProPage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<VideoGenerationRequest>({
    prompt: "",
    duration: 5,
    cfg_scale: 0.5,
    aspect_ratio: "16:9",
    negative_prompt: "",
    reference_images: [],
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPrediction, setCurrentPrediction] = useState<Prediction | null>(
    null
  );
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll for prediction status
  useEffect(() => {
    if (
      !currentPrediction ||
      currentPrediction.status === "succeeded" ||
      currentPrediction.status === "failed" ||
      currentPrediction.status === "canceled"
    ) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/replicateVideo/kling-v1-6-pro?id=${currentPrediction.id}&userId=${user?.uid}`
        );
        if (response.ok) {
          const prediction = await response.json();
          setCurrentPrediction(prediction);

          if (prediction.status === "succeeded" && prediction.output) {
            // Firebase URL이 있으면 사용, 없으면 원본 URL 사용
            setGeneratedVideo(prediction.firebaseUrl || prediction.output);
            setIsGenerating(false);
          } else if (prediction.status === "failed") {
            setError(prediction.error || "Video generation failed");
            setIsGenerating(false);
          }
        }
      } catch (error) {
        console.error("Error polling prediction status:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentPrediction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("Please log in to generate videos");
      return;
    }

    // Validate that either start_image or end_image is provided
    if (!formData.start_image && !formData.end_image) {
      setError("Either start image or end image is required");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideo(null);

    try {
      const response = await fetch("/api/replicateVideo/kling-v1-6-pro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start video generation");
      }

      const prediction = await response.json();
      setCurrentPrediction(prediction);
    } catch (error) {
      console.error("Error generating video:", error);
      setError(
        error instanceof Error ? error.message : "Failed to generate video"
      );
      setIsGenerating(false);
    }
  };

  const handleInputChange = (
    field: keyof VideoGenerationRequest,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addReferenceImage = () => {
    const url = prompt("Enter reference image URL:");
    if (url && formData.reference_images.length < 4) {
      setFormData((prev) => ({
        ...prev,
        reference_images: [...prev.reference_images, url],
      }));
    }
  };

  const removeReferenceImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      reference_images: prev.reference_images.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg  p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Kling v1.6 Pro Video Generation
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt *
            </label>
            <textarea
              value={formData.prompt}
              onChange={(e) => handleInputChange("prompt", e.target.value)}
              placeholder="Describe the video you want to generate..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              required
            />
          </div>

          {/* Negative Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Negative Prompt
            </label>
            <textarea
              value={formData.negative_prompt}
              onChange={(e) =>
                handleInputChange("negative_prompt", e.target.value)
              }
              placeholder="Things you do not want to see in the video..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
          </div>

          {/* Duration and Aspect Ratio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration *
              </label>
              <select
                value={formData.duration}
                onChange={(e) =>
                  handleInputChange("duration", parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aspect Ratio
              </label>
              <select
                value={formData.aspect_ratio}
                onChange={(e) =>
                  handleInputChange("aspect_ratio", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </div>
          </div>

          {/* CFG Scale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CFG Scale: {formData.cfg_scale}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.cfg_scale}
              onChange={(e) =>
                handleInputChange("cfg_scale", parseFloat(e.target.value))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>More Flexible (0)</span>
              <span>More Relevant (1)</span>
            </div>
          </div>

          {/* Start Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Image URL
            </label>
            <input
              type="url"
              value={formData.start_image || ""}
              onChange={(e) => handleInputChange("start_image", e.target.value)}
              placeholder="https://example.com/start-image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              First frame of the video. Either start or end image is required.
            </p>
          </div>

          {/* End Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Image URL
            </label>
            <input
              type="url"
              value={formData.end_image || ""}
              onChange={(e) => handleInputChange("end_image", e.target.value)}
              placeholder="https://example.com/end-image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Last frame of the video. Either start or end image is required.
            </p>
          </div>

          {/* Reference Images */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Reference Images ({formData.reference_images.length}/4)
              </label>
              {formData.reference_images.length < 4 && (
                <Button
                  type="button"
                  onClick={addReferenceImage}
                  variant="outline"
                  size="sm"
                >
                  Add Reference Image
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {formData.reference_images.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      const newImages = [...formData.reference_images];
                      newImages[index] = e.target.value;
                      handleInputChange("reference_images", newImages);
                    }}
                    placeholder="https://example.com/reference-image.jpg"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button
                    type="button"
                    onClick={() => removeReferenceImage(index)}
                    variant="secondary"
                    size="sm"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Reference images to use in video generation (up to 4 images).
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={
                isGenerating ||
                !formData.prompt ||
                (!formData.start_image && !formData.end_image)
              }
              variant="primary"
              size="lg"
              className="px-8 py-3"
            >
              {isGenerating ? "Generating Video..." : "Generate Video"}
            </Button>
          </div>
        </form>

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Status Display */}
        {currentPrediction && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-medium text-blue-800 mb-2">
              Generation Status
            </h3>
            <p className="text-blue-700">
              Status: {currentPrediction.status}
              {currentPrediction.status === "processing" &&
                " (This may take several minutes)"}
            </p>
            {currentPrediction.error && (
              <p className="text-red-600 mt-2">
                Error: {currentPrediction.error}
              </p>
            )}
          </div>
        )}

        {/* Generated Video Display */}
        {generatedVideo && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Generated Video
            </h3>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={generatedVideo}
                controls
                className="w-full h-full object-contain"
                onError={(e) => {
                  console.error("Video loading error:", e);
                }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = generatedVideo;
                  link.download = "generated-video.mp4";
                  link.click();
                }}
                variant="outline"
                size="sm"
              >
                Download Video
              </Button>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(generatedVideo);
                }}
                variant="outline"
                size="sm"
              >
                Copy URL
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
