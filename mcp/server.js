#!/usr/bin/env node
/*
 * DS-VLAB MCP server
 * Copyright (C) 2026 DS-VLAB contributors
 *
 * This file is part of DS-VLAB and is licensed under the GNU Affero General
 * Public License, version 3 or any later version. See ../license.txt.
 *
 * Original project:
 * Duosi Principles of Computer Composition Virtual Experiment System, DS-VLAB v2.0
 * Copyright(C)2013 ZHANG Wen-fen, Email: yydzhwf@xnu.edu.cn
 * Address: Xiangnan University, Chenzhou Hunan, China
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Lab } from "./lab.js";

const COMPONENT_NAMES = [
    "74LS181", "74LS245", "74LS175", "74LS174", "74LS273", "RAM6116",
    "74LS139", "74LS374", "74LS163",
    "ANDgate", "ORgate", "NOTgate", "NANDgate", "XORgate", "Triplegate",
    "Switch", "Led", "SinglePulse", "ContinuousPulse",
    "EPROM2716C3", "EPROM2716C4", "SequeTimer", "BUS"
];

const lab = new Lab({ headless: process.env.DSVLAB_HEADLESS === "1" });

const server = new McpServer(
    { name: "dsvlab-mcp", version: "0.1.0" },
    { capabilities: { logging: {} } }
);

function text(value) {
    const body = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    return { content: [{ type: "text", text: body }] };
}

function fail(message) {
    return {
        isError: true,
        content: [{ type: "text", text: "错误：" + message }]
    };
}

function register(name, config, handler) {
    server.registerTool(name, config, async (args) => {
        try {
            return await handler(args || {});
        } catch (error) {
            return fail(error && error.message ? error.message : String(error));
        }
    });
}

/* ------------------------------------------------------------------ */
/* 浏览器会话                                                          */
/* ------------------------------------------------------------------ */

register("lab_open", {
    title: "打开虚拟实验室",
    description:
        "启动一个由 Playwright 控制的浏览器窗口并打开 DS-VLAB 虚拟实验室。" +
        "其他工具在需要时会自动调用本工具。重复调用会复用已打开的窗口。",
    inputSchema: {
        headless: z.boolean().optional().describe("是否使用无头浏览器，默认 false（显示窗口）"),
        viewportWidth: z.number().int().min(800).max(3840).optional().describe("浏览器视口宽度，默认 1440"),
        viewportHeight: z.number().int().min(600).max(2160).optional().describe("浏览器视口高度，默认 900"),
        url: z.string().url().optional().describe("自定义实验室地址，默认使用 MCP 自带的本地静态服务器")
    },
    annotations: { readOnlyHint: false, openWorldHint: false }
}, async (args) => {
    await lab.ensureOpen(args);
    return text(await lab.status());
});

register("lab_close", {
    title: "关闭虚拟实验室",
    description: "关闭 MCP 打开的浏览器窗口和本地静态服务器。",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: true }
}, async () => {
    await lab.close();
    return text({ closed: true });
});

register("lab_status", {
    title: "查看实验室状态",
    description:
        "查看实验室是否已打开、当前 URL、器件数量、连接线数量、选中器件、电源状态、吸附开关和平移位置。",
    inputSchema: {},
    annotations: { readOnlyHint: true }
}, async () => {
    return text(await lab.status());
});

/* ------------------------------------------------------------------ */
/* 器件                                                                */
/* ------------------------------------------------------------------ */

register("list_components", {
    title: "列出器件",
    description:
        "列出画布上的所有器件，包括器件 id、类型、自定义名称、画布坐标、尺寸和是否被选中。",
    inputSchema: {
        selectedOnly: z.boolean().optional().describe("只列出当前选中的器件")
    },
    annotations: { readOnlyHint: true }
}, async (args) => {
    const components = await lab.evaluate((options) => {
        const selectedIds = new Set((window.mycircuit.selectedComponents || []).map((c) => c.id));
        return window.mycircuit.componentAll
            .filter((c) => !options.selectedOnly || selectedIds.has(c.id))
            .map((c) => {
                const div = document.getElementById(c.id);
                return {
                    id: c.id,
                    name: c.name,
                    customName: c.customName || null,
                    x: parseInt(div.style.left, 10) || 0,
                    y: parseInt(div.style.top, 10) || 0,
                    width: c.width,
                    height: c.height,
                    pinCount: c.pinValue.length,
                    selected: selectedIds.has(c.id)
                };
            });
    }, { selectedOnly: args.selectedOnly === true });
    return text(components);
});

