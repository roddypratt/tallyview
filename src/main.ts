// Modules to control application life and create native browser window
import { app, BrowserWindow, ipcMain } from 'electron'
import path = require('path')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('../index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

import dgram = require('dgram');

let server: dgram.Socket = dgram.createSocket('udp4');

server.on('listening', () => {
  let address = server.address();
  if (typeof address === "object")
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

server.on('message', (message, remote) => {
  if ((message.length >= 18) && (message[0] >= 128)  && ((message[1] & 0x40) == 0))
  {
      let addr = message[0] & 0x7f;
 
      let msg = message.subarray(2, 18).toString();
      let sum = (- message.subarray(0, 18).reduce((a, b) => a + b, 0)) & 0x7f;
      if (message.length == 18)
      {
        let bright = (message[1] & 0x30) >> 4;
        let tallybits = (message[1] & 0x0f);
        mainWindow.webContents.send("tally", addr, msg, tallybits & 1, tallybits & 2, (tallybits & 4) ? 3:0, (tallybits & 8) ? 3:0); // makes tally 1  red, tally 2 green, 3,4 amber
      }
      else if ((message.length == 22) && (sum == message[18]) && (message[19] == 2)) // ignore checksum fails and packets with wrong length
      {
        // TODO: Handle different text colours. 
        mainWindow.webContents.send("tally", addr, msg, message[20] &3, (message[20] >> 4) & 3, 
        message[21] & 3, (message[21] >> 4) & 3);
      }
    }
  });

server.bind(40001, '127.0.0.1');

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

