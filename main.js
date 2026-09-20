const electron = require("electron");
const { app, BrowserWindow, ipcMain } = electron;

// Enable Web Bluetooth API in Chromium
app.commandLine.appendSwitch("enable-web-bluetooth");

const path = require("path");
const { exec } = require("child_process");
const https = require("https");
const http = require("http");

let db, bcrypt;

// Load optional dependencies that may have native bindings
try {
  db = require("./db");
  console.log("[MODULE] db loaded successfully:", typeof db);
} catch (e) {
  console.warn("Warning: db module failed to load:", e.message);
  db = null;
}

try {
  bcrypt = require("bcrypt");
  console.log("[MODULE] bcrypt loaded successfully:", typeof bcrypt);
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
    // First, try blueutil for real-time device discovery
    exec("blueutil --inquiry 10", { timeout: 20000 }, (scanError, scanStdout) => {
      console.log("blueutil scan output:", scanStdout);
      
      if (!scanError && scanStdout && scanStdout.trim()) {
        try {
          // Parse blueutil output - format is: address: xx-xx-xx-xx-xx-xx, ... name: "Device Name"
          const lines = scanStdout.trim().split('\n');
          const devices = [];
          
          lines.forEach((line) => {
            const addressMatch = line.match(/address:\s*([0-9a-fA-F-]+)/);
            const nameMatch = line.match(/name:\s*"([^"]+)"/);
            
            if (addressMatch) {
              devices.push({
                name: nameMatch ? nameMatch[1] : "Unknown Device",
                address: addressMatch[1],
                deviceClass: "Nearby Device",
              });
            }
          });
          
          if (devices.length > 0) {
            console.log("Found nearby devices:", devices);
            resolve({ success: true, devices: devices, message: "Found nearby devices!" });
            return;
          }
        } catch (parseError) {
          console.log("blueutil parse error, trying paired devices...", parseError);
        }
      }
      
      // Fallback: Use system_profiler for paired devices
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
            const devicesArray = bluetoothDevices[0].device_not_connected;
            
            if (devicesArray && devicesArray.length > 0) {
              devicesArray.forEach((deviceObj) => {
                // device_not_connected contains objects with device name as key
                const deviceName = Object.keys(deviceObj)[0];
                const deviceProps = deviceObj[deviceName];
                
                if (deviceName && deviceProps && deviceProps.device_address) {
                  devices.push({
                    name: deviceName || "Unknown Device",
                    address: deviceProps.device_address || "Unknown Address",
                    deviceClass: deviceProps.device_minorType || "Unknown",
                  });
                }
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
    });
  });
});

// Bluetooth connect/pair handler - Step 1: Initiate pairing and get code
ipcMain.handle("initiate-bluetooth-pairing", async (_, { address, deviceName }) => {
  return new Promise((resolve) => {
    if (!address) {
      resolve({ success: false, message: "No device address provided" });
      return;
    }

    console.log("Initiating Bluetooth pairing for device:", address);

    // First, check if already paired and connected
    exec(`blueutil --info "${address}"`, { timeout: 10000 }, (infoError, infoStdout) => {
      if (!infoError && infoStdout) {
        try {
          const info = JSON.parse(infoStdout);
          if (info.connected === true || info.connected === 1) {
            resolve({ success: true, alreadyConnected: true, message: "Device already connected!" });
            return;
          }
          if (info.paired === true || info.paired === 1) {
            // Already paired, just connect
            resolve({ success: true, alreadyPaired: true, message: "Device already paired. Ready to connect." });
            return;
          }
        } catch (e) {
          // Continue with pairing attempt
        }
      }

      // Since blueutil --pair requires interactive input which doesn't work in exec(),
      // we need to guide the user through manual pairing
      resolve({ 
        success: true, 
        needsManualPairing: true,
        pairingInstructions: true,
        deviceName: deviceName || "Unknown Device",
        address: address,
        message: "Manual pairing required. Please go to System Settings → Bluetooth, find your device, and click Connect to pair."
      });
    });
  });
});

