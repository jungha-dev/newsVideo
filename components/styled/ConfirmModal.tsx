import React from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  apiInfo?: {
    url: string;
    method: string;
    data: any;
  };
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  apiInfo,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-700 mb-4">{message}</p>

          {apiInfo && (
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h4 className="font-semibold text-gray-900 mb-2">
                API 요청 정보:
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">URL:</span>
                  <span className="ml-2 text-gray-600">{apiInfo.url}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Method:</span>
                  <span className="ml-2 text-gray-600">{apiInfo.method}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Data:</span>
                  <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(apiInfo.data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
