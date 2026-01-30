# DeepSeek Prefill 扩展

这是一个 SillyTavern (酒馆) 扩展，旨在为 DeepSeek 的 prefill (前缀補全) 功能自动添加 `prefix: true` 标记。

## 功能介绍

当你使用 **Custom API (自定义 API)** 源连接到 DeepSeek 兼容端点（如官方的 `/beta` API 或各类中转）时，此扩展会自动在请求 payload 的最后一条 assistant 消息中注入 `prefix: true` 标记。这使得模型能够无缝地从已有内容继续生成，而不是启动一个全新的响应。

## 适用场景

- **直接使用酒馆内置的 DeepSeek 源**：❌ **不需要**。SillyTavern 原生代码已经处理了此逻辑。
- **使用 Custom API 连接 DeepSeek 官方 URL**：✅ **需要**。Custom 渠道默认不会添加 prefix 标记。
- **使用 OpenAI 兼容的代理/中转连接 DeepSeek**：✅ **非常有帮助**。

## 安装方法

### 方法 1：手动安装

将此文件夹复制到你的 SillyTavern 目录下的以下位置：

```
SillyTavern/public/scripts/extensions/third-party/deepseek-prefill/
```

### 方法 2：软连接（开发用途）

从你的开发目录链接到酒馆的扩展目录。

## 配置选项

安装并重启酒馆后，在 **扩展 (Extensions)** 面板中找到 **DeepSeek Prefill**：

| 设置项 | 说明 |
|---------|-------------|
| **启用 DeepSeek Prefill** | 扩展的总开关 |
| **仅对 Custom API 源生效** | 建议开启，避免干扰其他 API (如 OpenAI) |
| **模型匹配模式 (正则)** | 仅当模型名匹配该正则时生效（例如：`deepseek`）。留空则匹配所有模型 |
| **启用调试日志** | 在浏览器控制台中打印处理详情，方便排查问题 |

## 工作原理

扩展通过监听 `CHAT_COMPLETION_PROMPT_READY` 事件（该事件在酒馆发送 API 请求前触发）来拦截并修改消息数组。如果满足过滤条件，它会将 messages 数组中最后一条辅助信息 (assistant) 的 `prefix` 属性设为 `true`。

## 技术背景

`prefix: true` 标志告诉 DeepSeek API：最后一条 assistant 消息是“预填内容”——模型应该在此内容的基础上继续生成。这在以下情况非常有用：

- 继续被意外中断的对话
- 引导模型的输出风格/开头
- 多轮推理模式

## 授权协议

MIT License
