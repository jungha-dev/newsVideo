import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function POST(request: NextRequest) {
  try {
    const { url, selectors, targetId, targetClass } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log("Starting crawl for:", url);

    // Launch browser with explicit Chrome path and additional options
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_PATH || undefined, // 환경 변수에서 Chrome 경로 지정
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-images",
          "--disable-javascript",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
        ],
      });
    } catch (error) {
      console.log(
        "Chrome 경로를 찾을 수 없습니다. Puppeteer 브라우저를 사용합니다."
      );
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-images",
          "--disable-javascript",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
        ],
      });
    }

    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Navigate to the page
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait a bit for dynamic content
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let results: any = {};

    // If specific target ID is provided, extract images from that element
    if (targetId) {
      try {
        const result = await page.evaluate((id) => {
          const targetElement = document.getElementById(id);
          if (!targetElement) {
            return { error: `Element with ID '${id}' not found` };
          }

          const imgElements = targetElement.querySelectorAll("img");
          const images = Array.from(imgElements).map((img) => {
            // Amazon 고화질 이미지 우선 추출
            const oldHires = img.getAttribute("data-old-hires");
            const src = img.src;

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

            // 더 큰 해상도 이미지 URL 찾기
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
              alt: img.alt,
              width: img.width,
              height: img.height,
              className: img.className,
            };
          });

          return { images: images.filter((img) => img !== null) };
        }, targetId);

        if ("error" in result) {
          results = { error: result.error };
        } else {
          results = {
            targetId,
            images: result.images,
            totalImages: result.images.length,
          };
        }
      } catch (error) {
        console.error(`Error extracting images from ID '${targetId}':`, error);
        results = { error: `Failed to extract images from ID '${targetId}'` };
      }
    }
    // If specific target class is provided, extract images from elements with that class
    else if (targetClass) {
      try {
        const result = await page.evaluate((className) => {
          const targetElements = document.querySelectorAll(`.${className}`);
          if (targetElements.length === 0) {
            return { error: `Elements with class '${className}' not found` };
          }

          const allImages: any[] = [];
          targetElements.forEach((element) => {
            const imgElements = element.querySelectorAll("img");
            Array.from(imgElements).forEach((img) => {
              // Amazon 고화질 이미지 우선 추출
              const oldHires = img.getAttribute("data-old-hires");
              const src = img.src;

              // UI 요소 필터링 (360도 뷰, 비디오 플레이 버튼 등 제외)
              if (
                src.includes("imageBlock-360-thumbnail-icon") ||
                src.includes("play-button-mb-image-grid") ||
                src.includes("imageBlock-360") ||
                src.includes("play-button") ||
                src.includes("HomeCustomProduct")
              ) {
                return; // UI 요소는 제외
              }

              // 더 큰 해상도 이미지 URL 찾기
              let bestImageUrl = src;
              if (oldHires) {
                bestImageUrl = oldHires;
              } else if (src.includes("_AC_")) {
                // Amazon 이미지 URL을 고화질로 변경
                bestImageUrl = src.replace(/\.(_AC_).*?_\./, "._AC_SL1500_.");
              }

              allImages.push({
                src: bestImageUrl,
                originalSrc: src,
                oldHires: oldHires,
                alt: img.alt,
                width: img.width,
                height: img.height,
                className: img.className,
              });
            });
          });

          return { images: allImages };
        }, targetClass);

        if ("error" in result) {
          results = { error: result.error };
        } else {
          results = {
            targetClass,
            images: result.images,
            totalImages: result.images.length,
          };
        }
      } catch (error) {
        console.error(
          `Error extracting images from class '${targetClass}':`,
          error
        );
        results = {
          error: `Failed to extract images from class '${targetClass}'`,
        };
      }
    }
    // If specific selectors are provided, extract data from them
    else if (selectors && Array.isArray(selectors)) {
      for (const selector of selectors) {
        try {
          const elements = await page.$$(selector.selector);
          const data: any[] = [];

          for (const element of elements) {
            const text = await element.evaluate((el) => el.textContent?.trim());
            const href = await element.evaluate((el) =>
              el.getAttribute("href")
            );
            const src = await element.evaluate((el) => el.getAttribute("src"));

            data.push({
              text,
              href,
              src,
            });
          }

          results[selector.name] = data;
        } catch (error) {
          console.error(
            `Error extracting data for selector ${selector.name}:`,
            error
          );
          results[selector.name] = [];
        }
      }
    } else {
      // Default extraction: get all images and links
      const images = await page.evaluate(() => {
        const imgElements = document.querySelectorAll("img");
        return Array.from(imgElements).map((img) => {
          // Amazon 고화질 이미지 우선 추출
          const oldHires = img.getAttribute("data-old-hires");
          const src = img.src;

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

          // 더 큰 해상도 이미지 URL 찾기
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
            alt: img.alt,
            width: img.width,
            height: img.height,
          };
        });
      });

      const links = await page.evaluate(() => {
        const linkElements = document.querySelectorAll("a");
        return Array.from(linkElements).map((link) => ({
          href: link.href,
          text: link.textContent?.trim(),
        }));
      });

      const title = await page.title();
      const description = await page.evaluate(() => {
        const metaDesc = document.querySelector('meta[name="description"]');
        return metaDesc?.getAttribute("content") || "";
      });

      // HTML 파싱을 위한 추가 데이터
      const htmlContent = await page.content();

      results = {
        title,
        description,
        images,
        links,
        htmlContent,
      };
    }

    await browser.close();

    return NextResponse.json({
      success: true,
      url,
      data: results,
    });
  } catch (error) {
    console.error("Crawling error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to crawl the website";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