register("get_pins", {
    title: "查看器件引脚",
    description:
        "查看某个器件的全部引脚：引脚编号、名称、当前值、方向（input/output/io/ground/power/other）以及已连接的其他引脚。" +
        "引脚值 0/1 表示低/高电平，2 表示高阻或未知。",
    inputSchema: {
        componentId: z.string().describe("器件 id，例如 CP0")
    },
    annotations: { readOnlyHint: true }
}, async (args) => {
    const result = await lab.evaluate((componentId) => {
        const c = window.mycircuit.findById(componentId);
        if (!c) return null;

        function direction(fun) {
            if (fun === 1) return "output";
            if (fun === 11) return "io";
            if (fun === 0 || fun === 10) return "input";
            if (fun === 2) return "ground";
            if (fun === 3) return "power";
            return "other";
        }

        return {
            id: c.id,
            name: c.name,
            customName: c.customName || null,
            pins: c.pinName.map((pinName, index) => {
                const pinId = c.id + "Pin" + index;
                const connections = [];
                const list = c.connection[index] || [];
                for (const item of list) {
                    const peer = item[1].id === pinId ? item[2].id : item[1].id;
                    connections.push({ lineId: item[0].id, peer });
                }
                const rawValue = c.pinValue[index];
                return {
                    index,
                    id: pinId,
                    name: pinName || "",
                    value: Array.isArray(rawValue) ? rawValue[0] : rawValue,
                    direction: direction(c.pinFunction[index]),
                    connections
                };
            })
        };
    }, args.componentId);

    if (!result) throw new Error("找不到器件 " + args.componentId);
    return text(result);
});

register("add_component", {
    title: "添加器件",
    description:
        "在画布坐标 (x, y) 处添加器件。可用类型：" + COMPONENT_NAMES.join("、") + "。" +
        "Switch/Led 可用 count 一次添加多个，spacingX 控制水平间距。",
    inputSchema: {
        name: z.enum(COMPONENT_NAMES).describe("器件类型"),
        x: z.number().int().min(0).describe("画布 x 坐标（像素）"),
        y: z.number().int().min(0).describe("画布 y 坐标（像素）"),
        customName: z.string().optional().describe("显示在芯片上的自定义名称"),
        count: z.number().int().min(1).max(16).optional().describe("添加数量，默认 1"),
        spacingX: z.number().int().min(0).max(200).optional().describe("多个器件之间的水平间距，默认 18")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        if (typeof window["Compo" + options.name] !== "function") {
            return { error: "未知器件类型：" + options.name };
        }
        const count = options.count || 1;
        const spacingX = options.spacingX === undefined ? 18 : options.spacingX;
        const ids = [];
        for (let i = 0; i < count; i++) {
            window.mycircuit.addComponent(
                "demo",
                "Compo" + options.name,
                options.x + i * spacingX,
                options.y,
                undefined,
                options.customName
            );
            ids.push(window.mycircuit.componentAll[window.mycircuit.componentAll.length - 1].id);
        }
        return { ids, added: ids.length, total: window.mycircuit.componentAll.length };
    }, {
        name: args.name,
        x: args.x,
        y: args.y,
        customName: args.customName,
        count: args.count,
        spacingX: args.spacingX
    });

    if (result.error) throw new Error(result.error);
    return text(result);
});

register("move_component", {
    title: "移动器件",
    description: "把指定器件移动到画布坐标 (x, y)，并自动重绘与它相连的连接线。",
    inputSchema: {
        componentId: z.string().describe("器件 id"),
        x: z.number().int().min(0).describe("新的画布 x 坐标"),
        y: z.number().int().min(0).describe("新的画布 y 坐标")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        const c = window.mycircuit.findById(options.componentId);
        const div = document.getElementById(options.componentId);
        if (!c || !div) return null;
        div.style.left = options.x + "px";
        div.style.top = options.y + "px";
        window.mycircuit.lineReplace(div);
        return { id: c.id, x: options.x, y: options.y };
    }, args);
    if (!result) throw new Error("找不到器件 " + args.componentId);
    return text(result);
});

