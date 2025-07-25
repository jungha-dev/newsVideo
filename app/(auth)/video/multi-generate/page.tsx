"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { v4 as uuidv4 } from "uuid";
import {
  ImageUpload,
  Card,
  Modal,
  Input,
  Textarea,
  Button,
  PageLayout,
  Section,
} from "@/components/styled";

interface UploadItem {
  file: File;
  prompt: string;
  description: string;
  uploadedUrl?: string; // 업로드된 이미지 URL 저장
  isUploaded?: boolean; // 업로드 상태
}

interface ModalState {
  isOpen: boolean;
  type: "success" | "error";
  message: string;
}

export default function MultiImageUploadForm() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 중복 제출 방지
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: "success",
    message: "",
  });

  // ✅ 로그인 후 ID 토큰을 __session 쿠키에 저장
  useEffect(() => {
    const setSessionCookie = async () => {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        document.cookie = `__session=${token}; path=/`;
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setSessionCookie();
    });

    return () => unsubscribe();
  }, []);

  /* ---------------- 파일 선택 시 ---------------- */
  const handleFileChange = (files: File | File[] | null) => {
    if (!files) {
      setItems([]);
      return;
    }

    const fileArray = Array.isArray(files) ? files : [files];

    // 기존 아이템들의 파일과 새 파일들을 매칭하여 기존 데이터 유지
    const newItems: UploadItem[] = fileArray.map((file) => {
      // 기존 아이템에서 같은 파일 찾기
      const existingItem = items.find(
        (item) =>
          item.file.name === file.name &&
          item.file.size === file.size &&
          item.file.lastModified === file.lastModified
      );

      return (
        existingItem || {
          file,
          prompt: "",
          description: "",
        }
      );
    });

    setItems(newItems);
  };

  /* ---------------- Firebase Storage 업로드 ---------------- */
  const uploadImagesToFirebase = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("로그인이 필요합니다.");

    const uploaded: {
      imageUrl: string;
      promptText: string;
      description: string;
    }[] = [];

    for (const item of items) {
      // 이미 업로드된 이미지는 재사용
      if (item.isUploaded && item.uploadedUrl) {
        uploaded.push({
          imageUrl: item.uploadedUrl,
          promptText: item.prompt,
          description: item.description,
        });
        continue;
      }

      // Firebase Storage에 직접 업로드
      const { ref, uploadBytes, getDownloadURL } = await import(
        "firebase/storage"
      );
      const { storage } = await import("@/lib/firebase");

      const bytes = await item.file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = item.file.name.split(".").pop();
      const filename = `${uuidv4()}.${ext}`;
      const { getMultiGenerateImagePath, createSafeFilename } = await import(
        "../../../../utils/storagePaths"
      );

      const safeFilename = createSafeFilename(item.file.name, "multi_gen");
      const storagePath = getMultiGenerateImagePath({
        userId: uid,
        filename: safeFilename,
      });
      const fileRef = ref(storage, storagePath);

      await uploadBytes(fileRef, buffer, {
        contentType: item.file.type,
      });

      const imageUrl = await getDownloadURL(fileRef);

      // 업로드 상태 업데이트
      setItems((prev) =>
        prev.map((prevItem, index) =>
          prevItem === item
            ? { ...prevItem, uploadedUrl: imageUrl, isUploaded: true }
            : prevItem
        )
      );

      uploaded.push({
        imageUrl,
        promptText: item.prompt,
        description: item.description,
      });
    }

    return uploaded;
  };

  const moveItemUp = (index: number) => {
    if (index === 0) return;
    setItems((prev) => {
      const copy = [...prev];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  };

  const moveItemDown = (index: number) => {
    if (index === items.length - 1) return;
    setItems((prev) => {
      const copy = [...prev];
      [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
      return copy;
    });
  };

  const handleDelete = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const showModal = (type: "success" | "error", message: string) => {
    setModal({ isOpen: true, type, message });
  };

  const closeModal = () => {
    setModal({ isOpen: false, type: "success", message: "" });
  };

  /* ---------------- 영상 생성 요청 ---------------- */
  const handleSubmit = async () => {
    if (items.length === 0) {
      showModal("error", "업로드할 이미지가 없습니다.");
      return;
    }

    // 중복 제출 방지
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setLoading(true);

      // 토큰 갱신 시도
      const user = auth.currentUser;
      if (user) {
        try {
          const token = await user.getIdToken(true); // 강제 갱신
          document.cookie = `__session=${token}; path=/`;
        } catch (tokenError) {
          console.warn("⚠️ 토큰 갱신 실패:", tokenError);
        }
      }

      const payload = await uploadImagesToFirebase();

      const res = await fetch(
        "/api/video/runway/multi-generate-video/image-to-video",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // ✅ 쿠키 전송
          body: JSON.stringify({ items: payload }),
        }
      );

      let data;
      try {
        data = await res.json();
      } catch (error) {
        console.error("Response parsing error:", error);
        throw new Error(
          "서버 응답을 처리할 수 없습니다. Firebase 설정을 확인해주세요."
        );
      }

      if (!res.ok) {
        // 오류 발생 시 이미지는 그대로 유지하고 오류 메시지만 표시
        throw new Error(data.error || "영상 생성 실패");
      }

      // 성공 메시지 표시
      const successMessage = data.summary
        ? data.summary.message
        : `영상 생성이 시작되었습니다. batchId: ${data.groupId}`;

      showModal("success", successMessage);

      // 성공 시에만 아이템 초기화
      setItems([]);
    } catch (err: any) {
      showModal("error", err.message);
      // 오류 발생 시 이미지는 그대로 유지 (재시도 가능)
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <PageLayout
      title="여러 이미지로 영상 생성"
      subtitle="이미지를 업로드하여 영상을 생성하세요."
    >
      <Section>
        <ImageUpload
          value={items.map((item) => item.file)}
          onChange={handleFileChange}
          onError={(error) => {
            console.error("ImageUpload error:", error);
            showModal("error", error);
          }}
          multiple
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          maxSize={5} // Runway API 제한을 고려하여 5MB로 제한
          className="w-full"
          showPreview={showPreview}
        />
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, i) => (
          <div key={i} className="space-y-3">
            <Card
              id={`item-${i}`}
              title={`이미지 ${i + 1}${item.isUploaded ? " ✅" : ""}`}
              image={URL.createObjectURL(item.file)}
              imageAlt={`이미지 ${i + 1}`}
              imageFit="cover"
              className="relative"
              editable={false}
              variant="compact"
              order={i}
              onOrderChange={(id, newOrder) => {
                if (newOrder < i) {
                  moveItemUp(i);
                } else if (newOrder > i) {
                  moveItemDown(i);
                }
              }}
              onDelete={() => handleDelete(i)}
            >
              <div className="mb-4 px-4">
                <Input
                  type="text"
                  value={item.prompt}
                  onChange={(e) => {
                    const copy = [...items];
                    copy[i].prompt = e.target.value;
                    setItems(copy);
                  }}
                  placeholder={`이미지 ${i + 1} 프롬프트`}
                  className="w-full"
                />
                <Textarea
                  value={item.description}
                  onChange={(e) => {
                    const copy = [...items];
                    copy[i].description = e.target.value;
                    setItems(copy);
                  }}
                  placeholder="영상 설명 입력"
                  className="w-full"
                  rows={3}
                />
              </div>
            </Card>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleSubmit}
          disabled={loading || items.length === 0 || isSubmitting}
          variant="primary"
          size="lg"
        >
          {loading ? "비디오 생성 중..." : "영상 생성 요청하기"}
        </Button>
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        title={modal.type === "success" ? "성공" : "오류"}
        message={modal.message}
      />
    </PageLayout>
  );
}
