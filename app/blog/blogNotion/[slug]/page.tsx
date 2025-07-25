import { getPostBySlug } from "@/lib/notion";
import { notFound } from "next/navigation";

type Props = {
  params: {
    slug: string;
  };
};

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  const post = await getPostBySlug(slug);
  if (!post) return notFound();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
      <p className="text-sm text-gray-500 mb-6">{post.date}</p>
      <article
        className="prose max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </div>
  );
}