register("rename_component", {
    title: "重命名器件",
    description: "修改芯片上显示的自定义名称（例如把 74LS181 改成 ALU）。",
    inputSchema: {
        componentId: z.string().describe("器件 id"),
        name: z.string().min(1).max(40).describe("新的显示名称")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const ok = await lab.evaluate((options) => {
        return window.mycircuit.setComponentName(options.componentId, options.name);
    }, args);
    if (!ok) throw new Error("找不到器件 " + args.componentId);
    return text({ componentId: args.componentId, name: args.name });
});

register("remove_component", {
    title: "删除器件",
    description: "删除指定器件以及与它相连的所有连接线。",
    inputSchema: {
        componentId: z.string().describe("要删除的器件 id")
    },
    annotations: { readOnlyHint: false, destructiveHint: true }
}, async (args) => {
    const result = await lab.evaluate((componentId) => {
        const removed = window.mycircuit.removeComponentById(componentId);
        return {
            removed,
            total: window.mycircuit.componentAll.length,
            lineCount: document.querySelectorAll("#demo .div-line").length
        };
    }, args.componentId);
    if (!result.removed) throw new Error("找不到器件 " + args.componentId);
    return text(result);
});

/* ------------------------------------------------------------------ */
/* 连接线                                                              */
/* ------------------------------------------------------------------ */

register("connect_pins", {
    title: "连接引脚",
    description:
        "把两个器件的引脚连接起来。输出引脚会自动作为起点；支持 output/io → input/io。" +
        "引脚编号从 0 开始，可用 get_pins 查看。",
    inputSchema: {
        fromComponent: z.string().describe("起点器件 id"),
        fromPin: z.number().int().min(0).describe("起点引脚编号"),
        toComponent: z.string().describe("终点器件 id"),
        toPin: z.number().int().min(0).describe("终点引脚编号")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        const fromPinId = options.fromComponent + "Pin" + options.fromPin;
        const toPinId = options.toComponent + "Pin" + options.toPin;
        const fromPin = document.getElementById(fromPinId);
        const toPin = document.getElementById(toPinId);
        if (!fromPin) return { error: "找不到引脚 " + fromPinId };
        if (!toPin) return { error: "找不到引脚 " + toPinId };

        const lineId = window.mycircuit.connectPins(fromPinId, toPinId);
        if (!lineId) {
            return {
                error: "这两个引脚不能连接。请确认起点是输出/双向引脚，终点是输入/双向引脚，且不是同一个器件。"
            };
        }
        return {
            lineId,
            from: fromPinId,
            to: toPinId,
            lineCount: document.querySelectorAll("#demo .div-line").length
        };
    }, args);

    if (result.error) throw new Error(result.error);
    return text(result);
});

register("list_connections", {
    title: "列出连接线",
    description: "列出画布上的所有连接线，包括连接线 id 和两端器件/引脚。",
    inputSchema: {},
    annotations: { readOnlyHint: true }
}, async () => {
    const lines = await lab.evaluate(() => {
        const seen = new Set();
        const result = [];
        for (const c of window.mycircuit.componentAll) {
            for (const list of c.connection) {
                for (const item of list) {
                    const line = item[0];
                    if (seen.has(line.id)) continue;
                    seen.add(line.id);
                    const start = item[1].id;
                    const end = item[2].id;
                    result.push({
                        lineId: line.id,
                        fromPin: start,
                        toPin: end,
                        fromComponent: start.substring(0, start.indexOf("Pin")),
                        fromPinIndex: parseInt(start.substring(start.indexOf("Pin") + 3), 10),
                        toComponent: end.substring(0, end.indexOf("Pin")),
                        toPinIndex: parseInt(end.substring(end.indexOf("Pin") + 3), 10)
                    });
                }
            }
        }
        return result;
    });
    return text(lines);
});

register("remove_connection", {
    title: "删除连接线",
    description: "按连接线 id 删除一条连接线。连接线 id 可通过 list_connections 获取。",
    inputSchema: {
        lineId: z.string().describe("连接线 id，例如 CP0Pin2ToCP1Pin0")
    },
    annotations: { readOnlyHint: false, destructiveHint: true }
}, async (args) => {
    const result = await lab.evaluate((lineId) => {
        const removed = window.mycircuit.removeLineById(lineId);
        return {
            removed,
            lineCount: document.querySelectorAll("#demo .div-line").length
        };
    }, args.lineId);
    if (!result.removed) throw new Error("找不到连接线 " + args.lineId);
    return text(result);
});

/* ------------------------------------------------------------------ */
/* 运行与状态                                                          */
/* ------------------------------------------------------------------ */

