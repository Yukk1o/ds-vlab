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




function toolbox() {
    var _this = this;
    _this.tooltipSelected = 0;
    _this.tooltipName = "";

    var init = function () {
        $("#accordion li").mousedown(function (e) {
            _this.tooltipSelected = 1;
            _this.tooltipName = $(this).text();
        });

        $("body").mouseup(function (e) {
            if (_this.tooltipSelected == 1) {
                lefttop = $("#toolbox").offset();
                right = lefttop.left + $("#toolbox").width();
                bottom = lefttop.top + $("#toolbox").height();
                if (!(e.pageX > lefttop.left && e.pageX < right && e.pageY>lefttop.top && e.pageY <bottom)) {
                    // alert(_this.tooltipName + "X: " + e.pageX + ", Y: " + e.pageY);
                    var cName = _this.tooltipName;
                    //把鼠标的屏幕坐标换算成画布坐标（画布可能被中键平移过）
                    var demo = document.getElementById("demo");
                    var demoRect = demo.getBoundingClientRect();
                    var canvasX = e.clientX - demoRect.left;
                    var canvasY = e.clientY - demoRect.top;
                    if (cName==="SwitchC4" || cName==="SwitchC8" || cName==="LedC4" || cName==="LedC8" ) {
                        const lastChar = cName.slice(-1); // 使用 slice 获取末位字符
                        const num = Number(lastChar);     // 直接数值转换
                        if (cName==="SwitchC4" || cName==="SwitchC8") {
                            cName="Switch";
                        } else {
                            cName="Led";
                        }
                        for (let n = 0; n < num; n++) {
                            mycircuit.addComponent("demo", "Compo" + cName, canvasX+18*n, canvasY);
                        }
                    } else {
                        mycircuit.addComponent("demo", "Compo" + cName, canvasX, canvasY);
                    }
                };
            };
            _this.tooltipSelected = 0;
        });


        $(function () { $("#accordion").accordion({ heightStyle: "fill" }); });
        $(function () {
            $("#accordion-resizer").resizable({
                minHeight:250,
                minWidth:150,
                resize: function () {
                    $("#accordion").accordion("refresh");
                }
            });
            $("#accordion").accordion({ collapsible: true });
        });
        $(function () {
            $("#toolbox").draggable({ handle: "h1" });
        });
        $(function () {
            $("#accordion li").draggable({ appendTo: "#demo", helper: "clone" });
        });
    };

    init();
};


