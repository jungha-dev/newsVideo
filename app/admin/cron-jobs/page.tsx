"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, PageTitle, Section } from "@/components/styled";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function CronJobsPage() {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [lastRunStats, setLastRunStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 관리자 권한 확인 (users 컬렉션에서 role 확인)
  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        // users 컬렉션에서 role 확인
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log("사용자 데이터:", userData);

          if (userData.role === "superadmin") {
            setIsSuperAdmin(true);
            console.log("✅ 슈퍼 관리자 권한 확인됨");
          } else {
            setIsSuperAdmin(false);
            console.log("❌ 슈퍼 관리자 권한 없음, role:", userData.role);
          }
        } else {
          console.log("❌ 사용자 문서를 찾을 수 없음");
          setIsSuperAdmin(false);
        }
      } catch (err) {
        console.error("Role check failed:", err);
        setIsSuperAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();
  }, [user?.uid]);

  // 로딩 중이거나 권한이 없는 경우
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">로딩 중...</h1>
          <p className="text-gray-600">권한을 확인하고 있습니다.</p>
        </div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            접근 권한이 없습니다
          </h1>
          <p className="text-gray-600">
            이 페이지는 슈퍼 관리자만 접근할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const triggerAutoUpload = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setError(null);

    try {
      console.log("🚀 서버 사이드 자동 업로드 트리거 시작...");

      const authKey =
        process.env.NEXT_PUBLIC_CRON_SECRET_KEY || "test-secret-key-2024";
      console.log("🔑 전송하는 인증 키:", authKey);

      const response = await fetch("/api/video/news/auto-upload-cron", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ 자동 업로드 완료:", data);

        setLastRun(new Date().toLocaleString("ko-KR"));
        setLastRunStats(data.stats);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Unknown error");
      }
    } catch (err) {
      console.error("❌ 자동 업로드 실패:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  };

  const testEndpoint = async () => {
    try {
      const response = await fetch("/api/video/news/auto-upload-cron");
      if (response.ok) {
        const data = await response.json();
        console.log("✅ 엔드포인트 테스트 성공:", data);
        alert("엔드포인트가 정상적으로 작동합니다!");
      } else {
        throw new Error("Endpoint test failed");
      }
    } catch (err) {
      console.error("❌ 엔드포인트 테스트 실패:", err);
      alert("엔드포인트 테스트에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <PageTitle title="크론 작업 관리" />

        <Section title="서버 사이드 자동 업로드">
          <Card id="auto-upload-card" title="자동 업로드">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Firebase 자동 업로드 크론 작업
                </h3>
                <p className="text-gray-600 text-sm">
                  모든 사용자의 비디오에서 Replicate URL이 있지만 Firebase에
                  업로드되지 않은 씬들을 자동으로 Firebase Storage에
                  업로드합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">
                    📊 마지막 실행 정보
                  </h4>
                  <div className="text-sm text-blue-800">
                    {lastRun ? (
                      <div>
                        <p>
                          <strong>실행 시간:</strong> {lastRun}
                        </p>
                        {lastRunStats && (
                          <div className="mt-2">
                            <p>
                              <strong>처리된 비디오:</strong>{" "}
                              {lastRunStats.totalProcessed}개
                            </p>
                            <p>
                              <strong>업로드된 씬:</strong>{" "}
                              {lastRunStats.totalUploaded}개
                            </p>
                            <p>
                              <strong>오류 발생:</strong>{" "}
                              {lastRunStats.totalErrors}개
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p>아직 실행되지 않음</p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">
                    🔧 작업 상태
                  </h4>
                  <div className="text-sm text-green-800">
                    <p>
                      <strong>현재 상태:</strong>{" "}
                      {isRunning ? "실행 중..." : "대기 중"}
                    </p>
                    <p>
                      <strong>API 엔드포인트:</strong>{" "}
                      /api/video/news/auto-upload-cron
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-medium text-red-900 mb-2">
                    ❌ 오류 발생
                  </h4>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={triggerAutoUpload}
                  disabled={isRunning}
                  variant="primary"
                  className="min-w-[200px]"
                >
                  {isRunning ? "🔄 실행 중..." : "🚀 자동 업로드 실행"}
                </Button>

                <Button
                  onClick={testEndpoint}
                  variant="outline"
                  className="min-w-[150px]"
                >
                  🔍 엔드포인트 테스트
                </Button>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-medium text-yellow-900 mb-2">
                  ⚠️ 주의사항
                </h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>
                    • 이 작업은 모든 사용자의 비디오를 처리하므로 시간이 오래
                    걸릴 수 있습니다.
                  </li>
                  <li>• 동시에 여러 번 실행하지 마세요.</li>
                  <li>
                    • 실제 운영환경에서는 외부 크론 서비스(예: Vercel Cron)를
                    사용하는 것을 권장합니다.
                  </li>
                  <li>
                    • 환경변수 CRON_SECRET_KEY를 설정하여 보안을 강화하세요.
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </Section>

        <Section title="외부 크론 서비스 설정">
          <Card id="cron-service-card" title="크론 서비스 설정">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Vercel Cron 설정 예시
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Vercel을 사용하는 경우, vercel.json 파일에 다음과 같이 크론
                  작업을 설정할 수 있습니다.
                </p>

                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <pre>{`{
  "crons": [
    {
      "path": "/api/video/news/auto-upload-cron",
      "schedule": "0 */6 * * *"
    }
  ]
}`}</pre>
                </div>

                <p className="text-gray-600 text-sm mt-2">
                  위 설정은 6시간마다 자동 업로드를 실행합니다. 필요에 따라
                  스케줄을 조정하세요.
                </p>
              </div>
            </div>
          </Card>
        </Section>
      </div>
    </div>
  );
}
