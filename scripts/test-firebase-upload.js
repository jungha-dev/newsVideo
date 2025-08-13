const { getStorage } = require("firebase-admin/storage");
const admin = require("firebase-admin");

// Firebase Admin 초기화 (테스트용)
if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

/**
 * Replicate URL에서 비디오를 다운로드하여 Firebase Storage에 업로드 테스트
 */
async function testFirebaseUpload() {
  try {
    console.log("🧪 Firebase Storage 업로드 테스트 시작...");

    // 테스트용 Replicate URL (실제 존재하는 URL로 변경 필요)
    const replicateUrl =
      "https://replicate.delivery/pbxt/4kW7nw0IBIscFIOEj8UjSBQdOoTqgIS0Vkjsbt3Kf8uAeTkB/out-0.mp4";
    const userId = "test-user";
    const videoId = "test-video-123";
    const sceneIndex = 0;

    console.log(`📥 Replicate에서 비디오 다운로드 시작: ${replicateUrl}`);

    // Replicate URL에서 비디오 다운로드
    const videoResponse = await fetch(replicateUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    console.log(`📦 비디오 버퍼 크기: ${videoBuffer.byteLength} bytes`);

    // Firebase Storage 경로 설정 (video_1.mp4, video_2.mp4 형태)
    const fileName = `video_${sceneIndex + 1}.mp4`;
    const storagePath = `users/${userId}/newsVideo/${videoId}/${fileName}`;

    // Firebase Admin Storage 사용
    const adminStorage = getStorage();
    const bucket = adminStorage.bucket();
    const file = bucket.file(storagePath);

    // Firebase Storage에 업로드
    console.log(`📤 Firebase Storage 업로드 시작: ${storagePath}`);
    await file.save(Buffer.from(videoBuffer), {
      metadata: {
        contentType: "video/mp4",
      },
    });

    // 파일을 공개로 설정 (makePublic)
    await file.makePublic();

    // 공개 URL 생성
    const publicURL = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    const downloadURL = publicURL;

    console.log(`✅ Firebase Storage 업로드 완료:`);
    console.log(`   📁 경로: ${storagePath}`);
    console.log(`   📄 파일명: ${fileName}`);
    console.log(`   🔗 Firebase 공개 URL: ${downloadURL}`);

    // 업로드된 파일 확인
    const [exists] = await file.exists();
    console.log(`   ✅ 파일 존재 확인: ${exists}`);

    // 공개 접근 테스트
    const publicAccessResponse = await fetch(downloadURL);
    console.log(`   🌐 공개 접근 테스트: ${publicAccessResponse.status}`);

    return downloadURL;
  } catch (error) {
    console.error("❌ Firebase Storage 업로드 테스트 실패:", error);
    throw error;
  }
}

// 테스트 실행
if (require.main === module) {
  testFirebaseUpload()
    .then((url) => {
      console.log("🎉 테스트 완료! 업로드된 URL:", url);
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 테스트 실패:", error);
      process.exit(1);
    });
}

module.exports = { testFirebaseUpload };
