"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "success" | "error";
  title: string;
  message?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  autoClose = true,
  autoCloseDelay = 3000,
}) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const getModalStyles = () => {
    if (type === "success") {
      return {
        modal: "bg-black text-white",
        icon: "text-gray-500",
        iconBg: "bg-gray-100",
      };
    } else {
      return {
        modal: "bg-primary text-white",
        icon: "text-white",
        iconBg: "bg-red-500",
      };
    }
  };

  const styles = getModalStyles();

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 flex items-end justify-center`}
    >
      <div
        className={`relative max-w-4xl w-full mx-4 mb-4 rounded-xl shadow-2xl ${styles.modal}`}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1 rounded-full hover:bg-opacity-20 ${
            type === "success" ? "hover:bg-black" : "hover:bg-white"
          } transition-colors`}
        >
          <X size={20} />
        </button>

        {/* 모달 내용 */}
        <div className="p-6 text-center">
          {/* 제목 */}
          <h3 className="text-xl font-semibold mb-2">
            {title}:{message}
          </h3>
        </div>
      </div>
    </div>
  );
};

export default Modal;
