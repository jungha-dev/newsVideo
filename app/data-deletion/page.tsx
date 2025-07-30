"use client";

import React from "react";
import { PageLayout, Button } from "@/components/styled";
import { Trash2, AlertTriangle, Info, CheckCircle } from "lucide-react";

export default function DataDeletionPage() {
  return (
    <PageLayout title="사용자 데이터 삭제 안내">
      <div className="mx-auto">
        <div>
          <div className="space-y-8">
            {/* 중요 안내 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6  mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold  mb-2">중요 안내</h3>
                  <p className="">
                    데이터 삭제는 <strong>되돌릴 수 없습니다</strong>. 삭제하기
                    전에 중요한 데이터를 백업하시기 바랍니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 삭제되는 데이터 종류 */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                삭제되는 데이터 종류
              </h2>
              <div className="space-y-4 bg-gray-50 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trash2 className="w-5 h-5 " />
                      <h3 className="font-semibold text-gray-900">계정 정보</h3>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• 사용자 프로필 정보</li>
                      <li>• 이메일 주소</li>
                      <li>• 로그인 기록</li>
                    </ul>
                  </div>

                  <div className="rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trash2 className="w-5 h-5 " />
                      <h3 className="font-semibold text-gray-900">
                        업로드된 이미지
                      </h3>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• 캐릭터 이미지 파일</li>
                      <li>• 카테고리 이미지</li>
                      <li>• 프로필 이미지</li>
                    </ul>
                  </div>

                  <div className="rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trash2 className="w-5 h-5 " />
                      <h3 className="font-semibold text-gray-900">
                        생성된 이미지
                      </h3>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• AI 생성 이미지 파일</li>
                      <li>• 프롬프트 정보</li>
                      <li>• 생성 옵션 설정</li>
                    </ul>
                  </div>

                  <div className="rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trash2 className="w-5 h-5 " />
                      <h3 className="font-semibold text-gray-900">
                        서비스 데이터
                      </h3>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• 카테고리 정보</li>
                      <li>• 서비스 이용 로그</li>
                      <li>• 설정 정보</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 삭제 방법 */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                데이터 삭제 방법
              </h2>
              <div className="space-y-6 bg-gray-50 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-primary/20border-primary-light rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <Info className="w-6 h-6  mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-semibold  mb-2">
                        방법 1: 계정 탈퇴 (권장)
                      </h3>
                      <p className="text-primary-dark mb-4">
                        모든 데이터가 완전히 삭제되며, 서비스 이용이
                        불가능해집니다.
                      </p>
                      <div className="rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          탈퇴 절차:
                        </h4>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                          <li>설정 페이지로 이동</li>
                          <li>"계정 탈퇴" 버튼 클릭</li>
                          <li>탈퇴 확인 절차 진행</li>
                          <li>모든 데이터 즉시 삭제</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50border-yellow-200 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <Info className="w-6 h-6  mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        방법 2: 선택적 데이터 삭제
                      </h3>
                      <p className="text-yellow-700 mb-4">
                        특정 데이터만 선택적으로 삭제할 수 있습니다.
                      </p>
                      <div className=" rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          삭제 가능 항목:
                        </h4>
                        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                          <li>개별 이미지 파일</li>
                          <li>생성된 이미지</li>
                          <li>카테고리 정보</li>
                          <li>프로필 이미지</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 삭제 후 영향 */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                삭제 후 영향
              </h2>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    계정 탈퇴 시 영향
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">즉시 발생</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 서비스 접근 불가</li>
                        <li>• 모든 데이터 삭제</li>
                        <li>• 로그인 불가</li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">영구적 영향</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 데이터 복구 불가</li>
                        <li>• 계정 재생성 필요</li>
                        <li>• 모든 설정 초기화</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 데이터 보관 기간 */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                데이터 보관 기간
              </h2>
              <div className="space-y-4 text-gray-700">
                <p>
                  데이터 삭제 후에도 일부 정보는 법적 요구사항에 따라 일정 기간
                  보관될 수 있습니다:
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>서비스 이용 로그:</strong> 회원 탈퇴 후 30일간
                        보관
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>법적 요구사항:</strong> 관련 법령에 따른 보관
                        기간 준수
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>보안 목적:</strong> 서비스 보안을 위한 최소한의
                        정보 보관
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 문의사항 */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                문의사항
              </h2>
              <div className="space-y-4 text-gray-700">
                <p>
                  데이터 삭제와 관련하여 추가 문의사항이 있으시면 아래 연락처로
                  문의해 주시기 바랍니다.
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">문의</h4>
                      <p className="text-sm">이메일: hello@pltt.xyz</p>
                      <p className="text-sm">응답 시간: 영업일 기준 1-2일</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
