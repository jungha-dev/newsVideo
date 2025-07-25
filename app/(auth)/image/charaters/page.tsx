// pages/index.tsx
"use client";

/**
 * 만화 생성 페이지
 *
 * Firebase Storage URL CORS 이슈 해결:
 * - Firebase Storage URL에는 ?alt=media 파라미터가 필요합니다
 * - ensureFirebaseUrl() 함수로 자동 수정
 * - URL 접근성 테스트 기능 포함
 *
 * 주요 기능:
 * - 이미지 이미지 업로드 및 관리
 * - Firebase Storage URL 자동 수정
 * - 만화 패널 생성 (1-4컷)
 * - Replicate API 연동
 * - 사용자별 이미지 관리 (로그인 필요)
 */

import React, { useState, useEffect, useRef } from "react";
import { ref, deleteObject } from "firebase/storage";
import { Timestamp, deleteDoc, doc } from "firebase/firestore";
import { storage, db } from "../../../../lib/firebase";
import { useAuth } from "../../../../contexts/AuthContext";
import CharacterSelector from "./components/CharacterSelector";
import CategoryManager from "./components/CategoryManager";
import PromptInput from "./components/PromptInput";
import {
  Button,
  Select,
  Input,
  Textarea,
  Range,
  PageLayout,
} from "../../../../components/styled";

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

// 카테고리 인터페이스 추가
interface Category {
  id: string;
  name: string;
  description?: string;
  previewImage?: string;
  createdAt: any; // Firestore Timestamp 또는 Date
  updatedAt: any; // Firestore Timestamp 또는 Date
  order?: number; // 순서를 위한 필드
}

// Firebase Storage URL을 올바른 형식으로 변환하는 유틸리티 함수
const ensureFirebaseUrl = (url: string): string => {
  // URL이 비어있거나 null인 경우 처리
  if (!url || typeof url !== "string") {
    console.warn("Invalid URL provided to ensureFirebaseUrl:", url);
    return url;
  }

  // Firebase Storage URL 패턴 확인
  if (url.includes("firebasestorage.googleapis.com")) {
    // 이미 ?alt=media가 포함되어 있는지 확인
    if (url.includes("?alt=media")) {
      return url;
    }

    // 기존 쿼리 파라미터가 있는지 확인
    const separator = url.includes("?") ? "&" : "?";
    const correctedUrl = `${url}${separator}alt=media`;

    return correctedUrl;
  }

  return url;
};

// 강제 URL 수정 함수 (더 공격적)
const forceFirebaseUrl = (url: string): string => {
  if (!url || typeof url !== "string") {
    console.warn("Invalid URL provided to forceFirebaseUrl:", url);
    return url;
  }

  // Firebase Storage URL인지 확인
  if (url.includes("firebasestorage.googleapis.com")) {
    // 이미 ?alt=media가 있으면 그대로 반환
    if (url.includes("?alt=media")) {
      return url;
    }

    // 강제로 ?alt=media 추가
    const separator = url.includes("?") ? "&" : "?";
    const forcedUrl = `${url}${separator}alt=media`;

    return forcedUrl;
  }

  return url;
};

// 이미지 URL이 접근 가능한지 테스트하는 함수
const testImageUrl = async (url: string): Promise<boolean> => {
  try {
    // HEAD 요청으로 테스트 (credentials 제거)
    const response = await fetch(url, {
      method: "HEAD",
      mode: "no-cors", // CORS 에러를 방지하기 위해 no-cors 모드 사용
    });

    // no-cors 모드에서는 response.ok를 확인할 수 없으므로
    // 에러가 발생하지 않으면 성공으로 간주
    return true;
  } catch (error) {
    console.warn("Image URL test failed:", {
      url,
      error: error instanceof Error ? error.message : error,
    });

    return false;
  }
};

// URL 수정 테스트 함수 (디버깅용)
const testUrlCorrection = () => {
  const testUrls = [
    "https://firebasestorage.googleapis.com/v0/b/bucket/o/path/image.png",
    "https://firebasestorage.googleapis.com/v0/b/bucket/o/path/image.png?alt=media",
    "https://firebasestorage.googleapis.com/v0/b/bucket/o/path/image.png?other=param",
    "https://example.com/image.png",
  ];

  testUrls.forEach((url) => {
    const corrected = ensureFirebaseUrl(url);
    // 테스트 결과는 필요시에만 출력
  });
};

// 전역에서 테스트 함수 사용 가능하도록 설정
if (typeof window !== "undefined") {
  (window as any).testUrlCorrection = testUrlCorrection;
  (window as any).ensureFirebaseUrl = ensureFirebaseUrl;
  (window as any).forceFirebaseUrl = forceFirebaseUrl;
}

