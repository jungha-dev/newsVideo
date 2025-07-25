"use client";

import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-black text-white py-8 mt-16 pb-100">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 서비스 정보 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">후그르(Hoogrr)</h3>
            <p className="text-gray-300 text-sm">
              AI 기반 이미지 생성 및 블로그 서비스
            </p>
            <p className="text-gray-400 text-xs mt-2">
              © 2024 후그르(HooGrr). All rights reserved.
            </p>
          </div>

          {/* 사업자 정보 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">사업자 정보</h3>
            <div className="text-gray-300 text-sm space-y-1">
              <p>
                <span className="text-gray-400">사업자등록번호:</span>{" "}
                744-88-02542
              </p>
              <p>
                <span className="text-gray-400">통신판매업신고:</span>{" "}
                2023-서울관악-1824
              </p>
              <p>
                <span className="text-gray-400">대표:</span> 김도균
              </p>
            </div>
          </div>

          {/* 연락처 정보 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <div className="text-gray-300 text-sm space-y-1">
              <p>070-8018-8743</p>
              <p>contact@dalpha.so</p>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-xs">
              본 서비스는 AI 기술을 활용하여 사용자 경험을 향상시킵니다.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link
                href="/privacy-policy"
                className="text-gray-400 hover:text-white text-xs transition-colors"
              >
                개인정보처리방침
              </Link>
              <Link
                href="/terms-of-service"
                className="text-gray-400 hover:text-white text-xs transition-colors"
              >
                서비스약관
              </Link>
              <Link
                href="/data-deletion"
                className="text-gray-400 hover:text-white text-xs transition-colors"
              >
                데이터삭제
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
