// app/blogGoogle/page.tsx
import Link from "next/link";
import { getGoogleBlogPosts } from "@/lib/googleSheet";

export default async function BlogGooglePage() {
  const posts = await getGoogleBlogPosts();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-10">
      <h1 className="text-3xl font-bold mb-6">Google 블로그 목록</h1>
      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/blogGoogle/${post.slug}`}
              className="text-xl black hover:underline"
            >
              {post.title}
            </Link>
            <p className="text-sm text-gray-500">{post.date}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