register("set_switch", {
    title: "设置开关",
    description: "把指定 Switch 器件设置为开（1）或关（0）。电源已打开时会立即传播电平变化。",
    inputSchema: {
        componentId: z.string().describe("Switch 器件 id"),
        on: z.boolean().describe("true 为高电平（开），false 为低电平（关）")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        const c = window.mycircuit.findById(options.componentId);
        if (!c) return { error: "找不到器件 " + options.componentId };
        if (c.name !== "Switch") return { error: "器件 " + options.componentId + " 不是 Switch" };

        const desired = options.on ? 1 : 0;
        c.pinValue[0] = desired;
        const div = document.getElementById(c.id);
        div.style.backgroundImage = desired
            ? "url(./img/switchH.gif)"
            : "url(./img/switchL.gif)";

        if (window.cDispatch.runState === 1) {
            window.cDispatch.propagate(c);
        }

        return {
            componentId: c.id,
            value: c.pinValue[0],
            powered: window.cDispatch.runState === 1
        };
    }, args);

    if (result.error) throw new Error(result.error);
    return text(result);
});

register("pulse", {
    title: "触发脉冲",
    description:
        "触发 SinglePulse 或 ContinuousPulse 器件。需要先上电。ContinuousPulse 会持续产生脉冲，" +
        "可用 stop=true 停止。",
    inputSchema: {
        componentId: z.string().describe("脉冲器件 id"),
        stop: z.boolean().optional().describe("停止脉冲并复位该器件")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        const c = window.mycircuit.findById(options.componentId);
        if (!c) return { error: "找不到器件 " + options.componentId };
        if (c.name !== "SinglePulse" && c.name !== "ContinuousPulse") {
            return { error: "器件 " + options.componentId + " 不是脉冲源" };
        }

        if (options.stop) {
            c.reset();
            return { componentId: c.id, stopped: true, value: c.pinValue[0] };
        }

        if (window.cDispatch.runState !== 1) {
            return { error: "请先使用 power(action=on) 上电，再触发脉冲" };
        }

        window.cDispatch.sourceTrigger(c);
        return {
            componentId: c.id,
            name: c.name,
            value: c.pinValue[0],
            timer: !!c.timer
        };
    }, args);

    if (result.error) throw new Error(result.error);
    return text(result);
});

register("power", {
    title: "电源控制",
    description: "控制实验室电源：on 上电、off 断电、reset 复位后重新上电。",
    inputSchema: {
        action: z.enum(["on", "off", "reset"]).describe("电源操作")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const result = await lab.evaluate((action) => {
        const powerImage = document.getElementById("power");

        if (action === "on") {
            if (window.cDispatch.runState === 1) {
                return { action, runState: 1, alreadyOn: true };
            }
            powerImage.setAttribute("src", "./img/poweron.png");
            window.cDispatch.powerOn();
        } else if (action === "off") {
            powerImage.setAttribute("src", "./img/poweroff.png");
            window.cDispatch.powerOff();
        } else {
            if (window.cDispatch.runState === 1) {
                window.cDispatch.powerOff();
                window.cDispatch.powerOn();
            }
        }

        return { action, runState: window.cDispatch.runState };
    }, args.action);
    return text(result);
});

/* ------------------------------------------------------------------ */
/* 存储器                                                              */
/* ------------------------------------------------------------------ */

register("get_memory", {
    title: "读取存储器",
    description:
        "读取 RAM6116、EPROM2716C3 或 EPROM2716C4 的存储器内容。" +
        "返回每个地址的二进制位串（高位在前）和十六进制值。",
    inputSchema: {
        componentId: z.string().describe("存储器器件 id"),
        start: z.number().int().min(0).optional().describe("起始地址，默认 0"),
        count: z.number().int().min(1).max(512).optional().describe("读取行数，默认到末尾")
    },
    annotations: { readOnlyHint: true }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        const c = window.mycircuit.findById(options.componentId);
        if (!c) return { error: "找不到器件 " + options.componentId };
        if (!Array.isArray(c.memory)) return { error: "器件 " + options.componentId + " 没有存储器" };

        const total = c.memory.length;
        const start = Math.min(options.start || 0, total);
        const count = options.count || (total - start);
        const rows = [];
        for (let address = start; address < total && address < start + count; address++) {
            const bits = c.memory[address] || [];
            const binary = bits.slice().reverse().join("");
            rows.push({
                address,
                binary,
                hex: binary
                    ? parseInt(binary, 2).toString(16).toUpperCase().padStart(Math.ceil(bits.length / 4), "0")
                    : ""
            });
        }
        return {
            componentId: c.id,
            name: c.name,
            total,
            wordBits: c.memory[0] ? c.memory[0].length : 0,
            start,
            rows
        };
    }, args);

    if (result.error) throw new Error(result.error);
    return text(result);
});

