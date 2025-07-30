"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import { PageLayout, Button, Input } from "../../../../components/styled";
import { Search, Download, Trash2, Eye, Copy } from "lucide-react";

interface GeneratedImage {
  id: string;
  title: string;
  url: string;
  prompt: string;
  options: any;
  originalImageUrl?: string; // 기존 필드 (하위 호환성)
  inputImageUrl?: string; // 사용자가 입력한 이미지 링크
  characterName?: string;
  usedImageInfo?: any;
  usedImagesInfo?: any[];
  createdAt: any;
  uploadTime: any;
  size: string;
  contentType: string;
}

export default function GeneratedImagesPage() {
  const { user, loading: authLoading, approved } = useAuth();
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null
  );
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const [copyingLink, setCopyingLink] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const isAuthenticated = user && approved;

  // 생성된 이미지 목록 가져오기
  const fetchGeneratedImages = async () => {
    if (!isAuthenticated) {
      setGeneratedImages([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("인증 토큰을 가져올 수 없습니다.");
      }

      const response = await fetch("/api/firebase-images/generated", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "API request failed");
      }

      setGeneratedImages(data.generatedImages || []);
    } catch (error) {
      console.error("Error fetching generated images:", error);
      setError(
        error instanceof Error
          ? error.message
          : "생성된 이미지 목록을 불러오는데 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  // 이미지 삭제
  const handleDeleteImage = async (imageId: string) => {
    if (!confirm("정말로 이 이미지를 삭제하시겠습니까?")) {
      return;
    }

    setDeletingImage(imageId);

    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("인증 토큰을 가져올 수 없습니다.");
      }

      const response = await fetch(
        `/api/firebase-images/generated/${imageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "이미지 삭제에 실패했습니다.");
      }

      // 목록에서 제거
      setGeneratedImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (error) {
      console.error("Error deleting image:", error);
      alert(
        error instanceof Error
          ? error.message
          : "이미지 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setDeletingImage(null);
    }
  };

  // 이미지 다운로드
  const handleDownloadImage = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${image.title}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading image:", error);
      alert("이미지 다운로드에 실패했습니다.");
    }
  };

  // 이미지 링크 복사
  const handleCopyImageLink = async (image: GeneratedImage) => {
    setCopyingLink(image.id);

    try {
      await navigator.clipboard.writeText(image.url);

      // 성공 토스트 표시
      setToastMessage("이미지 링크가 클립보드에 복사되었습니다!");
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
    } catch (error) {
      console.error("Error copying link:", error);

      // fallback: 구형 브라우저 지원
      const textArea = document.createElement("textarea");
      textArea.value = image.url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setToastMessage("이미지 링크가 클립보드에 복사되었습니다!");
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 3000);
      } catch (fallbackError) {
        console.error("Fallback copy failed:", fallbackError);
        setToastMessage("링크 복사에 실패했습니다. 수동으로 복사해주세요.");
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 3000);
      }
      document.body.removeChild(textArea);
    } finally {
      setTimeout(() => {
        setCopyingLink(null);
      }, 1000);
    }
  };

  // 다중 선택 모드 토글
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    if (selectMode) {
      setSelectedImages(new Set());
    }
  };

  // 이미지 선택/해제
  const toggleImageSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
    setSelectedImages(newSelected);
  };

  // 선택된 이미지들의 링크 복사
  const handleCopySelectedImageLinks = async () => {
    if (selectedImages.size === 0) {
      setToastMessage("선택된 이미지가 없습니다.");
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return;
    }

    try {
      const selectedImageUrls = filteredImages
        .filter((image) => selectedImages.has(image.id))
        .map((image) => image.url);

      const urlsText = selectedImageUrls.join("\n");
      await navigator.clipboard.writeText(urlsText);

      setToastMessage(
        `${selectedImages.size}개 이미지의 링크가 클립보드에 복사되었습니다!`
      );
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
    } catch (error) {
      console.error("Error copying selected links:", error);

      // fallback: 구형 브라우저 지원
      const textArea = document.createElement("textarea");
      const selectedImageUrls = filteredImages
        .filter((image) => selectedImages.has(image.id))
        .map((image) => image.url);
      textArea.value = selectedImageUrls.join("\n");
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setToastMessage(
          `${selectedImages.size}개 이미지의 링크가 클립보드에 복사되었습니다!`
        );
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 3000);
      } catch (fallbackError) {
        console.error("Fallback copy failed:", fallbackError);
        setToastMessage("링크 복사에 실패했습니다. 수동으로 복사해주세요.");
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 3000);
      }
      document.body.removeChild(textArea);
    }
  };

  // Select All/해제
  const toggleSelectAll = () => {
    if (selectedImages.size === filteredImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredImages.map((image) => image.id)));
    }
  };

  // 이미지 모달 열기
  const handleOpenImageModal = (image: GeneratedImage) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  // 이미지 모달 닫기
  const handleCloseImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  // 검색 필터링
  const filteredImages = generatedImages.filter(
    (image) =>
      image.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (image.characterName &&
        image.characterName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 컴포넌트 마운트 시 이미지 목록 가져오기
  useEffect(() => {
    if (isAuthenticated) {
      fetchGeneratedImages();
    }
  }, [isAuthenticated]);

  // 날짜 포맷팅
  const formatDate = (date: any) => {
    if (!date) return "날짜 없음";

    try {
      let dateObj: Date;

      // Firebase Timestamp 객체인 경우
      if (date && typeof date.toDate === "function") {
        dateObj = date.toDate();
      }
      // 이미 Date 객체인 경우
      else if (date instanceof Date) {
        dateObj = date;
      }
      // 숫자(타임스탬프)인 경우
      else if (typeof date === "number") {
        dateObj = new Date(date);
      }
      // 문자열인 경우
      else if (typeof date === "string") {
        dateObj = new Date(date);
      }
      // 기타 객체인 경우 (seconds, nanoseconds 등)
      else if (date && typeof date === "object") {
        if (date.seconds) {
          // Firebase Timestamp 객체: seconds를 밀리초로 변환
          dateObj = new Date(date.seconds * 1000);
        } else if (date._seconds) {
          // 다른 형태의 Firebase Timestamp
          dateObj = new Date(date._seconds * 1000);
        } else {
          dateObj = new Date(date);
        }
      }
      // 기본적으로 Date 생성자 사용
      else {
        dateObj = new Date(date);
      }

      // 유효한 날짜인지 확인
      if (isNaN(dateObj.getTime())) {
        // 기존 데이터의 다른 날짜 필드들도 시도
        console.log("날짜 필드 확인:", date);
        return "날짜 없음";
      }

      return dateObj
        .toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        .replace(/\. /g, "/")
        .replace(/\./g, "/");
    } catch (error) {
      console.error("날짜 포맷팅 오류:", error, date);
      return "날짜 없음";
    }
  };

  // 옵션 정보 포맷팅
  const formatOptions = (options: any, inputImageUrl?: string) => {
    if (!options) return "옵션 정보 없음";

    const optionList: string[] = [];
    if (options.aspectRatio) optionList.push(`비율: ${options.aspectRatio}`);
    if (options.outputFormat) optionList.push(`형식: ${options.outputFormat}`);
    if (options.seed) optionList.push(`시드: ${options.seed}`);
    if (options.safetyTolerance)
      optionList.push(`안전성: ${options.safetyTolerance}`);
    if (options.comicMode) optionList.push(`만화 모드: ${options.comicMode}컷`);
    if (options.comicLayout)
      optionList.push(`레이아웃: ${options.comicLayout}`);
    if (options.resolution) optionList.push(`해상도: ${options.resolution}`);

    return optionList.length > 0 ? optionList.join(", ") : "옵션 정보 없음";
  };

  return (
    <PageLayout title="생성된 이미지 목록">
      <div>
        {authLoading ? (
          <div className="text-center py-8">
            <div className="text-lg">인증 상태를 확인하는 중...</div>
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center py-8">
            <div className="bg-yellow-50 border-1 border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
              <div className="text-yellow-800 text-lg font-semibold mb-2">
                로그인이 필요합니다
              </div>
              <p className="text-yellow-700 text-sm mb-4">
                생성된 이미지를 보려면 로그인해주세요.
              </p>
              <a href="/login" className="inline-block">
                <Button variant="primary">로그인하기</Button>
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* 검색 및 다중 선택 컨트롤 */}
            <div className="flex gap-4 pb-10">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="제목, 프롬프트, 캐릭터명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* 다중 선택 컨트롤 */}
              <div className="flex gap-2">
                <Button
                  variant={selectMode ? "primary" : "secondary"}
                  onClick={toggleSelectMode}
                  className="flex items-center gap-2"
                >
                  {selectMode ? "선택 모드 종료" : "다중 선택"}
                </Button>

                {selectMode && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2"
                    >
                      {selectedImages.size === filteredImages.length
                        ? "전체 해제"
                        : "Select All"}
                    </Button>

                    <Button
                      variant="primary"
                      onClick={handleCopySelectedImageLinks}
                      disabled={selectedImages.size === 0}
                      className="flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      선택된 링크 복사 ({selectedImages.size}개)
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* 오류 메시지 */}
            {error && (
              <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <strong>오류:</strong> {error}
              </div>
            )}

            {/* 이미지 목록 */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <div className="text-lg">이미지 목록을 불러오는 중...</div>
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 text-lg mb-2">
                  {searchTerm
                    ? "검색 결과가 없습니다."
                    : "Save된 이미지가 없습니다."}
                </div>
                <p className="text-gray-400 text-sm">
                  {searchTerm
                    ? "다른 검색어를 시도해보세요."
                    : "캐릭터 생성 페이지에서 이미지를 생성하고 Save해보세요."}
                </p>
              </div>
            ) : (
              <>
                {/* 선택된 이미지 개수 표시 */}
                {selectMode && selectedImages.size > 0 && (
                  <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-primary font-medium">
                        {selectedImages.size}개 이미지 선택됨
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedImages(new Set())}
                      >
                        선택 해제
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {filteredImages.map((image) => (
                    <div
                      key={image.id}
                      className={`group bg-white rounded-xl border border-gray-200 overflow-hidden hover: transition-all duration-300 cursor-pointer ${
                        selectMode && selectedImages.has(image.id)
                          ? "ring-2 ring-primary"
                          : ""
                      }`}
                      onClick={() => {
                        if (selectMode) {
                          toggleImageSelection(image.id);
                        } else {
                          handleOpenImageModal(image);
                        }
                      }}
                    >
                      {/* 이미지 */}
                      <div className="relative aspect-square bg-gray-100">
                        <img
                          src={image.url || undefined}
                          alt={image.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='12' fill='%239ca3af' text-anchor='middle' dy='.3em'%3E이미지 로드 실패%3C/text%3E%3C/svg%3E";
                          }}
                        />

                        {/* 선택 모드일 때 체크박스 */}
                        {selectMode && (
                          <div className="absolute top-2 left-2">
                            <input
                              type="checkbox"
                              checked={selectedImages.has(image.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleImageSelection(image.id);
                              }}
                              className="w-5 h-5 text-primary bg-white border-2 border-gray-300 rounded focus:ring-primary focus:ring-2"
                            />
                          </div>
                        )}

                        {/* 마우스 오버 시 나타나는 액션 버튼들 (오른쪽 상단) - 선택 모드가 아닐 때만 */}
                        {!selectMode && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyImageLink(image);
                              }}
                              disabled={copyingLink === image.id}
                              className="p-1.5 bg-white/90 hover:bg-primary-light rounded-full transition-colors  disabled:opacity-50"
                              title="링크 복사"
                            >
                              <Copy className="w-4 h-4 text-gray-700" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadImage(image);
                              }}
                              className="p-1.5 bg-white/90 hover:bg-white rounded-full transition-colors "
                              title="다운로드"
                            >
                              <Download className="w-4 h-4 text-gray-700" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteImage(image.id);
                              }}
                              disabled={deletingImage === image.id}
                              className="p-1.5 bg-white/90 hover:bg-red-100 rounded-full transition-colors  disabled:opacity-50"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4 text-gray-700" />
                            </button>
                          </div>
                        )}

                        {/* 마우스 오버 시 나타나는 이미지 정보 */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4">
                          <h3 className="font-semibold text-white mb-2 overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                            {image.title}
                          </h3>
                          <div className="space-y-1 text-xs text-gray-200">
                            {/* 사용자가 입력한 이미지 링크 간단 표시 */}
                            {image.inputImageUrl && (
                              <div className="flex items-center gap-1">
                                <span className="text-white/80">
                                  입력 링크:
                                </span>
                                <a
                                  href={image.inputImageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-light hover:text-primary-light underline truncate"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  링크 보기
                                </a>
                              </div>
                            )}
                            {/* 캐릭터명 표시 */}
                            {image.characterName && (
                              <div className="flex items-center gap-1">
                                <span className="text-white/80">캐릭터:</span>
                                <span className="text-white truncate">
                                  {image.characterName}
                                </span>
                              </div>
                            )}
                            {/* 생성일 표시 */}
                            <div className="flex items-center gap-1">
                              <span className="text-white text-xs">
                                {formatDate(image.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 이미지 상세 모달 */}
            {showImageModal && selectedImage && (
              <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
                <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
                  {/* 모달 헤더 */}
                  <div className="flex justify-between items-center p-4 border-b border-secondary bg-gray-50">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedImage.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        생성일: {formatDate(selectedImage.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={handleCloseImageModal}
                      className="text-gray-400 hover:text-black text-2xl font-bold p-0 w-8 h-8 bg-transparent border-none cursor-pointer"
                      title="닫기"
                    >
                      ×
                    </button>
                  </div>

                  {/* 이미지 컨테이너 */}
                  <div className="p-4 flex flex-col lg:flex-row gap-6">
                    {/* 이미지 */}
                    <div className="flex-1 flex justify-center">
                      <img
                        src={selectedImage.url || undefined}
                        alt={selectedImage.title}
                        className="max-w-full max-h-[60vh] object-contain rounded-xl"
                      />
                    </div>

                    {/* 이미지 정보 */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">
                          프롬프트
                        </h4>
                        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg space-y-2">
                          <div>{selectedImage.prompt}</div>
                          {selectedImage.inputImageUrl && (
                            <div className="pt-2 border-t border-gray-200">
                              <strong>사용된 이미지:</strong>{" "}
                              <a
                                href={selectedImage.inputImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary-dark underline break-all"
                              >
                                이미지 보기
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">
                          사용된 옵션
                        </h4>
                        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                          {formatOptions(
                            selectedImage.options,
                            selectedImage.inputImageUrl
                          )}
                        </div>
                      </div>

                      {selectedImage.characterName && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">
                            캐릭터
                          </h4>
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                            {selectedImage.characterName}
                          </p>
                        </div>
                      )}

                      {/* 사용된 이미지 정보 */}
                      {selectedImage.usedImageInfo && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">
                            사용된 이미지
                          </h4>
                          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg space-y-2">
                            <div>
                              <strong>이름:</strong>{" "}
                              {selectedImage.usedImageInfo.characterName}
                            </div>
                            {selectedImage.usedImageInfo.category && (
                              <div>
                                <strong>카테고리:</strong>{" "}
                                {selectedImage.usedImageInfo.category}
                              </div>
                            )}
                            <div>
                              <strong>원본 URL:</strong>{" "}
                              <a
                                href={selectedImage.usedImageInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary-dark underline"
                              >
                                링크 보기
                              </a>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 사용된 다중 이미지 정보 */}
                      {selectedImage.usedImagesInfo &&
                        selectedImage.usedImagesInfo.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">
                              사용된 이미지들 (
                              {selectedImage.usedImagesInfo.length}개)
                            </h4>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg space-y-2">
                              {selectedImage.usedImagesInfo.map(
                                (usedImage: any, index: number) => (
                                  <div
                                    key={usedImage.id}
                                    className="border-b border-gray-200 pb-2 last:border-b-0"
                                  >
                                    <div>
                                      <strong>
                                        {index + 1}. {usedImage.characterName}
                                      </strong>
                                    </div>
                                    {usedImage.category && (
                                      <div className="text-xs text-gray-500">
                                        카테고리: {usedImage.category}
                                      </div>
                                    )}
                                    <div className="text-xs">
                                      <a
                                        href={usedImage.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:text-primary-dark underline"
                                      >
                                        링크 보기
                                      </a>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="primary"
                          onClick={() => handleDownloadImage(selectedImage)}
                          className="flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          다운로드
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleCopyImageLink(selectedImage)}
                          disabled={copyingLink === selectedImage.id}
                          className="flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          링크 복사
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleDeleteImage(selectedImage.id)}
                          disabled={deletingImage === selectedImage.id}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 토스트 알림 */}
            {showToast && (
              <div className="fixed bottom-4 right-4 bg-gray-600 text-white px-6 py-3 rounded-lg z-50 transition-all duration-300 ease-in-out">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {toastMessage}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
