import { getFirebaseDbAdmin } from "../firebase-admin";
import { NewsVideo, NewsVideoCreateData } from "../types/newsVideo";

const COLLECTION_NAME = "newsVideos";

export const saveNewsVideo = async (
  uid: string,
  data: NewsVideoCreateData
): Promise<string> => {
  try {
    const docRef = await getFirebaseDbAdmin()
      .collection(COLLECTION_NAME)
      .add({
        uid,
        ...data,
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return docRef.id;
  } catch (error) {
    console.error("Error saving news video:", error);
    throw error;
  }
};

export const createNewsVideoDraft = async (
  uid: string,
  data: Partial<NewsVideoCreateData>
): Promise<string> => {
  try {
    const docRef = await getFirebaseDbAdmin()
      .collection(COLLECTION_NAME)
      .add({
        uid,
        ...data,
        status: "processing",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return docRef.id;
  } catch (error) {
    console.error("Error creating news video draft:", error);
    throw error;
  }
};

export const getNewsVideosByUser = async (
  uid: string
): Promise<NewsVideo[]> => {
  try {
    // 단순 쿼리로 시작 (인덱스 없이도 작동)
    const querySnapshot = await getFirebaseDbAdmin()
      .collection(COLLECTION_NAME)
      .where("uid", "==", uid)
      .get();

    const videos: NewsVideo[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      videos.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as NewsVideo);
    });

    // 클라이언트 사이드에서 정렬 (인덱스 불필요)
    return videos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error("Error getting news videos:", error);
    throw error;
  }
};

export const getNewsVideoById = async (
  id: string
): Promise<NewsVideo | null> => {
  try {
    console.log("Fetching news video with ID:", id);
    const docRef = getFirebaseDbAdmin().collection(COLLECTION_NAME).doc(id);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data()!;
      console.log("Found video data:", data);
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as NewsVideo;
    }

    console.log("No video found with ID:", id);
    return null;
  } catch (error) {
    console.error("Error getting news video:", error);
    throw error;
  }
};

export const updateNewsVideo = async (
  id: string,
  data: Partial<NewsVideo>
): Promise<void> => {
  try {
    const docRef = getFirebaseDbAdmin().collection(COLLECTION_NAME).doc(id);
    await docRef.update({
      ...data,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error updating news video:", error);
    throw error;
  }
};

export const deleteNewsVideo = async (id: string): Promise<void> => {
  try {
    const docRef = getFirebaseDbAdmin().collection(COLLECTION_NAME).doc(id);
    await docRef.delete();
  } catch (error) {
    console.error("Error deleting news video:", error);
    throw error;
  }
};
