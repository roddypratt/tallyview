// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

import * as $ from 'jquery';
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from 'constants';

$(() =>{
    let table = $("#tallytab");
                for (var j = 0; j < 128; j++) {
                    let row = $('<tr id="tally' + j + '"></tr>');
                    var rowData = $('<td>' + j + '</td><td></td><td>...</td><td></td><td></td><td></td>');
                    row.append(rowData);
                table.append(row);
                }
            
});


function tallyToCol(t:number) : string
{
    switch (t)
    { 
        case 1 : 
        return "red";
        case 2 : 
        return "green";
        case 3 :
        return "orange";
        default:
        return "";            
    }
}

require('electron').ipcRenderer.on('tally', (event, addr: number, msg:string, tally1 : number, tally2 : number,tally3 : number,tally4 : number) => {

    $("#tally" + addr + " td:nth-child(3)" ).html(msg);
    $("#tally" + addr + " td:nth-child(2)" ).css("background-color", tallyToCol(tally1));
    $("#tally" + addr + " td:nth-child(4)" ).css("background-color", tallyToCol(tally2));
    $("#tally" + addr + " td:nth-child(5)" ).css("background-color", tallyToCol(tally3));
    $("#tally" + addr + " td:nth-child(6)" ).css("background-color", tallyToCol(tally4));  

});