register("set_memory", {
    title: "写入存储器",
    description:
        "从指定地址开始写入存储器内容。data 的每一行是一个字：format=bin 时是二进制位串（高位在前），" +
        "format=hex 时是十六进制串。电源已打开时会立即刷新该存储器件的输出。",
    inputSchema: {
        componentId: z.string().describe("存储器器件 id"),
        data: z.array(z.string().min(1)).min(1).max(512).describe("要写入的数据行"),
        start: z.number().int().min(0).optional().describe("起始地址，默认 0"),
        format: z.enum(["bin", "hex"]).optional().describe("数据格式，默认 bin")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        const c = window.mycircuit.findById(options.componentId);
        if (!c) return { error: "找不到器件 " + options.componentId };
        if (!Array.isArray(c.memory)) return { error: "器件 " + options.componentId + " 没有存储器" };

        const width = c.memory[0] ? c.memory[0].length : 0;
        if (!width) return { error: "无法确定存储器字长" };

        const start = options.start || 0;
        const written = [];
        for (let i = 0; i < options.data.length; i++) {
            const address = start + i;
            if (address >= c.memory.length) break;

            const raw = String(options.data[i]);
            let bits;
            if (options.format === "hex") {
                const clean = raw.replace(/[^0-9a-fA-F]/g, "");
                if (!clean || clean.length > Math.ceil(width / 4)) {
                    return { error: `第 ${i + 1} 行不是有效的 ${Math.ceil(width / 4)} 位十六进制数` };
                }
                bits = BigInt("0x" + clean)
                    .toString(2)
                    .padStart(width, "0")
                    .slice(-width)
                    .split("")
                    .map(Number);
            } else {
                const clean = raw.replace(/[^01]/g, "");
                if (!clean || clean.length > width) {
                    return { error: `第 ${i + 1} 行不是有效的 ${width} 位二进制数` };
                }
                bits = clean.padStart(width, "0").split("").map(Number);
            }
            c.memory[address] = bits.reverse();
            written.push(address);
        }

        if (window.cDispatch.runState === 1) {
            window.cDispatch.propagate(c);
        }

        return {
            componentId: c.id,
            name: c.name,
            wordBits: width,
            written: written.length,
            firstAddress: written[0],
            lastAddress: written[written.length - 1]
        };
    }, args);

    if (result.error) throw new Error(result.error);
    return text(result);
});

/* ------------------------------------------------------------------ */
/* 编辑、画布、文件                                                    */
/* ------------------------------------------------------------------ */

register("edit", {
    title: "编辑操作",
    description:
        "执行编辑操作：select_all 全选、copy 复制、paste 粘贴、duplicate 再制、clear_selection 清除选择。" +
        "粘贴和再制可通过 offsetX/offsetY 指定偏移。",
    inputSchema: {
        action: z.enum(["select_all", "copy", "paste", "duplicate", "clear_selection"]).describe("编辑操作"),
        offsetX: z.number().int().min(-2000).max(2000).optional().describe("粘贴/再制的 x 偏移，默认 20"),
        offsetY: z.number().int().min(-2000).max(2000).optional().describe("粘贴/再制的 y 偏移，默认 20")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        const editor = window.DSVEditor;
        const offsetX = options.offsetX === undefined ? 20 : options.offsetX;
        const offsetY = options.offsetY === undefined ? 20 : options.offsetY;

        if (options.action === "select_all") {
            return { action: options.action, selected: window.mycircuit.selectAll() };
        }
        if (options.action === "clear_selection") {
            window.mycircuit.clearSelection();
            return { action: options.action, selected: 0 };
        }
        if (options.action === "copy") {
            const ok = editor.copy();
            return {
                action: options.action,
                ok,
                selected: window.mycircuit.selectedComponents.length,
                hasClipboard: editor.hasClipboard()
            };
        }
        if (options.action === "paste") {
            if (!editor.hasClipboard()) return { error: "剪贴板为空，请先执行 copy" };
            const newComponents = editor.pasteAt(offsetX, offsetY);
            return {
                action: options.action,
                count: newComponents.length,
                selected: window.mycircuit.selectedComponents.length,
                total: window.mycircuit.componentAll.length
            };
        }
        if (options.action === "duplicate") {
            const newComponents = editor.duplicateAt(offsetX, offsetY);
            return {
                action: options.action,
                count: newComponents.length,
                selected: window.mycircuit.selectedComponents.length,
                total: window.mycircuit.componentAll.length
            };
        }
        return { error: "未知操作" };
    }, args);

    if (result.error) throw new Error(result.error);
    return text(result);
});

