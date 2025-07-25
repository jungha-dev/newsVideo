import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function getNotionPosts() {
  try {
    const res = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID!,
      filter: {
        property: "published",
        select: {
          equals: "공개",
        },
      },
      sorts: [
        {
          property: "createdDate",
          direction: "descending",
        },
      ],
    });
    // console.log("🔍 전체 Notion 데이터:", JSON.stringify(res.results, null, 2));

    return res.results.map((page: any) => {
      const props = page.properties;

      const titleText = props.title?.title?.[0]?.plain_text || "제목 없음";
      const slugText = props.slug?.rich_text?.[0]?.plain_text || page.id;
      const dateValue = props.createdDate?.date?.start || "";

      return {
        id: page.id,
        title: titleText,
        slug: slugText,
        date: dateValue,
      };
    });
  } catch (err: any) {
    console.error("❌ Notion fetch error:", err.message);
    return [];
  }
}

export async function getPostBySlug(slug: string) {
  const posts = await getNotionPosts();
  const post = posts.find((p) => p.slug === slug);
  if (!post) return null;

  const blocks = await notion.blocks.children.list({ block_id: post.id });

  const content = blocks.results
    .map((b: any) => {
      const richTextToHTML = (richText: any[]) =>
        richText.map((r) => r.plain_text.replace(/\n/g, "<br />")).join("");

      switch (b.type) {
        case "paragraph":
          if (b.paragraph.rich_text.length === 0) return "<br />";
          return `<p>${richTextToHTML(b.paragraph.rich_text)}</p>`;
        case "heading_1":
          return `<h1>${richTextToHTML(b.heading_1.rich_text)}</h1>`;
        case "heading_2":
          return `<h2>${richTextToHTML(b.heading_2.rich_text)}</h2>`;
        case "heading_3":
          return `<h3>${richTextToHTML(b.heading_3.rich_text)}</h3>`;
        case "image":
          const url =
            b.image.type === "external"
              ? b.image.external.url
              : b.image.file.url;
          const alt = b.image.caption?.[0]?.plain_text || "image";
          return `<img src="${url}" alt="${alt}" />`;
        case "bulleted_list_item":
          return `<ul><li>${richTextToHTML(
            b.bulleted_list_item.rich_text
          )}</li></ul>`;
        case "numbered_list_item":
          return `<ol><li>${richTextToHTML(
            b.numbered_list_item.rich_text
          )}</li></ol>`;
        case "quote":
          return `<blockquote>${richTextToHTML(
            b.quote.rich_text
          )}</blockquote>`;
        case "code":
          const lang = b.code.language || "text";
          return `<pre><code class="language-${lang}">${richTextToHTML(
            b.code.rich_text
          )}</code></pre>`;
        default:
          return "";
      }
    })
    .join("\n");

  return { ...post, content };
}
