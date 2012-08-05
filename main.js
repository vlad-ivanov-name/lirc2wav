const APP_VERSION = "0.9 beta";

var file = new air.File(), params = new Object(), OS_WIN = false, totalImpulseLen, OS_SHELL_SCRIPT, SOX_PATH, OS_SHELL_ENCODING, commands, scriptFile, scriptFileStream;

function openExternalURL(href){
    var request = new air.URLRequest(href);
    try {
        air.navigateToURL(request);
    } 
    catch (e) {
        _alert(e.message);
    }
}

function _alert(text){
    $("#alert-message").html(text);
    $("#alert").fadeIn("fast");
}

function convertToBinary(dec, count){
    var bits = [];
    var dividend = dec;
    var remainder = 0;
    while (dividend >= 2) {
        remainder = dividend % 2;
        bits.push(remainder);
        dividend = (dividend - remainder) / 2;
    }
    bits.push(dividend);
    while (bits.length < count) 
        bits.push(0);
    bits.reverse();
    return bits;
}

function writePostDataBits(filename){
    var i = 0;
    var bits = convertToBinary(params.post_data_bits);
    var c = bits.lenght;
    for (i = 0; i < c; i++) {
        writeBit(filename, bits[i]);
    }
}


function writeWAVConversion(filename, originalName){
    command = SOX_PATH + " -r 48000 -e signed -b 16 " + filename + ".raw\" " + filename + ".wav\" \n\r";
    if (OS_WIN) {
        command += "echo " + originalName + "			: ok \n\r";
    }
    else {
        command += "echo \"" + originalName + "			: ok \"\n\r";
    }
    scriptFileStream.writeMultiByte(command, OS_SHELL_ENCODING);
}

function writeImpulsePause(filename, on, off){
    command = SOX_PATH + " -c 1 -r 48000 -n -t raw - synth " + (on / 2000000) + " sine 18000 vol 1 >> " + filename + ".raw\" \n\r";
    command += SOX_PATH + " -c 1 -r 48000 -n -t raw - synth " + (off / 2000000) + " sine 18000 vol 0 >> " + filename + ".raw\" \n\r";
    totalImpulseLen += parseInt(params.header[0]);
    totalImpulseLen += parseInt(params.header[1]);
    scriptFileStream.writeMultiByte(command, OS_SHELL_ENCODING);
}

function writeSingleImpulse(filename, on){
    command = SOX_PATH + " -c 1 -r 48000 -n -t raw - synth " + (on / 2000000) + " sine 18000 vol 1 >> " + filename + ".raw\" \n\r";
    totalImpulseLen += parseInt(params.ptrail);
    scriptFileStream.writeMultiByte(command, OS_SHELL_ENCODING);
}

function writeGap(filename){
    command = SOX_PATH + " -c 1 -r 48000 -n -t raw - synth " + ((params.gap) / 2000000) + " sine 18000 vol 0 >> " + filename + ".raw\" \n\r";
    scriptFileStream.writeMultiByte(command, OS_SHELL_ENCODING);
}

function writeBit(filename, bit){
    if (bit == 1) {
        command = SOX_PATH + " -c 1 -r 48000 -n -t raw - synth " + (params.one[0] / 2000000) + " sine 18000 vol 1 >> " + filename + ".raw\" \n\r";
        command += SOX_PATH + " -c 1 -r 48000 -n -t raw - synth " + (params.one[1] / 2000000) + " sine 18000 vol 0 >> " + filename + ".raw\" \n\r";
        totalImpulseLen += parseInt(params.one[0]);
        totalImpulseLen += parseInt(params.one[1]);
    }
    else {
        command = SOX_PATH + " -c 1 -r 48000 -n -t raw - synth " + (params.zero[0] / 2000000) + " sine 18000 vol 1 >> " + filename + ".raw\" \n\r";
        command += SOX_PATH + " -c 1 -r 48000 -n -t raw - synth " + (params.zero[1] / 2000000) + " sine 18000 vol 0 >> " + filename + ".raw\" \n\r";
        totalImpulseLen += parseInt(params.zero[0]);
        totalImpulseLen += parseInt(params.zero[1]);
    }
    scriptFileStream.writeMultiByte(command, OS_SHELL_ENCODING);
}

