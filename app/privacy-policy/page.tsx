"use client";

import React from "react";
import { PageLayout } from "@/components/styled";

export default function PrivacyPolicyPage() {
  return (
    <PageLayout title="개인정보 처리방침">
      <div className="mx-auto">
        <div className="space-y-8">
          {/* 1. 개인정보 수집 및 이용 목적 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. 개인정보 수집 및 이용 목적
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                팔레트(Palette)는 다음과 같은 목적으로 개인정보를 수집하고
                이용합니다:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>서비스 제공:</strong> AI 기반 이미지 생성, 블로그
                  서비스 제공
                </li>
                <li>
                  <strong>회원 관리:</strong> 회원 가입, 로그인, 회원 정보 관리
                </li>
                <li>
                  <strong>고객 지원:</strong> 문의사항 처리 및 고객 서비스 제공
                </li>
                <li>
                  <strong>서비스 개선:</strong> 서비스 품질 향상 및 신규 서비스
                  개발
                </li>
              </ul>
            </div>
          </section>

          {/* 2. 수집하는 개인정보 항목 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. 수집하는 개인정보 항목
            </h2>
            <div className="space-y-4 text-gray-700">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                필수 수집 항목
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>이메일 주소 (Google 로그인 시)</li>
                <li>사용자 ID (Firebase UID)</li>
                <li>프로필 정보 (이름, 프로필 이미지)</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-900 mb-2 mt-6">
                서비스 이용 시 생성되는 정보
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>업로드된 이미지 파일</li>
                <li>생성된 이미지 파일</li>
                <li>프롬프트 및 생성 옵션 정보</li>
                <li>서비스 이용 로그</li>
                <li>접속 IP 주소</li>
              </ul>
            </div>
          </section>

          {/* 3. 개인정보 보유 및 이용기간 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. 개인정보 보유 및 이용기간
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                회원 탈퇴 시까지 또는 법정 보유기간까지 개인정보를 보유합니다:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>회원 정보:</strong> 회원 탈퇴 시 즉시 삭제
                </li>
                <li>
                  <strong>업로드된 이미지:</strong> 회원 탈퇴 시 즉시 삭제
                </li>
                <li>
                  <strong>생성된 이미지:</strong> 회원 탈퇴 시 즉시 삭제
                </li>
                <li>
                  <strong>서비스 이용 로그:</strong> 회원 탈퇴 후 30일간 보관
                </li>
              </ul>
            </div>
          </section>

          {/* 4. 개인정보 제3자 제공 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. 개인정보 제3자 제공
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                팔레트(Palette)는 원칙적으로 개인정보를 제3자에게 제공하지
                않습니다. 다만, 다음의 경우에는 예외로 합니다:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>사용자가 사전에 동의한 경우</li>
                <li>
                  법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와
                  방법에 따라 수사기관의 요구가 있는 경우
                </li>
                <li>
                  서비스 제공을 위해 필요한 최소한의 정보를 서비스 제공업체에
                  제공하는 경우
                </li>
              </ul>
            </div>
          </section>

          {/* 5. 개인정보 처리 위탁 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. 개인정보 처리 위탁
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                서비스 제공을 위해 다음과 같은 업체에 개인정보 처리를
                위탁합니다:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Google Firebase:</strong> 사용자 인증, 데이터베이스,
                  파일 Save
                </li>
                <li>
                  <strong>Replicate:</strong> AI 이미지 생성 서비스
                </li>
                <li>
                  <strong>Vercel:</strong> 웹 서비스 호스팅
                </li>
              </ul>
            </div>
          </section>

          {/* 6. 이용자 권리 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. 이용자 권리
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>이용자는 다음과 같은 권리를 가집니다:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>개인정보 열람 요구</li>
                <li>개인정보 정정·삭제 요구</li>
                <li>개인정보 처리정지 요구</li>
                <li>개인정보 이전 요구</li>
                <li>처리정지·삭제 요구</li>
              </ul>
              <p className="text-sm text-gray-600 mt-4">
                권리 행사는 서비스 내 설정 메뉴 또는 고객센터를 통해 요청할 수
                있습니다.
              </p>
            </div>
          </section>

          {/* 7. 개인정보 보호책임자 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. 개인정보 보호책임자
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와
                관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이
                개인정보 보호책임자를 지정하고 있습니다.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p>
                  <strong>개인정보 보호책임자</strong>
                </p>
                <p>이메일: hello@pltt.xyz</p>
                <p>연락처: 고객센터를 통해 문의</p>
              </div>
            </div>
          </section>

          {/* 8. 개인정보 처리방침 변경 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. 개인정보 처리방침 변경
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                이 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에
                따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의
                시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
              </p>
            </div>
          </section>

          {/* 9. 연락처 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. 연락처
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                개인정보 처리방침에 관한 문의사항이 있으시면 아래로 연락해
                주시기 바랍니다.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p>
                  <strong>팔레트(Palette)</strong>
                </p>
                <p>이메일: hello@pltt.xyz</p>
                <p>웹사이트: http://pltt.xyz</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
