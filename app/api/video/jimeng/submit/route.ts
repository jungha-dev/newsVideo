import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosError } from "axios"; // 需导入AxiosError
import { generateSignature } from "@/lib/volcAuth";

// 环境变量
const ACCESS_KEY = process.env.JIMENG_ACCESS_KEY || "";
const SECRET_KEY = process.env.JIMENG_SECRET_KEY || "";
const API_BASE_URL = "https://visual.volcengineapi.com";

// 验证是否读取成功（添加日志）
console.log(
  "读取到的AccessKey:",
  ACCESS_KEY ? "已获取（长度：" + ACCESS_KEY.length + "）" : "未获取"
);
console.log(
  "读取到的SecretKey:",
  SECRET_KEY ? "已获取（长度：" + SECRET_KEY.length + "）" : "未获取"
);

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    console.log("收到的请求体:", body);

    // 参数校验（已修正为下划线参数名）
    if (!body.image_urls && !body.binary_data_base64) {
      return NextResponse.json(
        {
          error:
            "必须提供image_urls（图片URL数组）或binary_data_base64（Base64数组）",
        },
        { status: 400 }
      );
    }
    if (
      body.image_urls &&
      (!Array.isArray(body.image_urls) || body.image_urls.length === 0)
    ) {
      return NextResponse.json(
        { error: "image_urls 必须是非空数组" },
        { status: 400 }
      );
    }
    if (
      !["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "9:21"].includes(
        body.aspect_ratio
      )
    ) {
      return NextResponse.json(
        { error: "aspect_ratio 必须是 16:9/4:3/1:1/3:4/9:16/21:9/9:21 之一" },
        { status: 400 }
      );
    }
    if (body.req_key !== "jimeng_vgfm_i2v_l20") {
      return NextResponse.json(
        { error: "req_key 必须为 jimeng_vgfm_i2v_l20" },
        { status: 400 }
      );
    }

    // 构建请求参数
    const method: "POST" = "POST";
    const path = "/";
    const query = {
      Action: "CVSync2AsyncSubmitTask",
      Version: "2022-08-31",
    };
    const headers = {
      "Content-Type": "application/json",
      Region: "cn-north-1",
      Service: "cv",
    };
    const payload = JSON.stringify({
      req_key: body.req_key,
      ...(body.image_urls ? { image_urls: body.image_urls } : {}),
      ...(body.binary_data_base64
        ? { binary_data_base64: body.binary_data_base64 }
        : {}),
      prompt: body.prompt || "",
      aspect_ratio: body.aspect_ratio,
      ...(body.seed !== undefined && { seed: body.seed }),
    });

    // 生成签名并发起请求
    const authorization = generateSignature({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      method,
      path,
      query,
      headers,
      payload,
    });
    const response = await axios.post(
      `${API_BASE_URL}${path}?${new URLSearchParams(query).toString()}`,
      payload,
      { headers: { ...headers, Authorization: authorization } }
    );

    return NextResponse.json(response.data);
  } catch (error) {
    // 【关键：在这里添加错误码处理逻辑】
    if (error instanceof AxiosError) {
      // 提取火山引擎返回的错误码和信息
      const errorCode = error.response?.data?.ResponseMetadata?.Error?.Code;
      const errorMessage =
        error.response?.data?.ResponseMetadata?.Error?.Message ||
        "接口调用失败";

      console.error(`错误码: ${errorCode}, 错误信息: ${errorMessage}`);

      // 根据错误码返回自定义提示
      switch (errorCode) {
        case "InvalidBase64Content.Malformed":
          return NextResponse.json(
            { error: "图片Base64内容格式错误，请检查编码是否完整" },
            { status: 400 }
          );
        case "InternalError":
          return NextResponse.json(
            { error: "服务内部错误，请稍后重试" },
            { status: 500 }
          );
        case "MissingParameter.CommandContent":
          return NextResponse.json(
            { error: "命令内容不能为空，请补充参数" },
            { status: 400 }
          );
        // 其他错误码可继续添加case...
        default:
          return NextResponse.json(
            { error: `请求失败: ${errorMessage}`, code: errorCode },
            { status: error.response?.status || 500 }
          );
      }
    }

    // 非Axios错误（如解析失败）
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