function writePreferences(){
    var s = new air.ByteArray(), o = new air.ByteArray();
    s.writeUTFBytes($("#text-sox").val());
    air.EncryptedLocalStore.setItem("sox", s);
    o.writeUTFBytes($("#text-output").val());
    air.EncryptedLocalStore.setItem("output", o);
}

function readPreferences(){
    var s, o;
    s = air.EncryptedLocalStore.getItem("sox");
    $("#text-sox").val(s);
    o = air.EncryptedLocalStore.getItem("output");
    $("#text-output").val(o);
}

$(document).ready(function(){
    readPreferences();
    if ((air.Capabilities.os.indexOf("Windows") >= 0)) {
        OS_WIN = true;
    }
    if (OS_WIN) {
        OS_SHELL_SCRIPT = "cmd";
        OS_SHELL_ENCODING = "ibm866";
    }
    else {
        OS_SHELL_SCRIPT = "sh";
        OS_SHELL_ENCODING = "utf8";
    }
    function clearListeners(){
        file.removeEventListener(air.Event.SELECT, file_select_sox);
        file.removeEventListener(air.Event.SELECT, file_select_lirc);
        file.removeEventListener(air.Event.SELECT, file_select_output);
    }
    $("#select-sox").click(function(){
        clearListeners();
        file.addEventListener(air.Event.SELECT, file_select_sox);
        file.browseForOpen("Выберите исполняемый файл SOX...");
    });
	$("#text-sox").blur(function(){
		writePreferences();
    });
    $("#select-lirc").click(function(){
        clearListeners();
        file.addEventListener(air.Event.SELECT, file_select_lirc);
        file.browseForOpen("Выберите файл конфигурации LIRC...");
    });
    $("#select-output").click(function(){
        clearListeners();
        file.addEventListener(air.Event.SELECT, file_select_output);
        file.browseForDirectory("Выберите папку...");
    });
    $("#alert-dismiss").click(function(){
        $("#alert").fadeOut("fast");
    });
    $("#process").click(function(){
        processCommands();
    });
    $("#about").click(function(){
        _alert($("#about-box").html());
    });
    $(".donate").live("click", function(){
        openExternalURL('https://money.yandex.ru/donate.xml?to=41001965189709&s5=5rub');
    });
});

function processCommands(){
    try {
        if (($("#text-sox").val() == "") ||
        ($("#text-lirc").val() == "") ||
        ($("#text-output").val() == "")) {
            throw "e";
        }
    } 
    catch (e) {
        _alert("Ошибка: не указаны необходимые параметры");
        return;
    }
    try {
        SOX_PATH = '"' + $("#text-sox").val() + '"';
        var filename = "lirc2wav_temp." + OS_SHELL_SCRIPT;
        scriptFile = new air.File();
        scriptFile = air.File.documentsDirectory.resolvePath(filename);
        if (scriptFile.exists) {
            scriptFile.deleteFile()
        }
        scriptFileStream = new air.FileStream();
        scriptFileStream.open(scriptFile, air.FileMode.WRITE);
        if (OS_WIN) {
            scriptFileStream.writeMultiByte("@echo off \n\r", OS_SHELL_ENCODING);
        }
        var commandsCount = commands.length - 1;
        for (var iter = 1; iter < commandsCount; iter++) {
            if (!$("#" + commands[iter][1]).is(':checked')) {
                continue;
            }
            for (var a = 0; a <= params.min_repeat; a++) {
                totalImpulseLen = 0;
                var filename = '"' + $("#text-output").val() + air.File.separator + commands[iter][0];
                // Write header, plead, pre_data, pre
                if (params.header) {
                    writeImpulsePause(filename, params.header[0], params.header[1]);
                }
                if (params.plead) {
                    writeSingleImpulse(filename, params.plead);
                }
                if (params.pre_data) {
                    var bits = convertToBinary(parseInt(params.pre_data, 16), params.pre_data_bits);
                    for (i = 0; i < params.pre_data_bits; i++) {
                        writeBit(filename, bits[i]);
                    }
                }
                if (params.pre) {
                    writeImpulsePause(filename, params.pre[0], params.pre[1]);
                }
                // Write main code
                var bits = convertToBinary(parseInt(commands[iter][1], 16), params.bits);
                for (i = 0; i < params.bits; i++) {
                    writeBit(filename, bits[i]);
                }
                // Write post, post data, ptrail, foot & gap
                if (params.post) {
                    writeImpulsePause(filename, params.post[0], params.post[1]);
                }
                if (params.post_data) {
                    var bits = convertToBinary(parseInt(params.post_data, 16), params.post_data_bits);
                    for (i = 0; i < params.post_data_bits; i++) {
                        writeBit(filename, bits[i]);
                    }
                }
                if (params.ptrail) {
                    writeSingleImpulse(filename, params.ptrail);
                }
                if (params.foot) {
                    writeImpulsePause(filename, params.foot[0], params.foot[1]);
                }
                if (params.gap) {
                    writeGap(filename);
                }
            };
            writeWAVConversion(filename, commands[iter][0]);
        }
        scriptFileStream.close();
        _alert("Успешно завершена запись в " + OS_SHELL_SCRIPT.toUpperCase() + "-файл. Запустите файл " + scriptFile.nativePath);
        
    } 
    catch (e) {
        _alert("Ошибка: " + e.message);
        return;
    }
}

