"use client";

import React, { useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Button,
  Input,
  Textarea,
  Select,
  PageLayout,
} from "../../../components/styled";
import { Page } from "puppeteer";

interface CrawlResult {
  success: boolean;
  url: string;
  data: any;
}

interface Selector {
  name: string;
  selector: string;
}

const extractImagesFromHTML = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const imgElements = doc.querySelectorAll("img");

  return Array.from(imgElements)
    .map((img) => {
      const src = img.getAttribute("src") || "";
      const oldHires = img.getAttribute("data-old-hires");

      // UI 요소 필터링 (360도 뷰, 비디오 플레이 버튼 등 제외)
      if (
        src.includes("imageBlock-360-thumbnail-icon") ||
        src.includes("play-button-mb-image-grid") ||
        src.includes("imageBlock-360") ||
        src.includes("play-button") ||
        src.includes("HomeCustomProduct")
      ) {
        return null; // UI 요소는 제외
      }

      // Amazon 고화질 이미지 우선 추출
      let bestImageUrl = src;
      if (oldHires) {
        bestImageUrl = oldHires;
      } else if (src.includes("_AC_")) {
        // Amazon 이미지 URL을 고화질로 변경
        bestImageUrl = src.replace(/\.(_AC_).*?_\./, "._AC_SL1500_.");
      }

      return {
        src: bestImageUrl,
        originalSrc: src,
        oldHires: oldHires,
        alt: img.getAttribute("alt") || "",
        width: img.width || 0,
        height: img.height || 0,
      };
    })
    .filter((img) => img && img.src && img.src.trim() !== "");
};

