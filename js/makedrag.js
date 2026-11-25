/*
Duosi Principles of Computer Composition Virtual Experiment System ,DS-VLAB v2.0
Copyright(C)2013 ZHANG Wen-fen, Email: yydzhwf@xnu.edu.cn  Address: Xiangnan University, Chenzhou Hunan, China
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public 
License as published by the Free Software Foundation, either version 3 of the License, or any later version.

多思计算机组成原理网络虚拟实验系统, DS-VLAB v2.0 
版权所有(C) 张雯雰, 电子邮箱: yydzhwf@xnu.edu.cn
本程序为自由软件；您可依据自由软件基金会所发表的GNU AFFERO GENERAL PUBLIC LICENSE，对本程序再次发布和/或修改。

作者：湘南学院计算机与人工智能学院张雯雰老师
*/



//此函数使对象能够被拖动  o:对象ID  s:是否随屏幕滚动而移动
function dragEnabled(o, s) {

    if (typeof o == "string") o = document.getElementById(o);
    o.orig_x = parseInt(o.style.left) - document.documentElement.scrollLeft;
    o.orig_y = parseInt(o.style.top) - document.documentElement.scrollTop;
    o.orig_index = o.style.zIndex;

    o.onmousedown = function (a) {
        if (!a) a = window.event;
        //只响应鼠标左键，右键用于删除，中键用于平移画布
        if (a.button !== undefined && a.button !== 0) return;

        this.style.zIndex = 10000;
        var d = document;
        var startX = a.clientX;
        var startY = a.clientY;
        var startLeft = parseInt(o.style.left) || 0;
        var startTop = parseInt(o.style.top) || 0;
        var isGroupMove = false;
        var groupItems = [];
        var excludeIds = {};

        // 判断是否为多选组拖动
        if (window.mycircuit && Array.isArray(mycircuit.selectedComponents) && mycircuit.selectedComponents.length > 1) {
            // 判断当前拖动的o是否在选中组内
            var found = false;
            for (var i = 0; i < mycircuit.selectedComponents.length; i++) {
                if (mycircuit.selectedComponents[i] && mycircuit.selectedComponents[i].id === o.id) {
                    found = true;
                    break;
                }
            }
            if (found) {
                isGroupMove = true;
                // 记录所有选中器件的div和初始位置
                for (var i = 0; i < mycircuit.selectedComponents.length; i++) {
                    var comp = mycircuit.selectedComponents[i];
                    if (!comp) continue;
                    var compDiv = document.getElementById(comp.id);
                    if (!compDiv) continue;
                    groupItems.push({
                        div: compDiv,
                        left: parseInt(compDiv.style.left) || 0,
                        top: parseInt(compDiv.style.top) || 0,
                        width: compDiv.offsetWidth,
                        height: compDiv.offsetHeight
                    });
                    excludeIds[comp.id] = true;
                }
            }
        }

        if (!isGroupMove) {
            excludeIds[o.id] = true;
        }

        var moveAll = function (curX, curY, altKey) {
            var dx = curX - startX;
            var dy = curY - startY;
            var snapDX = 0, snapDY = 0;

            if (isGroupMove && groupItems.length > 1) {
                var minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
                for (var i = 0; i < groupItems.length; i++) {
                    var item = groupItems[i];
                    var left = item.left + dx;
                    var top = item.top + dy;
                    if (left < minLeft) minLeft = left;
                    if (top < minTop) minTop = top;
                    if (left + item.width > maxRight) maxRight = left + item.width;
                    if (top + item.height > maxBottom) maxBottom = top + item.height;
                }

                if (window.DSVSnap && !altKey) {
                    var snap = DSVSnap.snapMove({
                        left: minLeft,
                        top: minTop,
                        width: maxRight - minLeft,
                        height: maxBottom - minTop
                    }, excludeIds);
                    snapDX = snap.dx;
                    snapDY = snap.dy;
                } else if (window.DSVSnap) {
                    DSVSnap.hideGuides();
                }

                for (var i = 0; i < groupItems.length; i++) {
                    var item = groupItems[i];
                    item.div.style.left = (item.left + dx + snapDX) + "px";
                    item.div.style.top = (item.top + dy + snapDY) + "px";
                    item.div.orig_x = item.left + dx + snapDX;
                    item.div.orig_y = item.top + dy + snapDY;
                    if (window.mycircuit && typeof mycircuit.lineReplace === 'function') {
                        mycircuit.lineReplace(item.div);
                    }
                }
            } else {
                var left = startLeft + dx;
                var top = startTop + dy;
                if (window.DSVSnap && !altKey) {
                    var snap = DSVSnap.snapMove({
                        left: left,
                        top: top,
                        width: o.offsetWidth,
                        height: o.offsetHeight
                    }, excludeIds);
                    snapDX = snap.dx;
                    snapDY = snap.dy;
                } else if (window.DSVSnap) {
                    DSVSnap.hideGuides();
                }

                o.style.left = (left + snapDX) + "px";
                o.style.top = (top + snapDY) + "px";
                o.orig_x = left + snapDX;
                o.orig_y = top + snapDY;
                if (window.mycircuit && typeof mycircuit.lineReplace === 'function') {
                    mycircuit.lineReplace(o);
                }
            }
        };

        if (o.setCapture)
            o.setCapture();

        d.onmousemove = function (a) {
            if (!a) a = window.event;
            moveAll(a.clientX, a.clientY, a.altKey);
        };

        d.onmouseup = function () {
            if (o.releaseCapture)
                o.releaseCapture();
            d.onmousemove = null;
            d.onmouseup = null;
            o.style.zIndex = o.orig_index;
            if (window.DSVSnap) DSVSnap.hideGuides();
            if (isGroupMove) {
                for (var i = 0; i < groupItems.length; i++) {
                    if (window.mycircuit && typeof mycircuit.lineReplace === 'function') {
                        mycircuit.lineReplace(groupItems[i].div);
                    }
                }
            } else {
                if (window.mycircuit && typeof mycircuit.lineReplace === 'function') {
                    mycircuit.lineReplace(o);
                }
            }
        };
    };

    if (s) {
        var orig_scroll = window.onscroll ? window.onscroll : function () { };
        window.onscroll = function () {
            orig_scroll();
            o.style.left = o.orig_x + document.documentElement.scrollLeft;
            o.style.top = o.orig_y + document.documentElement.scrollTop;
        }
    }
};
