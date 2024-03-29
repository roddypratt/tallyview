// Modules to control application life and create native browser window
import { app, BrowserWindow, Menu, dialog } from 'electron'
import { Settings } from './settings'
import path = require('path')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

class Stats {
  v3count: number = 0;
  v4count: number = 0;
  v5count: number = 0;
  errors: number = 0;
}

let tcpStats = new Stats
let udpStats = new Stats

global.settings = new Settings;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      additionalArguments: ["--settings=" + JSON.stringify(global.settings)] // Hack to get settings to renderer
    },
    icon: "build/icon.png"
  })

  var menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit', role: "quit"
        }
      ]
    }, { label: "Edit", role: "editMenu" }, {
      label: 'Help',
      submenu: [
        {
          label: 'Developer Tools', role: "toggleDevTools"
        }, {
          label: 'About TallyView...', role: "about"
        }
      ]
    }
  ])
  Menu.setApplicationMenu(menu);

  app.setAboutPanelOptions({
    applicationName: "TallyView", applicationVersion: "V1.2", copyright: "© 2020-2024, Rascular Technology Ltd.", website: "https://rascular.com", iconPath: "build/icon.png"
  })

  const startUrl = 'file://' + path.resolve(path.join(__dirname, '../index.html'));
  mainWindow.loadURL(startUrl);

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })


  const dataPath = storage.getDataPath();
  console.log("DataPath=", dataPath);
}

function checksum(buff: Buffer): number {
  return (-buff.reduce((a, b) => a + b, 0)) & 0x7f;
}
function updateStats() {
  mainWindow.webContents.send("stats", udpStats.v3count, udpStats.v4count, udpStats.v5count, tcpStats.v3count, tcpStats.v4count, udpStats.errors, tcpStats.errors)
}

function handleV3V4Message(message: Buffer, stats: Stats) {
  let ok = false;
  if (((message.length == 18) || (message.length == 22)) && (message[0] >= 128) && ((message[1] & 0x40) == 0)) {
    let addr = message[0] & 0x7f;
    let msg = message.subarray(2, 18).toString();

    if (message.length == 18) {
      let bright = (message[1] & 0x30) >> 4;
      let tallybits = (message[1] & 0x0f);
      stats.v3count++;
      mainWindow.webContents.send("tally", addr, msg, tallybits & 1, tallybits & 2, (tallybits & 4) ? 3 : 0, (tallybits & 8) ? 3 : 0); // makes tally 1  red, tally 2 green, 3,4 amber
      ok = true
    }
    else
      if ((checksum(message.subarray(0, 18)) == message[18])
        && (message[19] == 2)) // ignore checksum fails and packets with wrong length
      {
        // TODO: Handle different text colours. 
        mainWindow.webContents.send("tally", addr, msg, message[20] & 3, (message[20] >> 4) & 3,
          message[21] & 3, (message[21] >> 4) & 3);
        stats.v4count++;
        ok = true
      }
      else console.log("Bad V4 packet: ", message[19], checksum(message.subarray(0, 18)), message[18])
  }
  if (!ok) stats.errors++;
  updateStats()

}

const DLE = 0xFE
const STX = 0x02

function handleV5Message(message: Buffer, stats: Stats) {
  let ok = false;

  if ((message.length >= 8) && (message[0] == DLE && [message[1] == STX])) {
    let pktlen = message.readUInt16LE(2);
    for (let index = 4; index < message.length; index++) {

      if ((message[index] == DLE) && (message[index + 1] == DLE)) {
        message = Buffer.concat([message.subarray(0, index), message.slice(index + 2)])
      }
    }
    if ((message.length == pktlen + 4) && ((message[5] & 2) == 0)) {
      let unicode = (message[5] & 1) == 1
      message = message.subarray(8)
      let index = message.readUInt16LE(0);
      let control = message.readUInt16LE(2);
      let length = message.readUInt16LE(4);
      let text = message.toString(unicode ? 'utf16le' : 'utf8', 6, 6 + length)

      {
        mainWindow.webContents.send("tally", index, text, control & 3, (control >> 4) & 3, (control >> 2) & 3, 0); /// TODO : Handle tallies
        stats.v5count++;
        ok = true
      }
    }
  }
  if (!ok) stats.errors++;
  updateStats()
}

import dgram = require('dgram');
import net = require('net');

function isObjectEmpty(obj) {
  return Object.keys(obj).length === 0;
}

import storage = require('electron-json-storage');


app.setName("TallyView")


let stored: Settings = storage.getSync("settings")
if (!isObjectEmpty(stored))
  global.settings = { ...global.settings, ...stored }
else
  storage.set("settings", global.settings);

if (global.settings.udp34Port > 0) {
  let v3server: dgram.Socket = dgram.createSocket('udp4');
  v3server.on('listening', () => {
    let address = v3server.address();
    if (typeof address === "object")
      console.log('V3.1 and V4.0 UDP Server listening on ' + address.address + ":" + address.port);
  });

  v3server.on('message', (message, remote) => {
    handleV3V4Message(message, udpStats)
  });
  v3server.bind(global.settings.udp34Port); // Listen on all interfaces
}

if (global.settings.udp5Port > 0) {
  let v5server: dgram.Socket = dgram.createSocket('udp4');

  v5server.on('listening', () => {
    let address = v5server.address();
    if (typeof address === "object")
      console.log('V5.0 UDP Server listening on ' + address.address + ":" + address.port);
  });

  v5server.on('message', (message, remote) => {
    handleV5Message(message, udpStats)
  });
  v5server.bind(global.settings.udp5Port); // Listen on all interfaces
}

if (global.settings.tcp3Port > 0) {
  let tcpV3Server = net.createServer();
  tcpV3Server.on('listening', () => {
    let address = tcpV3Server.address();
    if (typeof address === "object")
      console.log('TCP V3 Server listening on ' + address.address + ":" + address.port);
  });

  tcpV3Server.on('connection', (conn) => {
    console.log('new TCP V3 client connection from %s', conn.remoteAddress + ':' + conn.remotePort);

    var chunk = Buffer.alloc(0)
    conn.on('data', (message) => {
      message = Buffer.concat([chunk, message])
      while (message.length >= 18) {
        handleV3V4Message(message.subarray(0, 18), tcpStats)
        message = message.subarray(18)
      }
      chunk = message
    })
  });

  tcpV3Server.listen(global.settings.tcp3Port
  );
}

if (global.settings.tcp3Port > 0) {
  let tcpV4Server = net.createServer();
  tcpV4Server.on('listening', () => {
    let address = tcpV4Server.address();
    if (typeof address === "object")
      console.log('TCP V4 Server listening on ' + address.address + ":" + address.port);
  });

  tcpV4Server.on('connection', (conn) => {
    console.log('new TCP V4 client connection from %s', conn.remoteAddress + ':' + conn.remotePort);

    var chunk = Buffer.alloc(0)
    conn.on('data', (message) => {
      message = Buffer.concat([chunk, message])
      while (message.length >= 22) {
        handleV3V4Message(message.subarray(0, 22), tcpStats)
        message = message.subarray(22)
      }
      chunk = message
    })
  });

  tcpV4Server.listen(global.settings.tcp4Port);
}

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