function file_select_sox(event){
    $("#text-sox").val(file.nativePath);
    writePreferences();
}

function file_select_lirc(event){
    var fileStr = new air.FileStream();
    fileStr.open(file, air.FileMode.READ);
    var str = fileStr.readUTFBytes(file.size);
    try {
        var cmd_start = str.indexOf("begin remote");
        var cmd_end = str.indexOf("begin codes");
        if ((cmd_start == -1) || (cmd_end == -1)) {
            throw "e";
        };
            } 
    catch (e) {
        _alert("Обнаружена ошибка в файле конфигурации LIRC");
        return;
    }
    $("#text-lirc").val(file.nativePath);
    $("p#list-placeholder").hide();
    $("p#list").show();
    var cmd_str = str.substring(cmd_start + 12, cmd_end);
    commands = cmd_str.split(/\r?\n+/);
    var i = 0;
    var c = commands.length - 1;
    $("p#list").html("");
    for (i = 1; i < c; i++) {
        commands[i] = commands[i].replace(/[ ]+/g, " ");
        commands[i] = $.trim(commands[i]);
        commands[i] = commands[i].replace(/[ ]+/, "#");
        commands[i] = commands[i].split("#");
        params[commands[i][0]] = commands[i][1];
    }
    
    $.each(['one', 'zero', 'header', 'foot', 'pre', 'post'], function(index, value){
        if (params[value]) {
            params[value] = params[value].split(' ');
        };
            });
    
    params.min_repeat = params.min_repeat || 0;
    
    cmd_start = str.indexOf("begin codes");
    cmd_end = str.indexOf("end codes");
    cmd_str = str.substring(cmd_start + 11, cmd_end);
    commands = cmd_str.split(/\r?\n+/);
    i = 0;
    c = commands.length - 1;
    for (i = 1; i < c; i++) {
        commands[i] = commands[i].replace(/[ ]+/g, " ");
        commands[i] = $.trim(commands[i]);
        commands[i] = commands[i].split(" ");
        var input = $(document.createElement("input"));
        var label = $(document.createElement("label"));
        $(document.createElement("p")).attr({
            'class': "list-item",
            id: commands[i][1] + 'i',
        }).appendTo("p#list");
        input.attr({
            type: "checkbox",
            id: commands[i][1],
            checked: "checked",
        });
        input.appendTo("p#" + commands[i][1] + 'i');
        label.html(commands[i][0]);
        label.attr("for", commands[i][1]);
        label.appendTo("p#" + commands[i][1] + 'i');
    }
}

function file_select_output(event){
    $("#text-output").val(file.nativePath);
    writePreferences();
}
