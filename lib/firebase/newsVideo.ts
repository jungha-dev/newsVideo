import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { NewsVideo, NewsVideoCreateData } from "../types/newsVideo";

const COLLECTION_NAME = "newsVideos";

export const saveNewsVideo = async (
  uid: string,
  data: NewsVideoCreateData
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, "users", uid, "newsVideo"), {
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
    const docRef = await addDoc(collection(db, "users", uid, "newsVideo"), {
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
    console.log("Fetching news videos for user:", uid);

    // 새로운 경로 구조 사용
    const q = query(collection(db, "users", uid, "newsVideo"));

    const querySnapshot = await getDocs(q);
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
    return videos.sort((a, b) => {
      const getTime = (date: any): number => {
        if (date instanceof Date) {
          return date.getTime();
        } else if (date?.toDate) {
          return date.toDate().getTime();
        } else if (typeof date === "string" || typeof date === "number") {
          return new Date(date).getTime();
        }
        return 0;
      };

      const aTime = getTime(a.createdAt);
      const bTime = getTime(b.createdAt);
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error getting news videos:", error);
    throw error;
  }
};

export const getNewsVideoById = async (
  uid: string,
  id: string
): Promise<NewsVideo | null> => {
  try {
    console.log("Fetching news video with ID:", id, "for user:", uid);
    const docRef = doc(db, "users", uid, "newsVideo", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
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
  uid: string,
  id: string,
  data: Partial<NewsVideo>
): Promise<void> => {
  try {
    const docRef = doc(db, "users", uid, "newsVideo", id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error updating news video:", error);
    throw error;
  }
};

export const deleteNewsVideo = async (
  uid: string,
  id: string
): Promise<void> => {
  try {
    const docRef = doc(db, "users", uid, "newsVideo", id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting news video:", error);
    throw error;
  }
};