export default function HomePage() {
  const { user, loading: authLoading, approved } = useAuth();
  const [prompt, setPrompt] = useState("Using this style,");
  const [imageUrl, setImageUrl] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [outputFormat, setOutputFormat] = useState("png");
  const [seed, setSeed] = useState("");
  const [safetyTolerance, setSafetyTolerance] = useState(2);
  const [resultImage, setResultImage] = useState("");
  const [loading, setLoading] = useState(false);

  // 파이어베이스 이미지 관련 상태
  const [firebaseImages, setFirebaseImages] = useState<FirebaseImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [apiError, setApiError] = useState<string>("");

  // 업로드 관련 상태
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string>("");
  const [uploadSuccess, setUploadSuccess] = useState<string>("");
  const [characterName, setCharacterName] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 선택된 이미지 정보
  const [selectedImageInfo, setSelectedImageInfo] =
    useState<FirebaseImage | null>(null);

  // 삭제 관련 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState(false);
  const [characterToDelete, setCharacterToDelete] =
    useState<FirebaseImage | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 이미지 추가 관련 상태
  const [showAddCharacter, setShowAddCharacter] = useState(false);

  // 편집 드롭다운 메뉴 상태
  const [editingCharacter, setEditingCharacter] =
    useState<FirebaseImage | null>(null);
  const [showEditDropdown, setShowEditDropdown] = useState<string | null>(null);
  const [editingCharacterName, setEditingCharacterName] = useState("");
  const [editingCharacterCategory, setEditingCharacterCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // 이미지 편집 모달 관련 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingImage, setEditingImage] = useState<FirebaseImage | null>(null);
  const [editImageName, setEditImageName] = useState("");
  const [editImageCategory, setEditImageCategory] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editingImageLoading, setEditingImageLoading] = useState(false);

  // 카테고리 관련 상태
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [characterCategory, setCharacterCategory] = useState("uncategorized");
  const [availableCategories, setAvailableCategories] = useState<string[]>([
    "uncategorized",
  ]);

  // 카테고리 추가 관련 상태
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState<File | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const categoryImageInputRef = useRef<HTMLInputElement>(null);

  // 카테고리 관리 관련 상태
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // 고급 옵션 표시 상태
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // 이미지 확대 모달 상태
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageForModal, setSelectedImageForModal] =
    useState<FirebaseImage | null>(null);

  // 이미지 검색 모달 상태
  const [showImageSearchModal, setShowImageSearchModal] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [loadingGeneratedImages, setLoadingGeneratedImages] = useState(false);

  // 4컷 만화 생성 모드 상태
  const [panel1, setPanel1] = useState("");
  const [panel2, setPanel2] = useState("");
  const [panel3, setPanel3] = useState("");
  const [panel4, setPanel4] = useState("");

  // 만화 생성 모드 상태
  const [comicMode, setComicMode] = useState("1"); // "1", "2", "3", "4"
  const [comicLayout, setComicLayout] = useState("horizontal"); // "horizontal", "vertical", "grid"

  // 멀티 이미지 생성 모드 관련 상태
  const [activeTab, setActiveTab] = useState<"character" | "interior">(
    "character"
  );
  const [selectedCharacters, setSelectedCharacters] = useState<FirebaseImage[]>(
    []
  );
  const [interiorPrompt, setInteriorPrompt] = useState("");
  const [interiorResolution, setInteriorResolution] = useState("720p");
  const [interiorAspectRatio, setInteriorAspectRatio] = useState("16:9");
  const [interiorSeed, setInteriorSeed] = useState<number | null>(null);
  const [generatingInterior, setGeneratingInterior] = useState(false);
  const [generatedInteriorImage, setGeneratedInteriorImage] = useState<
    string | null
  >(null);
  const [interiorCategory, setInteriorCategory] = useState<string>("");

  // 다중 이미지 생성 모드 관련 상태
  const [interiorComicMode, setInteriorComicMode] = useState("1"); // "1", "2", "4"
  const [interiorComicLayout, setInteriorComicLayout] = useState("horizontal"); // "horizontal", "vertical", "grid"
  const [interiorPanel1, setInteriorPanel1] = useState("");
  const [interiorPanel2, setInteriorPanel2] = useState("");
  const [interiorPanel3, setInteriorPanel3] = useState("");
  const [interiorPanel4, setInteriorPanel4] = useState("");

  // 저장 관련 상태
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [savingImage, setSavingImage] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // 로그인 상태 확인
  const isAuthenticated = user && approved;

  // 링크 입력 관련 상태
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [isOptionsCollapsed, setIsOptionsCollapsed] = useState(true);

  // 이미지 URL이 변경될 때 자동으로 미리보기 활성화
  useEffect(() => {
    if (imageUrl && imageUrl.trim()) {
      // 이미지 URL이 설정되면 자동으로 미리보기가 표시됨
      console.log("이미지 URL이 설정되어 미리보기가 활성화됩니다:", imageUrl);
    }
  }, [imageUrl]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showAddCharacter) {
        handleCancelAddCharacter();
      }
    };

    if (showAddCharacter) {
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [showAddCharacter]);

  // 카테고리 목록 가져오기
  const fetchCategories = async () => {
    if (!user) return;

    try {
      setLoadingCategories(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/categories", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        throw new Error(`카테고리를 불러올 수 없습니다. (${response.status})`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "카테고리 데이터를 불러올 수 없습니다.");
      }

      // 중복 제거된 카테고리 이름 배열 생성
      const uniqueCategories = Array.from(
        new Set(data.categories.map((cat: Category) => cat.name))
      ) as string[];

      setAvailableCategories(uniqueCategories);
      setCategoryList(data.categories); // 카테고리 객체 배열 저장
    } catch (error) {
      console.error("카테고리 불러오기 오류:", error);
      setApiError(
        error instanceof Error
          ? error.message
          : "카테고리를 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingCategories(false);
    }
  };

  // 파이어베이스 이미지 가져오기
  const fetchFirebaseImages = async () => {
    // 로그인하지 않은 경우 API 호출하지 않음
    if (!isAuthenticated) {
      setFirebaseImages([]);
      return;
    }

    setLoadingImages(true);
    setApiError("");
    try {
      // 사용자 토큰 가져오기
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("인증 토큰을 가져올 수 없습니다.");
      }

      // API를 통해 이미지 정보 가져오기 (서버 사이드에서 signed URL 생성)
      const url =
        selectedCategory === "all"
          ? "/api/firebase-images"
          : `/api/firebase-images?category=${encodeURIComponent(
              selectedCategory
            )}`;

      const response = await fetch(url, {
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

      // API에서 받은 데이터를 상태에 설정
      setFirebaseImages(data.characters || []);
    } catch (error) {
      console.error("Error fetching characters via API:", error);

      // 더 자세한 오류 정보 표시
      let errorMessage = "이미지 정보를 불러오는데 실패했습니다.";

      if (error instanceof Error) {
        if (error.message.includes("401")) {
          errorMessage = "로그인이 필요합니다. 다시 로그인해주세요.";
        } else if (error.message.includes("500")) {
          errorMessage = "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
        } else if (error.message.includes("NetworkError")) {
          errorMessage = "네트워크 연결을 확인해주세요.";
        } else {
          errorMessage = `오류: ${error.message}`;
        }
      }

      setApiError(errorMessage);
    } finally {
      setLoadingImages(false);
    }
  };

  // 파일 업로드 처리
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 로그인 확인
    if (!isAuthenticated) {
      setUploadError("로그인이 필요합니다.");
      return;
    }

    // 파일 타입 검증
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      setUploadError(
        "지원하지 않는 파일 형식입니다. PNG, JPEG, GIF, WebP만 가능합니다."
      );
      return;
    }

    // 파일 크기 검증 (10MB 제한)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError("파일 크기가 너무 큽니다. 최대 10MB까지 가능합니다.");
      return;
    }

    setSelectedFile(file);
    setUploadError("");
  };

  // 저장 버튼 클릭 시 업로드 실행
  const handleSaveCharacter = async () => {
    if (!isAuthenticated) {
      setUploadError("로그인이 필요합니다.");
      return;
    }

    if (!selectedFile) {
      setUploadError("파일을 선택해주세요.");
      return;
    }

    if (!characterName.trim()) {
      setUploadError("이미지 이름을 입력해주세요.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadSuccess("");

    try {
      // FormData를 사용하여 API로 업로드
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("characterName", characterName.trim());
      formData.append("category", characterCategory);

      // 사용자 토큰 가져오기
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("인증 토큰을 가져올 수 없습니다.");
      }

      // 업로드 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // API를 통해 업로드
      const response = await fetch("/api/firebase-images", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "업로드에 실패했습니다.");
      }

      const result = await response.json();

      setUploadSuccess(
        `이미지 "${characterName}"이(가) 성공적으로 업로드되었습니다!`
      );

      // 폼 초기화
      setCharacterName("");
      setCharacterCategory("uncategorized");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // 업로드 성공 후 이미지 목록 새로고침
      setTimeout(() => {
        fetchFirebaseImages();
        setUploadProgress(0);
        setUploadSuccess("");
        setShowAddCharacter(false); // 폼 닫기
      }, 2000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(
        error instanceof Error
          ? error.message
          : "업로드 중 오류가 발생했습니다."
      );
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // 이미지 클릭 시 URL 자동 입력
  const handleImageClick = (image: FirebaseImage) => {
    // 강제로 ?alt=media 추가 (Firebase Storage URL인 경우)
    let finalUrl = forceFirebaseUrl(image.url);

    // 수정된 URL로 설정
    setImageUrl(finalUrl);
    setSelectedImageInfo(image);
  };

  // 이미지 로딩 에러 처리
  const handleImageError = (imageUrl: string) => {
    console.error("=== Image Load Error ===");
    console.error("Failed to load image:", {
      url: imageUrl,
      hasAltMedia: imageUrl.includes("?alt=media"),
      isFirebase: imageUrl.includes("firebasestorage.googleapis.com"),
    });

    // URL이 Firebase Storage URL인데 ?alt=media가 없으면 경고
    if (
      imageUrl.includes("firebasestorage.googleapis.com") &&
      !imageUrl.includes("?alt=media")
    ) {
      console.warn("CORS Error likely due to missing ?alt=media parameter");
      console.warn("Corrected URL would be:", ensureFirebaseUrl(imageUrl));
    }

    setImageErrors((prev) => new Set(prev).add(imageUrl));
  };

  // 이미지 로딩 성공 처리
  const handleImageLoad = (imageUrl: string) => {
    setImageErrors((prev) => {
      const newSet = new Set(prev);
      newSet.delete(imageUrl);
      return newSet;
    });
  };

  // 컴포넌트 마운트 시 이미지 이미지 자동 로드
  useEffect(() => {
    if (isAuthenticated) {
      fetchFirebaseImages();
      fetchCategories(); // 카테고리 목록도 함께 가져오기
    }
  }, [isAuthenticated, selectedCategory]);

  // 사용자 인증 상태 변경 시 카테고리 목록 새로고침
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchCategories();
    }
  }, [user, isAuthenticated]);

  // 카테고리 변경 시 이미지 다시 불러오기
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchFirebaseImages();
    }
  }, [selectedCategory]); // 카테고리가 변경될 때마다 실행

  // 배포 환경에서도 URL 수정을 강제하기 위한 추가 useEffect
  useEffect(() => {
    // 모든 Firebase Storage URL을 강제로 수정하는 함수
    const forceCorrectAllUrls = () => {
      // 모든 img 태그를 찾아서 Firebase Storage URL 수정
      const images = document.querySelectorAll("img");
      images.forEach((img, index) => {
        const originalSrc = img.src;
        if (
          originalSrc.includes("firebasestorage.googleapis.com") &&
          !originalSrc.includes("?alt=media")
        ) {
          const correctedSrc = forceFirebaseUrl(originalSrc);
          if (originalSrc !== correctedSrc) {
            img.src = correctedSrc;
          }
        }
      });
    };

    // MutationObserver를 사용하여 DOM 변경을 감지하고 URL 수정
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // 새로 추가된 img 태그들 확인
              const images: HTMLImageElement[] = [];

              // element가 img 태그인 경우
              if (element.tagName === "IMG") {
                images.push(element as HTMLImageElement);
              }

              // element 내부의 img 태그들 확인
              if (element.querySelectorAll) {
                const childImages = element.querySelectorAll("img");
                childImages.forEach((img) => images.push(img));
              }

              images.forEach((img) => {
                const originalSrc = img.src;
                if (
                  originalSrc.includes("firebasestorage.googleapis.com") &&
                  !originalSrc.includes("?alt=media")
                ) {
                  const correctedSrc = forceFirebaseUrl(originalSrc);
                  if (originalSrc !== correctedSrc) {
                    img.src = correctedSrc;
                  }
                }
              });
            }
          });
        }
      });
    });

    // DOM 변경 감지 시작
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 컴포넌트가 마운트된 후 URL 수정 실행
    const timer = setTimeout(() => {
      forceCorrectAllUrls();
    }, 1000);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [firebaseImages]); // firebaseImages가 변경될 때마다 실행

  const handleGenerate = async () => {
    if (!imageUrl) return alert("이미지 URL이 필요합니다.");

    let finalPrompt = prompt;

    // 만화 모드인 경우 패널들을 조합
    if (comicMode !== "0") {
      const comicPrompt = combineComicPanels();
      if (!comicPrompt) return;
      finalPrompt = comicPrompt;
    } else {
      if (!prompt) return alert("프롬프트가 필요합니다.");
    }

    setLoading(true);

    try {
      // 강제로 ?alt=media 추가 (Firebase Storage URL인 경우)
      let finalImageUrl = forceFirebaseUrl(imageUrl);

      // 이미지 URL 테스트는 제거 - API에서 처리하도록 함
      // const isAccessible = await testImageUrl(finalImageUrl);
      // if (!isAccessible) {
      //   console.warn(
      //     "Image URL is not accessible, but proceeding with API call..."
      //   );
      // }

      const requestBody: any = {
        prompt: finalPrompt,
        imageUrl: finalImageUrl,
        aspectRatio,
        outputFormat,
        safetyTolerance,
      };

      // seed가 입력된 경우에만 추가
      if (seed.trim()) {
        requestBody.seed = parseInt(seed);
      }

      const res = await fetch("/api/replicateImage/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
        return;
      }

      setResultImage(data.imageUrl);
    } catch (err) {
      console.error("Fetch error:", err);
      alert("Failed to generate image");
    } finally {
      setLoading(false);
    }
  };

  // 이미지 삭제 처리
  const handleDeleteCharacter = (
    image: FirebaseImage,
    event: React.MouseEvent
  ) => {
    event.stopPropagation(); // 이미지 클릭 이벤트 방지
    setCharacterToDelete(image);
    setShowDeleteConfirm(true);
  };

  // 첫 번째 삭제 확인
  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    setShowFinalDeleteConfirm(true);
  };

  // 최종 삭제 실행
  const executeDelete = async () => {
    if (!characterToDelete || !user) return;

    setDeleting(true);
    setShowFinalDeleteConfirm(false);

    try {
      // 1. Firestore에서 문서 삭제 (새로운 구조: users/{uid}/characters/{id})
      const docRef = doc(
        db,
        "users",
        user.uid,
        "characters",
        characterToDelete.id
      );
      await deleteDoc(docRef);

      // 2. Firebase Storage에서 이미지 파일 삭제
      const storageRef = ref(storage, characterToDelete.name);
      await deleteObject(storageRef);

      // 3. 선택된 이미지가 삭제된 이미지인 경우 선택 해제
      if (selectedImageInfo?.id === characterToDelete.id) {
        setSelectedImageInfo(null);
        setImageUrl("");
      }

      // 4. 이미지 목록 새로고침
      await fetchFirebaseImages();
    } catch (error) {
      console.error("Error deleting character:", error);
      alert("이미지 삭제 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setDeleting(false);
      setCharacterToDelete(null);
    }
  };

  // 삭제 취소
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setShowFinalDeleteConfirm(false);
    setCharacterToDelete(null);
  };

  // 이미지 추가 버튼 클릭
  const handleAddCharacterClick = () => {
    if (showAddCharacter) {
      // 이미 열려있으면 닫기
      handleCancelAddCharacter();
    } else {
      // 닫혀있으면 열기
      setShowAddCharacter(true);
      // 폼 초기화
      setCharacterName("");
      setSelectedFile(null);
      setUploadError("");
      setUploadSuccess("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 이미지 추가 취소
  const handleCancelAddCharacter = () => {
    setShowAddCharacter(false);
    setCharacterName("");
    setCharacterCategory("uncategorized");
    setSelectedFile(null);
    setUploadError("");
    setUploadSuccess("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 이미지 확대 모달 열기
  const handleOpenImageModal = (
    image: FirebaseImage,
    event: React.MouseEvent
  ) => {
    event.stopPropagation(); // 이미지 클릭 이벤트 방지
    setSelectedImageForModal(image);
    setShowImageModal(true);
  };

  // 이미지 확대 모달 닫기
  const handleCloseImageModal = () => {
    setShowImageModal(false);
    setSelectedImageForModal(null);
  };

  // 만화 프롬프트 조합
  const combineComicPanels = () => {
    const panels = [panel1, panel2, panel3, panel4].slice(
      0,
      parseInt(comicMode)
    );

    // 모든 패널이 입력되었는지 확인
    if (panels.some((panel) => !panel.trim())) {
      alert(`모든 ${comicMode}개 패널을 입력해주세요.`);
      return null;
    }

    // 1컷인 경우 레이아웃 프리픽스 제거
    if (comicMode === "1") {
      return panels[0];
    }

    let layoutText = "";
    switch (comicLayout) {
      case "horizontal":
        layoutText = "horizontal layout";
        break;
      case "vertical":
        layoutText = "vertical layout";
        break;
      case "grid":
        layoutText = "grid layout";
        break;
      default:
        layoutText = "horizontal layout";
    }

    const panelTexts = panels
      .map((panel, index) => {
        const panelNumber = index + 1;
        const suffix =
          panelNumber === 1
            ? "st"
            : panelNumber === 2
            ? "nd"
            : panelNumber === 3
            ? "rd"
            : "th";
        return `${panelNumber}${suffix} panel: ${panel}`;
      })
      .join(". ");

    return `${comicMode}-panel ${layoutText} .${panelTexts}`;
  };

  // 만화 프롬프트 조합 (미리보기용 - 알림 없음)
  const combineComicPanelsForPreview = () => {
    const panels = [panel1, panel2, panel3, panel4].slice(
      0,
      parseInt(comicMode)
    );

    // 모든 패널이 입력되었는지 확인
    if (panels.some((panel) => !panel.trim())) {
      return null;
    }

    // 1컷인 경우 레이아웃 프리픽스 제거
    if (comicMode === "1") {
      return panels[0];
    }

    let layoutText = "";
    switch (comicLayout) {
      case "horizontal":
        layoutText = "horizontal layout";
        break;
      case "vertical":
        layoutText = "vertical layout";
        break;
      case "grid":
        layoutText = "grid layout";
        break;
      default:
        layoutText = "horizontal layout";
    }

    const panelTexts = panels
      .map((panel, index) => {
        const panelNumber = index + 1;
        const suffix =
          panelNumber === 1
            ? "st"
            : panelNumber === 2
            ? "nd"
            : panelNumber === 3
            ? "rd"
            : "th";
        return `${panelNumber}${suffix} panel: ${panel}`;
      })
      .join(". ");

    return `A ${comicMode}-panel ${layoutText} .${panelTexts}`;
  };

  // 편집 드롭다운 토글
  const toggleEditDropdown = (characterId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setShowEditDropdown(showEditDropdown === characterId ? null : characterId);
  };

  // 이미지 이름 수정 시작
  const startEditCharacter = (
    character: FirebaseImage,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    setEditingCharacter(character);
    setEditingCharacterName(character.characterName);
    setEditingCharacterCategory(character.category || "uncategorized");
    setShowEditDropdown(null);
  };

  // 이미지 이름 수정 저장
  const saveEditCharacter = async () => {
    if (!editingCharacter || !editingCharacterName.trim() || !user) return;

    setSavingEdit(true);
    try {
      // 사용자 토큰 가져오기
      const token = await user.getIdToken();

      const response = await fetch(
        `/api/firebase-images/${editingCharacter.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            characterName: editingCharacterName.trim(),
            category: editingCharacterCategory,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();

        // 성공적으로 수정된 경우 이미지 목록 새로고침
        await fetchFirebaseImages();
        setEditingCharacter(null);
        setEditingCharacterName("");
        setEditingCharacterCategory("uncategorized");
      } else {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        console.error(
          "Failed to update character name - status:",
          response.status
        );
      }
    } catch (error) {
      console.error("Error updating character name:", error);
    } finally {
      setSavingEdit(false);
    }
  };

  // 이미지 이름 수정 취소
  const cancelEditCharacter = () => {
    setEditingCharacter(null);
    setEditingCharacterName("");
    setEditingCharacterCategory("uncategorized");
  };

  // 이미지 편집 모달 관련 핸들러
  const handleOpenEditModal = (image: FirebaseImage) => {
    setEditingImage(image);
    setEditImageName(image.characterName);
    setEditImageCategory(image.category || "uncategorized");
    setEditImageFile(null);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingImage(null);
    setEditImageName("");
    setEditImageCategory("");
    setEditImageFile(null);
  };

  const handleEditImageNameChange = (name: string) => {
    setEditImageName(name);
  };

  const handleEditImageCategoryChange = (category: string) => {
    setEditImageCategory(category);
  };

  const handleEditImageFileChange = (file: File | File[] | null) => {
    if (Array.isArray(file)) {
      setEditImageFile(file[0] || null);
    } else {
      setEditImageFile(file);
    }
  };

  const handleSaveEditImage = async () => {
    if (!editingImage || !editImageName.trim()) return;

    setEditingImageLoading(true);
    try {
      // 사용자 토큰 가져오기
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("인증 토큰을 가져올 수 없습니다.");
      }

      // FormData를 사용하여 API로 업로드
      const formData = new FormData();
      formData.append("imageId", editingImage.id);
      formData.append("characterName", editImageName.trim());
      formData.append("category", editImageCategory);

      if (editImageFile) {
        formData.append("newImage", editImageFile);
      }

      // API를 통해 이미지 업데이트
      const response = await fetch(`/api/firebase-images/${editingImage.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `API request failed: ${response.status}`
        );
      }

      const result = await response.json();

      // 로컬 상태 업데이트
      setFirebaseImages((prev) =>
        prev.map((img) =>
          img.id === editingImage.id
            ? {
                ...img,
                characterName: editImageName.trim(),
                category: editImageCategory,
                url: result.url || img.url, // API에서 새 URL을 반환한 경우
              }
            : img
        )
      );

      handleCloseEditModal();
    } catch (error) {
      console.error("이미지 편집 오류:", error);
      console.error("오류 상세:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        editingImage: editingImage?.id,
        editImageName,
        editImageCategory,
        hasNewFile: !!editImageFile,
      });
      alert(
        `이미지 편집 중 오류가 발생했습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setEditingImageLoading(false);
    }
  };

  const handleDeleteEditImage = async () => {
    if (!editingImage) return;

    if (!confirm("정말로 이 이미지를 삭제하시겠습니까?")) {
      return;
    }

    setEditingImageLoading(true);
    try {
      // 사용자 토큰 가져오기
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("인증 토큰을 가져올 수 없습니다.");
      }

      // API를 통해 이미지 삭제
      const response = await fetch(`/api/firebase-images/${editingImage.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `삭제 실패: ${response.status}`);
      }

      const result = await response.json();

      // 로컬 상태에서 제거
      setFirebaseImages((prev) =>
        prev.filter((img) => img.id !== editingImage.id)
      );

      handleCloseEditModal();
    } catch (error) {
      console.error("이미지 삭제 오류:", error);
      alert(
        `이미지 삭제 중 오류가 발생했습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setEditingImageLoading(false);
    }
  };

  // 편집 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEditDropdown) {
        // 약간의 지연을 두어 버튼 클릭이 처리될 시간을 줍니다
        setTimeout(() => {
          setShowEditDropdown(null);
        }, 100);
      }
    };

    if (showEditDropdown) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showEditDropdown]);

  // 카테고리 추가 함수 (기존 모달용)
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryError("카테고리 이름을 입력해주세요.");
      return;
    }

    if (availableCategories.includes(newCategoryName.trim())) {
      setCategoryError("이미 존재하는 카테고리입니다.");
      return;
    }

    setAddingCategory(true);
    setCategoryError("");

    try {
      // 사용자 토큰 가져오기
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("인증 토큰을 가져올 수 없습니다.");
      }

      // FormData를 사용하여 API로 업로드
      const formData = new FormData();
      formData.append("name", newCategoryName.trim());
      formData.append("description", newCategoryDescription.trim());
      if (newCategoryImage) {
        formData.append("image", newCategoryImage);
      }

      // API를 통해 카테고리 추가
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "카테고리 추가에 실패했습니다.");
      }

      const result = await response.json();

      // 새 카테고리를 선택 상태로 설정
      setSelectedCategory(newCategoryName.trim());
      setCharacterCategory(newCategoryName.trim());

      // 카테고리 목록 새로고침
      await fetchCategories();

      // 모달 닫기
      setShowAddCategory(false);
      setNewCategoryName("");
      setNewCategoryDescription("");
      setNewCategoryImage(null);
      if (categoryImageInputRef.current) {
        categoryImageInputRef.current.value = "";
      }
    } catch (error) {
      console.error("카테고리 추가 중 오류:", error);
      setCategoryError(
        error instanceof Error
          ? error.message
          : "카테고리 추가 중 오류가 발생했습니다."
      );
    } finally {
      setAddingCategory(false);
    }
  };

  // 카테고리 추가 함수 (CategoryManager에서 사용)
  const handleAddCategoryForManager = async (
    name: string,
    description: string,
    image?: File
  ) => {
    if (!name.trim()) {
      throw new Error("카테고리 이름을 입력해주세요.");
    }

    if (availableCategories.includes(name.trim())) {
      throw new Error("이미 존재하는 카테고리입니다.");
    }

    try {
      // 사용자 토큰 가져오기
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("인증 토큰을 가져올 수 없습니다.");
      }

      // FormData를 사용하여 API로 업로드
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      if (image) {
        formData.append("image", image);
      }

      // API를 통해 카테고리 추가
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "카테고리 추가에 실패했습니다.");
      }

      const result = await response.json();

      // 카테고리 목록 새로고침
      await fetchCategories();
    } catch (error) {
      console.error("카테고리 추가 중 오류:", error);
      throw error;
    }
  };

  // 카테고리 추가 취소
  const handleCancelAddCategory = () => {
    setShowAddCategory(false);
    setNewCategoryName("");
    setNewCategoryDescription("");
    setNewCategoryImage(null);
    setCategoryError("");
    if (categoryImageInputRef.current) {
      categoryImageInputRef.current.value = "";
    }
  };

  // 카테고리 추가 버튼 클릭
  const handleAddCategoryClick = () => {
    setShowAddCategory(true);
    setNewCategoryName("");
    setNewCategoryDescription("");
    setNewCategoryImage(null);
    setCategoryError("");
    if (categoryImageInputRef.current) {
      categoryImageInputRef.current.value = "";
    }
  };

  // 카테고리 이미지 업로드 처리
  const handleCategoryImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      setCategoryError(
        "지원하지 않는 파일 형식입니다. PNG, JPEG, GIF, WebP만 가능합니다."
      );
      return;
    }

    // 파일 크기 검증 (5MB 제한)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setCategoryError("파일 크기가 너무 큽니다. 최대 5MB까지 가능합니다.");
      return;
    }

    setNewCategoryImage(file);
    setCategoryError("");
  };

  // 카테고리 수정 함수
  const handleUpdateCategory = async (
    categoryId: string,
    newName: string,
    newDescription: string,
    newImage?: File
  ) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();

      // FormData를 사용하여 이미지와 함께 업로드
      const formData = new FormData();
      formData.append("name", newName);
      formData.append("description", newDescription);
      if (newImage) {
        formData.append("image", newImage);
      }

      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`카테고리 수정 실패: ${errorData.error}`);
        return;
      }

      // 성공 시 카테고리 목록 새로고침
      await fetchCategories();
      alert("카테고리가 성공적으로 수정되었습니다.");
    } catch (error) {
      console.error("카테고리 수정 오류:", error);
      alert("카테고리 수정 중 오류가 발생했습니다.");
    }
  };

  // 카테고리 순서 변경 함수
  const handleReorderCategories = async (categories: Category[]) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();

      // 각 카테고리의 순서를 업데이트
      const updatePromises = categories.map((category) =>
        fetch(`/api/categories/${category.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            order: category.order,
          }),
        })
      );

      await Promise.all(updatePromises);

      // 성공 시 카테고리 목록 새로고침
      await fetchCategories();
    } catch (error) {
      console.error("카테고리 순서 변경 오류:", error);
      alert("카테고리 순서 변경 중 오류가 발생했습니다.");
    }
  };

  // 카테고리 삭제 함수 (기존 함수 수정)
  const handleDeleteCategory = async (categoryId: string) => {
    if (!user) return;

    const category = categoryList.find((cat) => cat.id === categoryId);
    if (!category) return;

    const confirmed = window.confirm(
      `"${category.name}" 카테고리를 삭제하시겠습니까?\n\n이 카테고리에 속한 모든 이미지는 "분류 없음"으로 이동됩니다.`
    );

    if (!confirmed) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`카테고리 삭제 실패: ${errorData.error}`);
        return;
      }

      // 성공 시 카테고리 목록과 이미지 목록 새로고침
      await Promise.all([fetchCategories(), fetchFirebaseImages()]);
      alert("카테고리가 성공적으로 삭제되었습니다.");
    } catch (error) {
      console.error("카테고리 삭제 오류:", error);
      alert("카테고리 삭제 중 오류가 발생했습니다.");
    }
  };

  // 멀티 이미지 생성 관련 핸들러 함수들
  const handleTabChange = (tab: "character" | "interior") => {
    setActiveTab(tab);
    if (tab === "interior") {
      setSelectedCharacters([]);
      setInteriorPrompt("");
      setGeneratedInteriorImage(null);
      setInteriorCategory("");
      setResultImage("");
      // 멀티 이미지 생성 탭에서도 캐릭터 추가 가능하도록 모달 상태는 유지
    } else if (tab === "character") {
      // 캐릭터 탭으로 돌아갈 때 모달 상태 초기화
      setShowAddCharacter(false);
    }
  };

  const handleCharacterSelection = (character: FirebaseImage) => {
    setSelectedCharacters((prev) => {
      const isSelected = prev.some((c) => c.id === character.id);
      if (isSelected) {
        return prev.filter((c) => c.id !== character.id);
      } else {
        return [...prev, character];
      }
    });
  };

  const handleGenerateInterior = async () => {
    if (!user || selectedCharacters.length === 0) {
      alert("캐릭터를 선택해주세요.");
      return;
    }

    // 씬별 프롬프트 조합
    const combinedPrompt = combineInteriorComicPanels();
    if (!combinedPrompt) {
      return; // combineInteriorComicPanels에서 이미 알림 표시됨
    }

    setGeneratingInterior(true);
    try {
      const input = {
        prompt: combinedPrompt,
        resolution: interiorResolution,
        aspect_ratio: interiorAspectRatio,
        reference_tags: selectedCharacters.map((char) => char.characterName),
        reference_images: selectedCharacters.map((char) => char.url),
        ...(interiorSeed && { seed: interiorSeed }),
      };

      const response = await fetch("/api/replicateImage/multiImage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        console.error(
          "API Response not OK:",
          response.status,
          response.statusText
        );
        const errorData = await response.json().catch(() => ({}));
        console.error("Error data:", errorData);
        throw new Error(
          errorData.error || `HTTP ${response.status}: Failed to generate image`
        );
      }

      const data = await response.json();

      // 생성된 이미지를 미리보기로 설정
      if (data.imageUrl) {
        setGeneratedInteriorImage(data.imageUrl);
        setResultImage(data.imageUrl);
      }
    } catch (error) {
      console.error("멀티 이미지 생성 생성 오류:", error);
      let errorMessage = "멀티 이미지 생성 생성 중 오류가 발생했습니다.";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        errorMessage = JSON.stringify(error);
      }

      console.error("상세 에러 정보:", error);
      alert(`멀티 이미지 생성 생성 실패: ${errorMessage}`);
    } finally {
      setGeneratingInterior(false);
    }
  };

  // 다중 이미지 씬별 프롬프트 조합
  const combineInteriorComicPanels = () => {
    const panels = [
      interiorPanel1,
      interiorPanel2,
      interiorPanel3,
      interiorPanel4,
    ].slice(0, parseInt(interiorComicMode));

    // 모든 패널이 입력되었는지 확인
    if (panels.some((panel) => !panel.trim())) {
      alert(`모든 ${interiorComicMode}개 씬을 입력해주세요.`);
      return null;
    }

    let layoutText = "";
    switch (interiorComicLayout) {
      case "horizontal":
        layoutText = "horizontal layout";
        break;
      case "vertical":
        layoutText = "vertical layout";
        break;
      case "grid":
        layoutText = "grid layout";
        break;
      default:
        layoutText = "horizontal layout";
    }

    const panelTexts = panels
      .map((panel, index) => {
        const panelNumber = index + 1;
        const suffix =
          panelNumber === 1
            ? "st"
            : panelNumber === 2
            ? "nd"
            : panelNumber === 3
            ? "rd"
            : "th";
        return `${panelNumber}${suffix} scene: ${panel}`;
      })
      .join(". ");

    return `${interiorComicMode}-scene ${layoutText} .${panelTexts}`;
  };

  // 단일 이미지 초기화 함수
  const handleClearCharacterSelection = () => {
    setPrompt("");
    setPanel1("");
    setPanel2("");
    setPanel3("");
    setPanel4("");
    setComicMode("1");
    setComicLayout("horizontal");
    setAspectRatio("1:1");
    setSeed("");
    setSafetyTolerance(2);
    setOutputFormat("png");
  };

  const handleClearInteriorSelection = () => {
    setSelectedCharacters([]);
    setInteriorPrompt("");
    setGeneratedInteriorImage(null);
    setInteriorCategory("");
    setResultImage("");
    setShowAddCharacter(false);
    // 다중 이미지 모드 상태도 초기화
    setInteriorComicMode("1");
    setInteriorComicLayout("horizontal");
    setInteriorPanel1("");
    setInteriorPanel2("");
    setInteriorPanel3("");
    setInteriorPanel4("");
  };

  // 저장 관련 함수들
  const handleSaveGeneratedImage = async () => {
    if (!resultImage) {
      setSaveError("저장할 이미지가 없습니다.");
      return;
    }

    // 제목이 없으면 자동으로 생성
    const finalTitle = saveTitle.trim() || `Generated_${Date.now()}`;

    setSavingImage(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      // 사용자 토큰 가져오기
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("인증 토큰을 가져올 수 없습니다.");
      }

      // 현재 사용된 프롬프트와 옵션 정보 수집
      let currentPrompt = "";
      let currentOptions: any = {};

      if (activeTab === "character") {
        if (comicMode === "0") {
          currentPrompt = prompt;
        } else {
          currentPrompt = combineComicPanels() || "";
        }
        currentOptions = {
          aspectRatio,
          outputFormat,
          seed: seed || null,
          safetyTolerance,
          comicMode,
          comicLayout,
          panel1,
          panel2,
          panel3,
          panel4,
        };
      } else {
        // interior 탭
        currentPrompt = combineInteriorComicPanels() || "";
        currentOptions = {
          resolution: interiorResolution,
          aspectRatio: interiorAspectRatio,
          seed: interiorSeed,
          comicMode: interiorComicMode,
          comicLayout: interiorComicLayout,
          panel1: interiorPanel1,
          panel2: interiorPanel2,
          panel3: interiorPanel3,
          panel4: interiorPanel4,
          selectedCharacters: selectedCharacters.map((char) => ({
            id: char.id,
            name: char.characterName,
            url: char.url,
          })),
        };
      }

      // API를 통해 이미지 저장
      const requestBody = {
        imageUrl: resultImage,
        title: finalTitle,
        prompt: currentPrompt,
        options: currentOptions,
        inputImageUrl: imageUrl, // 사용자가 입력한 이미지 링크
        characterName: selectedImageInfo?.characterName || "",
        // 사용된 이미지의 더 자세한 정보 추가
        usedImageInfo: selectedImageInfo
          ? {
              id: selectedImageInfo.id,
              name: selectedImageInfo.name,
              url: selectedImageInfo.url,
              characterName: selectedImageInfo.characterName,
              category: selectedImageInfo.category,
              uploadTime: selectedImageInfo.uploadTime,
              size: selectedImageInfo.size,
              contentType: selectedImageInfo.contentType,
            }
          : null,
        // 다중 선택된 이미지 정보 (interior 탭의 경우)
        usedImagesInfo:
          activeTab === "interior"
            ? selectedCharacters.map((char) => ({
                id: char.id,
                name: char.name,
                url: char.url,
                characterName: char.characterName,
                category: char.category,
                uploadTime: char.uploadTime,
                size: char.size,
                contentType: char.contentType,
              }))
            : [],
      };

      console.log("저장할 데이터:", requestBody);

      const response = await fetch("/api/firebase-images/generated", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "이미지 저장에 실패했습니다.");
      }

      const result = await response.json();

      setSaveSuccess("이미지가 성공적으로 저장되었습니다!");
      setSaveTitle("");

      // 2초 후 모달 닫기 및 성공 메시지 제거
      setTimeout(() => {
        setShowSaveModal(false);
        setSaveSuccess("");
      }, 2000);
    } catch (error) {
      console.error("이미지 저장 오류:", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "이미지 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSavingImage(false);
    }
  };

  const handleOpenSaveModal = () => {
    if (!resultImage) {
      alert("저장할 이미지가 없습니다.");
      return;
    }
    setShowSaveModal(true);
    setSaveTitle("");
    setSaveError("");
    setSaveSuccess("");
  };

  const handleCloseSaveModal = () => {
    setShowSaveModal(false);
    setSaveTitle("");
    setSaveError("");
    setSaveSuccess("");
  };

  // 링크 입력 처리 핸들러
  const handleImageUrlChange = (url: string) => {
    setInputImageUrl(url);
  };

  const handleImageUrlConfirm = () => {
    if (inputImageUrl.trim()) {
      console.log("이미지 URL 설정:", inputImageUrl.trim());
      setImageUrl(inputImageUrl.trim());
      setSelectedImageInfo(null); // 기존 선택된 이미지 정보 초기화
      setInputImageUrl(""); // 입력 필드 초기화
    }
  };

  // 이미지 검색 모달 관련 핸들러
  const handleShowImageSearchModal = () => {
    setShowImageSearchModal(true);
    fetchGeneratedImages(); // 모달을 열 때 생성된 이미지 목록 가져오기
  };

  const handleCloseImageSearchModal = () => {
    setShowImageSearchModal(false);
  };

  const handleSelectImageFromSearch = (image: any) => {
    setImageUrl(image.url);
    setSelectedImageInfo(null); // 생성된 이미지는 selectedImageInfo와 다른 구조
    setShowImageSearchModal(false);
  };

  // 생성된 이미지 목록 가져오기
  const fetchGeneratedImages = async () => {
    if (!isAuthenticated) {
      setGeneratedImages([]);
      return;
    }

    setLoadingGeneratedImages(true);

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
      setGeneratedImages([]);
    } finally {
      setLoadingGeneratedImages(false);
    }
  };

  return (
    <PageLayout
      title="캐릭터 생성"
      // subtitle="이미지를 업로드하여 영상을 생성하세요."
    >
      <div>
        {showCategoryManager && (
          <CategoryManager
            isOpen={showCategoryManager}
            onClose={() => setShowCategoryManager(false)}
            categories={categoryList}
            onDeleteCategory={handleDeleteCategory}
            onUpdateCategory={handleUpdateCategory}
            onAddCategory={handleAddCategoryForManager}
            onReorderCategories={handleReorderCategories}
            loading={loadingCategories}
          />
        )}
        {/* 인증 상태 확인 */}
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
                이미지 이미지를 관리하고 만화를 생성하려면 로그인해주세요.
              </p>
              <a href="/login" className="inline-block">
                <Button variant="primary">로그인하기</Button>
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* 탭 UI */}
            <div className="flex justify-between gap-2 mb-6">
              <div className="flex">
                <button
                  className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 transition-all duration-150 ${
                    activeTab === "character"
                      ? "border-black text-black bg-white"
                      : "border-transparent text-black"
                  }`}
                  onClick={() => handleTabChange("character")}
                >
                  단일 이미지
                </button>
                <button
                  className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 transition-all duration-150 ${
                    activeTab === "interior"
                      ? "border-black text-black bg-white"
                      : "border-transparent text-black"
                  }`}
                  onClick={() => handleTabChange("interior")}
                >
                  다중 이미지
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 왼쪽: 이미지 선택 및 설정 */}
              <div className="space-y-6">
                {/* 기존 캐릭터 기능 */}
                {activeTab === "character" && (
                  <>
                    <CharacterSelector
                      firebaseImages={firebaseImages}
                      loadingImages={loadingImages}
                      apiError={apiError}
                      selectedCategory={selectedCategory}
                      availableCategories={availableCategories}
                      categoryList={categoryList}
                      imageUrl={imageUrl}
                      selectedImageInfo={selectedImageInfo}
                      imageErrors={imageErrors}
                      showAddCharacter={showAddCharacter}
                      uploading={uploading}
                      editingCharacterId={editingCharacter?.id || null}
                      editingCharacterName={editingCharacterName}
                      savingEdit={savingEdit}
                      showEditDropdown={showEditDropdown}
                      characterName={characterName}
                      characterCategory={characterCategory}
                      selectedFile={selectedFile}
                      uploadProgress={uploadProgress}
                      uploadError={uploadError}
                      uploadSuccess={uploadSuccess}
                      onImageClick={handleImageClick}
                      onAddCharacterClick={handleAddCharacterClick}
                      onCategoryChange={setSelectedCategory}
                      onAddCategoryClick={handleAddCategoryClick}
                      onShowCategoryManager={() => setShowCategoryManager(true)}
                      onRetryFetch={fetchFirebaseImages}
                      onImageError={handleImageError}
                      onImageLoad={handleImageLoad}
                      onToggleEditDropdown={toggleEditDropdown}
                      onStartEditCharacter={startEditCharacter}
                      onSaveEditCharacter={saveEditCharacter}
                      onCancelEditCharacter={cancelEditCharacter}
                      onDeleteCharacter={handleDeleteCharacter}
                      onOpenImageModal={handleOpenImageModal}
                      onFileUpload={handleFileUpload}
                      onSaveCharacter={handleSaveCharacter}
                      onEditingCharacterNameChange={setEditingCharacterName}
                      onCharacterNameChange={setCharacterName}
                      onCharacterCategoryChange={setCharacterCategory}
                      onCancelAddCharacter={handleCancelAddCharacter}
                      // 이미지 편집 모달 관련 props
                      showEditModal={showEditModal}
                      editingImage={editingImage}
                      editImageName={editImageName}
                      editImageCategory={editImageCategory}
                      editImageFile={editImageFile}
                      editingImageLoading={editingImageLoading}
                      onOpenEditModal={handleOpenEditModal}
                      onCloseEditModal={handleCloseEditModal}
                      onEditImageNameChange={handleEditImageNameChange}
                      onEditImageCategoryChange={handleEditImageCategoryChange}
                      onEditImageFileChange={handleEditImageFileChange}
                      onSaveEditImage={handleSaveEditImage}
                      onDeleteEditImage={handleDeleteEditImage}
                      forceFirebaseUrl={forceFirebaseUrl}
                      // 링크 입력 관련 props
                      onImageUrlChange={handleImageUrlChange}
                      onImageUrlConfirm={handleImageUrlConfirm}
                      // 이미지 검색 모달 관련 props
                      showImageSearchModal={showImageSearchModal}
                      onShowImageSearchModal={handleShowImageSearchModal}
                      onCloseImageSearchModal={handleCloseImageSearchModal}
                      onSelectImageFromSearch={handleSelectImageFromSearch}
                      // 생성된 이미지 목록 관련 props
                      generatedImages={generatedImages}
                      loadingGeneratedImages={loadingGeneratedImages}
                    />
                  </>
                )}
                {/* 멀티 이미지 생성 다중선택/생성 UI */}
                {activeTab === "interior" && (
                  <div className="space-y-6">
                    {/* 멀티 이미지 생성 탭에서도 CharacterSelector의 카테고리 기능 사용 */}
                    <CharacterSelector
                      firebaseImages={firebaseImages}
                      loadingImages={loadingImages}
                      apiError={apiError}
                      selectedCategory={selectedCategory}
                      availableCategories={availableCategories}
                      categoryList={categoryList}
                      imageUrl={imageUrl}
                      selectedImageInfo={selectedImageInfo}
                      imageErrors={imageErrors}
                      showAddCharacter={showAddCharacter}
                      uploading={uploading}
                      editingCharacterId={editingCharacter?.id || null}
                      editingCharacterName={editingCharacterName}
                      savingEdit={savingEdit}
                      showEditDropdown={showEditDropdown}
                      characterName={characterName}
                      characterCategory={characterCategory}
                      selectedFile={selectedFile}
                      uploadProgress={uploadProgress}
                      uploadError={uploadError}
                      uploadSuccess={uploadSuccess}
                      // 다중 선택 관련 props
                      isMultiSelect={true}
                      selectedImages={selectedCharacters}
                      onMultiSelect={handleCharacterSelection}
                      onImageClick={handleImageClick}
                      onAddCharacterClick={handleAddCharacterClick}
                      onCategoryChange={setSelectedCategory}
                      onAddCategoryClick={handleAddCategoryClick}
                      onShowCategoryManager={() => setShowCategoryManager(true)}
                      onRetryFetch={fetchFirebaseImages}
                      onImageError={handleImageError}
                      onImageLoad={handleImageLoad}
                      onToggleEditDropdown={toggleEditDropdown}
                      onStartEditCharacter={startEditCharacter}
                      onSaveEditCharacter={saveEditCharacter}
                      onCancelEditCharacter={cancelEditCharacter}
                      onDeleteCharacter={handleDeleteCharacter}
                      onOpenImageModal={handleOpenImageModal}
                      onFileUpload={handleFileUpload}
                      onSaveCharacter={handleSaveCharacter}
                      onEditingCharacterNameChange={setEditingCharacterName}
                      onCharacterNameChange={setCharacterName}
                      onCharacterCategoryChange={setCharacterCategory}
                      onCancelAddCharacter={handleCancelAddCharacter}
                      // 이미지 편집 모달 관련 props
                      showEditModal={showEditModal}
                      editingImage={editingImage}
                      editImageName={editImageName}
                      editImageCategory={editImageCategory}
                      editImageFile={editImageFile}
                      editingImageLoading={editingImageLoading}
                      onOpenEditModal={handleOpenEditModal}
                      onCloseEditModal={handleCloseEditModal}
                      onEditImageNameChange={handleEditImageNameChange}
                      onEditImageCategoryChange={handleEditImageCategoryChange}
                      onEditImageFileChange={handleEditImageFileChange}
                      onSaveEditImage={handleSaveEditImage}
                      onDeleteEditImage={handleDeleteEditImage}
                      forceFirebaseUrl={forceFirebaseUrl}
                      // 링크 입력 관련 props
                      onImageUrlChange={handleImageUrlChange}
                      onImageUrlConfirm={handleImageUrlConfirm}
                    />

                    {/* 다중 이미지 생성 모드 설정 */}
                    <div className="grid grid-cols-4 gap-4">
                      <Select
                        value={interiorComicMode}
                        onChange={setInteriorComicMode}
                        options={[
                          { value: "1", label: "1컷" },
                          { value: "2", label: "2컷" },
                          { value: "4", label: "4컷" },
                        ]}
                      />
                      <Select
                        value={interiorComicLayout}
                        onChange={setInteriorComicLayout}
                        options={[
                          { value: "horizontal", label: "가로 배치" },
                          { value: "vertical", label: "세로 배치" },
                          { value: "grid", label: "격자 배치" },
                        ]}
                      />
                      <Select
                        value={interiorResolution}
                        onChange={setInteriorResolution}
                        options={[
                          { value: "720p", label: "720p" },
                          { value: "1080p", label: "1080p" },
                        ]}
                      />
                      <Select
                        value={interiorAspectRatio}
                        onChange={setInteriorAspectRatio}
                        options={[
                          { value: "16:9", label: "가로형 (16:9)" },
                          { value: "9:16", label: "세로형 (9:16)" },
                          { value: "4:3", label: "전통형 (4:3)" },
                          { value: "3:4", label: "세로 전통형 (3:4)" },
                          { value: "1:1", label: "정사각형 (1:1)" },
                          { value: "21:9", label: "울트라와이드 (21:9)" },
                        ]}
                      />
                    </div>

                    {/* 프롬프트 내용 입력 */}
                    <PromptInput
                      title="프롬프트 내용 입력"
                      panels={[
                        {
                          label: "1st 장면 설명",
                          value: interiorPanel1,
                          placeholder: "예: 침실에 두 명의 캐릭터가 있는 장면",
                          onChange: setInteriorPanel1,
                        },
                        {
                          label: "2nd 장면 설명",
                          value: interiorPanel2,
                          placeholder: "예: 거실에서 대화하는 장면",
                          onChange: setInteriorPanel2,
                        },
                        {
                          label: "3rd 장면 설명",
                          value: interiorPanel3,
                          placeholder: "예: 주방에서 식사하는 장면",
                          onChange: setInteriorPanel3,
                        },
                        {
                          label: "4th 장면 설명",
                          value: interiorPanel4,
                          placeholder: "예: 정원에서 산책하는 장면",
                          onChange: setInteriorPanel4,
                        },
                      ]}
                      onReset={handleClearInteriorSelection}
                      maxPanels={parseInt(interiorComicMode)}
                    />

                    <Button
                      variant="primary-full"
                      onClick={handleGenerateInterior}
                      disabled={
                        selectedCharacters.length === 0 ||
                        (parseInt(interiorComicMode) >= 1 &&
                          !interiorPanel1.trim()) ||
                        (parseInt(interiorComicMode) >= 2 &&
                          !interiorPanel2.trim()) ||
                        (parseInt(interiorComicMode) >= 3 &&
                          !interiorPanel3.trim()) ||
                        (parseInt(interiorComicMode) >= 4 &&
                          !interiorPanel4.trim())
                      }
                    >
                      {generatingInterior ? "생성 중..." : "확인"}
                    </Button>
                  </div>
                )}

                {/* 프롬프트 입력 섹션 */}
                {activeTab === "character" && (
                  <>
                    {comicMode === "0" && (
                      <Input
                        placeholder="프롬프트 (예: Make this a 90s cartoon)"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    )}
                    {comicMode !== "0" && (
                      <div className="space-y-4">
                        {/* 만화 모드 설정 */}
                        <div className="grid grid-cols-3 gap-4">
                          <Select
                            value={comicMode}
                            onChange={setComicMode}
                            options={[
                              { value: "1", label: "1컷" },
                              { value: "2", label: "2컷" },
                              { value: "4", label: "4컷" },
                            ]}
                          />
                          <Select
                            value={comicLayout}
                            onChange={setComicLayout}
                            options={[
                              { value: "horizontal", label: "가로 배치" },
                              { value: "vertical", label: "세로 배치" },
                              { value: "grid", label: "격자 배치" },
                            ]}
                          />
                          <Select
                            value={aspectRatio}
                            onChange={setAspectRatio}
                            options={[
                              {
                                value: "match_input_image",
                                label: "원본 이미지",
                              },
                              { value: "1:1", label: "정사각형 (1:1)" },
                              { value: "16:9", label: "가로형 (16:9)" },
                              { value: "9:16", label: "세로형 (9:16)" },
                              { value: "4:3", label: "전통형 (4:3)" },
                              { value: "3:4", label: "세로 전통형 (3:4)" },
                              { value: "3:2", label: "광고형 (3:2)" },
                              { value: "2:3", label: "세로 광고형 (2:3)" },
                              { value: "4:5", label: "인스타그램형 (4:5)" },
                              {
                                value: "5:4",
                                label: "세로 인스타그램형 (5:4)",
                              },
                              { value: "21:9", label: "울트라와이드 (21:9)" },
                              {
                                value: "9:21",
                                label: "세로 울트라와이드 (9:21)",
                              },
                              { value: "2:1", label: "와이드 (2:1)" },
                              { value: "1:2", label: "세로 와이드 (1:2)" },
                            ]}
                          />
                        </div>
                        {/* 패널 입력 */}
                        <PromptInput
                          title="프롬프트 내용 입력"
                          panels={[
                            {
                              label: "1st 장면 설명",
                              value: panel1,
                              placeholder:
                                "예: Change the background to a beach while keeping the person in the exact same position, scale, and pose. Maintain identical subject placement, camera angle, framing, and perspective. Only replace the environment around them",
                              onChange: setPanel1,
                            },
                            {
                              label: "2nd 장면 설명",
                              value: panel2,
                              placeholder:
                                "예: Using this style, a bunny, a dog and a cat are having a tea party seated around a small white table",
                              onChange: setPanel2,
                            },
                            {
                              label: "3rd 장면 설명",
                              value: panel3,
                              placeholder: "세 번째 장면 설명",
                              onChange: setPanel3,
                            },
                            {
                              label: "4th 장면 설명",
                              value: panel4,
                              placeholder:
                                "예: Using this style, a panda astronaut riding a unicorn",
                              onChange: setPanel4,
                            },
                          ]}
                          onReset={handleClearCharacterSelection}
                          maxPanels={parseInt(comicMode)}
                        />
                        {/* 조합된 프롬프트 미리보기 */}
                        {(panel1 || panel2 || panel3 || panel4) && (
                          <div className="p-3 bg-secondary-light border-1 border-black/5 rounded">
                            <h4 className="font-medium black mb-2">
                              생성될 프롬프트:
                            </h4>
                            <p className="text-sm -black">
                              {combineComicPanelsForPreview() ||
                                "모든 패널을 입력하면 여기에 조합된 프롬프트가 표시됩니다."}
                            </p>
                          </div>
                        )}
                        {/* 더보기 버튼 */}
                        <div className="text-center mt-[-20px] mb-[-10px]">
                          <Button
                            variant="normal"
                            onClick={() =>
                              setShowAdvancedOptions(!showAdvancedOptions)
                            }
                          >
                            {showAdvancedOptions
                              ? "간단히 보기"
                              : "상세 설정 더보기"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* 고급 옵션들 */}
                    {showAdvancedOptions && (
                      <div className="space-y-4 border-t border-secondary pt-8">
                        <div>
                          <Select
                            label="출력 형식 (Output Format)"
                            value={outputFormat}
                            onChange={setOutputFormat}
                            options={[
                              { value: "png", label: "PNG" },
                              { value: "jpg", label: "JPG" },
                            ]}
                          />
                        </div>

                        <div>
                          <Input
                            label="랜덤 시드 (선택사항) - 재현 가능한 생성용"
                            type="number"
                            placeholder="랜덤 시드 (선택사항)"
                            value={seed}
                            onChange={(e) => setSeed(e.target.value)}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            같은 시드값을 사용하면 동일한 결과를 얻을 수
                            있습니다
                          </p>
                        </div>

                        <Range
                          value={safetyTolerance}
                          onChange={setSafetyTolerance}
                          min={0}
                          max={6}
                          label="안전성 허용도 (Safety Tolerance)"
                          showValue={true}
                          valueLabel={`현재: ${safetyTolerance}`}
                          helperText="엄격 (0) - 관대 (6) | 입력 이미지 사용 시 최대 2까지 허용됩니다"
                        />
                      </div>
                    )}

                    <Button
                      variant="primary-full"
                      onClick={handleGenerate}
                      disabled={loading}
                    >
                      {loading ? "생성 중..." : "확인"}
                    </Button>
                  </>
                )}
              </div>

              {/* 오른쪽: 결과 이미지 */}
              <div className="space-y-6">
                <div className="sticky top-6">
                  <div className="bg-white rounded-xl border border-secondary p-4">
                    <div className="text-lg font-semibold mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {loading || generatingInterior ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            {activeTab === "interior"
                              ? "멀티 이미지 생성 생성 중..."
                              : "생성 중..."}
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-5 h-5 text-secondary"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {activeTab === "interior"
                              ? "다중으로 생성된 이미지"
                              : "생성된 이미지"}
                          </>
                        )}
                      </div>
                      {resultImage && !loading && !generatingInterior && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleOpenSaveModal}
                          className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                            />
                          </svg>
                          저장
                        </Button>
                      )}
                    </div>
                    {resultImage ? (
                      <img
                        src={resultImage}
                        alt="Generated"
                        className="w-full rounded-xl"
                      />
                    ) : (
                      <div className="border-2 border-dashed border-secondary bg-secondary-light rounded-xl p-8 text-center h-160 flex flex-col items-center justify-center">
                        <svg
                          className="w-12 h-12 text-secondary-dark mb-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <p className="text-secondary-dark text-sm">
                          {loading || generatingInterior
                            ? activeTab === "interior"
                              ? "멀티 이미지 생성 생성 중..."
                              : "이미지 생성 중..."
                            : activeTab === "interior"
                            ? "다중으로 생성된 이미지가 여기에 표시됩니다"
                            : "생성된 이미지가 여기에 표시됩니다"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 첫 번째 삭제 확인 모달 */}
            {showDeleteConfirm && characterToDelete && (
              <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-red-600 text-xl">⚠️</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      이미지 삭제
                    </h3>
                  </div>
                  <p className="text-gray-700 mb-6">
                    <strong>"{characterToDelete.characterName}"</strong>{" "}
                    이미지를 삭제하시겠습니까?
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button variant="normal" onClick={cancelDelete}>
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      onClick={confirmDelete}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 최종 삭제 확인 모달 */}
            {showFinalDeleteConfirm && characterToDelete && (
              <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-red-600 text-xl">🚨</span>
                    </div>
                    <h3 className="text-lg font-semibold text-red-600">
                      정말 삭제하시겠습니까?
                    </h3>
                  </div>
                  <div className="mb-6">
                    <p className="text-gray-700 mb-3">
                      <strong>"{characterToDelete.characterName}"</strong>{" "}
                      이미지를 완전히 삭제합니다.
                    </p>
                    <div className="bg-red-50 border-1 border-red-200 rounded-xl p-3">
                      <p className="text-red-700 text-sm">
                        ⚠️ <strong>되돌릴 수 없습니다!</strong>
                      </p>
                      <ul className="text-red-600 text-sm mt-2 space-y-1">
                        <li>• 이미지 파일이 영구적으로 삭제됩니다</li>
                        <li>• 이미지 정보가 데이터베이스에서 제거됩니다</li>
                        <li>• 이 작업은 취소할 수 없습니다</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button variant="normal" onClick={cancelDelete}>
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      onClick={executeDelete}
                      disabled={deleting}
                      loading={deleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleting ? "삭제 중..." : "정말 삭제"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 이미지 확대 모달 */}
            {showImageModal && selectedImageForModal && (
              <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
                  {/* 모달 헤더 */}
                  <div className="flex justify-between items-center p-4 border-b border-secondary bg-gray-50">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedImageForModal.characterName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        생성 날짜:{" "}
                        {selectedImageForModal.uploadTime
                          ?.toDate?.()
                          ?.toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }) || "날짜 없음"}
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
                  <div className="p-4 flex justify-center items-center">
                    <img
                      src={selectedImageForModal.url || undefined}
                      alt={selectedImageForModal.characterName}
                      className="max-w-full max-h-[70vh] object-contain rounded-xl "
                      onError={() => {
                        console.error(
                          "Image load error in modal for:",
                          selectedImageForModal.url
                        );
                      }}
                    />
                  </div>

                  {/* 모달 푸터 */}
                  <div className="p-4 border-t bg-secondary/20  flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      파일 크기:{" "}
                      {(
                        parseInt(selectedImageForModal.size) /
                        1024 /
                        1024
                      ).toFixed(2)}{" "}
                      MB
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => {
                        handleImageClick(selectedImageForModal);
                        handleCloseImageModal();
                      }}
                    >
                      이 이미지 선택
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 저장 모달 */}
            {showSaveModal && (
              <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      생성된 이미지 저장
                    </h3>
                    <button
                      onClick={handleCloseSaveModal}
                      className="text-gray-400 hover:text-black text-xl bg-transparent border-none p-0"
                    >
                      ×
                    </button>
                  </div>

                  {/* 저장할 이미지 미리보기 */}
                  {resultImage && (
                    <div className="mb-4">
                      <img
                        src={resultImage}
                        alt="저장할 이미지"
                        className="w-full rounded-lg max-h-48 object-contain"
                      />
                    </div>
                  )}

                  {/* 제목 입력 */}
                  <div className="space-y-4">
                    <div>
                      <Input
                        label="저장할 제목 (선택사항)"
                        placeholder="예: 만화 스타일 캐릭터, 판타지 배경 (비워두면 자동 생성)"
                        value={saveTitle}
                        onChange={(e) => setSaveTitle(e.target.value)}
                      />
                    </div>

                    {/* 사용된 옵션 정보 */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <Button
                        onClick={() =>
                          setIsOptionsCollapsed(!isOptionsCollapsed)
                        }
                        variant="normal"
                        size="sm"
                      >
                        {isOptionsCollapsed ? "상세보기" : "접기"}
                        <svg
                          className={`w-4 h-4 ml-2 transition-transform ${
                            isOptionsCollapsed ? "" : "rotate-180"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </Button>
                      {!isOptionsCollapsed && (
                        <div className="text-sm text-gray-600 space-y-1">
                          {activeTab === "character" ? (
                            <>
                              <div>• 비율: {aspectRatio}</div>
                              <div>• 출력 형식: {outputFormat}</div>
                              {seed && <div>• 시드: {seed}</div>}
                              <div>• 안전성 허용도: {safetyTolerance}</div>
                              {comicMode !== "0" && (
                                <>
                                  <div>• 만화 모드: {comicMode}컷</div>
                                  <div>• 레이아웃: {comicLayout}</div>
                                </>
                              )}
                              {imageUrl && (
                                <div>
                                  • 입력 이미지:{" "}
                                  <button
                                    onClick={() =>
                                      window.open(imageUrl, "_blank")
                                    }
                                    className="text-gray-600 hover:text-gray-800 underline"
                                  >
                                    링크
                                  </button>
                                </div>
                              )}
                              {!imageUrl && <div>• 입력 이미지: 없음</div>}
                            </>
                          ) : (
                            <>
                              <div>• 해상도: {interiorResolution}</div>
                              <div>• 비율: {interiorAspectRatio}</div>
                              {interiorSeed && (
                                <div>• 시드: {interiorSeed}</div>
                              )}
                              <div>• 만화 모드: {interiorComicMode}컷</div>
                              <div>• 레이아웃: {interiorComicLayout}</div>
                              <div>
                                • 선택된 캐릭터: {selectedCharacters.length}개
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {saveError && (
                      <div className="p-3 bg-red-100 border-1 border-red-400 text-red-700 text-sm rounded-xl">
                        <strong>오류:</strong> {saveError}
                      </div>
                    )}

                    {saveSuccess && (
                      <div className="p-3 bg-gray-100 border-1 border-gray-400 text-gray-700 text-sm rounded-xl">
                        <strong>성공:</strong> {saveSuccess}
                      </div>
                    )}
                  </div>

                  {/* 버튼 그룹 */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="secondary"
                      onClick={handleCloseSaveModal}
                      className="flex-1"
                      disabled={savingImage}
                    >
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSaveGeneratedImage}
                      disabled={savingImage}
                      loading={savingImage}
                      className="flex-1"
                    >
                      {savingImage ? "저장 중..." : "저장"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 카테고리 추가 모달 */}
            {showAddCategory && (
              <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      카테고리 추가
                    </h3>
                    <button
                      onClick={handleCancelAddCategory}
                      className="text-gray-400 hover:text-black text-xl bg-transparent border-none p-0"
                    >
                      ×
                    </button>
                  </div>

                  {/* 카테고리 입력 */}
                  <div className="space-y-4">
                    <div>
                      <Input
                        label="카테고리 이름*"
                        placeholder="예: 신비한 마법사, 용감한 기사"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Textarea
                        label="카테고리 설명 (선택사항)"
                        placeholder="이 카테고리에 대한 설명을 입력하세요 (선택사항)"
                        value={newCategoryDescription}
                        onChange={(e) =>
                          setNewCategoryDescription(e.target.value)
                        }
                        rows={3}
                      />
                    </div>

                    <div>
                      <input
                        lang="미리보기 이미지"
                        ref={categoryImageInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                        onChange={handleCategoryImageUpload}
                        disabled={addingCategory}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-secondary  rounded-xl p-4">
                        {!newCategoryImage ? (
                          <div className="text-center">
                            <Button
                              onClick={() =>
                                categoryImageInputRef.current?.click()
                              }
                              disabled={addingCategory}
                            >
                              이미지 선택
                            </Button>
                            <p className="text-xs text-gray-500">
                              PNG, JPEG, GIF, WebP (최대 5MB)
                            </p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <div className="mb-2">
                              <img
                                src={URL.createObjectURL(newCategoryImage)}
                                alt="미리보기"
                                className="w-20 h-20 object-cover rounded-lg mx-auto"
                              />
                            </div>
                            <div className="text-sm text-black mb-2">
                              {newCategoryImage.name}
                            </div>
                            <Button
                              variant="normal"
                              size="sm"
                              onClick={() => {
                                setNewCategoryImage(null);
                                if (categoryImageInputRef.current) {
                                  categoryImageInputRef.current.value = "";
                                }
                              }}
                              disabled={addingCategory}
                              className="text-xs bg-red-100 text-red-600 hover:bg-red-200"
                            >
                              제거
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {categoryError && (
                      <div className="p-3 bg-red-100 border-1 border-red-400 text-red-700 text-sm rounded-xl">
                        <strong>오류:</strong> {categoryError}
                      </div>
                    )}
                  </div>

                  {/* 버튼 그룹 */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="secondary"
                      onClick={handleCancelAddCategory}
                      className="flex-1"
                    >
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleAddCategory}
                      disabled={addingCategory || !newCategoryName.trim()}
                      loading={addingCategory}
                      className="flex-1"
                    >
                      {addingCategory ? "추가 중..." : "추가"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
