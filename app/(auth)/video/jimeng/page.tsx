"use client";

import { useState } from "react";

// 定义接口类型（前端调用相关）
interface SubmitTaskParams {
  imageUrl: string;
  prompt: string;
  aspectRatio: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "9:21";
}

interface SubmitTaskResponse {
  code: number;
  data: {
    task_id: string;
    status: "pending" | "running" | "done" | "failed";
  };
  message: string;
}

interface QueryTaskResponse {
  code: number;
  data: {
    status: "pending" | "running" | "done" | "failed";
    video_url?: string;
    error_msg?: string;
  };
  message: string;
}

export default function VideoGenerator() {
  // 表单状态
  const [imageUrl, setImageUrl] = useState("https://picsum.photos/800/600"); // 示例图片
  const [prompt, setPrompt] = useState(
    "夕阳下的湖面波光粼粼，微风吹过泛起涟漪"
  );
  const [aspectRatio, setAspectRatio] = useState<
    "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "9:21"
  >("16:9");

  // 任务状态
  const [taskId, setTaskId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle / submitting / querying / done / error
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);

  // 提交任务逻辑（添加日志）
  const submitTask = async () => {
    // 重置状态
    setStatus("submitting");
    setErrorMsg("");
    setVideoUrl("");
    setProgress(0);

    try {
      // 1. 严格按照文档要求构建参数（关键修正）
      const params = {
        req_key: "jimeng_vgfm_i2v_l20", // 文档必填，固定值
        image_urls: [imageUrl], // 文档要求：数组类型（即使单张图片）
        prompt: prompt, // 可选，150字符内
        aspect_ratio: aspectRatio, // 文档要求：下划线命名
        // seed: -1, // 可选，默认-1（随机）
      };

      // 【新增日志1：打印请求参数（含文档要求的格式）】
      console.log("提交任务参数（符合文档）：", {
        params,
        // 检查核心参数是否符合要求
        reqKeyIsValid: params.req_key === "jimeng_vgfm_i2v_l20",
        imageUrlsIsArray:
          Array.isArray(params.image_urls) && params.image_urls.length > 0,
        aspectRatioIsValid: [
          "16:9",
          "4:3",
          "1:1",
          "3:4",
          "9:16",
          "21:9",
          "9:21",
        ].includes(params.aspect_ratio),
      });

      // 2. 调用后端接口
      const res = await fetch("/api/video/jimeng/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      // 【新增日志2：打印响应状态和原始数据】
      console.log("提交任务接口响应：", {
        status: res.status, // 打印HTTP状态码（如400/200）
        statusText: res.statusText,
      });

      // 3. 解析响应数据
      const data: SubmitTaskResponse = await res.json();

      // 【新增日志3：打印解析后的响应数据】
      console.log("提交任务响应数据：", data);

      // 4. 处理响应
      if (res.ok && data.code === 10000) {
        // 提交成功，获取taskId并开始轮询
        setTaskId(data.data.task_id);
        setStatus("querying");
        setProgress(30); // 模拟进度
        startPolling(data.data.task_id);
      } else {
        // 提交失败（显示后端返回的具体错误）
        setStatus("error");
        setErrorMsg(data.message || "提交任务失败，请重试");
      }
    } catch (err) {
      // 【新增日志4：捕获异常日志】
      console.error("提交任务发生异常：", err);
      setStatus("error");
      setErrorMsg("网络错误，无法提交任务");
    }
  };
  // 轮询查询任务状态（保持不变）
  const startPolling = async (taskId: string) => {
    const maxRetries = 20; // 最大重试次数（约1分钟）
    const interval = 3000; // 轮询间隔（3秒）
    let retries = 0;

    const poll = async () => {
      if (retries >= maxRetries) {
        setStatus("error");
        setErrorMsg("视频生成超时，请重试");
        return;
      }

      try {
        const res = await fetch("/api/video/jimeng/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        });

        const data: QueryTaskResponse = await res.json();

        if (res.ok && data.code === 10000) {
          switch (data.data.status) {
            case "pending":
            case "running":
              // 继续轮询，更新进度
              setProgress(Math.min(80, 30 + retries * 2.5)); // 逐步增加进度
              retries++;
              setTimeout(poll, interval);
              break;
            case "done":
              // 生成成功
              setStatus("done");
              setVideoUrl(data.data.video_url || "");
              setProgress(100);
              break;
            case "failed":
              // 生成失败
              setStatus("error");
              setErrorMsg(data.data.error_msg || "视频生成失败");
              break;
          }
        } else {
          setStatus("error");
          setErrorMsg(data.message || "查询任务失败");
        }
      } catch (err) {
        console.error("查询任务失败:", err);
        retries++;
        setTimeout(poll, interval); // 网络错误时继续重试
      }
    };

    // 开始第一次轮询
    poll();
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">AI图生视频生成器</h2>

      {/* 表单输入区域 */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            图片URL
          </label>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            placeholder="输入图片的URL地址"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            生成提示词
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            rows={3}
            placeholder="描述视频内容（如：夕阳下的湖面波光粼粼，微风吹过泛起涟漪）"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            视频比例
          </label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as any)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="16:9">16:9（宽屏）</option>
            <option value="9:16">9:16（竖屏）</option>
            <option value="1:1">1:1（正方形）</option>
            <option value="4:3">4:3（标准）</option>
            <option value="3:4">3:4（竖屏）</option>
            <option value="21:9">21:9（超宽屏）</option>
            <option value="9:21">9:21（超长竖屏）</option>
          </select>
        </div>

        <button
          onClick={submitTask}
          disabled={status === "submitting" || status === "querying"}
          className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-dark disabled:bg-gray-400"
        >
          {status === "submitting"
            ? "提交中..."
            : status === "querying"
            ? "生成中..."
            : "生成视频"}
        </button>
      </div>

      {/* 进度显示 */}
      {status === "querying" && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-1">
            <span>生成进度</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            正在生成视频，请稍候...（视频生成需要10-30秒）
          </p>
        </div>
      )}

      {/* 错误提示 */}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
          ❌ {errorMsg}
        </div>
      )}

      {/* 生成结果 */}
      {status === "done" && videoUrl && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">
            生成结果（有效期1小时）
          </h3>
          <video
            src={videoUrl}
            controls
            className="w-full rounded-md"
            poster={imageUrl} // 用原图作为视频封面
          />
          <p className="text-sm text-gray-500 mt-2">
            提示：视频URL有效期为1小时，建议及时保存
          </p>
        </div>
      )}

      {/* 原始图片预览 */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">原始图片预览</h3>
        <img
          src={imageUrl}
          alt="原始图片"
          className="w-full h-auto rounded-md border border-gray-200"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://picsum.photos/800/600?error";
          }}
        />
      </div>
    </div>
  );
}
