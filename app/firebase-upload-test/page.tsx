"use client";

import React, { useState } from "react";
import { Button } from "@/components/styled";
import { useAuth } from "@/contexts/AuthContext";

export default function FirebaseUploadTestPage() {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const testFirebaseUpload = async (apiEndpoint: string, testData: any) => {
    try {
      console.log(`Testing ${apiEndpoint} with data:`, testData);

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...testData,
          userId: user?.uid,
        }),
      });

      const result = await response.json();

      setTestResults((prev) => [
        ...prev,
        {
          endpoint: apiEndpoint,
          success: response.ok,
          result,
          timestamp: new Date().toISOString(),
        },
      ]);

      return result;
    } catch (error) {
      console.error(`Error testing ${apiEndpoint}:`, error);
      setTestResults((prev) => [
        ...prev,
        {
          endpoint: apiEndpoint,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const runAllTests = async () => {
    if (!user) {
      alert("Please log in to test Firebase upload");
      return;
    }

    setIsTesting(true);
    setTestResults([]);

    // 테스트 데이터
    const testData = {
      prompt: "A beautiful sunset over the ocean",
      duration: 5,
      cfg_scale: 0.5,
      aspect_ratio: "16:9",
      negative_prompt: "blurry, low quality",
    };

    // 각 API 엔드포인트 테스트
    await testFirebaseUpload("/api/replicateVideo/veo-3", testData);
    await testFirebaseUpload("/api/replicateVideo/kling-v2", testData);
    await testFirebaseUpload("/api/replicateVideo/minimax-hailuo-02", testData);

    setIsTesting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Firebase Upload Test
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">테스트 설명</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              • 이 페이지는 Replicate 비디오 생성 API들이 완료 시 Firebase
              Storage에 업로드하는 기능을 테스트합니다.
            </p>
            <p>• 각 API는 동일한 테스트 데이터로 비디오를 생성합니다.</p>
            <p>• 생성이 완료되면 자동으로 Firebase Storage에 업로드됩니다.</p>
            <p>• 업로드된 URL은 원본 Replicate URL 대신 사용됩니다.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">테스트 실행</h2>
            <Button
              onClick={runAllTests}
              disabled={isTesting || !user}
              className="px-6 py-2"
            >
              {isTesting ? "테스트 중..." : "모든 API 테스트"}
            </Button>
          </div>

          {!user && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">로그인이 필요합니다.</p>
            </div>
          )}
        </div>

        {/* 테스트 결과 */}
        {testResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">테스트 결과</h2>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.success
                      ? "bg-primary/20 border-primary/40"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{result.endpoint}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        result.success
                          ? "bg-secondary text-black"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {result.success ? "성공" : "실패"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {new Date(result.timestamp).toLocaleString()}
                  </p>
                  <div className="text-sm">
                    {result.success ? (
                      <div>
                        <p className="font-medium">결과:</p>
                        <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(result.result, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">오류:</p>
                        <p className="text-red-600">{result.error}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
