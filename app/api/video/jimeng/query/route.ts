import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosError } from "axios";
import { generateSignature } from "@/lib/volcAuth";

// 类型定义（内部合并）
interface QueryRequest {
  taskId: string;
}

interface QueryTaskResponse {
  code: number;
  data: {
    status: "pending" | "running" | "done" | "failed";
    video_url?: string;
    error_msg?: string;
  };
  message: string;
  request_id: string;
}

// 环境变量
const ACCESS_KEY = process.env.JIMENG_ACCESS_KEY || "";
const SECRET_KEY = process.env.JIMENG_SECRET_KEY || "";

// 直接硬编码密钥（不推荐，仅临时测试用）
const API_BASE_URL = "https://visual.volcengineapi.com";

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const { taskId }: QueryRequest = await request.json();

    // 参数校验
    if (!taskId) {
      return NextResponse.json({ error: "必须提供taskId" }, { status: 400 });
    }

    // 构建请求参数
    const method: "POST" = "POST";
    const path = "/";
    const query = {
      Action: "CVSync2AsyncGetResult",
      Version: "2022-08-31",
    };
    const headers = {
      "Content-Type": "application/json",
      Region: "cn-north-1",
      Service: "cv",
    };
    const payload = JSON.stringify({
      req_key: "jimeng_vgfm_i2v_l20",
      task_id: taskId,
    });

    // 生成签名
    const authorization = generateSignature({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      method,
      path,
      query,
      headers,
      payload,
    });

    // 发起请求
    const response = await axios.post<QueryTaskResponse>(
      `${API_BASE_URL}${path}?${new URLSearchParams(query).toString()}`,
      payload,
      {
        headers: { ...headers, Authorization: authorization },
      }
    );

    return NextResponse.json(response.data);
  } catch (error) {
    if (error instanceof AxiosError) {
      return NextResponse.json(
        {
          error: "查询任务失败",
          details: error.response?.data || error.message,
        },
        { status: error.response?.status || 500 }
      );
    }
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
