// lib/googleSheet.ts
export type GoogleBlogPost = {
  title: string;
  slug: string;
  date: string;
  content: string;
};

export async function getGoogleBlogPosts(): Promise<GoogleBlogPost[]> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/시트1?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  const rows = data.values;

  // ✅ 방어 코드 추가
  if (!rows || rows.length === 0) {
    console.error("❌ 시트에서 데이터를 불러오지 못했습니다.");
    return [];
  }

  const headers = rows[0];
  const items = rows.slice(1);

  return items.map((row: string[]) => {
    const item: any = {};
    headers.forEach((header: string, i: number) => {
      item[header.toLowerCase()] = row[i];
    });
    return item as GoogleBlogPost;
  });
}
