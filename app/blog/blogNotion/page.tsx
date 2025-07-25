import Link from "next/link";
import { getNotionPosts } from "@/lib/notion";

export default async function blogNotionPage() {
  const posts = await getNotionPosts(); // ✅ 결과 저장

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-10">
      <h1 className="text-2xl font-bold mb-4">Blog</h1>
      <ul className="space-y-2">
        {posts.map(({ slug, title, date }) => (
          <li key={slug}>
            <Link
              href={`/blog/blogNotion/${slug}`}
              className="-black hover:underline"
            >
              {title}
            </Link>
            <p className="text-sm text-gray-500">{date}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
