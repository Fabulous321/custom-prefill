# Multi-Prefill 多模型预填充扩展

这是一个 SillyTavern (酒馆) 扩展，为多种 LLM 模型自动添加预填充 (Prefill) 属性。

## ✨ 功能特性

- **自动识别模型**：根据当前请求的模型名称自动匹配对应的预填充规则
- **多模型支持**：内置 DeepSeek 和 Kimi 预设，支持添加自定义规则
- **可视化管理**：在酒馆设置面板中直接管理所有规则
- **灵活配置**：支持自定义属性名、值和正则匹配模式

## 📦 支持的模型

| 模型/厂商 | 预填充属性 | 匹配模式 |
|-----------|------------|----------|
| DeepSeek | `prefix: true` | `deepseek` |
| Kimi (月之暗面) | `partial: true` | `kimi\|moonshot` |
| 自定义 | 用户配置 | 用户配置 |

## 🚀 安装方法

将此文件夹复制到 SillyTavern 的第三方扩展目录：

```
SillyTavern/public/scripts/extensions/third-party/custom message/
```

或者使用其他目录名（需同步修改 `index.js` 中的 `EXTENSION_FOLDER_PATH`）。

## ⚙️ 配置说明

安装并重启酒馆后，在 **扩展 (Extensions)** 面板中找到 **多模型预填充 (Multi-Prefill)**：

### 全局选项

| 设置项 | 说明 |
|--------|------|
| **启用多模型预填充** | 扩展总开关 |
| **仅对 Custom API 源生效** | 建议开启，避免干扰其他已内置预填充支持的 API |
| **启用调试日志** | 在浏览器控制台打印匹配和注入详情 |

### 规则管理

- **添加预设规则**：点击 "DeepSeek" 或 "Kimi" 按钮快速添加
- **添加自定义规则**：点击 "自定义" 按钮，填写：
  - 规则名称（显示用）
  - 模型匹配正则（如 `glm|chatglm`）
  - 预填充属性名（如 `prefix`）
  - 预填充值（如 `true`）
- **启用/禁用规则**：勾选或取消勾选规则前的复选框
- **删除规则**：点击规则右侧的删除按钮

## 🔧 工作原理

1. 扩展监听 `CHAT_COMPLETION_PROMPT_READY` 事件
2. 通过 `getChatCompletionModel()` 获取当前请求的模型名称
3. 按优先级遍历所有启用的规则，找到首个匹配的规则
4. 将规则中的属性注入到最后一条 assistant 消息中

## 📝 技术背景

不同 LLM 厂商使用不同的预填充标记：

- **DeepSeek**：使用 `prefix: true` 告诉 API 继续生成而非重新开始
- **Kimi (月之暗面)**：使用 `partial: true` 实现类似功能
- **Claude**：使用 assistant 消息直接预填充（酒馆已原生支持）

## 📜 更新日志

### v2.0.0

- 🎉 支持多模型自动匹配
- ✨ 新增 Kimi (月之暗面) 预设
- 🎨 全新的规则管理界面
- 🔧 使用 `getChatCompletionModel()` 获取模型名

### v1.0.0

- 初始版本，仅支持 DeepSeek

## 授权协议

MIT License
