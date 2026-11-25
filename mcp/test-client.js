/*
 * End-to-end test for the DS-VLAB MCP server.
 * Run: node test-client.js
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
    if (!condition) throw new Error("ASSERT FAILED: " + message);
}

function parse(result) {
    const item = (result.content || []).find((entry) => entry.type === "text");
    if (!item) return null;
    return JSON.parse(item.text);
}

const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, "server.js")],
    cwd: __dirname,
    env: { ...process.env, DSVLAB_HEADLESS: "1" }
});

const client = new Client({ name: "dsvlab-mcp-test", version: "0.0.1" });
await client.connect(transport);

try {
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    console.log("tools:", names.join(", "));
    for (const required of ["lab_open", "add_component", "connect_pins", "set_switch", "get_pins", "screenshot"]) {
        assert(names.includes(required), "tool exists: " + required);
    }

    const opened = parse(await client.callTool({
        name: "lab_open",
        arguments: { headless: true, viewportWidth: 1280, viewportHeight: 800 }
    }));
    assert(opened.open === true, "lab opened");
    console.log("opened:", opened.url);

    const sw = parse(await client.callTool({
        name: "add_component",
        arguments: { name: "Switch", x: 300, y: 300 }
    }));
    const led = parse(await client.callTool({
        name: "add_component",
        arguments: { name: "Led", x: 500, y: 300 }
    }));
    assert(sw.ids.length === 1 && led.ids.length === 1, "switch and led added");

    const line = parse(await client.callTool({
        name: "connect_pins",
        arguments: { fromComponent: sw.ids[0], fromPin: 0, toComponent: led.ids[0], toPin: 0 }
    }));
    assert(line.lineId, "line created");
    console.log("connected:", line.lineId);

    await client.callTool({ name: "power", arguments: { action: "on" } });

    const off = parse(await client.callTool({
        name: "get_pins",
        arguments: { componentId: led.ids[0] }
    }));
    assert(off.pins[0].value === 0, "led initially off: " + JSON.stringify(off.pins[0]));

    await client.callTool({
        name: "set_switch",
        arguments: { componentId: sw.ids[0], on: true }
    });
    const on = parse(await client.callTool({
        name: "get_pins",
        arguments: { componentId: led.ids[0] }
    }));
    assert(on.pins[0].value === 1, "led on after switch: " + JSON.stringify(on.pins[0]));
    console.log("switch -> led ok");

    const connections = parse(await client.callTool({ name: "list_connections", arguments: {} }));
    assert(connections.length === 1, "one connection listed");
    assert(connections[0].lineId === line.lineId, "line id matches");

    const exported = parse(await client.callTool({ name: "export_circuit", arguments: {} }));
    assert(exported.componentCount === 2, "export component count");
    assert(exported.data.includes("Switch") && exported.data.includes("Led"), "export contains components");
    console.log("export:", exported.data.substring(0, 80) + "...");

    const selected = parse(await client.callTool({
        name: "edit",
        arguments: { action: "select_all" }
    }));
    assert(selected.selected === 2, "select all");

    await client.callTool({ name: "edit", arguments: { action: "copy" } });
    const pasted = parse(await client.callTool({
        name: "edit",
        arguments: { action: "paste", offsetX: 30, offsetY: 40 }
    }));
    assert(pasted.count === 2, "pasted two components: " + JSON.stringify(pasted));
    assert(pasted.total === 4, "total after paste");
    console.log("copy/paste ok");

    const shot = await client.callTool({ name: "screenshot", arguments: {} });
    const image = shot.content.find((entry) => entry.type === "image");
    assert(image && image.mimeType === "image/png" && image.data.length > 1000, "screenshot returned");
    console.log("screenshot bytes:", Buffer.from(image.data, "base64").length);

    const snapOff = parse(await client.callTool({
        name: "set_snap",
        arguments: { enabled: false }
    }));
    assert(snapOff.enabled === false, "snap disabled");

    const status = parse(await client.callTool({ name: "lab_status", arguments: {} }));
    assert(status.componentCount === 4 && status.power === 1, "status reflects state");
    assert(status.snap === false, "status snap false");

    const cleared = parse(await client.callTool({ name: "new_circuit", arguments: {} }));
    assert(cleared.componentCount === 0 && cleared.lineCount === 0, "new circuit clears");
    console.log("new circuit ok");

    // 存储器读写
    const ram = parse(await client.callTool({
        name: "add_component",
        arguments: { name: "RAM6116", x: 400, y: 400 }
    }));
    const written = parse(await client.callTool({
        name: "set_memory",
        arguments: {
            componentId: ram.ids[0],
            format: "bin",
            data: ["10101010", "00001111"]
        }
    }));
    assert(written.written === 2, "memory written");
    const memory = parse(await client.callTool({
        name: "get_memory",
        arguments: { componentId: ram.ids[0], start: 0, count: 2 }
    }));
    assert(memory.rows[0].binary === "10101010" && memory.rows[0].hex === "AA", "memory row 0");
    assert(memory.rows[1].binary === "00001111" && memory.rows[1].hex === "0F", "memory row 1");
    console.log("memory read/write ok");

    // 导出 -> 新建 -> 导入
    const exported2 = parse(await client.callTool({ name: "export_circuit", arguments: {} }));
    await client.callTool({ name: "new_circuit", arguments: {} });
    const imported = parse(await client.callTool({
        name: "import_circuit",
        arguments: { data: exported2.data }
    }));
    assert(imported.componentCount === 1, "import restores component");
    const importedList = parse(await client.callTool({ name: "list_components", arguments: {} }));
    assert(importedList[0].name === "RAM6116", "imported type");
    console.log("import/export ok");

    // 重命名、移动、删除
    const alu = parse(await client.callTool({
        name: "add_component",
        arguments: { name: "74LS181", x: 200, y: 200 }
    }));
    await client.callTool({
        name: "rename_component",
        arguments: { componentId: alu.ids[0], name: "MY-ALU" }
    });
    await client.callTool({
        name: "move_component",
        arguments: { componentId: alu.ids[0], x: 250, y: 260 }
    });
    const afterEdit = parse(await client.callTool({ name: "list_components", arguments: {} }));
    const aluInfo = afterEdit.find((component) => component.id === alu.ids[0]);
    assert(aluInfo.customName === "MY-ALU", "rename works");
    assert(aluInfo.x === 250 && aluInfo.y === 260, "move works");
    const removed = parse(await client.callTool({
        name: "remove_component",
        arguments: { componentId: alu.ids[0] }
    }));
    assert(removed.removed === true && removed.total === 1, "remove works");
    console.log("rename/move/remove ok");

    // 平移画布
    const pan = parse(await client.callTool({
        name: "pan_canvas",
        arguments: { x: 40, y: 30 }
    }));
    assert(pan.x === 40 && pan.y === 30 && pan.rect.width > 0, "pan works");

    console.log("MCP TESTS PASSED");
} finally {
    try {
        await client.callTool({ name: "lab_close", arguments: {} });
    } catch {
        //忽略关闭异常
    }
    await client.close();
}
