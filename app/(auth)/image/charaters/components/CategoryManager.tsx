"use client";

import React, { useState, useRef } from "react";
import { Timestamp } from "firebase/firestore";
import { Button, Input, Textarea, ImageUpload } from "@/components/styled";
import { Plus, GripVertical, Image as ImageIcon, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description?: string;
  previewImage?: string;
  createdAt: any; // Firestore Timestamp 또는 Date
  updatedAt: any; // Firestore Timestamp 또는 Date
  order?: number; // 순서를 위한 필드 추가
}

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onDeleteCategory: (categoryId: string) => void;
  onUpdateCategory: (
    categoryId: string,
    newName: string,
    newDescription: string,
    newImage?: File
  ) => void;
  onAddCategory: (name: string, description: string, image?: File) => void;
  onReorderCategories: (categories: Category[]) => void;
  loading: boolean;
}

export default function CategoryManager({
  isOpen,
  onClose,
  categories,
  onDeleteCategory,
  onUpdateCategory,
  onAddCategory,
  onReorderCategories,
  loading,
}: CategoryManagerProps) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);

  // 카테고리 추가 관련 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState<File | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);

  // 드래그 앤 드롭 관련 상태
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  // 순서가 있는 카테고리 목록 생성
  const sortedCategories = [...categories].sort((a, b) => {
    const orderA = a.order || 0;
    const orderB = b.order || 0;
    return orderA - orderB;
  });

  const handleStartEdit = (category: Category) => {
    setEditingCategory(category.id);
    setEditName(category.name);
    setEditDescription(category.description || "");
    setEditImage(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editName.trim()) return;

    await onUpdateCategory(
      editingCategory,
      editName.trim(),
      editDescription.trim(),
      editImage || undefined
    );
    setEditingCategory(null);
    setEditName("");
    setEditDescription("");
    setEditImage(null);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditName("");
    setEditDescription("");
    setEditImage(null);
  };

  const handleDelete = async (categoryId: string) => {
    setDeletingCategory(categoryId);
    await onDeleteCategory(categoryId);
    setDeletingCategory(null);
  };

  // 카테고리 추가 처리
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    setAddingCategory(true);
    try {
      await onAddCategory(
        newCategoryName.trim(),
        newCategoryDescription.trim(),
        newCategoryImage || undefined
      );
      setShowAddForm(false);
      setNewCategoryName("");
      setNewCategoryDescription("");
      setNewCategoryImage(null);
    } catch (error) {
      console.error("카테고리 추가 오류:", error);
    } finally {
      setAddingCategory(false);
    }
  };

  // 카테고리 추가 취소
  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewCategoryName("");
    setNewCategoryDescription("");
    setNewCategoryImage(null);
  };

  // 드래그 앤 드롭 처리
  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedCategory(categoryId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    if (draggedCategory !== categoryId) {
      setDragOverCategory(categoryId);
    }
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const handleDrop = (e: React.DragEvent, targetCategoryId: string) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === targetCategoryId) {
      setDraggedCategory(null);
      setDragOverCategory(null);
      return;
    }

    // 순서 재정렬
    const draggedIndex = sortedCategories.findIndex(
      (cat) => cat.id === draggedCategory
    );
    const targetIndex = sortedCategories.findIndex(
      (cat) => cat.id === targetCategoryId
    );

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedCategory(null);
      setDragOverCategory(null);
      return;
    }

    const newCategories = [...sortedCategories];
    const [draggedItem] = newCategories.splice(draggedIndex, 1);
    newCategories.splice(targetIndex, 0, draggedItem);

    // 순서 값 업데이트
    const updatedCategories = newCategories.map((cat, index) => ({
      ...cat,
      order: index,
    }));

    onReorderCategories(updatedCategories);
    setDraggedCategory(null);
    setDragOverCategory(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">카테고리 관리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black text-2xl bg-transparent border-none p-0 cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* 카테고리 추가 버튼 */}
        {!showAddForm && (
          <div className="mb-6">
            <Button
              variant="primary"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2"
            >
              <Plus size={16} />새 카테고리 추가
            </Button>
          </div>
        )}

        {/* 카테고리 추가 폼 */}
        {showAddForm && (
          <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              새 카테고리 추가
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  label="카테고리 이름 *"
                  placeholder="카테고리 이름을 입력하세요"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
              </div>
              <div>
                <Textarea
                  label="설명 (선택사항)"
                  placeholder="카테고리 설명을 입력하세요"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                미리보기 이미지 (선택사항)
              </label>
              <ImageUpload
                value={newCategoryImage}
                onChange={(file: File | null | File[]) => {
                  if (Array.isArray(file)) {
                    setNewCategoryImage(file[0] || null);
                  } else {
                    setNewCategoryImage(file);
                  }
                }}
                onError={(error) => {
                  // 에러 처리는 상위 컴포넌트에서 처리
                  console.error("Category image upload error:", error);
                }}
                maxSize={5}
                placeholder="카테고리 미리보기 이미지를 선택하세요"
                disabled={addingCategory}
                previewSize="sm"
              />
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="primary"
                onClick={handleAddCategory}
                disabled={addingCategory || !newCategoryName.trim()}
                loading={addingCategory}
              >
                {addingCategory ? "추가 중..." : "추가"}
              </Button>
              <Button variant="secondary" onClick={handleCancelAdd}>
                취소
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-gray-600">카테고리를 불러오는 중...</p>
          </div>
        ) : sortedCategories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>등록된 카테고리가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedCategories.map((category) => (
              <div
                key={category.id}
                className={`border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 ${
                  draggedCategory === category.id ? "opacity-50" : ""
                } ${
                  dragOverCategory === category.id
                    ? "border-primary bg-primary/5"
                    : ""
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, category.id)}
                onDragOver={(e) => handleDragOver(e, category.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, category.id)}
              >
                {editingCategory === category.id ? (
                  // 편집 모드
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Input
                          label=" 카테고리 이름 *"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="카테고리 이름"
                        />
                      </div>
                      <div>
                        <Textarea
                          label="설명 (선택사항)"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="카테고리 설명"
                          rows={2}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        미리보기 이미지
                      </label>
                      <ImageUpload
                        value={editImage}
                        onChange={(file: File | null | File[]) => {
                          if (Array.isArray(file)) {
                            setEditImage(file[0] || null);
                          } else {
                            setEditImage(file);
                          }
                        }}
                        onError={(error) => {
                          // 에러 처리는 상위 컴포넌트에서 처리
                          console.error(
                            "Category edit image upload error:",
                            error
                          );
                        }}
                        maxSize={5}
                        placeholder="카테고리 미리보기 이미지를 선택하세요"
                        previewSize="sm"
                      />
                      {category.previewImage && !editImage && (
                        <div className="mt-2 text-center">
                          <p className="text-xs text-gray-500 mb-2">
                            현재 이미지:
                          </p>
                          <img
                            src={category.previewImage}
                            alt="현재 이미지"
                            className="w-16 h-16 object-cover rounded-lg mx-auto"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        onClick={handleSaveEdit}
                        disabled={!editName.trim()}
                      >
                        Save
                      </Button>
                      <Button variant="secondary" onClick={handleCancelEdit}>
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  // 보기 모드
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="cursor-move text-gray-400 hover:text-gray-600">
                        <GripVertical size={20} />
                      </div>

                      {/* 카테고리 이미지 */}
                      {category.previewImage && (
                        <img
                          src={category.previewImage}
                          alt={category.name}
                          className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                        />
                      )}

                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {category.name}
                        </h3>
                        {category.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {category.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          생성일:{" "}
                          {category.createdAt
                            ?.toDate?.()
                            ?.toLocaleDateString() || "날짜 없음"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStartEdit(category)}
                      >
                        수정
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                        disabled={deletingCategory === category.id}
                        loading={deletingCategory === category.id}
                      >
                        {deletingCategory === category.id
                          ? "삭제 중..."
                          : "삭제"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">
            💡 드래그하여 카테고리 순서를 변경할 수 있습니다.
          </p>
          <Button variant="secondary" onClick={onClose} className="w-full">
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
