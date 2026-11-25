/*
Editor enhancements for DS-VLAB 2.0
Copyright (C) 2026 DS-VLAB contributors

This file is part of DS-VLAB and is licensed under the GNU Affero General
Public License, version 3 or any later version. See license.txt.

Original project:
Duosi Principles of Computer Composition Virtual Experiment System, DS-VLAB v2.0
Copyright(C)2013 ZHANG Wen-fen, Email: yydzhwf@xnu.edu.cn
Address: Xiangnan University, Chenzhou Hunan, China

新增功能：
1. Ctrl+C / Ctrl+V / Ctrl+A / Ctrl+D 快捷键；
2. 拖动器件时自动吸附对齐（可通过“编辑”菜单关闭）；
3. 按住鼠标中键拖动画布。
*/
(function (window, $) {
    "use strict";

    var SNAP_STORAGE_KEY = "dsvlab_snap_enabled";
    var snapEnabled = true;
    try {
        var storedSnap = window.localStorage.getItem(SNAP_STORAGE_KEY);
        if (storedSnap !== null) snapEnabled = storedSnap !== "0";
    } catch (e) {
        snapEnabled = true;
    }

    var initialized = false;
    var clipboard = null;
    var pasteCount = 0;
    var guideV = null;
    var guideH = null;

    /* ------------------------------------------------------------------ */
    /* 提示消息                                                           */
    /* ------------------------------------------------------------------ */
    function showToast(message) {
        var toast = document.getElementById("dsv-editor-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "dsv-editor-toast";
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = "show";
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(function () {
            toast.className = "";
        }, 1600);
    }

    /* ------------------------------------------------------------------ */
    /* 自动吸附对齐                                                       */
    /* ------------------------------------------------------------------ */
    function ensureGuides() {
        if (!guideV) {
            guideV = document.createElement("div");
            guideV.className = "dsv-snap-guide-v";
            document.body.appendChild(guideV);
        }
        if (!guideH) {
            guideH = document.createElement("div");
            guideH.className = "dsv-snap-guide-h";
            document.body.appendChild(guideH);
        }
    }

    function hideGuides() {
        if (guideV) guideV.style.display = "none";
        if (guideH) guideH.style.display = "none";
    }

    //在一组目标坐标中寻找与移动边最近的对齐点
    function findBestSnap(movingStart, movingSize, targets, threshold) {
        var movingPoints = [movingStart, movingStart + movingSize / 2, movingStart + movingSize];
        var best = null;
        var i, j, delta;
        for (i = 0; i < targets.length; i++) {
            for (j = 0; j < movingPoints.length; j++) {
                delta = targets[i] - movingPoints[j];
                if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
                    best = { delta: delta, guide: targets[i] };
                }
            }
        }
        return best;
    }

    /*
     * 计算移动中的矩形（left/top/width/height，画布坐标）的吸附偏移。
     * excludeIds 为正在拖动的器件id集合，避免自己吸附到自己。
     * 返回 {dx, dy}。
     */
    function snapMove(box, excludeIds) {
        var result = { dx: 0, dy: 0 };
        if (!snapEnabled || !window.mycircuit) {
            hideGuides();
            return result;
        }

        var threshold = 6;
        var xTargets = [];
        var yTargets = [];
        var components = window.mycircuit.componentAll;
        var i, comp, div, left, top, width, height;

        for (i = 0; i < components.length; i++) {
            comp = components[i];
            if (!comp || (excludeIds && excludeIds[comp.id])) continue;
            div = document.getElementById(comp.id);
            if (!div) continue;
            left = div.offsetLeft;
            top = div.offsetTop;
            width = div.offsetWidth;
            height = div.offsetHeight;
            xTargets.push(left, left + width / 2, left + width);
            yTargets.push(top, top + height / 2, top + height);
        }

        var snapX = findBestSnap(box.left, box.width, xTargets, threshold);
        var snapY = findBestSnap(box.top, box.height, yTargets, threshold);
        if (!snapX && !snapY) {
            hideGuides();
            return result;
        }

        ensureGuides();
        var demo = document.getElementById("demo");
        var demoRect = demo.getBoundingClientRect();

        if (snapX) {
            result.dx = snapX.delta;
            guideV.style.display = "block";
            guideV.style.left = (demoRect.left + snapX.guide) + "px";
            guideV.style.top = "0px";
            guideV.style.height = window.innerHeight + "px";
        } else {
            guideV.style.display = "none";
        }

        if (snapY) {
            result.dy = snapY.delta;
            guideH.style.display = "block";
            guideH.style.top = (demoRect.top + snapY.guide) + "px";
            guideH.style.left = "0px";
            guideH.style.width = window.innerWidth + "px";
        } else {
            guideH.style.display = "none";
        }

        return result;
    }

    function updateSnapMenu() {
        var $item = $("#editsnap");
        if ($item.length) {
            $item.text((snapEnabled ? "✓ " : "") + "自动吸附对齐");
        }
    }

    function setSnapEnabled(enabled) {
        snapEnabled = !!enabled;
        try {
            window.localStorage.setItem(SNAP_STORAGE_KEY, snapEnabled ? "1" : "0");
        } catch (e) {
            //忽略隐私模式下的存储异常
        }
        if (!snapEnabled) hideGuides();
        updateSnapMenu();
    }

    /* ------------------------------------------------------------------ */
    /* 中键平移画布                                                       */
    /* ------------------------------------------------------------------ */
    function initCanvasPan() {
        var demo = document.getElementById("demo");
        if (!demo) return;

        var panning = false;
        var startX = 0, startY = 0;
        var startLeft = 0, startTop = 0;

        demo.addEventListener("mousedown", function (e) {
            if (e.button !== 1) return; //中键
            e.preventDefault();
            e.stopPropagation();

            panning = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseFloat(demo.style.left) || 0;
            startTop = parseFloat(demo.style.top) || 0;
            document.body.classList.add("dsv-panning");
            if (demo.setCapture) demo.setCapture();
        }, true);

        document.addEventListener("mousemove", function (e) {
            if (!panning) return;
            e.preventDefault();
            demo.style.left = (startLeft + e.clientX - startX) + "px";
            demo.style.top = (startTop + e.clientY - startY) + "px";
        }, true);

        function stopPan() {
            if (!panning) return;
            panning = false;
            document.body.classList.remove("dsv-panning");
            if (demo.releaseCapture) demo.releaseCapture();
        }

        document.addEventListener("mouseup", function (e) {
            if (e.button === 1) stopPan();
        }, true);
        window.addEventListener("blur", stopPan);

        //阻止浏览器中键自动滚动和 Linux 下的中键粘贴
        demo.addEventListener("auxclick", function (e) {
            if (e.button === 1) e.preventDefault();
        }, true);
    }

    /* ------------------------------------------------------------------ */
    /* 快捷键和菜单                                                       */
    /* ------------------------------------------------------------------ */
    function isEditingTarget(target) {
        if (!target) return false;
        var tag = (target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        if (target.isContentEditable) return true;
        return $(target).closest(".ui-dialog").length > 0;
    }

    function hasOpenDialog() {
        return $(".ui-dialog:visible").length > 0;
    }

    function copySelection() {
        var clip = window.mycircuit.copySelection();
        if (!clip) {
            showToast("请先选择要复制的器件");
            return false;
        }
        clipboard = clip;
        pasteCount = 0;
        showToast("已复制 " + clip.components.length + " 个器件");
        return true;
    }

    function pasteSelection() {
        if (!clipboard) {
            showToast("剪贴板为空");
            return false;
        }
        pasteCount = pasteCount + 1;
        var newComponents = window.mycircuit.pasteClipboard(clipboard, 20 * pasteCount, 20 * pasteCount);
        if (!newComponents.length) {
            showToast("粘贴失败");
            return false;
        }
        showToast("已粘贴 " + newComponents.length + " 个器件");
        return true;
    }

    function selectAll() {
        var count = window.mycircuit.selectAll();
        showToast(count ? "已全选 " + count + " 个器件" : "画布中还没有器件");
        return count > 0;
    }

    function duplicateSelection() {
        if (!window.mycircuit.selectedComponents.length) {
            showToast("请先选择要再制的器件");
            return false;
        }
        var newComponents = window.mycircuit.duplicateSelection(20, 20);
        showToast("已再制 " + newComponents.length + " 个器件");
        return newComponents.length > 0;
    }

    function handleKeyDown(e) {
        if (!window.mycircuit || e.altKey) return;
        if (!(e.ctrlKey || e.metaKey)) return;
        if (isEditingTarget(e.target) || hasOpenDialog()) return;

        var key = (e.key || "").toLowerCase();
        //兼容旧浏览器
        if (!key && e.keyCode) key = String.fromCharCode(e.keyCode).toLowerCase();

        var handled = false;
        if (key === "c") {
            copySelection();
            handled = true;
        } else if (key === "v") {
            pasteSelection();
            handled = true;
        } else if (key === "a") {
            selectAll();
            handled = true;
        } else if (key === "d") {
            duplicateSelection();
            handled = true;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    function bindMenu() {
        $("#editcopy").on("click", function (e) {
            e.preventDefault();
            copySelection();
        });
        $("#editpaste").on("click", function (e) {
            e.preventDefault();
            pasteSelection();
        });
        $("#editselectall").on("click", function (e) {
            e.preventDefault();
            selectAll();
        });
        $("#editduplicate").on("click", function (e) {
            e.preventDefault();
            duplicateSelection();
        });
        $("#editsnap").on("click", function (e) {
            e.preventDefault();
            setSnapEnabled(!snapEnabled);
            showToast(snapEnabled ? "自动吸附对齐：开" : "自动吸附对齐：关");
        });
    }

    window.DSVSnap = {
        snapMove: snapMove,
        hideGuides: hideGuides,
        isEnabled: function () { return snapEnabled; },
        setEnabled: setSnapEnabled
    };

    window.initEditorEnhancements = function () {
        if (initialized) return;
        initialized = true;
        updateSnapMenu();
        bindMenu();
        initCanvasPan();
        document.addEventListener("keydown", handleKeyDown, false);
    };

}(window, jQuery));
