import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function GET() {
  try {
    console.log("Testing Puppeteer...");

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Navigate to a simple page
    await page.goto("https://httpbin.org/html", {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    const title = await page.title();
    const content = await page.evaluate(() => document.body.textContent);

    await browser.close();

    return NextResponse.json({
      success: true,
      title,
      content: content?.substring(0, 100) + "...",
      message: "Puppeteer is working correctly",
    });
  } catch (error) {
    console.error("Puppeteer test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Puppeteer test failed",
      },
      { status: 500 }
    );
  }
}
