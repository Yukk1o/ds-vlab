/*
 * DS-VLAB MCP laboratory session
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

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf"
};

function pushLimited(array, value, limit = 30) {
    if (!value) return;
    array.push(value);
    if (array.length > limit) array.shift();
}

export class Lab {
    constructor(options = {}) {
        this.defaultOptions = {
            headless: options.headless === true,
            viewportWidth: options.viewportWidth || 1440,
            viewportHeight: options.viewportHeight || 900,
            url: options.url || ""
        };
        this.browser = null;
        this.context = null;
        this.page = null;
        this.httpServer = null;
        this.baseUrl = "";
        this.opening = null;
        this.pageErrors = [];
        this.consoleErrors = [];
    }

    get projectRoot() {
        return PROJECT_ROOT;
    }

    async ensureOpen(options = {}) {
        if (this.page && !this.page.isClosed()) return this.page;
        if (!this.opening) {
            const merged = { ...this.defaultOptions, ...options };
            this.opening = this._open(merged).finally(() => {
                this.opening = null;
            });
        }
        return this.opening;
    }

    async _open(options) {
        this.lastOpenOptions = { ...options };
        const headless = options.headless === true;
        const width = Math.max(800, Number(options.viewportWidth) || 1440);
        const height = Math.max(600, Number(options.viewportHeight) || 900);

        const url = options.url || (await this._startStaticServer());

        const attempts = [];
        if (process.env.DSVLAB_BROWSER_PATH) {
            attempts.push({ executablePath: process.env.DSVLAB_BROWSER_PATH });
        }
        if (process.env.DSVLAB_BROWSER_CHANNEL) {
            attempts.push({ channel: process.env.DSVLAB_BROWSER_CHANNEL });
        }
        attempts.push({ channel: "chrome" }, { channel: "msedge" }, {});

        const launchOptions = {
            headless,
            args: [
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
                "--disable-backgrounding-occluded-windows"
            ]
        };

        let lastError = null;
        for (const attempt of attempts) {
            try {
                this.browser = await chromium.launch({ ...launchOptions, ...attempt });
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!this.browser) {
            throw new Error(
                "无法启动浏览器。请安装 Chrome 或 Edge，或设置环境变量 DSVLAB_BROWSER_PATH 指向浏览器可执行文件。" +
                (lastError ? " 最后一个错误：" + lastError.message : "")
            );
        }

        try {
            this.context = await this.browser.newContext({
                viewport: { width, height },
                deviceScaleFactor: 1
            });
            this.page = await this.context.newPage();

            this.page.on("pageerror", (error) => {
                pushLimited(this.pageErrors, error.message);
            });
            this.page.on("console", (message) => {
                if (message.type() !== "error") return;
                const text = message.text();
                //jQuery UI 主题图片缺失属于原项目自带问题，不视为页面错误
                if (/Failed to load resource/i.test(text)) return;
                pushLimited(this.consoleErrors, text);
            });

            const response = await this.page.goto(url, { waitUntil: "load", timeout: 45000 });
            if (response && !response.ok()) {
                throw new Error(`页面加载失败：HTTP ${response.status()} ${url}`);
            }

            await this.page.waitForFunction(
                () => !!(window.mycircuit && window.cDispatch && window.DSVSnap),
                null,
                { timeout: 20000 }
            );
            await this.page.waitForTimeout(300);
        } catch (error) {
            await this.close();
            throw error;
        }

        return this.page;
    }

    async _startStaticServer() {
        if (this.baseUrl) return this.baseUrl;

        const server = http.createServer((request, response) => {
            let pathname;
            try {
                pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
            } catch {
                response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
                response.end("Bad request");
                return;
            }

            if (pathname.endsWith("/")) pathname += "index.html";
            const filePath = path.resolve(PROJECT_ROOT, "." + pathname);
            const relative = path.relative(PROJECT_ROOT, filePath);
            if (relative.startsWith("..") || path.isAbsolute(relative)) {
                response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
                response.end("Forbidden");
                return;
            }

            fs.stat(filePath, (error, stat) => {
                if (error || !stat.isFile()) {
                    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
                    response.end("Not found");
                    return;
                }
                const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
                response.writeHead(200, {
                    "Content-Type": type,
                    "Content-Length": stat.size,
                    "Cache-Control": "no-store"
                });
                if (request.method === "HEAD") {
                    response.end();
                    return;
                }
                const stream = fs.createReadStream(filePath);
                stream.on("error", () => {
                    if (!response.headersSent) response.writeHead(500);
                    response.end();
                });
                stream.pipe(response);
            });
        });

        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(Number(process.env.DSVLAB_PORT) || 0, "127.0.0.1", () => {
                server.removeListener("error", reject);
                resolve();
            });
        });

        this.httpServer = server;
        const address = server.address();
        this.baseUrl = `http://127.0.0.1:${address.port}/index.html`;
        return this.baseUrl;
    }

    async evaluate(fn, arg) {
        const page = await this.ensureOpen();
        return page.evaluate(fn, arg);
    }

    async screenshot(options = {}) {
        const page = await this.ensureOpen();
        const buffer = await page.screenshot({
            type: "png",
            fullPage: options.fullPage === true
        });

        let savedPath = null;
        if (options.savePath) {
            savedPath = path.isAbsolute(options.savePath)
                ? options.savePath
                : path.resolve(PROJECT_ROOT, options.savePath);
            fs.mkdirSync(path.dirname(savedPath), { recursive: true });
            fs.writeFileSync(savedPath, buffer);
        }

        return { buffer, savedPath };
    }

    async status() {
        const page = this.page;
        const open = !!(page && !page.isClosed());
        const result = {
            open,
            url: open ? page.url() : this.baseUrl || null,
            headless: open && this.lastOpenOptions ? this.lastOpenOptions.headless === true : null,
            pageErrors: this.pageErrors.slice(),
            consoleErrors: this.consoleErrors.slice()
        };

        if (!open) return result;

        try {
            const state = await page.evaluate(() => {
                const demo = document.getElementById("demo");
                const selected = (window.mycircuit.selectedComponents || []).map((c) => c.id);
                return {
                    title: document.title,
                    componentCount: window.mycircuit.componentAll.length,
                    connectionCount: document.querySelectorAll("#demo .div-line").length,
                    selected,
                    power: window.cDispatch.runState,
                    snap: window.DSVSnap ? window.DSVSnap.isEnabled() : null,
                    pan: {
                        x: parseInt(demo.style.left, 10) || 0,
                        y: parseInt(demo.style.top, 10) || 0
                    },
                    clipboard: !!(window.DSVEditor && window.DSVEditor.hasClipboard()),
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    }
                };
            });
            Object.assign(result, state);
        } catch (error) {
            result.evaluateError = error.message;
        }
        return result;
    }

    async close() {
        const browser = this.browser;
        this.page = null;
        this.context = null;
        this.browser = null;

        if (browser) {
            try {
                await browser.close();
            } catch {
                //忽略关闭时的异常
            }
        }

        if (this.httpServer) {
            const server = this.httpServer;
            this.httpServer = null;
            await new Promise((resolve) => server.close(() => resolve()));
        }

        this.baseUrl = "";
        this.pageErrors = [];
        this.consoleErrors = [];
    }
}
