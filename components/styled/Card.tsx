"use client";

import React, { useState } from "react";
import { Button } from "./index";
import { ChevronUp, ChevronDown, MoreVertical } from "lucide-react";

interface MenuItem {
  id: string;
  label: string;
  icon?: string; // 아이콘 (이모지 또는 텍스트)
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string; // 커스텀 스타일
}

interface CardProps {
  id: string;
  title: string;
  subtitle?: string;
  content?: string;
  image?: string; // 이미지 URL
  imageAlt?: string; // 이미지 대체 텍스트
  imageFit?: "contain" | "cover"; // ⭐ 표시 방식
  menuItems?: MenuItem[]; // 기본 메뉴 아이템들
  editMenuItems?: MenuItem[]; // 편집 메뉴 아이템들
  customMenuItems?: MenuItem[]; // 커스텀 메뉴 아이템들 (우선순위 높음)
  order?: number;
  onOrderChange?: (id: string, newOrder: number) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
  variant?: "default" | "compact" | "expanded";
  editable?: boolean;
  children?: React.ReactNode;
  onTitleClick?: () => void; // 제목 클릭 이벤트
  showMenu?: boolean; // 메뉴 표시 여부
  menuIcon?: React.ReactNode; // 커스텀 메뉴 아이콘
}

const Card: React.FC<CardProps> = ({
  id,
  title,
  subtitle,
  content,
  image,
  imageAlt,
  imageFit = "cover", // 기본값: cover
  menuItems = [],
  editMenuItems = [],
  customMenuItems = [],
  order = 0,
  onOrderChange,
  onEdit,
  onDelete,
  className = "",
  variant = "default",
  editable = true,
  children,
  onTitleClick,
  showMenu = true,
  menuIcon,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editSubtitle, setEditSubtitle] = useState(subtitle || "");
  const [editContent, setEditContent] = useState(content || "");
  const [editImage, setEditImage] = useState(image || "");
  const [editImageAlt, setEditImageAlt] = useState(imageAlt || "");
  const [editImageFit, setEditImageFit] = useState<"contain" | "cover">(
    imageFit
  );

  // 외부 클릭 시 드롭다운 닫기
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".edit-menu-container")) {
        setIsEditMenuOpen(false);
      }
    };

    if (isEditMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditMenuOpen]);

  const baseStyles = `
    border border-gray-200 rounded-xl bg-white
    transition-all duration-200 ease-in-out relative
  `;

  const variantStyles = {
    default: "p-6",
    compact: "p-0",
    expanded: "p-8",
  };

  const combinedStyles = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${className}
  `;

  // 이미지 표시 방식에 따른 클래스 결정
  const getImageFitClass = () => {
    return imageFit === "contain" ? "object-contain" : "object-cover";
  };

  // 이미지 컨테이너 스타일 결정
  const getImageContainerClass = () => {
    if (imageFit === "contain") {
      return "w-full h-48 bg-secondary overflow-hidden flex items-center justify-center";
    }
    return "w-full h-48 bg-gray-100 overflow-hidden";
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(title);
    setEditSubtitle(subtitle || "");
    setEditContent(content || "");
    setEditImage(image || "");
    setEditImageAlt(imageAlt || "");
    setEditImageFit(imageFit);
    setIsEditing(false);
  };

  const handleMoveUp = () => {
    onOrderChange?.(id, order - 1);
  };

  const handleMoveDown = () => {
    onOrderChange?.(id, order + 1);
  };

  return (
    <div className={combinedStyles}>
      {/* 상단 영역: 순서 + 제목 + 버튼 */}
      <div className="flex items-start justify-between gap-2 mb-4 pt-4">
        <div className="flex items-start gap-2">
          {onOrderChange && (
            <div className="flex flex-col items-center">
              <Button onClick={handleMoveUp} variant="normal" className="h-6">
                <ChevronUp size={18} />
              </Button>
              <Button onClick={handleMoveDown} variant="normal" className="h-6">
                <ChevronDown size={18} />
              </Button>
            </div>
          )}
          <div>
            {isEditing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                className="w-full text-lg font-semibold border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            ) : (
              <h3
                className={`text-lg font-semibold text-gray-900 ${
                  onTitleClick
                    ? "cursor-pointer hover:text-primary transition-colors"
                    : ""
                }`}
                onClick={onTitleClick}
              >
                {title}
              </h3>
            )}
            {isEditing ? (
              <input
                value={editSubtitle}
                onChange={(e) => setEditSubtitle(e.target.value)}
                placeholder="부제목을 입력하세요"
                className="w-full text-sm border border-gray-300 rounded mt-1 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            ) : (
              subtitle && <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        {showMenu && !isEditing && (
          <div className="relative edit-menu-container">
            <Button
              variant="normal"
              size="sm"
              onClick={() => setIsEditMenuOpen(!isEditMenuOpen)}
              className="p-1"
            >
              {menuIcon || <MoreVertical size={16} />}
            </Button>
            {isEditMenuOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg z-10 min-w-[120px]">
                {/* 커스텀 메뉴 아이템들 (우선순위 높음) */}
                {customMenuItems.length > 0 &&
                  customMenuItems.map((item) => (
                    <button
                      key={item.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                        item.disabled ? "opacity-50 cursor-not-allowed" : ""
                      } ${item.className || ""}`}
                      onClick={() => {
                        if (!item.disabled) {
                          item.onClick?.();
                          setIsEditMenuOpen(false);
                        }
                      }}
                      disabled={item.disabled}
                    >
                      {item.icon && <span>{item.icon}</span>}
                      {item.label}
                    </button>
                  ))}

                {/* 기본 메뉴 아이템들 */}
                {customMenuItems.length === 0 &&
                  editMenuItems.length > 0 &&
                  editMenuItems.map((item) => (
                    <button
                      key={item.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                        item.disabled ? "opacity-50 cursor-not-allowed" : ""
                      } ${item.className || ""}`}
                      onClick={() => {
                        if (!item.disabled) {
                          item.onClick?.();
                          setIsEditMenuOpen(false);
                        }
                      }}
                      disabled={item.disabled}
                    >
                      {item.icon && <span>{item.icon}</span>}
                      {item.label}
                    </button>
                  ))}

                {/* 기본 편집 메뉴 (커스텀 메뉴가 없을 때만) */}
                {customMenuItems.length === 0 && editMenuItems.length === 0 && (
                  <>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        setIsEditing(true);
                        setIsEditMenuOpen(false);
                      }}
                    >
                      편집
                    </button>
                    {onDelete && (
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 transition-colors"
                        onClick={() => {
                          onDelete(id);
                          setIsEditMenuOpen(false);
                        }}
                      >
                        삭제
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 이미지 영역 */}
      {isEditing ? (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이미지 URL
            </label>
            <input
              value={editImage}
              onChange={(e) => setEditImage(e.target.value)}
              placeholder="이미지 URL을 입력하세요"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이미지 대체 텍스트
            </label>
            <input
              value={editImageAlt}
              onChange={(e) => setEditImageAlt(e.target.value)}
              placeholder="이미지 설명을 입력하세요"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이미지 표시 방식
            </label>
            <select
              value={editImageFit}
              onChange={(e) =>
                setEditImageFit(e.target.value as "contain" | "cover")
              }
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              <option value="cover">원본 비율대로 그대로 꽉 채움</option>
              <option value="contain">
                정방형 프레임 안에 가로세로 중 긴 쪽을 맞추고 비율 유지
              </option>
            </select>
          </div>
          {editImage && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-2">미리보기:</p>
              <div
                className={
                  editImageFit === "contain"
                    ? "w-full h-48 bg-secondary overflow-hidden flex items-center justify-center"
                    : "w-full h-48 bg-gray-100 overflow-hidden"
                }
              >
                <img
                  src={editImage}
                  alt={editImageAlt || "미리보기"}
                  className={`w-full h-full ${
                    editImageFit === "contain"
                      ? "object-contain"
                      : "object-cover"
                  }`}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        image && (
          <div className="mb-4">
            <div className={getImageContainerClass()}>
              <img
                src={image}
                alt={imageAlt || title}
                className={`w-full h-full ${getImageFitClass()}`}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            </div>
          </div>
        )
      )}

      {/* 내용 */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            placeholder="내용을 입력하세요"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary resize-none"
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave}>
              저장
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <>
          {content && (
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          )}
          {children}
        </>
      )}

      {/* 메뉴 */}
      {menuItems.length > 0 && !isEditing && (
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-full justify-between"
          >
            메뉴 보기
            <ChevronDown
              size={16}
              className={`transform transition-transform ${
                isMenuOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
          {isMenuOpen && (
            <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-200 overflow-hidden">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    item.onClick?.();
                    setIsMenuOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Card;

/*
사용 예시:

// 1. 원본 비율대로 그대로 꽉 채움 (cover)
<Card
  id="1"
  title="카드 제목"
  subtitle="부제목"
  content="카드 내용입니다."
  image="https://example.com/image.jpg"
  imageAlt="이미지 설명"
  imageFit="cover" // 원본 비율대로 그대로 꽉 채움
/>

// 2. 정방형 프레임 안에 가로세로 중 긴 쪽을 맞추고 비율 유지 (contain)
<Card
  id="2"
  title="카드 제목"
  subtitle="부제목"
  content="카드 내용입니다."
  image="https://example.com/image.jpg"
  imageAlt="이미지 설명"
  imageFit="contain" // 정방형 프레임 안에 가로세로 중 긴 쪽을 맞추고 비율 유지
/>

// 3. 편집 가능한 카드
<Card
  id="3"
  title="편집 가능한 카드"
  subtitle="부제목"
  content="이 카드는 편집할 수 있습니다."
  image="https://example.com/image.jpg"
  imageAlt="이미지 설명"
  imageFit="cover"
  editable={true}
                  onEdit={(id) => {}}
                onDelete={(id) => {}}
/>
*/
