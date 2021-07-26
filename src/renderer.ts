// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

import * as $ from 'jquery';
import * as bootstrap from "bootstrap"

let render = require('electron').ipcRenderer

let settings: any = {}
window.process.argv.some((val) => {
    if (val.startsWith("--settings=")) {
        settings = JSON.parse(val.substr(11))
        return true
    }
});

$("#settingsjson").text(JSON.stringify(settings, null, 2));
console.log(settings)
let numDisplays = settings.displays

$(() => {
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl)
    })


    let table = $("#tallytab");
    for (var j = 0; j < numDisplays; j++) {
        let row = $('<tr id="tally' + j + '"></tr>');
        var rowData = $('<td>' + j + '</td><td></td><td>...</td><td></td><td></td><td></td>');
        row.append(rowData);
        table.append(row);
    }

});


function tallyToCol(t: number): string {
    switch (t) {
        case 1:
            return "red";
        case 2:
            return "green";
        case 3:
            return "orange";
        default:
            return "";
    }
}


render.on('tally', (event, addr: number, msg: string, tally1: number, tally2: number, tally3: number, tally4: number) => {

    $("#tally" + addr + " td:nth-child(3)").html(msg);
    $("#tally" + addr + " td:nth-child(2)").css("background-color", tallyToCol(tally1));
    $("#tally" + addr + " td:nth-child(4)").css("background-color", tallyToCol(tally2));
    $("#tally" + addr + " td:nth-child(5)").css("background-color", tallyToCol(tally3));
    $("#tally" + addr + " td:nth-child(6)").css("background-color", tallyToCol(tally4));

});


render.on('stats', (event, udp3: number, udp4: number, udp5: number, tcp3: number, tcp4: number, udpErrors: number, tcpErrors: number) => {

    $("#udp3count").text(udp3);
    $("#udp4count").text(udp4);
    $("#udp5count").text(udp5);
    $("#tcp3count").text(tcp3);
    $("#tcp4count").text(tcp4);
    $("#udpErrors").text(udpErrors);
    $("#tcpErrors").text(tcpErrors);

});