// Bluetooth connect handler - Step 2: Confirm after user accepts on phone
ipcMain.handle("confirm-bluetooth-pairing", async (_, { address }) => {
  return new Promise((resolve) => {
    if (!address) {
      resolve({ success: false, message: "No device address provided" });
      return;
    }

    console.log("Confirming Bluetooth pairing for device:", address);

    // Wait a moment for the pairing to complete on the device
    setTimeout(() => {
      // Try to connect to the device
      exec(`blueutil --connect "${address}"`, { timeout: 30000 }, (connectError, connectStdout, connectStderr) => {
        const fullOutput = (connectStdout || "") + " " + (connectStderr || "");
        console.log("blueutil connect output:", fullOutput);

        if (connectError) {
          // Check if already connected after connection attempt
          exec(`blueutil --info "${address}"`, { timeout: 10000 }, (infoError2, infoStdout2) => {
            if (!infoError2 && infoStdout2) {
              try {
                const info = JSON.parse(infoStdout2);
                if (info.connected === true || info.connected === 1) {
                  resolve({ success: true, message: "Device connected successfully!" });
                  return;
                }
              } catch (e) {
                // Check string indicators
              }
              if (infoStdout2.includes('"connected": 1')) {
                resolve({ success: true, message: "Device connected successfully!" });
                return;
              }
            }

            resolve({ 
              success: false, 
              message: "Could not connect to device. Please try manually: Open System Settings → Bluetooth, find the device, and click Connect."
            });
          });
        } else {
          // Verify connection
          exec(`blueutil --info "${address}"`, { timeout: 10000 }, (infoError3, infoStdout3) => {
            if (!infoError3 && infoStdout3 && (infoStdout3.includes('"connected": 1') || infoStdout3.includes('connected: 1'))) {
              resolve({ success: true, message: "Successfully connected to device!" });
            } else {
              resolve({ success: true, message: "Pairing completed! Connection status may vary." });
            }
          });
        }
      });
    }, 2000); // Wait 2 seconds for pairing to complete
  });
});

// Legacy connect-bluetooth handler for backward compatibility
ipcMain.handle("connect-bluetooth", async (_, { address }) => {
  return new Promise((resolve) => {
    if (!address) {
      resolve({ success: false, message: "No device address provided" });
      return;
    }

    console.log("Attempting to connect to Bluetooth device:", address);

    // First, check if already connected
    exec(`blueutil --info "${address}"`, { timeout: 10000 }, (infoError, infoStdout) => {
      if (!infoError && infoStdout && infoStdout.includes('"connected": 1')) {
        resolve({ success: true, message: "Device already connected!" });
        return;
      }

      // Try to pair the device using blueutil
      exec(`blueutil --pair "${address}"`, { timeout: 30000 }, (pairError, pairStdout, pairStderr) => {
        try {
          console.log("blueutil pair output:", pairStdout || "", "stderr:", pairStderr || "");
        } catch (e) {
          console.log("blueutil pair output unavailable");
        }

        // Now try to connect to the device
        exec(`blueutil --connect "${address}"`, { timeout: 30000 }, (connectError, connectStdout, connectStderr) => {
          try {
            console.log("blueutil connect output:", connectStdout || "", "stderr:", connectStderr || "");
          } catch (e) {
            console.log("blueutil connect output unavailable");
          }

          if (connectError) {
            // Check if already connected after connection attempt
            exec(`blueutil --info "${address}"`, { timeout: 10000 }, (infoError2, infoStdout2) => {
              if (!infoError2 && infoStdout2 && infoStdout2.includes('"connected": 1')) {
                resolve({ success: true, message: "Device connected successfully!" });
                return;
              }

              resolve({ 
                success: false, 
                message: "Could not connect. Please pair manually: Open System Settings → Bluetooth, find the device, and click Connect."
              });
            });
          } else {
            resolve({ success: true, message: "Successfully connected to device!" });
          }
        });
      });
    });
  });
});

// Get connection status of a device
ipcMain.handle("bluetooth-status", async (_, { address }) => {
  return new Promise((resolve) => {
    if (!address) {
      resolve({ success: false, message: "No device address provided" });
      return;
    }

    exec(`blueutil --info "${address}"`, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ connected: false, paired: false });
        return;
      }

      try {
        // Parse the JSON output from blueutil
        const info = JSON.parse(stdout);
        resolve({
          connected: info.connected === true || info.connected === 1,
          paired: info.paired === true || info.paired === 1,
          name: info.name || "Unknown",
          address: info.address || address
        });
      } catch (parseError) {
        // If JSON parsing fails, check for string indicators
        const connected = stdout.includes('"connected": 1') || stdout.includes('connected: 1');
        const paired = stdout.includes('"paired": 1') || stdout.includes('paired: 1');
        resolve({ connected, paired });
      }
    });
  });
});

// ===== QR Code / Hospital Data Transfer IPC Handlers =====

