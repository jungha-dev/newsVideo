const admin = require("firebase-admin");
const serviceAccount = require("../keys/serviceAccountKey.json");

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "nesvideo-24f56.appspot.com",
});

const db = admin.firestore(app, "news-video");

async function fixFirebaseUrls() {
  try {
    console.log(
      "Firebase Storage URL을 Replicate URL로 교체하는 작업을 시작합니다..."
    );

    // 모든 사용자의 connectedVideo 프로젝트 조회
    const usersSnapshot = await db.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`사용자 ${userId} 처리 중...`);

      const projectsSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("connectedVideo")
        .get();

      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        console.log(`  프로젝트 ${projectId} 처리 중...`);

        const videosSnapshot = await projectDoc.ref.collection("videos").get();

        for (const videoDoc of videosSnapshot.docs) {
          const videoData = videoDoc.data();

          // Firebase Storage URL이 있는지 확인
          if (videoData.output && videoData.output.includes("firebase")) {
            console.log(`    비디오 ${videoDoc.id}: Firebase URL 발견`);
            console.log(`    기존 URL: ${videoData.output}`);

            // Replicate prediction ID가 있는지 확인
            if (videoData.prediction_id) {
              try {
                // Replicate API에서 최신 상태 확인
                const response = await fetch(
                  `https://api.replicate.com/v1/predictions/${videoData.prediction_id}`,
                  {
                    headers: {
                      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
                      "Content-Type": "application/json",
                    },
                  }
                );

                if (response.ok) {
                  const replicateData = await response.json();

                  if (replicateData.output && replicateData.output.length > 0) {
                    const replicateUrl = replicateData.output[0];
                    console.log(`    Replicate URL: ${replicateUrl}`);

                    // Firestore 업데이트
                    await videoDoc.ref.update({
                      output: replicateUrl,
                      updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    console.log(`    ✅ URL 교체 완료`);
                  } else {
                    console.log(`    ❌ Replicate에서 출력 URL을 찾을 수 없음`);
                  }
                } else {
                  console.log(
                    `    ❌ Replicate API 호출 실패: ${response.status}`
                  );
                }
              } catch (error) {
                console.error(`    ❌ Replicate API 에러:`, error);
              }
            } else {
              console.log(`    ❌ prediction_id가 없음`);
            }
          }
        }
      }
    }

    console.log("모든 작업이 완료되었습니다.");
  } catch (error) {
    console.error("스크립트 실행 중 에러:", error);
  } finally {
    process.exit(0);
  }
}

// 스크립트 실행
fixFirebaseUrls();
