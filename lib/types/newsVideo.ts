// Firestore Timestamp 타입을 위한 유니온 타입
export type FirestoreDate = Date | { toDate(): Date } | string | number;

export interface NewsVideo {
  id: string;
  uid: string;
  title: string;
  description?: string;
  thumbnail?: string;
  videoUrl: string;
  prompts: string[];
  narrations: string[];
  scenes: {
    scene_number: number;
    image_prompt: string;
    narration: string;
    imageUrl?: string;
    videoUrl?: string;
    firebaseUrl?: string;
    output?: string; // 원본 Replicate URL
  }[];
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
  status: "processing" | "completed" | "failed";
  duration?: number;
  aspectRatio?: string;
  model?: string;
}

export interface NewsVideoCreateData {
  title: string;
  description?: string;
  thumbnail?: string;
  videoUrl: string;
  prompts: string[];
  narrations: string[];
  scenes: {
    scene_number: number;
    image_prompt: string;
    narration: string;
    imageUrl?: string;
    videoUrl?: string;
    firebaseUrl?: string;
    output?: string; // 원본 Replicate URL
  }[];
  duration?: number;
  aspectRatio?: string;
  model?: string;
}
