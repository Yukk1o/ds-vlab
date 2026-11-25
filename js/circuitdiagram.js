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


function Circuit() {
    this.componentAll = [];  //已画出的实验器件列表(不包括已删除的）
    this.count = 0;   //器件计数，包括已删除的器件，用于生成器件id

    this.linecolor = "yellow";
    const storedLineColor = localStorage.getItem("linecolor");
    if (storedLineColor) {
        this.linecolor = storedLineColor;
    }

    var targetPin = null;  //拉连接线时的目标引脚
    var _this = this;
    var  arrowCount=0;

    //初始化选择框相关变量
    this.isSelecting = false;
    this.selectionStartX = 0;
    this.selectionStartY = 0;
    this.selectionBox = null;
    this.selectedComponents = [];


    //在给定div（parentId）的指定位置（offsetX, offsetY）处画出实验器件（componentName）
    this.addComponent = function (parentId, componentName, offsetX, offsetY, componentId, customName) {
        var component = new window[componentName]();
        if (componentId === undefined) {
            component.id = "CP" + String(this.count);
        } else {
            component.id = componentId;
        }
        ;

        // Set customName if provided
        if (customName!=null) {
            component.customName = customName;
        } 

        this.count = this.count + 1;
        _this.componentAll.push(component);
        var compDiv = document.createElement("div");
        compDiv.id = component.id;
        compDiv.style.position = "absolute";
        compDiv.style.left = offsetX + "px";
        compDiv.style.top = offsetY + "px";
        compDiv.style.width = component.width + "px";
        compDiv.style.height = component.height + "px";
        compDiv.style.zIndex = 3000 + this.count;
        $("#" + parentId).append(compDiv);

        if (component.image != "") {
            compDiv.style.backgroundImage = "url(" + component.image + ")";
        }
        ;
        if (component.showBorder == true && component.showName == false) {
            compDiv.className = "window2";
        }
        ;
        if (component.showBorder == true && component.showName == true) {
            var underDiv = document.createElement("div");
            underDiv.id = component.id + "UnderLayer";
            underDiv.className = "window";
            underDiv.style.left = "0px";
            underDiv.style.top = "0px";
            underDiv.style.width = component.width + "px";
            underDiv.style.height = component.height + "px";
            underDiv.style.lineHeight = component.height + "px";
            underDiv.innerHTML = "<strong>" + component.customName + "</strong>";
            $("#" + compDiv.id).append(underDiv);
        }
        ;

        //画出所有引脚
        var pinDiv, pn, pinFun;
        for (var i = 0; i < component.pinName.length; i++) {
            pinDiv = document.createElement("div");
            pinDiv.id = compDiv.id + "Pin" + i;
            pinDiv.className = "pin";
            pn = component.pinName[i];
            if (pn == "") {
                pinDiv.style.width = component.pinWidth + 2 + "px";
                pinDiv.style.height = component.pinHeight + "px";
            } else {
                pinDiv.style.width = component.pinWidth + 6 + "px"; //让引脚间部分重叠，字好看些
                pinDiv.style.height = component.pinHeight + 2 + "px";
            }
            ;
           
            pinDiv.style.left = component.paddingLR + (component.width - component.paddingLR * 2) * component.pinPosition[i][0] + "px";

            if (component.pinPosition[i][1] == 1) {
                if (component.showBorder == true) {
                    pinDiv.style.top = component.height - component.pinHeight + "px";
                } else {
                    pinDiv.style.top = component.height - component.pinHeight - 1 + "px";
                }
                ;
                if (pn != "" && component.showPinNo != false) pinDiv.innerHTML = pn + "<br>" + i;
                if (pn != "" && component.showPinNo == false) pinDiv.innerHTML = pn;
            }
            ;
            if (component.pinPosition[i][1] == 0) {
                pinDiv.style.top = 0 + "px";
                if (pn != "" && component.showPinNo != false) pinDiv.innerHTML = i + "<br>" + pn;
                if (pn != "" && component.showPinNo == false) pinDiv.innerHTML = pn;
            }
            ;
            pinFun = component.pinFunction[i];
            if (pinFun == 10 || pinFun == 0) {   //如果是输入引脚
                pinDiv.style.color = "#003C9D";
                $(pinDiv).bind("mousedown", doNone);
                $(pinDiv).bind("mouseenter", function () {
                    targetPin = this;
                });
                $(pinDiv).bind("mouseleave", function () {
                    targetPin = null;
                });
            }
            ;
            if (pinFun == 1) {   //如果是输出引脚
                pinDiv.style.color = "green";
                $(pinDiv).bind("mousedown", lineDrag);
            }
            ;
            if (pinFun == 11) {   //如果是输入/输出引脚
                pinDiv.style.color = "#b200ff";
                $(pinDiv).bind("mouseenter", function () {
                    targetPin = this;
                });
                $(pinDiv).bind("mouseleave", function () {
                    targetPin = null;
                });
                $(pinDiv).bind("mousedown", lineDrag);
            }
            ;
            if (pinFun >= 2) {   //如果是其它引脚
                $(pinDiv).bind("mousedown", doNone);
            }
            ;

            pinDiv.onselectstart = function () {
                return false;
            };//不让div中的文字被选中

            $("#" + compDiv.id).append(pinDiv);
        }
        ;

        dragEnabled(compDiv.id);
        
        $(compDiv).bind("mouseup", deleteC);
        if (component.name == "Switch")
            $(compDiv).bind("mousedown", switchClick);
        if (component.name == "SinglePulse")
            $(compDiv).bind("mousedown", singlePulseClick);

        if (component.showName === true && component.showPinNo === true)
            $(compDiv).bind("dblclick", showPinValue);
    };


    //生成一条连接线
    this.lineCreate = function (paintDiv, fromX, fromY, toX, toY) {
        console.log("========" + fromX + "  " + toX)
        var newLine = document.createElement("div");
        var path = "M " + fromX + " " + fromY + " L " + toX + " " + toY;
        newLine.setAttribute("class", "div-line");

     //   var timestamp=new Date().getTime();
        arrowCount=arrowCount+1;

        newLine.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\"" +
            "style='overflow: inherit;position: absolute;left:0;top:0;'>" +
            "\n" +
            "<defs>" +
            "<marker id=\"idArrow"+arrowCount+"\"\n" +
            "\n" +
            "         viewBox=\"0 0 20 20\" refX=\"0\" refY=\"10\"\n" +
            "\n" +
            "         markerUnits=\"userSpaceOnUse\" markerWidth=\"7\" markerHeight=\"7\"\n" +
            "\n" +
            "         orient=\"auto\">\n" +
            "\n" +
            "         <path class='my-arrow' d=\"M 0 0 L 20 10 L 0 20 z\" fill=\"" + _this.linecolor + "\" stroke=\"" + _this.linecolor + "\"/>\n" +
            "\n" +
            "      </marker>\n" +
            "\n" +
            "</defs>" +
            "<path stroke-width='1.5' fill='none' class='my-line'  stroke=" + _this.linecolor + " d='" + path + "'  marker-end=\"url(#idArrow"+arrowCount+")\" /></svg>";
 
        $("#" + paintDiv).append(newLine);
        $(".my-line").hover(function () {
            $(this).css("stroke", "red");
            $(this).css("stroke-width", "4");
            var a = $(this).prev().find(".my-arrow")[0];
            $(a).css("fill", "red");
            $(a).css("stroke", "red");
        }, function () {
            $(this).css("stroke", _this.linecolor);
            $(this).css("stroke-width", "1.5");
            var a = $(this).prev().find(".my-arrow")[0];
            $(a).css("fill", _this.linecolor);
            $(a).css("stroke", _this.linecolor);
        });
        $(newLine).bind("mousedown", deleteL);

        var p = $(newLine).find("path")[1];
        return p;
    };

    //生成连接线时，从起始点往目标点拖动的过程中，线的变化
    function lineChange(line, fromX, fromY, toX, toY) {
        var p1X, p1Y, p2X, p2Y;
        if (Math.abs(fromX - toX) > Math.abs(fromY - toY)) {
            p1X = fromX + Math.round((toX - fromX) / 2);
            p1Y = fromY;
            p2X = fromX + Math.round((toX - fromX) / 2);
            p2Y = toY;
            if (fromX > toX) {
                toX = toX + 7
            } else {
                toX = toX - 7
            }
            ;
        } else {
            p1X = fromX;
            p1Y = fromY + Math.round((toY - fromY) / 2);
            p2X = toX;
            p2Y = fromY + Math.round((toY - fromY) / 2);
            if (fromY > toY) {
                toY = toY + 7
            } else {
                toY = toY - 7
            }
            ;
        }
        ;
        var path = "M " +fromX + " " + fromY + " L " + p1X + " " + p1Y + " " + p2X + " " + p2Y + " " + toX + " " + toY;
        $(line).attr("d", path);
     };

    //生成连接线时，鼠标到达目标引脚后，调整、定位连接线；拖动器件时，调整连接线
    this.lineAdjust = function (line, startPin, endPin) {
        var sX, sY, eX, eY;
        var st = startPin.offsetTop;
        var et = endPin.offsetTop;
        sX = startPin.parentNode.offsetLeft + startPin.offsetLeft + Math.round(startPin.offsetWidth / 2) - 1;
        if (st < 2) sY = startPin.parentNode.offsetTop;
        else sY = startPin.parentNode.offsetTop + startPin.parentNode.offsetHeight;
        eX = endPin.parentNode.offsetLeft + endPin.offsetLeft + Math.round(endPin.offsetWidth / 2) - 1;
        if (et < 2) eY = endPin.parentNode.offsetTop;
        else eY = endPin.parentNode.offsetTop + endPin.parentNode.offsetHeight;

        if (eY - sY > 10 && st > 1 && et < 2) {
            var p1X = sX;
            var p1Y = sY + Math.round((eY - sY) / 2);
            var p2X = eX;
            var p2Y = sY + Math.round((eY - sY) / 2);

            eY = eY - 5;
            var path = "M " + sX + " " + sY + " L " + p1X + " " + p1Y + " L " + p2X + " " + p2Y + " L " + eX + " " + eY;
            $(line).attr("d", path);
        }
        ;
        if (eY - sY < 10 && st > 1 && et < 2) {
            var p1X = sX;
            var p1Y = sY + 30;
            var p2X = sX + Math.round((eX - sX) / 2);
            var p2Y = sY + 30;
            var p3X = p2X;
            var p3Y = eY - 30;
            var p4X = eX;
            var p4Y = eY - 30;

            eY = eY - 5;
            var path = "M " + sX + " " + sY + " L " + p1X + " " + p1Y + " L " + p2X + " " + p2Y + " L " + p3X + " " + p3Y + " L " + p4X + " " + p4Y + " L " + eX + " " + eY;
            $(line).attr("d", path);
        }
        ;
        if (st > 1 && et > 1) {
            var p1X = sX;
            if (eY > sY) {
                var p1Y = eY + 30;
                var p2Y = eY + 30;
            } else {
                var p1Y = sY + 30;
                var p2Y = sY + 30;
            }
            ;
            var p2X = eX;
            eY = eY + 8;
            var path = "M " + sX + " " + sY + " L " + p1X + " " + p1Y + " L " + p2X + " " + p2Y + " L " + eX + " " + eY;
            $(line).attr("d", path);
        }
        ;
        if (st < 2 && et < 2) {
            var p1X = sX;
            if (eY > sY) {
                var p1Y = sY - 30;
                var p2Y = sY - 30;
            } else {
                var p1Y = eY - 30;
                var p2Y = eY - 30;
            }
            ;
            var p2X = eX;
            eY = eY - 5;
            var path = "M " + sX + " " + sY + " L " + p1X + " " + p1Y + " L " + p2X + " " + p2Y + " L " + eX + " " + eY;
            $(line).attr("d", path);
        }
        ;
        var flag = false;
        if (sY - eY > 10 && st < 2 && et > 1) {
            var p1X = sX;
            var p1Y = sY - Math.round((sY - eY) / 2);
            var p2X = eX;
            var p2Y = sY - Math.round((sY - eY) / 2);

            eY = eY + 8;
            var path = "M " + sX + " " + sY + " L " + p1X + " " + p1Y + " L " + p2X + " " + p2Y + " L " + eX + " " + eY;
            $(line).attr("d", path);

            flag = true;
        }
        ;
        if (sY - eY < 10 && st < 2 && et > 1) {
            var p1X = sX;
            var p1Y = sY - 30;
            var p2X = sX + Math.round((eX - sX) / 2);
            var p2Y = sY - 30;
            var p3X = p2X;
            var p3Y = eY + 30;
            var p4X = eX;
            var p4Y = eY + 30;
            if (!flag) {
                eY = eY + 8;
            }
            var path = "M " + sX + " " + sY + " L " + p1X + " " + p1Y + " L " + p2X + " " + p2Y + " L " + p3X + " " + p3Y + " L " + p4X + " " + p4Y + " L " + eX + " " + eY;
            $(line).attr("d", path);
        }
        ;
    };


    //输出引脚的鼠标事件
    function lineDrag(a) {
        window.event.cancelBubble = true;  //禁止事件冒泡到下一层
        if (!a) a = window.event;
        var d = document;
        var sTop = Math.max(d.body.scrollTop, d.documentElement.scrollTop);
        var sLeft = Math.max(d.body.scrollLeft, d.documentElement.scrollLeft);
        var ox = a.clientX + sLeft, oy = a.clientY + sTop;
        var line = _this.lineCreate("demo", ox, oy, ox, oy);
        targetPin = null;
        var originPin = this;

        // Highlight the line and arrow while dragging
        $(line).css("stroke", "red");
        var arrow = $(line).prev().find(".my-arrow")[0];
        if(arrow) {
            $(arrow).css("fill", "red");
            $(arrow).css("stroke", "red");
        }

        d.onmousemove = function (a) {
            if (!a) a = window.event;
            var sTop = Math.max(d.body.scrollTop, d.documentElement.scrollTop);
            var sLeft = Math.max(d.body.scrollLeft, d.documentElement.scrollLeft);
            if (targetPin == null) {  //鼠标还没到达目标点时
                lineChange(line, ox, oy, a.clientX + sLeft, a.clientY + sTop);
            } else { //鼠标已进入目标引脚时
                _this.lineAdjust(line, originPin, targetPin);
            }
        }

        d.onmouseup = function () {
            if (targetPin == null) {//如果没有进入任何目标引脚                   待修改：还应该检查目标引脚是否已经被连接了
                var a = $(line).parent()[0];
                $(a).parent()[0].remove(true);
            } else {
                _this.lineAdjust(line, originPin, targetPin);

                // Restore default color when mouse is released and line is kept
                $(line).css("stroke", _this.linecolor);
                var arrow = $(line).prev().find(".my-arrow")[0];
                if(arrow) {
                    $(arrow).css("fill", _this.linecolor);
                    $(arrow).css("stroke", _this.linecolor);
                }

                _this.addLineToComponent(line, originPin, targetPin);
            }
            
            d.onmousemove = null;
            d.onmouseup = null;

        }
    };


    //输入引脚和其它引脚的mousedown事件
    function doNone(a) {
        window.event.cancelBubble = true;  //禁止事件冒泡到下一层
    };

    //根据id从componentAll中找到匹配的器件
    this.findById = function (Id) {
        for (var i = 0; i < _this.componentAll.length; i++) {
            if (_this.componentAll[i].id == Id)
                return _this.componentAll[i];
        }
        ;
        return 0;
    };

    //根据id从componentAll中找到匹配的器件并删除
    function deleteById(Id) {
        for (var i = 0; i < _this.componentAll.length; i++) {
            if (_this.componentAll[i].id == Id) {
                _this.componentAll[i] = null;
                _this.componentAll.splice(i, 1);
                return 1;
            }
            ;
        }
        ;
        return 0;
    };


    //把连接线信息保存到器件对象中,设置line.id
    this.addLineToComponent = function (line, startPin, endPin) {
        var sPId, ePId, sCId, sPNo, eCId, ePNo, p;
        sPId = startPin.id;
        p = sPId.indexOf("Pin");
        sCId = sPId.substring(0, p);//获取起始引脚的器件ID
        sPNo = sPId.substring(p + 3);//获取起始引脚的编号
        ePId = endPin.id;
        p = ePId.indexOf("Pin");
        eCId = ePId.substring(0, p);
        ePNo = ePId.substring(p + 3);
        var sc = _this.findById(sCId);
        sc.connection[sPNo].push([line, startPin, endPin]);
        var ec = _this.findById(eCId);
        ec.connection[ePNo].push([line, startPin, endPin]);
        line.id = sPId + "To" + ePId;
    };

    //拖动器件c时，更新其所有连接线
    this.lineReplace = function (c) {
        var comp = _this.findById(c.id);
        if (comp===0 || !comp.connection) return;

        var i, j, l, s, e;
        for (i = 0; i < comp.connection.length; i++) {
            for (j = 0; j < comp.connection[i].length; j++) {
                l = comp.connection[i][j][0];
                s = comp.connection[i][j][1];
                e = comp.connection[i][j][2];
                _this.lineAdjust(l, s, e);
            }
            ;
        }
        ;
    };


    //删除连接线
    function lineDelete(line) {
        var lId, sPId, ePId, sCId, sPNo, eCId, ePNo, p, i;
        var aline = $(line).find("path")[1];
        var bline = line;
        if (typeof (aline) == 'undefined') {
            lId = line.id;
            var a = $(line).parent()[0];
            line = $(a).parent()[0];
        } else {
            bline = aline;
            lId = aline.id;
        }
        p = lId.indexOf("To");
        sPId = lId.substring(0, p);
        ePId = lId.substring(p + 2);
        p = sPId.indexOf("Pin");
        sCId = sPId.substring(0, p);//获取起始引脚的器件ID
        sPNo = sPId.substring(p + 3);//获取起始引脚的编号
        p = ePId.indexOf("Pin");
        eCId = ePId.substring(0, p);
        ePNo = ePId.substring(p + 3);
        var sc = _this.findById(sCId);
        for (i = 0; i < sc.connection[sPNo].length; i++) {
            if (sc.connection[sPNo][i][0] == bline) {
                sc.connection[sPNo].splice(i, 1);
                break;
            }
            ;
        }
        ;
        var ec = _this.findById(eCId);
        for (i = 0; i < ec.connection[ePNo].length; i++) {
            if (ec.connection[ePNo][i][0] == bline) {
                ec.connection[ePNo].splice(i, 1);
                break;
            }
            ;
        }
        ;
        $(line).remove();
    };

    //右击删除连接线的鼠标事件
    function deleteL(a) {
        if (!a) a = window.event;
        if (a.button == 2) {
            var r = confirm("是否要删除连接线？");
            if (r == true) {
                lineDelete(this);
            }
            ;
        }
        ;
    };


    //删除器件以及与器件相连的所有连接线
    function componentDelete(c) {
        var i, j;
        var comp = _this.findById(c.id);
        for (i = 0; i < comp.connection.length; i++) {
            for (j = 0; j < comp.connection[i].length;) {
                lineDelete(comp.connection[i][j][0]);
            }
            ;
        }
        ;
        deleteById(c.id);
        c.remove(true);

    };

    //右击删除器件及其连接线的鼠标事件
    function deleteC(a) {
        if (!a) a = window.event;
        if (a.button == 2) {
            // 判断是否多选且当前器件在多选组内
            var group = (window.mycircuit && mycircuit.selectedComponents) ? mycircuit.selectedComponents : [];
            var isGroup = false;
            if (group && group.length > 1) {
                for (var i = 0; i < group.length; i++) {
                    if (group[i] && group[i].id === this.id) {
                        isGroup = true;
                        break;
                    }
                }
            }
            if (isGroup) {
                var r = confirm("是否要删除所有选中元器件及其连接线？");
                if (r == true) {
                    // 先复制一份，防止删除时selectedComponents变化
                    var toDelete = group.slice();
                    for (var i = 0; i < toDelete.length; i++) {
                        var compDiv = document.getElementById(toDelete[i].id);
                        if (compDiv) componentDelete(compDiv);
                    }
                    if (window.mycircuit) mycircuit.clearSelection();
                }
            } else {
                var r = confirm("是否要删除元器件及其连接线？");
                if (r == true) {
                    componentDelete(this);
                    if (window.mycircuit) mycircuit.clearSelection();
                }
            }
        }
    };


    //双击器件显示所有引脚的值
    function showPinValue() {
        var s = "";
        var comp = _this.findById(this.id);
        var len = comp.pinValue.length;
        var w = 250;
        var i;
        if (len > 26) w = len * 10;
        for (i = len - 1; i >= len / 2; i--) {
            s = s + comp.pinValue[i] + "&nbsp;&nbsp;&nbsp;";
        }
        ;
        s = s + "<br/>";
        for (i = len - 1; i >= len / 2; i--) {
            if (i < 10) {
                s = s + i + "&nbsp;&nbsp;&nbsp;";
            } else {
                s = s + i + " ";
            }
            ;
        }
        ;
        s = s + "<br/>";
        for (i = 0; i < len / 2; i++) {
            if (i < 10) {
                s = s + i + "&nbsp;&nbsp;&nbsp;";
            } else {
                s = s + i + " ";
            }
            ;
        }
        ;
        s = s + "<br/>";
        for (i = 0; i < len / 2; i++) {
            s = s + comp.pinValue[i] + "&nbsp;&nbsp;&nbsp;";
        }
        ;

        s ="<p>" + s + "</p>" + "<label>Component Name: <input type='text' id='compNameInput' value='" + comp.customName + "' style='width:200px;'/></label>" ;
        dialog.innerHTML = s;
        $("#dialog").dialog({
            modal: true,
            height: 260,
            width: w,
            buttons: [
                {
                    text: "OK",
                    click: function () {
                        // Optionally save the component name
                        var newName = $("#compNameInput").val();
                        //如果newName不为空且不全是空格，则保存；否则保持原名
                        if (newName.trim() !== "") {
                            //如果newName的长度超过器件宽度允许显示的长度，则截断
                            var maxNameLength = Math.floor((comp.width - 10) / 8);
                            if (newName.length > maxNameLength) {
                                newName = newName.substring(0, maxNameLength);
                            }
                            comp.customName = newName;
                            var compDiv = document.getElementById(comp.id);
                            compDiv.querySelector("#" + comp.id + "UnderLayer strong").textContent = newName;

                            $(this).dialog("close");
                        }
                    }
                },
                {
                    text: "Cancel",
                    click: function () {
                        $(this).dialog("close");
                    }
                }
            ]
        });
    };


    /*开关的鼠标单击事件*/
    function switchClick(a) {
        if (!a) a = window.event;
        if (a.button == 2) {
          return;
        }
        ;

        var moveFlag = false;
        var d = document;
        var me = this;

        $(this).bind("mousemove", mm);
        $(this).bind("mouseup", mup);

        function mm() {
            moveFlag = true;
        };

        function mup() {
            if (!moveFlag) {
                var imgSrc = me.style.backgroundImage;
                var c = _this.findById(me.id);
                if (imgSrc == "url(\"./img/switchL.gif\")" || imgSrc == "url(./img/switchL.gif)") {
                    me.style.backgroundImage = "url(./img/switchH.gif)";
                }
                ;
                if (imgSrc == "url(\"./img/switchH.gif\")" || imgSrc == "url(./img/switchH.gif)") {
                    me.style.backgroundImage = "url(./img/switchL.gif)";
                }
                ;
                if (cDispatch.runState == 1) {
                    cDispatch.sourceTrigger(c);
                } else {
                    c.input();
                }
                ;
            }
            ;

            $(me).unbind("mousemove", mm);
            $(me).unbind("mouseup", mup);
        };
    };

    /*单脉冲器件的鼠标单击事件*/
    function singlePulseClick(a) {
        if (!a) a = window.event;
        if (a.button == 2) {
          return;
        }
        ;

        var moveFlag = false;
        var d = document;
        var me = this;

        $(this).bind("mousemove", mm);
        $(this).bind("mouseup", mup);

        function mm() {
            moveFlag = true;
        };

        function mup() {
            if (!moveFlag) {
                var c = _this.findById(me.id);
                if (cDispatch.runState == 1 && c.timer == null) {
                    cDispatch.sourceTrigger(c);
                }
                ;
            }
            ;

            $(me).unbind("mousemove", mm);
            $(me).unbind("mouseup", mup);
        };
    };

    this.linecolorchange = function (c) {
        var x = $("#demo").find("div");
        for (var i = 0; i < x.length; i++) {
            var p = $(x[i]).find("path")[1];
            var p1 = $(x[i]).find("path")[0];
            $(p).attr("stroke", c);
            $(p1).attr("fill", c);
        }
        $(".my-line").mouseover();
        $(".my-line").mouseout();
    };

    this.deletecircuit = function () {
        var c;
        this.clearSelection();
        if ($("#power").attr("src") == "./img/poweron.png") {
            $("#power").attr("src", "./img/poweroff.png");
            cDispatch.powerOff();
        }
        ;

        for (var i = 0; _this.componentAll.length > 0; i) {
            c = document.getElementById(_this.componentAll[i].id);
            componentDelete(c);
        }
        ;

        this.count = 0;   //器件计数，包括已删除的器件，用于生成器件id
        var targetPin = null;  //拉连接线时的目标引脚
    };

    

    // Initialize selection functionality
    this.initSelection = function(parentId) {
        var demo = document.getElementById(parentId);
        var self = _this;
        
        $(demo).mousedown(function(e) {
            if (e.button !== 0) return; // Only left click

            // 判断是否点击在器件（有id且不是parentId）
            var $target = $(e.target);
            var isComponent = false;
            // 只要不是demo本身且不是连接线div，就认为是器件
            if ($target.closest('div').attr('id') !== parentId && $target.attr('id') !== parentId) {
                // 但如果是连接线div（class包含div-line），则不是器件
                if ($target.hasClass('div-line') || $target.parents('.div-line').length > 0) {
                    isComponent = false;
                } else {
                    isComponent = true;
                }
            }
            if (isComponent) {
                //self.clearSelection();
                return;
            }

            // If already selecting, clear selection
            if (self.isSelecting) {
                self.clearSelection();
            }

            // Start selection
            self.isSelecting = true;
            var demoRect = demo.getBoundingClientRect();
            self.selectionStartX = e.clientX - demoRect.left;
            self.selectionStartY = e.clientY - demoRect.top;

            // Create selection box
            self.selectionBox = document.createElement('div');
            self.selectionBox.className = 'selection-box';
            self.selectionBox.style.left = self.selectionStartX + 'px';
            self.selectionBox.style.top = self.selectionStartY + 'px';
            self.selectionBox.style.width = '0px';
            self.selectionBox.style.height = '0px';
            demo.appendChild(self.selectionBox);
        });
        
        $(document).mousemove(function(e) {
            if (!self.isSelecting || !self.selectionBox) return;

            var demoRect = demo.getBoundingClientRect();
            var currentX = e.clientX - demoRect.left;
            var currentY = e.clientY - demoRect.top;
            
            var left = Math.min(self.selectionStartX, currentX);
            var top = Math.min(self.selectionStartY, currentY);
            var width = Math.abs(currentX - self.selectionStartX);
            var height = Math.abs(currentY - self.selectionStartY);
            
            self.selectionBox.style.left = left + 'px';
            self.selectionBox.style.top = top + 'px';
            self.selectionBox.style.width = width + 'px';
            self.selectionBox.style.height = height + 'px';
        });
        
        $(document).mouseup(function(e) {
            if (!self.isSelecting) return;
            
            if (self.selectionBox) {
                // Get selection rectangle bounds
                var rect = {
                    left: parseInt(self.selectionBox.style.left),
                    top: parseInt(self.selectionBox.style.top),
                    right: parseInt(self.selectionBox.style.left) + parseInt(self.selectionBox.style.width),
                    bottom: parseInt(self.selectionBox.style.top) + parseInt(self.selectionBox.style.height)
                };
                
                // Find components within rectangle
                self.selectComponentsInRect(rect);
                
                // Remove selection box
                self.selectionBox.parentNode.removeChild(self.selectionBox);
                self.selectionBox = null;
            }
            
            //如果没有选中任何组件，isSelectiong设为false；如果选中了组件，保持isSelecting为true，直到用户点击空白区域取消选择
            if (self.selectedComponents.length === 0) {
                self.isSelecting = false;
            }

        });
    };
    
    // Select components within rectangle
    this.selectComponentsInRect = function(rect) {
        var newlySelected = [];
        
        for (var i = 0; i < this.componentAll.length; i++) {
            var comp = this.componentAll[i];
            if (!comp) continue;
            
            var compDiv = document.getElementById(comp.id);
            if (!compDiv) continue;
            
            var compLeft = compDiv.offsetLeft;
            var compTop = compDiv.offsetTop;
            var compRight = compLeft + compDiv.offsetWidth;
            var compBottom = compTop + compDiv.offsetHeight;
            
            // Check if component is within selection rectangle
            if (compLeft >= rect.left && compRight <= rect.right &&
                compTop >= rect.top && compBottom <= rect.bottom) {
                newlySelected.push(comp);
                compDiv.classList.add('component-selected');
            }
        }
        
        this.selectedComponents = newlySelected;
    };
    
    // Clear all selections
    this.clearSelection = function() {
        for (var i = 0; i < this.selectedComponents.length; i++) {
            var comp = this.selectedComponents[i];
            if (comp) {
                var compDiv = document.getElementById(comp.id);
                if (compDiv) {
                    compDiv.classList.remove('component-selected');
                }
            }
        }
        this.selectedComponents = [];
        this.isSelecting = false;
    };

    //选中指定的器件组（additive为true时保留原有选择）
    this.selectComponents = function(comps, additive) {
        if (!additive) this.clearSelection();
        for (var i = 0; i < comps.length; i++) {
            var comp = comps[i];
            if (!comp) continue;
            if (this.selectedComponents.indexOf(comp) == -1) {
                this.selectedComponents.push(comp);
            }
            var compDiv = document.getElementById(comp.id);
            if (compDiv) compDiv.classList.add('component-selected');
        }
        this.isSelecting = this.selectedComponents.length > 0;
    };

    //全选
    this.selectAll = function() {
        this.selectComponents(this.componentAll.slice(), false);
        return this.selectedComponents.length;
    };

    //深拷贝器件运行状态（不包含DOM引用、连接线和定时器）
    function cloneComponentState(value) {
        if (value === null || typeof value != "object") return value;
        if (Object.prototype.toString.call(value) === "[object Date]") {
            return new Date(value.getTime());
        }
        var copy, key;
        if (Object.prototype.toString.call(value) === "[object Array]") {
            copy = [];
            for (var i = 0; i < value.length; i++) {
                copy.push(cloneComponentState(value[i]));
            }
            return copy;
        }
        copy = {};
        for (key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                copy[key] = cloneComponentState(value[key]);
            }
        }
        return copy;
    }

    //取得器件除id、连接线、定时器之外的全部状态
    function getComponentState(comp) {
        var state = {}, key, value;
        for (key in comp) {
            if (!Object.prototype.hasOwnProperty.call(comp, key)) continue;
            if (key == "id" || key == "connection" || key == "timer" || key == "customName") continue;
            value = comp[key];
            if (typeof value == "function") continue;
            state[key] = cloneComponentState(value);
        }
        return state;
    }

    //从引脚id中取出器件id和引脚编号
    function splitPinId(pinId) {
        var p = pinId.indexOf("Pin");
        return {
            compId: pinId.substring(0, p),
            pinNo: pinId.substring(p + 3)
        };
    }

    /*
     * 复制当前选中的器件（以及选中器件之间的连接线）
     * 返回一个不包含DOM引用的剪贴板对象，可直接用于粘贴。
     */
    this.copySelection = function() {
        if (!this.selectedComponents.length) return null;

        var selectedIds = {}, components = [], lines = [], lineKeys = {};
        var i, j, k, comp, compDiv, item;

        for (i = 0; i < this.selectedComponents.length; i++) {
            comp = this.selectedComponents[i];
            if (!comp) continue;
            compDiv = document.getElementById(comp.id);
            if (!compDiv) continue;
            selectedIds[comp.id] = true;
            components.push({
                oldId: comp.id,
                name: comp.name,
                customName: comp.customName,
                left: parseInt(compDiv.style.left, 10) || 0,
                top: parseInt(compDiv.style.top, 10) || 0,
                backgroundImage: compDiv.style.backgroundImage || "",
                state: getComponentState(comp)
            });
        }

        //只复制两端都在选中范围内的连接线
        for (i = 0; i < this.selectedComponents.length; i++) {
            comp = this.selectedComponents[i];
            if (!comp || !comp.connection) continue;
            for (j = 0; j < comp.connection.length; j++) {
                if (comp.pinFunction[j] != 1 && comp.pinFunction[j] != 11) continue;
                for (k = 0; k < comp.connection[j].length; k++) {
                    item = comp.connection[j][k];
                    if (!item || !item[0] || !item[1] || !item[2]) continue;
                    var startPin = item[1];
                    var endPin = item[2];
                    var start = splitPinId(startPin.id);
                    var end = splitPinId(endPin.id);
                    if (!selectedIds[start.compId] || !selectedIds[end.compId]) continue;

                    var lineKey = item[0].id || (startPin.id + "To" + endPin.id);
                    if (lineKeys[lineKey]) continue;
                    lineKeys[lineKey] = true;
                    lines.push({
                        startId: start.compId,
                        startPin: start.pinNo,
                        endId: end.compId,
                        endPin: end.pinNo
                    });
                }
            }
        }

        return {
            components: components,
            lines: lines,
            createdAt: new Date().getTime()
        };
    };

    /*
     * 粘贴剪贴板内容。offsetX/offsetY为相对原始位置的偏移量。
     * 返回新生成的器件对象数组，并自动选中这些器件。
     */
    this.pasteClipboard = function(clipboard, offsetX, offsetY) {
        if (!clipboard || !clipboard.components || !clipboard.components.length) return [];

        offsetX = offsetX || 0;
        offsetY = offsetY || 0;
        var idMap = {}, newComponents = [], item, i, key, newComp, compDiv;

        for (i = 0; i < clipboard.components.length; i++) {
            item = clipboard.components[i];
            this.addComponent("demo", "Compo" + item.name, item.left + offsetX, item.top + offsetY,
                undefined, item.customName);
            newComp = this.componentAll[this.componentAll.length - 1];
            idMap[item.oldId] = newComp.id;

            //恢复开关状态、存储器内容、引脚值等运行状态
            if (item.state) {
                for (key in item.state) {
                    if (!Object.prototype.hasOwnProperty.call(item.state, key)) continue;
                    newComp[key] = cloneComponentState(item.state[key]);
                }
            }

            //恢复LED、开关、脉冲源等器件的显示状态
            compDiv = document.getElementById(newComp.id);
            if (compDiv && item.backgroundImage) {
                compDiv.style.backgroundImage = item.backgroundImage;
            }
            newComponents.push(newComp);
        }

        //在新器件之间恢复连接线
        for (i = 0; i < clipboard.lines.length; i++) {
            var lineInfo = clipboard.lines[i];
            var startPinId = idMap[lineInfo.startId] + "Pin" + lineInfo.startPin;
            var endPinId = idMap[lineInfo.endId] + "Pin" + lineInfo.endPin;
            var startPin = document.getElementById(startPinId);
            var endPin = document.getElementById(endPinId);
            if (!startPin || !endPin) continue;
            var line = this.lineCreate("demo", 0, 0, 10, 10);
            this.lineAdjust(line, startPin, endPin);
            this.addLineToComponent(line, startPin, endPin);
        }

        this.selectComponents(newComponents, false);
        return newComponents;
    };

    //原地再制选中器件（不改变系统剪贴板内容）
    this.duplicateSelection = function(offsetX, offsetY) {
        var clipboard = this.copySelection();
        if (!clipboard) return [];
        return this.pasteClipboard(clipboard, offsetX === undefined ? 20 : offsetX,
            offsetY === undefined ? 20 : offsetY);
    };


    this.initSelection("demo");

};


