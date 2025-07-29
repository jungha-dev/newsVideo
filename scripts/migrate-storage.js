/**
 * Firebase Storage 마이그레이션 스크립트
 * 기존 구조에서 새로운 사용자별 구조로 파일들을 이동
 */

const admin = require("firebase-admin");
const path = require("path");

// Firebase Admin 초기화
const serviceAccount = require("../keys/serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      "nesvideo-24f56.firebasestorage.com",
  });
}

const db = admin.firestore(app, "news-video");
const storage = admin.storage();
const bucket = storage.bucket();

/**
 * 기존 파일을 새로운 구조로 이동
 */
async function migrateFile(oldPath, newPath, userId) {
  try {
    console.log(`🔄 Migrating: ${oldPath} -> ${newPath}`);

    // 파일 존재 확인
    const [exists] = await bucket.file(oldPath).exists();
    if (!exists) {
      console.log(`⚠️ File not found: ${oldPath}`);
      return false;
    }

    // 새 경로로 복사
    await bucket.file(oldPath).copy(newPath);
    console.log(`✅ Copied: ${oldPath} -> ${newPath}`);

    // 원본 파일 삭제
    await bucket.file(oldPath).delete();
    console.log(`🗑️ Deleted original: ${oldPath}`);

    return true;
  } catch (error) {
    console.error(`❌ Failed to migrate ${oldPath}:`, error);
    return false;
  }
}

/**
 * 사용자별 이미지 마이그레이션
 */
async function migrateUserImages(userId) {
  console.log(`\n📁 Migrating images for user: ${userId}`);

  try {
    // 사용자의 캐릭터 이미지들 가져오기
    const charactersSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("characters")
      .get();

    let migratedCount = 0;
    let failedCount = 0;

    for (const doc of charactersSnapshot.docs) {
      const data = doc.data();

      if (data.storagePath) {
        // 기존 경로에서 새 경로 생성
        const oldPath = data.storagePath;
        const fileName = path.basename(oldPath);
        const category = data.category || "uncategorized";

        const newPath = `users/${userId}/uploads/images/categories/${category}/${fileName}`;

        const success = await migrateFile(oldPath, newPath, userId);
        if (success) {
          // Firestore 문서 업데이트
          await doc.ref.update({
            storagePath: newPath,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          migratedCount++;
        } else {
          failedCount++;
        }
      }
    }

    console.log(`✅ Migrated ${migratedCount} images, ${failedCount} failed`);
    return { migratedCount, failedCount };
  } catch (error) {
    console.error(`❌ Error migrating images for user ${userId}:`, error);
    return { migratedCount: 0, failedCount: 1 };
  }
}

/**
 * 비디오 마이그레이션
 */
async function migrateVideos() {
  console.log("\n🎥 Migrating videos...");

  try {
    const videosSnapshot = await db.collection("videos").get();

    let migratedCount = 0;
    let failedCount = 0;

    for (const doc of videosSnapshot.docs) {
      const data = doc.data();

      if (data.firebaseVideoUrl) {
        const storagePath = extractStoragePath(data.firebaseVideoUrl);

        if (storagePath && storagePath.startsWith("videos/")) {
          const fileName = path.basename(storagePath);
          const userId = data.userId || "system";
          const newPath = `users/${userId}/uploads/videos/generate/runway/${fileName}`;

          const success = await migrateFile(storagePath, newPath, userId);
          if (success) {
            // Firestore 문서 업데이트
            await doc.ref.update({
              storagePath: newPath,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            migratedCount++;
          } else {
            failedCount++;
          }
        }
      }
    }

    console.log(`✅ Migrated ${migratedCount} videos, ${failedCount} failed`);
    return { migratedCount, failedCount };
  } catch (error) {
    console.error("❌ Error migrating videos:", error);
    return { migratedCount: 0, failedCount: 1 };
  }
}

/**
 * Firebase Storage URL에서 파일 경로 추출
 */
function extractStoragePath(url) {
  try {
    const urlObj = new URL(url);

    if (!urlObj.hostname.includes("firebasestorage.googleapis.com")) {
      return null;
    }

    const pathSegments = urlObj.pathname.split("/");

    if (
      pathSegments.length >= 6 &&
      pathSegments[1] === "v0" &&
      pathSegments[2] === "b" &&
      pathSegments[4] === "o"
    ) {
      return decodeURIComponent(pathSegments.slice(5).join("/"));
    }

    return null;
  } catch (error) {
    console.error("Error extracting storage path from URL:", url, error);
    return null;
  }
}

/**
 * 모든 사용자 마이그레이션
 */
async function migrateAllUsers() {
  console.log("🚀 Starting storage migration...");

  try {
    // 모든 사용자 가져오기
    const usersSnapshot = await db.collection("users").get();

    let totalMigrated = 0;
    let totalFailed = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const result = await migrateUserImages(userId);
      totalMigrated += result.migratedCount;
      totalFailed += result.failedCount;
    }

    // 비디오 마이그레이션
    const videoResult = await migrateVideos();
    totalMigrated += videoResult.migratedCount;
    totalFailed += videoResult.failedCount;

    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Total migrated: ${totalMigrated}`);
    console.log(`❌ Total failed: ${totalFailed}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
}

/**
 * 특정 사용자만 마이그레이션
 */
async function migrateSpecificUser(userId) {
  console.log(`🚀 Starting migration for user: ${userId}`);

  try {
    const result = await migrateUserImages(userId);
    console.log(`\n🎉 Migration completed for user ${userId}!`);
    console.log(`✅ Migrated: ${result.migratedCount}`);
    console.log(`❌ Failed: ${result.failedCount}`);
  } catch (error) {
    console.error(`❌ Migration failed for user ${userId}:`, error);
  }
}

// 스크립트 실행
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length > 0 && args[0] === "--user") {
    const userId = args[1];
    if (userId) {
      migrateSpecificUser(userId);
    } else {
      console.error("Please provide a user ID");
      process.exit(1);
    }
  } else {
    migrateAllUsers();
  }
}

module.exports = {
  migrateAllUsers,
  migrateSpecificUser,
  migrateUserImages,
  migrateVideos,
};