register("set_snap", {
    title: "开关自动吸附对齐",
    description: "打开或关闭拖动器件时的自动吸附对齐辅助线。",
    inputSchema: {
        enabled: z.boolean().describe("true 打开，false 关闭")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const enabled = await lab.evaluate((value) => {
        window.DSVSnap.setEnabled(value);
        return window.DSVSnap.isEnabled();
    }, args.enabled);
    return text({ enabled });
});

register("pan_canvas", {
    title: "平移画布",
    description: "把画布原点平移到 (x, y)。x/y 为画布容器左上角相对浏览器视口的偏移。",
    inputSchema: {
        x: z.number().int().min(-5000).max(5000).describe("水平偏移（像素）"),
        y: z.number().int().min(-5000).max(5000).describe("垂直偏移（像素）")
    },
    annotations: { readOnlyHint: false }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        const demo = document.getElementById("demo");
        demo.style.left = options.x + "px";
        demo.style.top = options.y + "px";
        const rect = demo.getBoundingClientRect();
        return {
            x: options.x,
            y: options.y,
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        };
    }, args);
    return text(result);
});

register("screenshot", {
    title: "截取实验室画面",
    description:
        "截取当前浏览器画面并返回 PNG 图片，便于检查电路布局和器件状态。" +
        "可选保存到文件（相对路径以项目根目录为基准）。",
    inputSchema: {
        fullPage: z.boolean().optional().describe("是否截取整个页面，默认 false（仅视口）"),
        savePath: z.string().optional().describe("保存路径，例如 docs/lab.png")
    },
    annotations: { readOnlyHint: true }
}, async (args) => {
    const { buffer, savedPath } = await lab.screenshot(args);
    const content = [
        { type: "image", data: buffer.toString("base64"), mimeType: "image/png" }
    ];
    const info = {
        bytes: buffer.length,
        savedPath,
        fullPage: args.fullPage === true
    };
    content.push({ type: "text", text: JSON.stringify(info, null, 2) });
    return { content };
});

register("export_circuit", {
    title: "导出电路",
    description: "把当前电路导出为 DS-VLAB 的电路文本格式，可用于保存或分享。",
    inputSchema: {},
    annotations: { readOnlyHint: true }
}, async () => {
    const result = await lab.evaluate(() => {
        return {
            data: window.circuitdata(window.mycircuit),
            componentCount: window.mycircuit.componentAll.length,
            lineCount: document.querySelectorAll("#demo .div-line").length
        };
    });
    return text(result);
});

register("import_circuit", {
    title: "导入电路",
    description:
        "导入 DS-VLAB 电路文本（export_circuit 的格式）。默认先清空当前电路；导入后电源处于关闭状态。",
    inputSchema: {
        data: z.string().min(1).describe("电路文本"),
        clear: z.boolean().optional().describe("是否先清空当前电路，默认 true")
    },
    annotations: { readOnlyHint: false, destructiveHint: true }
}, async (args) => {
    const result = await lab.evaluate((options) => {
        if (options.clear !== false && window.mycircuit.componentAll.length > 0) {
            window.mycircuit.deletecircuit();
        }
        if (window.cDispatch.runState === 1) {
            document.getElementById("power").setAttribute("src", "./img/poweroff.png");
            window.cDispatch.powerOff();
        }
        window.recovercircuit("demo", window.mycircuit, options.data);
        return {
            componentCount: window.mycircuit.componentAll.length,
            lineCount: document.querySelectorAll("#demo .div-line").length,
            power: window.cDispatch.runState
        };
    }, { data: args.data, clear: args.clear });
    return text(result);
});

register("new_circuit", {
    title: "新建电路",
    description: "清空画布上的所有器件和连接线，并关闭电源。",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: true }
}, async () => {
    const result = await lab.evaluate(() => {
        window.mycircuit.deletecircuit();
        return {
            componentCount: window.mycircuit.componentAll.length,
            lineCount: document.querySelectorAll("#demo .div-line").length,
            power: window.cDispatch.runState
        };
    });
    return text(result);
});

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("DS-VLAB MCP server is running on stdio");

async function shutdown() {
    try {
        await lab.close();
    } finally {
        process.exit(0);
    }
}

server.onclose = shutdown;
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