export default function CrawlerPage() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [isCrawling, setIsCrawling] = useState(false);
  const [results, setResults] = useState<CrawlResult | null>(null);
  const [error, setError] = useState("");
  const [customSelectors, setCustomSelectors] = useState<Selector[]>([]);
  const [crawlMode, setCrawlMode] = useState<
    "default" | "custom" | "html" | "target"
  >("default");
  const [htmlInput, setHtmlInput] = useState("");
  const [targetId, setTargetId] = useState("");
  const [targetClass, setTargetClass] = useState("");

  const handleCrawl = async () => {
    if (crawlMode !== "html" && !url.trim()) {
      setError("URL을 입력해주세요.");
      return;
    }

    if (crawlMode !== "html") {
      try {
        new URL(url);
      } catch {
        setError("올바른 URL 형식을 입력해주세요. (예: https://example.com)");
        return;
      }
    }

    setIsCrawling(true);
    setError("");
    setResults(null);

    try {
      let payload: any = { url };

      if (crawlMode === "custom" && customSelectors.length > 0) {
        payload.selectors = customSelectors;
      } else if (crawlMode === "html" && htmlInput.trim()) {
        // HTML 파싱 모드
        const extractedImages = extractImagesFromHTML(htmlInput);
        setResults({
          success: true,
          url: "HTML Input",
          data: { images: extractedImages },
        });
        return;
      } else if (crawlMode === "target") {
        if (targetId.trim()) {
          payload.targetId = targetId.trim();
        } else if (targetClass.trim()) {
          payload.targetClass = targetClass.trim();
        } else {
          setError("ID 또는 클래스를 입력해주세요.");
          return;
        }
      }

      const response = await fetch("/api/crawler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          data.error || `HTTP ${response.status}: 크롤링에 실패했습니다.`;
        throw new Error(errorMessage);
      }

      setResults(data);
    } catch (error) {
      console.error("Crawling error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "크롤링 중 오류가 발생했습니다."
      );
    } finally {
      setIsCrawling(false);
    }
  };

  const addSelector = () => {
    setCustomSelectors([...customSelectors, { name: "", selector: "" }]);
  };

  const updateSelector = (
    index: number,
    field: "name" | "selector",
    value: string
  ) => {
    const newSelectors = [...customSelectors];
    newSelectors[index][field] = value;
    setCustomSelectors(newSelectors);
  };

  const removeSelector = (index: number) => {
    setCustomSelectors(customSelectors.filter((_, i) => i !== index));
  };

  const downloadResults = () => {
    if (!results) return;

    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `crawl-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadTestHTML = () => {
    const testHTML = `<ul class="a-unordered-list a-nostyle a-button-list a-declarative a-button-toggle-group a-vertical a-spacing-top-micro gridAltImageViewLayoutIn1x7" role="radiogroup" data-action="a-button-group">                                                                                                                                                                                                                                    <li class="a-spacing-small videoCountTemplate aok-hidden"><span class="a-list-item"> <span id="videoCount_template" class="a-size-mini a-color-secondary video-count a-text-bold a-nowrap"> </span> </span></li>                            <li class="a-spacing-small 360IngressTemplate pos-360 aok-hidden"><span class="a-list-item"> <span class="a-declarative" data-action="thumb-action" data-thumb-action="{}">   <span class="a-button a-button-thumbnail a-button-toggle" id="a-autoid-2"><span class="a-button-inner"><input role="radio" aria-checked="false" class="a-button-input" type="submit" aria-labelledby="a-autoid-2-announce" aria-posinset="1" aria-setsize="9"><span class="a-button-text" aria-hidden="true" id="a-autoid-2-announce">  <div class="imageBlockThumbnailImageGrayOverlay"></div> <img alt="" src="https://m.media-amazon.com/images/G/01/HomeCustomProduct/imageBlock-360-thumbnail-icon-small._CB612115888_FMpng_RI_.png"> </span></span></span>    </span> </span></li>    <li class="a-spacing-small template"><span class="a-list-item">   <span class="a-button a-button-thumbnail a-button-toggle" id="a-autoid-3"><span class="a-button-inner"><input role="radio" aria-checked="false" class="a-button-input" type="submit" aria-labelledby="a-autoid-3-announce" aria-posinset="2" aria-setsize="9"><span class="a-button-text" aria-hidden="true" id="a-autoid-3-announce"> <span class="placeHolder"></span>   <span class="textMoreImages"></span>  </span></span></span>    </span> </li> <li class="a-spacing-small item imageThumbnail a-declarative" data-ux-click="" data-csa-c-type="uxElement" data-csa-c-element-type="navigational" data-csa-c-action="image-block-alt-image-hover" data-csa-c-posy="1" data-csa-c-id="waljtt-kve7xf-snw18x-dwmlvg"><span class="a-list-item">   <span class="a-button a-button-thumbnail a-button-toggle" id="a-autoid-4"><span class="a-button-inner"><input role="radio" aria-checked="false" class="a-button-input" type="submit" aria-labelledby="a-autoid-4-announce" aria-posinset="3" aria-setsize="9"><span class="a-button-text" aria-hidden="true" id="a-autoid-4-announce"> <div class="imageBlockThumbnailImageGrayOverlay"></div><img src="https://m.media-amazon.com/images/I/41HI3YF3zkL._AC_US100_.jpg">   <span class="textMoreImages">10+</span>  </span></span></span>    </span> </li><li class="a-spacing-small item imageThumbnail a-declarative" data-ux-click="" data-csa-c-type="uxElement" data-csa-c-element-type="navigational" data-csa-c-action="image-block-alt-image-hover" data-csa-c-posy="2" data-csa-c-id="yvwq7j-xp57rl-6rszie-x5woby"><span class="a-list-item">   <span class="a-button a-button-thumbnail a-button-toggle" id="a-autoid-5"><span class="a-button-inner"><input role="radio" aria-checked="false" class="a-button-input" type="submit" aria-labelledby="a-autoid-5-announce" aria-posinset="4" aria-setsize="9"><span class="a-button-text" aria-hidden="true" id="a-autoid-5-announce"> <div class="imageBlockThumbnailImageGrayOverlay"></div><img src="https://m.media-amazon.com/images/I/41-ZawPgtJL._AC_US100_.jpg">   <span class="textMoreImages">9+</span>  </span></span></span>    </span> </li><li class="a-spacing-small item imageThumbnail a-declarative" data-ux-click="" data-csa-c-type="uxElement" data-csa-c-element-type="navigational" data-csa-c-action="image-block-alt-image-hover" data-csa-c-posy="3" data-csa-c-id="cdqik8-kej7bu-s20dtt-aisr1q"><span class="a-list-item">   <span class="a-button a-button-thumbnail a-button-toggle a-button-selected a-button-focus" id="a-autoid-6"><span class="a-button-inner"><input role="radio" aria-checked="false" class="a-button-input" type="submit" aria-labelledby="a-autoid-6-announce" aria-posinset="5" aria-setsize="9"><span class="a-button-text" aria-hidden="true" id="a-autoid-6-announce"> <div class="imageBlockThumbnailImageGrayOverlay"></div><img src="https://m.media-amazon.com/images/I/51chIoeftJL._AC_US100_.jpg">   <span class="textMoreImages">8+</span>  </span></span></span>    </span> </li><li class="a-spacing-small item imageThumbnail a-declarative" data-ux-click="" data-csa-c-type="uxElement" data-csa-c-element-type="navigational" data-csa-c-action="image-block-alt-image-hover" data-csa-c-posy="4" data-csa-c-id="aevefe-wnlhxv-k8bg35-u7z5b8"><span class="a-list-item">   <span class="a-button a-button-thumbnail a-button-toggle" id="a-autoid-7"><span class="a-button-inner"><input role="radio" aria-checked="false" class="a-button-input" type="submit" aria-labelledby="a-autoid-7-announce" aria-posinset="6" aria-setsize="9"><span class="a-button-text" aria-hidden="true" id="a-autoid-7-announce"> <div class="imageBlockThumbnailImageGrayOverlay"></div><img src="https://m.media-amazon.com/images/I/41Kv1c0SvOL._AC_US100_.jpg">   <span class="textMoreImages">7+</span>  </span></span></span>    </span> </li><li class="a-spacing-small item imageThumbnail a-declarative" data-ux-click="" data-csa-c-type="uxElement" data-csa-c-element-type="navigational" data-csa-c-action="image-block-alt-image-hover" data-csa-c-posy="5" data-csa-c-id="if9mwi-6lef7z-oiarxf-91nq5f"><span class="a-list-item">   <span class="a-button a-button-thumbnail a-button-toggle" id="a-autoid-8"><span class="a-button-inner"><input role="radio" aria-checked="false" class="a-button-input" type="submit" aria-labelledby="a-autoid-8-announce" aria-posinset="7" aria-setsize="9"><span class="a-button-text" aria-hidden="true" id="a-autoid-8-announce"> <div class="imageBlockThumbnailImageGrayOverlay"></div><img src="https://m.media-amazon.com/images/I/412wskHrMcL._AC_US100_.jpg">   <span class="textMoreImages">6+</span>  </span></span></span>    </span> </li><li class="a-spacing-small item imageThumbnail a-declarative overlayRestOfImages" data-ux-click="" data-csa-c-type="uxElement" data-csa-c-element-type="navigational" data-csa-c-action="image-block-alt-image-hover" data-csa-c-posy="6" data-csa-c-id="k430uv-3enz65-x1yicl-n90xbi"><span class="a-list-item">   <span class="a-button a-button-thumbnail a-button-toggle" id="a-autoid-9"><span class="a-button-inner"><input role="radio" aria-checked="false" class="a-button-input" type="submit" aria-labelledby="a-autoid-9-announce" aria-posinset="8" aria-setsize="9"><span class="a-button-text" aria-hidden="true" id="a-autoid-9-announce"> <div class="imageBlockThumbnailImageGrayOverlay"></div><div class="lastAltImageOverlay lastAltImageOverlay-t2"></div><img src="https://m.media-amazon.com/images/I/51PqYSeAErL._AC_US100_.jpg">   <span class="textMoreImages textMoreImages-t2">5+</span>  </span></span></span>    </span> </li><li class="a-spacing-small item videoThumbnail videoBlockIngress videoBlockDarkIngress a-align-top videoImageBlockGridView a-declarative multiple-videos" data-ux-click="" data-csa-c-type="uxElement" data-csa-c-element-type="navigational" data-csa-c-action="image-block-alt-image-clickToImmersiveVideos" data-csa-c-posy="7" data-csa-c-id="6487l3-r0fsfq-tzde4o-b2x7x3"><span class="a-list-item">   <span class="a-button a-button-thumbnail a-button-toggle" id="a-autoid-10"><span class="a-button-inner"><input role="radio" aria-checked="false" class="a-button-input" type="submit" aria-labelledby="a-autoid-10-announce" aria-posinset="9" aria-setsize="9"><span class="a-button-text" aria-hidden="true" id="a-autoid-10-announce"> <div class="imageBlockThumbnailImageGrayOverlay"></div><img src="https://m.media-amazon.com/images/I/6177vI7TNWL.SS125_PKplay-button-mb-image-grid-small_.jpg">   <span class="textMoreImages"></span>  </span></span></span>    </span><span id="videoCount" class="a-size-mini a-color-secondary video-count a-text-bold a-nowrap">5 VIDEOS</span></li></ul>`;
    setHtmlInput(testHTML);
    setCrawlMode("html");
  };

  if (!user) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-8">
          <div className="bg-yellow-50 border-1 border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
            <div className="text-yellow-800 text-lg font-semibold mb-2">
              로그인이 필요합니다
            </div>
            <p className="text-yellow-700 text-sm mb-4">
              크롤링 기능을 사용하려면 로그인해주세요.
            </p>
            <a href="/login" className="inline-block">
              <Button variant="primary">로그인하기</Button>
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <PageLayout title="웹 크롤러">
      {/* 크롤링 설정 */}
      <div className="bg-white rounded-lg space-y-6">
        <div>
          <Input
            label="대상 URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full"
          />
        </div>

        {/* 크롤링 모드 선택 */}
        <div>
          <Select
            label="크롤링 모드 선택"
            value={crawlMode}
            helperText={`현재 선택된 모드: ${crawlMode}`}
            onChange={(value) => {
              console.log("크롤링 모드 변경:", value);
              setCrawlMode(value as "default" | "custom" | "html" | "target");
            }}
            options={[
              { value: "default", label: "기본 모드 (이미지, 링크, 제목)" },
              { value: "custom", label: "커스텀 선택자" },
              { value: "html", label: "HTML 직접 입력" },
              { value: "target", label: "특정 ID/클래스에서 이미지 추출" },
            ]}
          />
        </div>

        {/* HTML 직접 입력 */}
        {crawlMode === "html" && (
          <div className="space-y-4">
            <div>
              <Textarea
                label="HTML 코드 입력"
                value={htmlInput}
                onChange={(e) => setHtmlInput(e.target.value)}
                placeholder="HTML 코드를 여기에 붙여넣으세요..."
                rows={10}
                className="w-full"
              />
            </div>
            <div className="text-sm text-gray-600">
              HTML에서 img 태그의 src 속성을 자동으로 추출합니다.
            </div>
          </div>
        )}

        {/* 특정 ID/클래스에서 이미지 추출 */}
        {crawlMode === "target" && (
          <div className="space-y-4">
            <div>
              <Input
                label="대상 ID"
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="altImages"
                className="w-full"
                helperText="특정 ID를 가진 요소 안의 이미지들만 추출합니다."
              />
            </div>

            <div className="text-center text-gray-500">또는</div>

            <div>
              <Input
                label="대상 클래스"
                type="text"
                helperText="특정 클래스를 가진 요소 안의 이미지들만 추출합니다."
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                placeholder="image-gallery"
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* 커스텀 선택자 설정 */}
        {crawlMode === "custom" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">
                커스텀 선택자
              </label>
              <Button
                onClick={addSelector}
                className="bg-gray-600 hover:bg-gray-700"
              >
                + 선택자 추가
              </Button>
            </div>

            {customSelectors.map((selector, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <Input
                    label="선택자 이름"
                    type="text"
                    value={selector.name}
                    onChange={(e) =>
                      updateSelector(index, "name", e.target.value)
                    }
                    placeholder="예: 제목, 가격, 이미지"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label="CSS선택자"
                    type="text"
                    value={selector.selector}
                    onChange={(e) =>
                      updateSelector(index, "selector", e.target.value)
                    }
                    placeholder="예: h1, .price, img"
                  />
                </div>
                <Button
                  onClick={() => removeSelector(index)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  삭제
                </Button>
              </div>
            ))}

            {customSelectors.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                커스텀 선택자를 추가해주세요.
              </div>
            )}
          </div>
        )}

        {/* 테스트 버튼 */}
        {crawlMode === "html" && (
          <Button
            onClick={loadTestHTML}
            className="w-full bg-gray-600 hover:bg-gray-700 mb-2"
          >
            테스트 HTML 로드 (Amazon 이미지)
          </Button>
        )}

        {/* altImages ID 테스트 버튼 */}
        {crawlMode === "target" && (
          <Button
            variant="primary-full"
            onClick={() => setTargetId("altImages")}
          >
            altImages ID 설정
          </Button>
        )}

        {/* 크롤링 버튼 */}
        <Button
          onClick={handleCrawl}
          disabled={
            isCrawling ||
            (crawlMode !== "html" && crawlMode !== "target" && !url.trim()) ||
            (crawlMode === "html" && !htmlInput.trim()) ||
            (crawlMode === "target" &&
              !url.trim() &&
              !targetId.trim() &&
              !targetClass.trim())
          }
          className="w-full"
        >
          {isCrawling ? "크롤링 중..." : "크롤링 시작"}
        </Button>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* 결과 표시 */}
      {results && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">크롤링 결과</h2>
            <Button
              onClick={downloadResults}
              className="bg-primary hover:bg-primary-dark"
            >
              결과 다운로드 (JSON)
            </Button>
          </div>

          <div className="space-y-4">
            {/* 기본 정보 */}
            <div>
              <h3 className="font-semibold text-lg mb-2">기본 정보</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p>
                  <strong>URL:</strong> {results.url}
                </p>
                {results.data.title && (
                  <p>
                    <strong>제목:</strong> {results.data.title}
                  </p>
                )}
                {results.data.description && (
                  <p>
                    <strong>설명:</strong> {results.data.description}
                  </p>
                )}
                {results.data.error && (
                  <p className="text-red-600">
                    <strong>오류:</strong> {results.data.error}
                  </p>
                )}
              </div>
            </div>

            {/* 특정 ID/클래스 결과 */}
            {(results.data.targetId || results.data.targetClass) &&
              results.data.images &&
              results.data.images.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {results.data.targetId
                      ? `ID "${results.data.targetId}"`
                      : `클래스 "${results.data.targetClass}"`}
                    에서 추출한 이미지 ({results.data.totalImages}개)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                    {results.data.images
                      .slice(0, 9)
                      .map((img: any, index: number) => (
                        <div
                          key={index}
                          className="border rounded-lg p-3 w-full max-w-sm"
                        >
                          <img
                            src={img.src}
                            alt={img.alt || `Image ${index + 1}`}
                            className="w-full h-32 object-cover rounded mb-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "/placeholder-image.png";
                            }}
                          />
                          <p className="text-sm text-gray-600 truncate">
                            {img.src}
                          </p>
                          {img.originalSrc && img.originalSrc !== img.src && (
                            <p className="text-xs text-gray-500">
                              원본: {img.originalSrc}
                            </p>
                          )}
                          {img.alt && (
                            <p className="text-xs text-gray-500">{img.alt}</p>
                          )}
                        </div>
                      ))}
                  </div>
                  {results.data.images.length > 9 && (
                    <p className="text-sm text-gray-500 mt-2">
                      ... 및 {results.data.images.length - 9}개 더
                    </p>
                  )}
                </div>
              )}

            {/* 일반 이미지 결과 (기본 모드용) */}
            {!results.data.targetId &&
              !results.data.targetClass &&
              results.data.images &&
              results.data.images.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    이미지 ({results.data.images.length}개)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                    {results.data.images
                      .slice(0, 9)
                      .map((img: any, index: number) => (
                        <div
                          key={index}
                          className="border rounded-lg p-3 w-full max-w-sm"
                        >
                          <img
                            src={img.src}
                            alt={img.alt || `Image ${index + 1}`}
                            className="w-full h-32 object-cover rounded mb-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "/placeholder-image.png";
                            }}
                          />
                          <p className="text-sm text-gray-600 truncate">
                            {img.src}
                          </p>
                          {img.originalSrc && img.originalSrc !== img.src && (
                            <p className="text-xs text-gray-500">
                              원본: {img.originalSrc}
                            </p>
                          )}
                          {img.alt && (
                            <p className="text-xs text-gray-500">{img.alt}</p>
                          )}
                        </div>
                      ))}
                  </div>
                  {results.data.images.length > 9 && (
                    <p className="text-sm text-gray-500 mt-2">
                      ... 및 {results.data.images.length - 9}개 더
                    </p>
                  )}
                </div>
              )}

            {/* 링크 결과 */}
            {results.data.links && results.data.links.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  링크 ({results.data.links.length}개)
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {results.data.links
                    .slice(0, 20)
                    .map((link: any, index: number) => (
                      <div key={index} className="border rounded p-2">
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary-dark text-sm break-all"
                        >
                          {link.href}
                        </a>
                        {link.text && (
                          <p className="text-xs text-gray-500 mt-1">
                            {link.text}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
                {results.data.links.length > 20 && (
                  <p className="text-sm text-gray-500 mt-2">
                    ... 및 {results.data.links.length - 20}개 더
                  </p>
                )}
              </div>
            )}

            {/* 커스텀 선택자 결과 */}
            {crawlMode === "custom" && customSelectors.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  커스텀 선택자 결과
                </h3>
                <div className="space-y-4">
                  {customSelectors.map((selector, index) => {
                    const data = results.data[selector.name];
                    if (!data || data.length === 0) return null;

                    return (
                      <div key={index} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">{selector.name}</h4>
                        <div className="space-y-2">
                          {data
                            .slice(0, 5)
                            .map((item: any, itemIndex: number) => (
                              <div
                                key={itemIndex}
                                className="bg-gray-50 p-2 rounded"
                              >
                                {item.text && (
                                  <p>
                                    <strong>텍스트:</strong> {item.text}
                                  </p>
                                )}
                                {item.href && (
                                  <p>
                                    <strong>링크:</strong> {item.href}
                                  </p>
                                )}
                                {item.src && (
                                  <p>
                                    <strong>이미지:</strong> {item.src}
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                        {data.length > 5 && (
                          <p className="text-sm text-gray-500 mt-2">
                            ... 및 {data.length - 5}개 더
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 전체 결과 JSON */}
            <details className="border rounded-lg">
              <summary className="p-4 cursor-pointer font-medium">
                전체 결과 JSON 보기
              </summary>
              <pre className="p-4 bg-gray-50 text-sm overflow-x-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
