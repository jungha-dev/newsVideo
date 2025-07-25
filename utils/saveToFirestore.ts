import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function saveVideoMeta({
  taskId,
  prompt,
  imageUrl,
  firebaseVideoUrl,
}: {
  taskId: string;
  prompt: string;
  imageUrl: string;
  firebaseVideoUrl: string;
}) {
  await addDoc(collection(db, "videos"), {
    taskId,
    prompt,
    imageUrl,
    firebaseVideoUrl,
    createdAt: serverTimestamp(),
  });
}
