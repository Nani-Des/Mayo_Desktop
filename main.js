const electron = require("electron");
const { app, BrowserWindow, ipcMain } = electron;
console.log("electron loaded, app:", typeof app, "BrowserWindow:", typeof BrowserWindow, "ipcMain:", typeof ipcMain);
const path = require("path");
const { exec } = require("child_process");

let db, bcrypt;

// Load optional dependencies that may have native bindings
try {
  db = require("./db");
} catch (e) {
  console.warn("Warning: db module failed to load:", e.message);
  db = null;
}

try {
  bcrypt = require("bcrypt");
} catch (e) {
  console.warn("Warning: bcrypt module failed to load:", e.message);
  bcrypt = null;
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.maximize();
  win.loadFile("renderer/index.html");

  // Open DevTools so you can see console logs from renderer
  win.webContents.openDevTools();
}

ipcMain.handle("scan-bluetooth", async () => {
  return new Promise((resolve) => {
    try {
      // Use macOS system_profiler to get Bluetooth devices
      exec("system_profiler SPBluetoothDataType -json", { timeout: 15000 }, (error, stdout) => {
        if (error) {
          console.error("Bluetooth scan error:", error);
          resolve({ success: false, message: "Failed to scan for Bluetooth devices" });
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const bluetoothDevices = data.SPBluetoothDataType || [];
          
          const devices = [];
          
          // Parse the Bluetooth devices from system_profiler output
          if (bluetoothDevices.length > 0) {
            const devicesArray = bluetoothDevices[0].device_ULM;
            
            if (devicesArray && devicesArray.length > 0) {
              devicesArray.forEach((device) => {
                devices.push({
                  name: device.name || "Unknown Device",
                  address: device.address || "Unknown Address",
                  deviceClass: device.deviceClass || "Unknown",
                });
              });
            }
          }

          if (devices.length > 0) {
            resolve({ success: true, devices: devices });
          } else {
            // If no devices found via system_profiler, try another approach
            exec("ioreg -c IOBluetoothDevice -w0 -d2 -a | grep -E '(\"Name\"|\"Address\")' | head -20", { timeout: 10000 }, (err, output) => {
              if (err || !output) {
                resolve({ success: true, devices: [], message: "No Bluetooth devices found nearby. Make sure Bluetooth is enabled and devices are discoverable." });
                return;
              }
              
              // Parse ioreg output
              const lines = output.split('\n');
              const parsedDevices = [];
              let currentDevice = {};
              
              lines.forEach((line) => {
                if (line.includes('"Name"')) {
                  const match = line.match(/"Name" = \"([^\"]+)\"/);
                  if (match) currentDevice.name = match[1];
                } else if (line.includes('"Address"')) {
                  const match = line.match(/"Address" = \"([^\"]+)\"/);
                  if (match) currentDevice.address = match[1];
                  if (currentDevice.name && currentDevice.address) {
                    parsedDevices.push({ ...currentDevice, deviceClass: "Unknown" });
                    currentDevice = {};
                  }
                }
              });

              if (parsedDevices.length > 0) {
                resolve({ success: true, devices: parsedDevices });
              } else {
                resolve({ success: true, devices: [], message: "No Bluetooth devices found. Make sure Bluetooth is enabled and devices are in pairing mode." });
              }
            });
          }
        } catch (parseError) {
          console.error("Parse error:", parseError);
          resolve({ success: false, message: "Error parsing Bluetooth data" });
        }
      });
    } catch (error) {
      console.error("Bluetooth scan error:", error);
      resolve({ success: false, message: error.message });
    }
  });
});

ipcMain.handle("login", async (_, { id_card, password }) => {
  return new Promise((resolve) => {
    if (!db || !bcrypt) {
      resolve({ success: false, message: "Server modules not loaded" });
      return;
    }
    
    db.get(
      "SELECT * FROM users WHERE id_card = ?",
      [id_card],
      async (err, user) => {
        if (err) {
          console.error("SQLite error:", err);
          resolve({ success: false, message: err.message });
          return;
        }

        if (!user) {
          resolve({ success: false, message: "User not found" });
          return;
        }

        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
          resolve({ success: false, message: "Invalid password" });
          return;
        }

        resolve({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
          },
        });
      }
    );
  });
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
