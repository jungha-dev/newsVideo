/**
 * 사용자별 스토리지 경로 생성 유틸리티
 */

export interface StoragePathOptions {
  userId: string;
  filename?: string;
  category?: string;
  characterId?: string;
  timestamp?: number;
}

/**
 * 이미지 업로드 경로 생성
 */
export function getImageUploadPath({
  userId,
  filename,
  category = "uncategorized",
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_image`;
  return `users/${userId}/uploads/images/categories/${category}/${safeFilename}`;
}

/**
 * 캐릭터 이미지 경로 생성
 */
export function getCharacterImagePath({
  userId,
  characterId,
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_character`;
  return `users/${userId}/uploads/images/characters/${characterId}/${safeFilename}`;
}

/**
 * 비디오 에셋 썸네일 경로 생성
 */
export function getVideoThumbnailPath({
  userId,
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_thumbnail`;
  return `users/${userId}/uploads/images/video-assets/thumbnails/${safeFilename}`;
}

/**
 * 생성된 이미지 경로 생성
 */
export function getGeneratedImagePath({
  userId,
  category = "generate",
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_generated`;
  return `users/${userId}/uploads/images/generate/${category}/${safeFilename}`;
}

/**
 * 사용자별 생성된 이미지 경로 생성
 */
export function getUserGeneratedImagePath({
  userId,
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_generated`;
  return `users/${userId}/generatedImg/${safeFilename}`;
}

/**
 * 멀티 생성 이미지 경로 생성
 */
export function getMultiGenerateImagePath({
  userId,
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_multi`;
  return `users/${userId}/uploads/images/multi-generate/${safeFilename}`;
}

/**
 * 비디오 생성 경로 생성
 */
export function getVideoGeneratePath({
  userId,
  category = "generate",
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_video`;
  return `users/${userId}/uploads/videos/generate/${category}/${safeFilename}`;
}

/**
 * 멀티 비디오 생성 경로 생성
 */
export function getMultiVideoGeneratePath({
  userId,
  category = "multi-generate",
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_multi_video`;
  return `users/${userId}/uploads/videos/multi-generate/${category}/${safeFilename}`;
}

/**
 * 아바타 이미지 경로 생성
 */
export function getAvatarPath({
  userId,
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_avatar`;
  return `users/${userId}/avatars/${safeFilename}`;
}

/**
 * 연결된 영상 이미지 경로 생성
 */
export function getConnectedVideoImagePath({
  userId,
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_connected`;
  return `users/${userId}/uploads/images/connected-videos/${safeFilename}`;
}

/**
 * 연결된 영상 비디오 경로 생성
 */
export function getConnectedVideoPath({
  userId,
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_connected_video`;
  return `users/${userId}/uploads/videos/connected-videos/${safeFilename}`;
}

/**
 * 뉴스 비디오 경로 생성
 */
export function getNewsVideoPath({
  userId,
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_news_video`;
  return `users/${userId}/uploads/videos/news/${safeFilename}`;
}

/**
 * 뉴스 비디오 썸네일 경로 생성
 */
export function getNewsVideoThumbnailPath({
  userId,
  filename,
}: StoragePathOptions): string {
  const timestamp = Date.now();
  const safeFilename = filename || `${timestamp}_news_thumbnail`;
  return `users/${userId}/uploads/images/news/thumbnails/${safeFilename}`;
}

/**
 * 파일 확장자 추출
 */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * 안전한 파일명 생성
 */
export function createSafeFilename(
  originalName: string,
  prefix?: string
): string {
  const timestamp = Date.now();
  const extension = getFileExtension(originalName);
  const baseName = originalName.replace(/\.[^/.]+$/, "");
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9가-힣]/g, "_");

  if (prefix) {
    return `${prefix}_${timestamp}_${safeBaseName}.${extension}`;
  }

  return `${timestamp}_${safeBaseName}.${extension}`;
}
