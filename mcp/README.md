# DS-VLAB MCP 服务

让 AI 通过 [Model Context Protocol](https://modelcontextprotocol.io/) 直接操作 DS-VLAB 虚拟实验室。

MCP 服务会用 Playwright 启动一个独立的浏览器窗口打开实验室，然后提供添加器件、连接引脚、设置开关、读写存储器、上电仿真、截图等工具。AI 可以像真人一样搭电路、观察结果并自我检查。

## 环境要求

- Node.js 18 或更高版本
- Chrome 或 Edge（二选一即可）
- Windows、macOS、Linux 均可

## 安装

```bash
cd mcp
npm install
```

`playwright-core` 不会自动下载浏览器，MCP 会依次尝试系统安装的 Chrome、Edge 和 Playwright 自带的 Chromium。如果都找不到，可以设置 `DSVLAB_BROWSER_PATH` 指向浏览器可执行文件。

## 配置客户端

以下示例中的路径请替换成你本机的实际路径。

### OpenCode V2

在项目的 `opencode.jsonc` 中加入：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "dsvlab": {
        "type": "local",
        "command": ["node", "C:/path/to/ds-vlab/mcp/server.js"],
        "cwd": "C:/path/to/ds-vlab/mcp",
        "environment": {
          "DSVLAB_HEADLESS": "0"
        },
        "codemode": false
      }
    }
  }
}
```

### Claude Desktop

编辑 `%APPDATA%\Claude\claude_desktop_config.json`（macOS 为 `~/Library/Application Support/Claude/claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "dsvlab": {
      "command": "node",
      "args": ["C:/path/to/ds-vlab/mcp/server.js"],
      "env": {
        "DSVLAB_HEADLESS": "0"
      }
    }
  }
}
```

### Cursor

在项目的 `.cursor/mcp.json` 中加入：

```json
{
  "mcpServers": {
    "dsvlab": {
      "command": "node",
      "args": ["C:/path/to/ds-vlab/mcp/server.js"],
      "env": {
        "DSVLAB_HEADLESS": "0"
      }
    }
  }
}
```

### 其他 MCP 客户端

使用 stdio 传输，启动命令为：

```text
node C:/path/to/ds-vlab/mcp/server.js
```

## 工具列表

| 工具 | 作用 |
| --- | --- |
| `lab_open` | 打开实验室浏览器窗口 |
| `lab_close` | 关闭浏览器和本地静态服务器 |
| `lab_status` | 查看器件数、连接线数、电源、吸附、平移等状态 |
| `list_components` | 列出所有器件及其坐标、类型、选中状态 |
| `get_pins` | 查看器件每个引脚的值、方向和连接 |
| `add_component` | 添加器件，支持一次添加多个 Switch/Led |
| `move_component` | 移动器件并重绘连接线 |
| `rename_component` | 修改芯片显示名称 |
| `remove_component` | 删除器件及其连接线 |
| `connect_pins` | 按器件 id 和引脚编号连接两个引脚 |
| `list_connections` | 列出所有连接线 |
| `remove_connection` | 按连接线 id 删除连接 |
| `set_switch` | 设置开关为开/关，并立即传播电平 |
| `pulse` | 触发或停止单脉冲/连续脉冲 |
| `power` | 上电、断电、复位 |
| `get_memory` | 读取 RAM/EPROM 内容（二进制和十六进制） |
| `set_memory` | 从指定地址写入 RAM/EPROM |
| `edit` | 全选、复制、粘贴、再制、清除选择 |
| `set_snap` | 打开/关闭自动吸附对齐 |
| `pan_canvas` | 平移画布 |
| `screenshot` | 截图并返回 PNG 给模型查看 |
| `export_circuit` | 导出 DS-VLAB 电路文本 |
| `import_circuit` | 导入电路文本 |
| `new_circuit` | 清空画布 |

可用器件类型：

```text
74LS181、74LS245、74LS175、74LS174、74LS273、RAM6116、74LS139、
74LS374、74LS163、ANDgate、ORgate、NOTgate、NANDgate、XORgate、
Triplegate、Switch、Led、SinglePulse、ContinuousPulse、
EPROM2716C3、EPROM2716C4、SequeTimer、BUS
```

## 使用示例

配置好之后，可以直接对 AI 说：

> 打开 DS-VLAB，放一个 Switch 和一个 Led，把开关输出接到 LED 输入，上电，然后打开开关并截图确认 LED 亮起。

> 在 DS-VLAB 里放一个 RAM6116，从地址 0 开始写入 16 条 8 位数据，再读出来核对。

> 用 74LS181、两个 74LS374 和开关搭一个简单的运算器电路，完成后导出电路文本。

AI 通常会按以下顺序调用工具：

1. `lab_open`
2. `add_component`
3. `connect_pins`
4. `power`
5. `set_switch` / `pulse`
6. `get_pins` / `get_memory` / `screenshot` 检查结果
7. `lab_close`

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `DSVLAB_HEADLESS` | 设为 `1` 时默认使用无头浏览器。适合 CI 或没有图形界面的服务器 |
| `DSVLAB_BROWSER_PATH` | 浏览器可执行文件的绝对路径，例如 `C:/Program Files/Google/Chrome/Application/chrome.exe` |
| `DSVLAB_BROWSER_CHANNEL` | 指定 Playwright 浏览器通道，例如 `chrome` 或 `msedge` |
| `DSVLAB_PORT` | 本地静态服务器的固定端口。默认使用随机端口 |

## 工作原理

```text
MCP 客户端（OpenCode / Claude Desktop / Cursor）
        │  stdio
        ▼
mcp/server.js  ── 启动本地静态服务器（项目根目录）
        │
        ▼
playwright-core  ── 打开 http://127.0.0.1:<port>/index.html
        │
        ▼
DS-VLAB 页面（window.mycircuit / cDispatch / DSVSnap）
```

MCP 服务和浏览器在同一台机器上运行，不依赖外部网络。截图通过 MCP 的 image content 返回，AI 可以直接看到画布。

## 测试

```bash
cd mcp
npm test
```

测试会启动无头浏览器，自动完成“开关控制 LED”、复制粘贴、存储器读写、导入导出、重命名/移动/删除等操作。

## 许可证

本 MCP 服务是 DS-VLAB 的一部分，采用 **GNU Affero General Public License v3.0 or later**（AGPL-3.0-or-later）。

原项目版权：Copyright (C) 2013 张雯雰（ZHANG Wen-fen），湘南学院计算机与人工智能学院。

MCP 服务新增部分：Copyright (C) 2026 DS-VLAB contributors。
