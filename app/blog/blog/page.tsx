// app/blog/page.tsx
import { getSortedPostsData } from "@/lib/posts";
import Link from "next/link";

// `async` 서버 컴포넌트로 선언해야 await 사용 가능
export default async function BlogListPage() {
  const posts = getSortedPostsData(); // 마크다운 포스트 불러오기

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-10">
      <h1 className="text-2xl font-bold mb-4">Blog</h1>
      <ul className="space-y-2">
        {posts.map(({ slug, title, date }) => (
          <li key={slug}>
            <Link
              href={`/blog/blog/${slug}`}
              className="-black hover:underline"
            >
              {title}
            </Link>
            <p className="text-sm text-gray-500">{date}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
