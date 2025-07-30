"use client";

import React, { useState, useRef, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { Button, Select, Input, ImageUpload } from "@/components/styled";
import { Plus, Settings2, Check } from "lucide-react";

interface FirebaseImage {
  id: string;
  name: string;
  url: string;
  size: string;
  contentType: string;
  timeCreated: string;
  characterName: string;
  uploadTime: Timestamp;
  email?: string;
  category?: string;
  storagePath?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  previewImage?: string;
  createdAt: any; // Firestore Timestamp 또는 Date
  updatedAt: any; // Firestore Timestamp 또는 Date
}

interface GeneratedImage {
  id: string;
  title: string;
  url: string;
  prompt: string;
  options: any;
  originalImageUrl?: string;
  inputImageUrl?: string;
  characterName?: string;
  usedImageInfo?: any;
  usedImagesInfo?: any[];
  createdAt: any;
  uploadTime: any;
  size: string;
  contentType: string;
}

interface CharacterSelectorProps {
  firebaseImages: FirebaseImage[];
  loadingImages: boolean;
  apiError: string;
  selectedCategory: string;
  availableCategories: string[];
  categoryList: Category[];
  imageUrl: string;
  selectedImageInfo: FirebaseImage | null;
  imageErrors: Set<string>;
  showAddCharacter: boolean;
  uploading: boolean;
  editingCharacterId: string | null;
  editingCharacterName: string;
  savingEdit: boolean;
  showEditDropdown: string | null;
  // 이미지 추가 폼 관련 props
  characterName: string;
  characterCategory: string;
  selectedFile: File | null;
  uploadProgress: number;
  uploadError: string;
  uploadSuccess: string;
  // 이미지 편집 모달 관련 props
  showEditModal: boolean;
  editingImage: FirebaseImage | null;
  editImageName: string;
  editImageCategory: string;
  editImageFile: File | null;
  editingImageLoading: boolean;
  // 다중 선택 관련 props
  isMultiSelect?: boolean;
  selectedImages?: FirebaseImage[];
  onMultiSelect?: (image: FirebaseImage) => void;
  onImageClick: (image: FirebaseImage) => void;
  onAddCharacterClick: () => void;
  onCategoryChange: (category: string) => void;
  onAddCategoryClick: () => void;
  onShowCategoryManager: () => void;
  onRetryFetch: () => void;
  onImageError: (imageUrl: string) => void;
  onImageLoad: (imageUrl: string) => void;
  onToggleEditDropdown: (characterId: string, event: React.MouseEvent) => void;
  onStartEditCharacter: (
    character: FirebaseImage,
    event: React.MouseEvent
  ) => void;
  onSaveEditCharacter: () => void;
  onCancelEditCharacter: () => void;
  onDeleteCharacter: (image: FirebaseImage, event: React.MouseEvent) => void;
  onOpenImageModal: (image: FirebaseImage, event: React.MouseEvent) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveCharacter: () => void;
  onEditingCharacterNameChange: (name: string) => void;
  onCharacterNameChange: (name: string) => void;
  onCharacterCategoryChange: (category: string) => void;
  onCancelAddCharacter: () => void;
  // 이미지 편집 모달 관련 핸들러
  onOpenEditModal: (image: FirebaseImage) => void;
  onCloseEditModal: () => void;
  onEditImageNameChange: (name: string) => void;
  onEditImageCategoryChange: (category: string) => void;
  onEditImageFileChange: (file: File | File[] | null) => void;
  onSaveEditImage: () => void;
  onDeleteEditImage: () => void;
  forceFirebaseUrl: (url: string) => string;
  // 멀티 이미지 생성 탭에서 모달 숨기기 옵션
  hideAddModal?: boolean;
  // 링크 입력 관련 props
  onImageUrlChange?: (url: string) => void;
  onImageUrlConfirm?: () => void;
  // 이미지 검색 모달 관련 props
  showImageSearchModal?: boolean;
  onShowImageSearchModal?: () => void;
  onCloseImageSearchModal?: () => void;
  onSelectImageFromSearch?: (image: GeneratedImage) => void;
  // 생성된 이미지 목록 관련 props
  generatedImages?: GeneratedImage[];
  loadingGeneratedImages?: boolean;
}

export default function CharacterSelector({
  firebaseImages,
  loadingImages,
  apiError,
  selectedCategory,
  availableCategories,
  categoryList,
  imageUrl,
  selectedImageInfo,
  imageErrors,
  showAddCharacter,
  uploading,
  editingCharacterId,
  editingCharacterName,
  savingEdit,
  showEditDropdown,
  characterName,
  characterCategory,
  selectedFile,
  uploadProgress,
  uploadError,
  uploadSuccess,
  // 다중 선택 관련 props
  isMultiSelect = false,
  selectedImages = [],
  onMultiSelect,
  onImageClick,
  onAddCharacterClick,
  onCategoryChange,
  onAddCategoryClick,
  onShowCategoryManager,
  onRetryFetch,
  onImageError,
  onImageLoad,
  onToggleEditDropdown,
  onStartEditCharacter,
  onSaveEditCharacter,
  onCancelEditCharacter,
  onDeleteCharacter,
  onOpenImageModal,
  onFileUpload,
  onSaveCharacter,
  onEditingCharacterNameChange,
  onCharacterNameChange,
  onCharacterCategoryChange,
  onCancelAddCharacter,
  // 이미지 편집 모달 관련 props
  showEditModal,
  editingImage,
  editImageName,
  editImageCategory,
  editImageFile,
  editingImageLoading,
  onOpenEditModal,
  onCloseEditModal,
  onEditImageNameChange,
  onEditImageCategoryChange,
  onEditImageFileChange,
  onSaveEditImage,
  onDeleteEditImage,
  forceFirebaseUrl,
  // 멀티 이미지 생성 탭에서 모달 숨기기 옵션
  hideAddModal = false,
  // 링크 입력 관련 props
  onImageUrlChange,
  onImageUrlConfirm,
  // 이미지 검색 모달 관련 props
  showImageSearchModal = false,
  onShowImageSearchModal,
  onCloseImageSearchModal,
  onSelectImageFromSearch,
  // 생성된 이미지 목록 관련 props
  generatedImages = [],
  loadingGeneratedImages = false,
}: CharacterSelectorProps) {
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewImageError, setPreviewImageError] = useState(false);

  return (
    <div className="space-y-4">
      {/* 카테고리 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className="border-2 p-1 rounded-xl border-[var(--color-white)] text-[var(--color-black)] hover:bg-[var(--color-secondary-light)] hover:text-black focus:ring-[var(--color-white)] bg-transparent"
          onClick={onShowCategoryManager}
          disabled={loadingImages}
          title="카테고리 관리"
        >
          <Settings2 size={32} />
        </button>
        {/* 모든 카테고리 탭 */}
        <button
          onClick={() => onCategoryChange("all")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
            selectedCategory === "all"
              ? "bg-black text-white"
              : "bg-secondary text-gray-700 hover:bg-secondary-dark"
          }`}
          disabled={loadingImages}
        >
          모든 카테고리
        </button>

        {/* 개별 카테고리 탭들 */}
        {availableCategories.map((category) => {
          const categoryInfo = categoryList.find(
            (cat) => cat.name === category
          );
          return (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`pr-6 rounded-xl border-2 border-secondary-light text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                selectedCategory === category
                  ? "bg-black text-white"
                  : "bg-secondary text-gray-700 hover:bg-secondary-dark"
              }`}
              disabled={loadingImages}
            >
              {/* 카테고리 이미지가 있으면 표시 */}
              {category !== "uncategorized" && categoryInfo?.previewImage ? (
                <img
                  src={categoryInfo.previewImage}
                  alt={category}
                  className="block w-12 h-12 object-cover rounded-tl-lg rounded-bl-lg flex-shrink-0"
                />
              ) : category !== "uncategorized" ? (
                <div className="bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-xs">📁</span>
                </div>
              ) : null}
              {category === "uncategorized" ? "분류 없음" : category}
            </button>
          );
        })}
      </div>

      {/* 이미지 URL 입력 및 미리보기 */}
      <div className="space-y-4">
        {/* 미리보기 이미지 */}
        {previewImageUrl && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">미리보기</h4>
              <button
                onClick={() => setPreviewImageUrl("")}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                title="미리보기 닫기"
              >
                ×
              </button>
            </div>
            <div className="flex items-center justify-center">
              {previewImageError ? (
                <div className="text-center text-gray-500">
                  미리보기 이미지를 로드할 수 없습니다.
                </div>
              ) : (
                <img
                  src={previewImageUrl}
                  alt="미리보기"
                  className="max-w-full max-h-48 object-contain rounded-lg shadow-sm"
                  onError={() => {
                    console.error(
                      "미리보기 이미지 로드 실패:",
                      previewImageUrl
                    );
                    setPreviewImageError(true);
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-semibold">
          {isMultiSelect ? "캐릭터 다중 선택" : "적용할 이미지 선택"}
          {selectedImageInfo && (
            <span className="-black">: {selectedImageInfo.characterName}</span>
          )}
        </div>

        <Button
          variant="secondary-light"
          size="sm"
          onClick={onAddCharacterClick}
          disabled={loadingImages || showAddCharacter || hideAddModal}
          className="flex items-center gap-2"
        >
          <Plus size={32} />
        </Button>
      </div>

      {apiError && (
        <div className="mb-4 p-3 bg-red-100 border-1 border-red-400 text-red-700 rounded">
          <strong>오류:</strong> {apiError}
          <Button
            variant="primary"
            size="sm"
            onClick={onRetryFetch}
            className="ml-2 bg-red-600 hover:bg-red-700"
          >
            다시 시도
          </Button>
        </div>
      )}

      {loadingImages ? (
        <div className="text-center py-8">이미지 이미지를 불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 overflow-y-auto max-h-96">
          {firebaseImages.map((image) => {
            const hasError = imageErrors.has(image.url || "");
            let displayUrl = image.url ? forceFirebaseUrl(image.url) : "";
            const isSelected = isMultiSelect
              ? selectedImages.some((img) => img.id === image.id)
              : imageUrl === image.url;

            return (
              <div
                key={image.id}
                className={`relative group cursor-pointer border-6 rounded-xl overflow-hidden hover: transition-all duration-200 ${
                  isSelected ? "border-primary/90 border-6 " : "border-gray-200"
                }`}
                onClick={(e) => {
                  if (isMultiSelect && onMultiSelect) {
                    onMultiSelect(image);
                  } else {
                    onImageClick(image);
                  }
                }}
              >
                {/* 체크박스 표시 (다중 선택 및 단일 선택 모두) */}
                <div className="absolute top-2 left-2 z-10">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                </div>
                {hasError ? (
                  <div className="w-full h-40 bg-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-500">로드 실패</span>
                  </div>
                ) : displayUrl ? (
                  <img
                    src={displayUrl}
                    alt={image.characterName}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                    onError={() => onImageError(displayUrl)}
                    onLoad={() => onImageLoad(displayUrl)}
                  />
                ) : null}
                {/* 편집 버튼 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditModal(image);
                  }}
                  className="absolute top-2 right-2 bg-white/90 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm cursor-pointer"
                  title="편집"
                >
                  <span className="text-xs font-bold">⋯</span>
                </button>

                {/* 이미지 이름 */}
                <div className="absolute bottom-0 left-0 right-0  bg-opacity-50 text-xs p-2 truncate">
                  {editingCharacterId === image.id ? (
                    <input
                      type="text"
                      value={editingCharacterName}
                      onChange={(e) =>
                        onEditingCharacterNameChange(e.target.value)
                      }
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          onSaveEditCharacter();
                        }
                      }}
                      onBlur={onSaveEditCharacter}
                      className="w-full bg-transparent border-none text-white text-xs focus:outline-none cursor-pointer"
                      autoFocus
                    />
                  ) : (
                    image.characterName
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="url"
            placeholder="이미지 URL을 직접 입력하세요"
            value={inputImageUrl}
            onChange={(e) => {
              setInputImageUrl(e.target.value);
              onImageUrlChange?.(e.target.value);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent"
          />
        </div>

        <Button onClick={onShowImageSearchModal}>리스트에서 불러오기</Button>
        <button
          onClick={() => {
            if (inputImageUrl.trim()) {
              setPreviewImageUrl(inputImageUrl.trim());
              setPreviewImageError(false);
              onImageUrlConfirm?.();
              setInputImageUrl("");
            }
          }}
          disabled={!inputImageUrl.trim()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          확인
        </button>
      </div>
      {/* 이미지 추가 모달 */}
      {showAddCharacter && !hideAddModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                새 이미지 추가
              </h3>
              <button
                onClick={onCancelAddCharacter}
                className="text-gray-400 hover:text-black text-xl bg-transparent border-none p-0 cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  label="이미지 이름"
                  placeholder="이미지 이름을 입력하세요"
                  value={characterName}
                  onChange={(e) => onCharacterNameChange(e.target.value)}
                />
              </div>

              <div>
                <Select
                  label="카테고리"
                  value={characterCategory}
                  onChange={onCharacterCategoryChange}
                  options={[
                    { value: "uncategorized", label: "분류 없음" },
                    ...availableCategories
                      .filter((cat) => cat !== "uncategorized")
                      .map((category) => ({
                        value: category,
                        label: category,
                      })),
                  ]}
                />
              </div>

              <ImageUpload
                value={selectedFile}
                onChange={(file) => {
                  if (file) {
                    onFileUpload({ target: { files: [file] } } as any);
                  } else {
                    onFileUpload({ target: { files: [] } } as any);
                  }
                }}
                onError={(error) => {
                  // 에러 처리는 상위 컴포넌트에서 처리
                  console.error("Image upload error:", error);
                }}
                maxSize={10}
                placeholder="이미지를 선택하거나 여기에 드래그하세요"
                disabled={uploading}
                previewSize="md"
              />

              {/* 업로드 상태 표시 */}
              {uploading && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    업로드 중... {uploadProgress}%
                  </p>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-100 border-1 border-red-400 text-red-700 text-sm rounded-xl">
                  <strong>업로드 오류:</strong> {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 bg-primary/5 border-1 border-primary black text-sm rounded-xl">
                  <strong>성공:</strong> {uploadSuccess}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={onCancelAddCharacter}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={onSaveCharacter}
                  disabled={uploading || !selectedFile || !characterName.trim()}
                  loading={uploading}
                  className="flex-1"
                >
                  {uploading ? "Save 중..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 편집 모달 */}
      {showEditModal && editingImage && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                이미지 편집
              </h3>
              <button
                onClick={onCloseEditModal}
                className="text-gray-400 hover:text-black text-xl bg-transparent border-none p-0 cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* 현재 이미지 미리보기 */}
              <div className="text-center">
                {editingImage && editingImage.url ? (
                  <img
                    src={forceFirebaseUrl(editingImage.url)}
                    alt={editingImage.characterName}
                    className="w-32 h-32 object-cover rounded-lg mx-auto border border-gray-200"
                  />
                ) : null}
                <p className="text-sm text-gray-500 mt-2">현재 이미지</p>
              </div>

              <div>
                <Input
                  label="이미지 이름"
                  placeholder="이미지 이름을 입력하세요"
                  value={editImageName}
                  onChange={(e) => onEditImageNameChange(e.target.value)}
                />
              </div>

              <div>
                <Select
                  label="카테고리"
                  value={editImageCategory}
                  onChange={onEditImageCategoryChange}
                  options={[
                    { value: "uncategorized", label: "분류 없음" },
                    ...availableCategories
                      .filter((cat) => cat !== "uncategorized")
                      .map((category) => ({
                        value: category,
                        label: category,
                      })),
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  새 이미지로 교체 (선택사항)
                </label>
                <ImageUpload
                  value={editImageFile}
                  onChange={onEditImageFileChange}
                  onError={(error) => {
                    console.error("Edit image upload error:", error);
                  }}
                  maxSize={10}
                  placeholder="새 이미지를 선택하거나 여기에 드래그하세요"
                  disabled={editingImageLoading}
                  previewSize="md"
                />
              </div>

              {/* 편집 상태 표시 */}
              {editingImageLoading && (
                <div className="p-3 bg-primary-light border-1 primary-light text-primary-dark text-sm rounded-xl">
                  <strong>편집 중...</strong> 이미지를 업데이트하고 있습니다.
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={onDeleteEditImage}
                  disabled={editingImageLoading}
                  className="flex-1 bg-red-100 text-red-600 hover:bg-red-200"
                >
                  삭제
                </Button>
                <Button
                  variant="secondary"
                  onClick={onCloseEditModal}
                  disabled={editingImageLoading}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={onSaveEditImage}
                  disabled={editingImageLoading || !editImageName.trim()}
                  loading={editingImageLoading}
                  className="flex-1"
                >
                  {editingImageLoading ? "Save 중..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 검색 모달 */}
      {showImageSearchModal && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                생성된 이미지에서 선택
              </h3>
              <button
                onClick={onCloseImageSearchModal}
                className="text-gray-400 hover:text-black text-xl bg-transparent border-none p-0 cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="이미지 이름으로 검색..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent"
                onChange={(e) => {
                  // 검색 기능은 나중에 구현
                }}
              />
            </div>

            {loadingGeneratedImages ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-light mx-auto mb-4"></div>
                <div className="text-gray-500">이미지를 불러오는 중...</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-h-96 overflow-y-auto">
                {generatedImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative group cursor-pointer border border-gray-200 rounded-lg overflow-hidden hover:border-primary-light transition-colors"
                    onClick={() => {
                      onSelectImageFromSearch?.(image);
                      setInputImageUrl(image.url); // 이미지 URL 입력 필드에도 URL 설정
                      onCloseImageSearchModal?.();
                    }}
                  >
                    <div className="aspect-square relative">
                      <img
                        src={image.url || undefined}
                        alt={image.title}
                        className="w-full h-full object-cover"
                        onError={() => onImageError(image.url)}
                        onLoad={() => onImageLoad(image.url)}
                      />
                      <div className="absolute inset-0 transition-all duration-200 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="bg-white text-black px-3 py-1 rounded-full text-sm font-medium">
                            선택
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-gray-700 truncate">
                        {image.title}
                      </p>
                      {image.characterName && (
                        <p className="text-xs text-gray-500 truncate">
                          {image.characterName}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingGeneratedImages && generatedImages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                생성된 이미지가 없습니다.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
