// app/blogGoogle/[slug]/page.tsx
import { getGoogleBlogPosts } from "@/lib/googleSheet";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const posts = await getGoogleBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function BlogGooglePostPage({
  params,
}: {
  params: { slug: string };
}) {
  const posts = await getGoogleBlogPosts();
  const post = posts.find((p) => p.slug === params.slug);

  if (!post) return notFound();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
      <p className="text-sm text-gray-500 mb-6">{post.date}</p>
      <article
        className="prose max-w-none dark:prose-invert whitespace-pre-line"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </div>
  );
}
