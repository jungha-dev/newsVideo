"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Button, Input } from "@/components/styled";
import { User, Save, ArrowLeft, Camera, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UserProfile {
  nickname?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<UserProfile>({
    nickname: "",
    displayName: "",
    email: "",
    photoURL: "",
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load user information
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const loadUserProfile = async () => {
      setLoading(true);
      try {
        // Get user profile information from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProfile({
            nickname: userData.nickname || "",
            displayName: user.displayName || "",
            email: user.email || "",
            photoURL: userData.photoURL || user.photoURL || "",
          });
        } else {
          // Set default information
          setProfile({
            nickname: user.displayName || "",
            displayName: user.displayName || "",
            email: user.email || "",
            photoURL: user.photoURL || "",
          });
        }
      } catch (error) {
        console.error("User profile load failed:", error);
        setMessage("Failed to load user profile.");
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user, router]);

  // 이미지 선택 처리
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setMessage("Image size must be less than 5MB");
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setMessage("Image file only");
        return;
      }

      setSelectedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle image upload
  const handleImageUpload = async () => {
    if (!selectedImage || !user) return;

    setUploadingImage(true);
    setMessage("");

    try {
      // Delete existing image (if any)
      if (profile.photoURL && profile.photoURL !== user.photoURL) {
        try {
          const oldImageRef = ref(storage, profile.photoURL);
          await deleteObject(oldImageRef);
        } catch (error) {
          console.log("delete old image error:", error);
        }
      }

      // Upload new image
      const imageRef = ref(storage, `users/${user.uid}/profile.jpg`);
      await uploadBytes(imageRef, selectedImage);
      const downloadURL = await getDownloadURL(imageRef);

      // Update Firestore
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: downloadURL,
        updatedAt: new Date(),
      });

      setProfile((prev) => ({ ...prev, photoURL: downloadURL }));
      setSelectedImage(null);
      setImagePreview("");
      setMessage("Profile image uploaded successfully!");
    } catch (error) {
      console.error("Image upload error:", error);
      setMessage("Image upload failed.");
    } finally {
      setUploadingImage(false);
    }
  };

  // 이미지 제거
  const handleRemoveImage = async () => {
    if (!user) return;

    setUploadingImage(true);
    setMessage("");

    try {
      // 기존 이미지 삭제
      if (profile.photoURL && profile.photoURL !== user.photoURL) {
        try {
          const imageRef = ref(storage, profile.photoURL);
          await deleteObject(imageRef);
        } catch (error) {
          console.log("delete image error:", error);
        }
      }

      // Firestore에서 photoURL 제거
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: null,
        updatedAt: new Date(),
      });

      setProfile((prev) => ({ ...prev, photoURL: "" }));
      setSelectedImage(null);
      setImagePreview("");
      setMessage("Profile image removed successfully!");
    } catch (error) {
      console.error("Image remove error:", error);
      setMessage("Image remove failed.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage("");

    try {
      // Firestore에 사용자 프로필 업데이트
      await updateDoc(doc(db, "users", user.uid), {
        nickname: profile.nickname,
        updatedAt: new Date(),
      });

      setMessage("Profile saved successfully!");
    } catch (error) {
      console.error("Profile save error:", error);
      setMessage("Profile save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>

        {/* 프로필 카드 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {imagePreview || profile.photoURL ? (
                  <img
                    src={imagePreview || profile.photoURL}
                    alt="프로필"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <User size={24} className="text-gray-500" />
                )}
              </div>

              {/* 이미지 업로드 버튼 */}
              <label className="absolute bottom-0 right-0 w-6 h-6 bg-primary-light rounded-full flex items-center justify-center cursor-pointer hover:bg-primary transition-colors">
                <Camera size={12} className="text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={uploadingImage}
                />
              </label>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Profile Settings
              </h2>
              <p className="text-gray-600">
                Manage and update your account information
              </p>
            </div>
          </div>

          {/* 이미지 업로드 영역 */}
          {selectedImage && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                      <User size={16} className="text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedImage.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleImageUpload}
                    disabled={uploadingImage}
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    {uploadingImage ? "Uploading..." : "Upload"}
                  </Button>
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview("");
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* 닉네임 */}
            <div>
              <Input
                label="닉네임"
                placeholder="닉네임을 입력하세요"
                value={profile.nickname || ""}
                onChange={(e) =>
                  setProfile({ ...profile, nickname: e.target.value })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                This is the name that will be displayed to other users
              </p>
            </div>

            {/* 이메일 (읽기 전용) */}
            <div>
              <Input label="이메일" value={profile.email || ""} disabled />
              <p className="text-xs text-gray-500 mt-1">
                This email cannot be changed
              </p>
            </div>

            {/* 표시 이름 (읽기 전용) */}
            <div>
              <Input
                label="표시 이름"
                value={profile.displayName || ""}
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                This is the name that is imported from your Google account
              </p>
            </div>

            {/* 메시지 */}
            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.includes("success")
                    ? "bg-gray-100 text-gray-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {message}
              </div>
            )}

            {/* 버튼 그룹 */}
            <div className="flex justify-between pt-4">
              <div className="flex gap-2">
                {profile.photoURL && !selectedImage && (
                  <Button
                    onClick={handleRemoveImage}
                    disabled={uploadingImage}
                    variant="normal"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove Image
                  </Button>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>

        {/* 계정 정보 카드 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Account Information
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Account ID:</span>
              <span className="font-mono text-gray-900">{user?.uid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Join Date:</span>
              <span className="text-gray-900">
                {user?.metadata?.creationTime
                  ? new Date(user.metadata.creationTime).toLocaleDateString(
                      "ko-KR"
                    )
                  : "Unknown"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Login:</span>
              <span className="text-gray-900">
                {user?.metadata?.lastSignInTime
                  ? new Date(user.metadata.lastSignInTime).toLocaleDateString(
                      "ko-KR"
                    )
                  : "Unknown"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
