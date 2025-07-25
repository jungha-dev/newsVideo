// lib/volcAuth.ts
import crypto from "crypto";

interface GenerateSignatureParams {
  accessKey: string;
  secretKey: string;
  method: "POST" | "GET";
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  payload: string;
}

export function generateSignature({
  accessKey,
  secretKey,
  method,
  path,
  query,
  headers,
  payload,
}: GenerateSignatureParams): string {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonce = crypto.randomBytes(16).toString("hex");

  // 处理Query参数（排序）
  const sortedQueryKeys = Object.keys(query).sort();
  const canonicalQuery = sortedQueryKeys
    .map((key) => `${key}=${encodeURIComponent(query[key])}`)
    .join("&");

  // 处理Headers（排序并小写）
  const sortedHeaderKeys = Object.keys(headers).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const canonicalHeaders =
    sortedHeaderKeys
      .map((key) => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join("\n") + "\n";
  const signedHeaders = sortedHeaderKeys
    .map((key) => key.toLowerCase())
    .join(";");

  // 计算Payload哈希
  const hashedPayload = crypto
    .createHash("sha256")
    .update(payload)
    .digest("hex");

  // 构建规范请求字符串
  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join("\n");

  // 生成签名串
  const date = timestamp.split("T")[0];
  const credentialScope = `${date}/cn-north-1/cv/request`;
  const hashedCanonicalRequest = crypto
    .createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");
  const stringToSign = `HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  // 计算HMAC签名
  const kDate = crypto.createHmac("sha256", secretKey).update(date).digest();
  const kRegion = crypto
    .createHmac("sha256", kDate)
    .update("cn-north-1")
    .digest();
  const kService = crypto.createHmac("sha256", kRegion).update("cv").digest();
  const kSigning = crypto
    .createHmac("sha256", kService)
    .update("request")
    .digest();
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  // 生成Authorization头
  return `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}
