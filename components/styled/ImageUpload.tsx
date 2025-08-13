"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Image as ImageIcon, Plus } from "lucide-react";
import Button from "./Button";

interface ImageUploadProps {
  value?: File | null | File[];
  onChange?: (file: File | null | File[]) => void;
  onError?: (error: string) => void;
  accept?: string;
  maxSize?: number; // MB 단위
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  previewSize?: "sm" | "md" | "lg";
  showPreview?: boolean;
  multiple?: boolean;
  maxFiles?: number; // 멀티 업로드 시 최대 파일 수
}

// 타입 가드 함수들
const isFileArray = (value: any): value is File[] => {
  return Array.isArray(value) && value.every((item) => item instanceof File);
};

const isSingleFile = (value: any): value is File => {
  return value instanceof File;
};

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  onError,
  accept = "image/png,image/jpeg,image/jpg,image/gif,image/webp",
  maxSize = 10, // 10MB 기본값
  placeholder = "이미지를 선택하거나 여기에 드래그하세요",
  disabled = false,
  className = "",
  previewSize = "md",
  showPreview = true,
  multiple = false,
  maxFiles = 10,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevFilesRef = useRef<File[]>([]);

  // 현재 파일들을 배열로 관리
  const currentFiles: File[] = multiple
    ? isFileArray(value)
      ? value
      : []
    : isSingleFile(value)
    ? [value]
    : [];

  // value prop이 변경될 때 previewUrls 동기화
  useEffect(() => {
    // 파일이 실제로 변경되었는지 확인
    const filesChanged =
      prevFilesRef.current.length !== currentFiles.length ||
      prevFilesRef.current.some(
        (file, index) =>
          !currentFiles[index] ||
          file.name !== currentFiles[index].name ||
          file.size !== currentFiles[index].size
      );

    if (filesChanged) {
      // 기존 URL들 정리
      previewUrls.forEach((url) => URL.revokeObjectURL(url));

      if (showPreview && currentFiles.length > 0) {
        // 새로운 URL들 생성
        const newUrls = currentFiles.map((file) => URL.createObjectURL(file));
        setPreviewUrls(newUrls);
      } else {
        setPreviewUrls([]);
      }

      // 현재 파일들을 이전 파일로 Save
      prevFilesRef.current = [...currentFiles];
    }
  }, [currentFiles, showPreview, previewUrls]);

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // 파일 유효성 검사
  const validateFile = useCallback(
    (file: File): boolean => {
      // 파일 타입 검증
      const allowedTypes = accept.split(",").map((type) => type.trim());

      // image/* 패턴 처리
      const isImageType = file.type.startsWith("image/");
      const isExplicitlyAllowed = allowedTypes.includes(file.type);
      const isWildcardAllowed = allowedTypes.includes("image/*");

      if (!isExplicitlyAllowed && !(isWildcardAllowed && isImageType)) {
        onError?.("지원하지 않는 파일 형식입니다.");
        return false;
      }

      // 파일 크기 검증 (Runway API 제한을 고려하여 5MB로 제한)
      const maxSizeBytes = Math.min(maxSize * 1024 * 1024, 5 * 1024 * 1024); // 최대 5MB
      if (file.size > maxSizeBytes) {
        const actualMaxSize = Math.min(maxSize, 5);
        onError?.(
          `파일 크기가 너무 큽니다. 최대 ${actualMaxSize}MB까지 가능합니다. (Runway API 제한)`
        );
        return false;
      }

      return true;
    },
    [accept, maxSize, onError]
  );

  // 파일 처리
  const handleFiles = useCallback(
    (files: File[]) => {
      const validFiles = files.filter(validateFile);

      if (validFiles.length === 0) return;

      if (multiple) {
        // 멀티 업로드 모드
        const newFiles = [...currentFiles, ...validFiles];
        if (newFiles.length > maxFiles) {
          onError?.(`최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`);
          return;
        }
        onChange?.(newFiles);
      } else {
        // 단일 업로드 모드
        onChange?.(validFiles[0]);
      }
    },
    [validateFile, multiple, currentFiles, maxFiles, onChange, onError]
  );

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      if (disabled) return;

      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, handleFiles]
  );

  // 파일 제거
  const handleRemove = useCallback(
    (index: number) => {
      if (multiple) {
        const newFiles = currentFiles.filter((_, i) => i !== index);
        onChange?.(newFiles);
      } else {
        onChange?.(null);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [multiple, currentFiles, onChange]
  );

  // 모든 파일 제거
  const handleRemoveAll = useCallback(() => {
    onChange?.(multiple ? [] : null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onChange, multiple]);

  // 미리보기 크기 클래스
  const getPreviewSizeClass = () => {
    switch (previewSize) {
      case "sm":
        return "w-16 h-16";
      case "lg":
        return "w-32 h-32";
      default:
        return "w-32 h-32";
    }
  };

  // 업로드 영역 렌더링
  const renderUploadArea = () => {
    if (multiple && currentFiles.length >= maxFiles) {
      return null;
    }

    if (!multiple && currentFiles.length > 0) {
      return null;
    }

    return (
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 transition-all duration-200
          ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-gray-400"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <Upload
              size={32}
              className={`${isDragOver ? "text-primary" : "text-gray-400"}`}
            />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">
            {multiple ? `${placeholder} (최대 ${maxFiles}개)` : placeholder}
          </p>
          <p className="text-xs text-gray-500">
            PNG, JPEG, GIF, WebP (최대 {maxSize}MB)
          </p>
        </div>
      </div>
    );
  };

  // 미리보기 렌더링
  const renderPreviews = () => {
    if (currentFiles.length === 0) return null;

    if (multiple) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">
              업로드된 이미지 ({currentFiles.length}/{maxFiles})
            </h4>
            {currentFiles.length > 0 && (
              <Button type="button" onClick={handleRemoveAll}>
                모두 제거
              </Button>
            )}
          </div>

          {showPreview && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-4">
              {currentFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative group">
                  <div
                    className={`${getPreviewSizeClass()} relative rounded-lg overflow-hidden border border-gray-200`}
                  >
                    {previewUrls[index] && (
                      <img
                        src={previewUrls[index]}
                        alt={`preview ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error(
                            `Image preview error for ${file.name}:`,
                            e
                          );
                        }}
                      />
                    )}

                    {/* 제거 버튼 */}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="absolute cursor-pointer top-1 right-1 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center hover:bg-black transition-colors opacity-0 group-hover:opacity-100"
                        title="제거"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* 파일 정보 */}
                  <div className="mt-1 text-center">
                    <div className="w-20">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* 추가 업로드 버튼 */}
              {currentFiles.length < maxFiles && (
                <div
                  className={`${getPreviewSizeClass()} border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors`}
                  onClick={() => !disabled && fileInputRef.current?.click()}
                >
                  <Plus size={24} className="text-gray-400" />
                </div>
              )}
            </div>
          )}
        </div>
      );
    } else {
      // 단일 업로드 미리보기
      const file = currentFiles[0];
      return (
        <div className="relative">
          <div className="flex items-center justify-center">
            <div
              className={`${getPreviewSizeClass()} relative rounded-lg overflow-hidden border border-gray-200`}
            >
              {previewUrls[0] && (
                <img
                  src={previewUrls[0]}
                  alt="미리보기"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error(`Image preview error for ${file.name}:`, e);
                  }}
                />
              )}
            </div>
          </div>

          {/* 파일 정보 */}
          <div className="mt-2 text-center">
            <p className="text-sm font-medium text-gray-700 truncate">
              {file.name}
            </p>
            <p className="text-xs text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          {/* 제거 버튼 */}
          {!disabled && (
            <button
              type="button"
              onClick={() => handleRemove(0)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              title="제거"
            >
              <X size={14} />
            </button>
          )}
        </div>
      );
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 파일 입력 (숨김) */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled}
        multiple={multiple}
        className="hidden"
      />

      {/* 업로드 영역 */}
      {renderUploadArea()}

      {/* 미리보기 */}
      {renderPreviews()}

      {/* 미리보기 없이 파일 정보만 표시 (단일 업로드에서만) */}
      {!showPreview && currentFiles.length > 0 && !multiple && (
        <div className="space-y-2">
          {currentFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <ImageIcon size={20} className="text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              {!disabled && (
                <Button
                  type="button"
                  onClick={() => handleRemove(index)}
                  title="제거"
                >
                  <X size={16} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