// Helper function to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const serverUrl = "http://localhost:3000";
    const url = new URL(path, serverUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on("error", (error) => {
      console.error("HTTP request error:", error);
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Generate QR code for patient scanning
ipcMain.handle("generate-qr-code", async (_, { doctorId, doctorName, patientName }) => {
  try {
    console.log("[MAIN] Generating QR code for doctor:", doctorName);
    const result = await makeRequest("POST", "/api/session/generate", {
      doctorId,
      doctorName,
      patientName: patientName || null,
    });
    
    console.log("[MAIN] Server response:", result);
    
    if (result.success) {
      return {
        success: true,
        qrCode: result.qrCode,
        sessionToken: result.sessionToken,
        message: result.message,
      };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error) {
    console.error("[MAIN] Error generating QR code:", error);
    return { success: false, message: "Failed to connect to server. Make sure mock server is running." };
  }
});

// Get session info and patient data
ipcMain.handle("get-session-info", async (_, { sessionToken }) => {
  try {
    const result = await makeRequest("GET", `/api/session/${sessionToken}`);
    return result;
  } catch (error) {
    console.error("Error getting session info:", error);
    return { success: false, message: "Failed to get session info" };
  }
});

// Add consultation notes
ipcMain.handle("add-consultation", async (_, { sessionToken, diagnosis, treatment, notes, prescriptions, doctorId, doctorName }) => {
  try {
    const result = await makeRequest("POST", `/api/session/${sessionToken}/consultation`, {
      diagnosis,
      treatment,
      notes,
      prescriptions,
      doctorId,
      doctorName,
    });
    return result;
  } catch (error) {
    console.error("Error adding consultation:", error);
    return { success: false, message: "Failed to add consultation" };
  }
});

// Complete session and wipe patient data
ipcMain.handle("complete-session", async (_, { sessionToken }) => {
  try {
    const result = await makeRequest("POST", `/api/session/${sessionToken}/complete`);
    return result;
  } catch (error) {
    console.error("Error completing session:", error);
    return { success: false, message: "Failed to complete session" };
  }
});

// Get doctor's consultation history
ipcMain.handle("get-consultation-history", async (_, { doctorId }) => {
  try {
    const result = await makeRequest("GET", `/api/consultations/${doctorId}`);
    return result;
  } catch (error) {
    console.error("Error getting consultation history:", error);
    return { success: false, message: "Failed to get consultation history" };
  }
});

// Patient sends medical data (simulated)
ipcMain.handle("patient-send-data", async (_, { sessionToken, patientId, patientName, medicalRecords }) => {
  try {
    const result = await makeRequest("POST", `/api/session/${sessionToken}/patient-data`, {
      patientId,
      patientName,
      medicalRecords,
    });
    return result;
  } catch (error) {
    console.error("Error sending patient data:", error);
    return { success: false, message: "Failed to send patient data" };
  }
});

// Patient gets updated data after consultation
ipcMain.handle("patient-get-data", async (_, { sessionToken }) => {
  try {
    const result = await makeRequest("GET", `/api/session/${sessionToken}/patient-data`);
    return result;
  } catch (error) {
    console.error("Error getting patient data:", error);
    return { success: false, message: "Failed to get patient data" };
  }
});

ipcMain.handle("login", async (_, { id_card, password }) => {
  // DIAGNOSTIC: Log module states
  console.log("[LOGIN] db =", db, "bcrypt =", bcrypt);
  console.log("[LOGIN] !db =", !db, "!bcrypt =", !bcrypt);
  console.log("[LOGIN] Entering test mode:", !db || !bcrypt);
  
  // For testing without database, allow these test credentials
  const testUsers = {
    "D21035633": { name: "Dr. Nana Kweku", role: "doctor", password: "doctor123" },
    "N5678": { name: "Nurse Kofi Owusu", role: "nurse", password: "nurse123" }
  };
  
  console.log("[LOGIN] Looking up id_card:", id_card);
  console.log("[LOGIN] testUsers[id_card]:", testUsers[id_card]);
  console.log("[LOGIN] password match:", testUsers[id_card] ? testUsers[id_card].password === password : 'N/A');
  
  // Check if we have database available
  if (!db || !bcrypt) {
    // Use test mode without database
    if (testUsers[id_card] && testUsers[id_card].password === password) {
      return {
        success: true,
        user: {
          id: 1,
          name: testUsers[id_card].name,
          role: testUsers[id_card].role
        }
      };
    }
    return { success: false, message: "Invalid credentials" };
  }
  
  // Original database login
  return new Promise((resolve) => {
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
