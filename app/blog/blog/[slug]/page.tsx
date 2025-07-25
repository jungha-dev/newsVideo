// app/blog/[slug]/page.tsx
import { getPostData, getSortedPostsData } from "@/lib/posts";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// 타입만 이처럼 지정 (절대 Props 따로 만들지 말기)
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPostData(params.slug);
  return {
    title: post.title,
    description: `${post.title} - Blog post`,
  };
}

// 정적 경로 생성
export async function generateStaticParams() {
  const posts = getSortedPostsData();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// 본문
export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPostData(params.slug);
  if (!post) return notFound();

  return (
    <div className="prose prose-lg mx-auto p-8 max-w-4xl">
      <h1>{post.title}</h1>
      <p className="text-sm text-gray-500">{post.date}</p>
      <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
    </div>
  );
}
