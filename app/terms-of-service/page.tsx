"use client";

import React from "react";
import { PageLayout } from "@/components/styled";

export default function TermsOfServicePage() {
  return (
    <PageLayout title="서비스 약관">
      <div className="mx-auto">
        {/* 1. 서비스 개요 */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            1. 서비스 개요
          </h2>
          <div className="space-y-4 text-gray-700">
            <p>
              팔레트(Palette)는 AI 기술을 활용한 이미지 생성 및 블로그 서비스를
              제공합니다. 본 약관은 팔레트(Palette) 서비스 이용에 관한 조건 및
              절차, 당사와 이용자의 권리, 의무, 책임사항을 규정합니다.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>AI 기반 이미지 생성 서비스</li>
              <li>블로그 작성 및 관리 서비스</li>
              <li>이미지 저장 및 관리 서비스</li>
              <li>카테고리 관리 서비스</li>
            </ul>
          </div>
        </section>

        {/* 2. 서비스 이용 */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            2. 서비스 이용
          </h2>
          <div className="space-y-4 text-gray-700">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              2.1 서비스 이용 신청
            </h3>
            <p>
              서비스 이용을 위해서는 Google 계정을 통한 로그인이 필요합니다.
              로그인 시 수집되는 정보는 개인정보 처리방침에 따릅니다.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2 mt-6">
              2.2 서비스 이용 시간
            </h3>
            <p>
              서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다. 다만,
              시스템 점검, 보수, 교체 등의 경우에는 사전 공지 후 서비스를 일시
              중단할 수 있습니다.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2 mt-6">
              2.3 서비스 이용 제한
            </h3>
            <p>다음의 경우 서비스 이용이 제한될 수 있습니다:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>서비스 이용 목적에 맞지 않는 사용</li>
              <li>타인의 권리를 침해하는 행위</li>
              <li>서비스의 안정성을 해치는 행위</li>
              <li>법령을 위반하는 행위</li>
            </ul>
          </div>
        </section>

        {/* 3. 이용자의 의무 */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            3. 이용자의 의무
          </h2>
          <div className="space-y-4 text-gray-700">
            <p>이용자는 다음 사항을 준수해야 합니다:</p>

            <h3 className="text-lg font-medium text-gray-900 mb-2">
              3.1 준수사항
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>관련 법령 및 본 약관의 준수</li>
              <li>타인의 지적재산권 및 개인정보 보호</li>
              <li>서비스의 안정적 운영을 방해하는 행위 금지</li>
              <li>부정한 목적으로 서비스를 이용하지 않을 것</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2 mt-6">
              3.2 금지사항
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>저작권, 상표권 등 타인의 지적재산권 침해</li>
              <li>음란, 폭력, 차별 등 부적절한 콘텐츠 생성</li>
              <li>서비스의 보안을 침해하는 행위</li>
              <li>타인의 개인정보를 무단으로 수집, 이용하는 행위</li>
              <li>서비스의 정상적인 운영을 방해하는 행위</li>
            </ul>
          </div>
        </section>

        {/* 4. 지적재산권 */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            4. 지적재산권
          </h2>
          <div className="space-y-4 text-gray-700">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              4.1 서비스의 지적재산권
            </h3>
            <p>
              팔레트(Palette) 서비스와 관련된 모든 지적재산권은 당사에
              귀속됩니다. 이용자는 서비스를 통해 생성된 콘텐츠에 대한 권리를
              가지지만, 서비스 자체의 지적재산권은 당사에 있습니다.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2 mt-6">
              4.2 생성된 콘텐츠의 권리
            </h3>
            <p>
              이용자가 서비스를 통해 생성한 이미지 및 콘텐츠의 저작권은 해당
              이용자에게 있습니다. 다만, 다음 사항을 준수해야 합니다:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>타인의 권리를 침해하지 않을 것</li>
              <li>법령을 위반하지 않을 것</li>
              <li>서비스의 안정성을 해치지 않을 것</li>
            </ul>
          </div>
        </section>

        {/* 5. 서비스 제한 및 중단 */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            5. 서비스 제한 및 중단
          </h2>
          <div className="space-y-4 text-gray-700">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              5.1 서비스 중단 사유
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>시스템 점검, 보수, 교체가 필요한 경우</li>
              <li>천재지변, 전쟁, 테러 등 불가항력적 사유</li>
              <li>서비스 이용자의 급증으로 인한 시스템 과부하</li>
              <li>기타 서비스 운영상 필요한 경우</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2 mt-6">
              5.2 서비스 중단 공지
            </h3>
            <p>
              서비스 중단이 예정된 경우 사전에 공지하며, 긴급한 경우에는 사후
              공지할 수 있습니다.
            </p>
          </div>
        </section>

        {/* 6. 책임 제한 */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            6. 책임 제한
          </h2>
          <div className="space-y-4 text-gray-700">
            <p>당사는 다음과 같은 경우 책임을 지지 않습니다:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                천재지변, 전쟁, 테러 등 불가항력적 사유로 인한 서비스 중단
              </li>
              <li>이용자의 귀책사유로 인한 서비스 이용 장애</li>
              <li>이용자가 생성한 콘텐츠로 인한 분쟁</li>
              <li>제3자가 제공하는 서비스의 장애</li>
              <li>이용자의 개인정보 관리 소홀로 인한 피해</li>
            </ul>
          </div>
        </section>

        {/* 7. 분쟁 해결 */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            7. 분쟁 해결
          </h2>
          <div className="space-y-4 text-gray-700">
            <p>
              서비스 이용과 관련하여 분쟁이 발생한 경우, 당사와 이용자는 상호
              협의하여 해결합니다. 협의가 이루어지지 않는 경우, 관련 법령에 따라
              해결합니다.
            </p>
          </div>
        </section>

        {/* 8. 약관 변경 */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            8. 약관 변경
          </h2>
          <div className="space-y-4 text-gray-700">
            <p>
              당사는 서비스의 개선 및 법령 변경 등으로 인해 본 약관을 변경할 수
              있습니다. 약관 변경 시 변경사항을 사전에 공지하며, 이용자가 변경된
              약관에 동의하지 않는 경우 서비스 이용을 중단할 수 있습니다.
            </p>
          </div>
        </section>

        {/* 9. 기타 */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. 기타</h2>
          <div className="space-y-4 text-gray-700">
            <p>
              본 약관에 명시되지 않은 사항은 관련 법령 및 당사가 정한 서비스
              운영정책에 따릅니다.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p>
                <strong>문의사항</strong>
              </p>
              <p>이메일: hello@pltt.xyz</p>
              <p>웹사이트: http://pltt.xyz</p>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
