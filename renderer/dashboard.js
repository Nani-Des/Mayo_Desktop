document.addEventListener("DOMContentLoaded", () => {
  const dataSharingBtn = document.getElementById("dataSharingBtn");
  const dataSharingSection = document.getElementById("dataSharingSection");
  const userNameSpan = document.getElementById("userName");
  const bluetoothBtn = document.getElementById("bluetoothBtn");
  const deviceListContainer = document.getElementById("bluetoothDeviceList");

  // Pairing modal elements
  const pairingModal = document.getElementById("pairingModal");
  const pairingDeviceName = document.getElementById("pairingDeviceName");
  const pairingCodeDisplay = document.getElementById("pairingCodeDisplay");
  const pairingInstructions = document.getElementById("pairingInstructions");
  const confirmPairingBtn = document.getElementById("confirmPairingBtn");
  const cancelPairingBtn = document.getElementById("cancelPairingBtn");
  const pairingError = document.getElementById("pairingError");

  // Current pairing state
  let currentPairingAddress = null;
  let currentPairingDeviceName = null;
  let pairingTimeout = null;

  // TODO: get logged-in user from login page
  // For now, placeholder name
  const loggedInUser = localStorage.getItem("loggedInUserName") || "Dr. User";
  userNameSpan.textContent = loggedInUser;

  // Toggle data sharing section
  dataSharingBtn.addEventListener("click", () => {
    if (dataSharingSection.style.display === "none") {
      dataSharingSection.style.display = "block";
    } else {
      dataSharingSection.style.display = "none";
    }
  });

  // Bluetooth scanning functionality
  let isScanning = false;
  
  bluetoothBtn.addEventListener("click", async () => {
    // Toggle device list visibility if already scanned
    if (!isScanning && deviceListContainer.style.display === "block") {
      deviceListContainer.style.display = "none";
      return;
    }
    
    // Start scanning using paired Bluetooth devices
    isScanning = true;
    bluetoothBtn.textContent = "Scanning...";
    bluetoothBtn.disabled = true;
    deviceListContainer.style.display = "block";
    deviceListContainer.innerHTML = '<div class="loading">Scanning for Bluetooth devices...</div>';

    try {
      const result = await window.api.scanBluetooth();
      console.log("Bluetooth scan result:", result);
      
      if (result.success) {
        if (result.devices && result.devices.length > 0) {
          // Display discovered devices
          deviceListContainer.innerHTML = result.devices
            .map(
              (device) => `
              <div class="device-item">
                <div>
                  <div class="device-name">${escapeHtml(device.name)}</div>
                  <div class="device-address">${escapeHtml(device.address)}</div>
                  <div class="device-class">${escapeHtml(device.deviceClass || 'Bluetooth Device')}</div>
                </div>
                <button class="device-connect-btn" data-address="${escapeHtml(device.address)}">Connect</button>
              </div>
            `
            )
            .join("");

          // Add click handlers for connect buttons
          document.querySelectorAll(".device-connect-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
              const address = e.target.getAttribute("data-address");
              const deviceName = e.target.closest(".device-item").querySelector(".device-name").textContent;
              
              // Show connecting state
              const originalText = e.target.textContent;
              e.target.textContent = "Connecting...";
              e.target.disabled = true;

              // Use two-step pairing process
              await initiatePairing(e.target, address, deviceName, originalText);
            });
          });
        } else {
          deviceListContainer.innerHTML = '<div class="no-devices">No paired Bluetooth devices found.<br><br>To pair a new device:<br>1. Open System Settings → Bluetooth<br>2. Put your device in pairing mode<br>3. Select the device to pair</div>';
        }
      } else {
        deviceListContainer.innerHTML = `<div class="no-devices">Error: ${escapeHtml(result.message)}</div>`;
      }
    } catch (error) {
      console.error("Bluetooth scan error:", error);
      deviceListContainer.innerHTML = `<div class="no-devices">Error: ${escapeHtml(error.message)}</div>`;
    } finally {
      isScanning = false;
      bluetoothBtn.textContent = "Start Bluetooth";
      bluetoothBtn.disabled = false;
    }
  });

  // Placeholder buttons for QR code
  document.getElementById("qrCodeBtn").addEventListener("click", () => {
    alert("QR code sharing clicked! (placeholder)");
  });

  // ===== Bluetooth Pairing Modal Functions =====
  
  // Show the pairing confirmation modal
  function showPairingModal(address, deviceName, pairingCode) {
    currentPairingAddress = address;
    currentPairingDeviceName = deviceName;
    pairingError.textContent = "";
    
    // Update modal content
    pairingDeviceName.textContent = `Connecting to ${escapeHtml(deviceName)}`;
    
    if (pairingCode) {
      pairingCodeDisplay.textContent = pairingCode;
      pairingCodeDisplay.style.display = "block";
      pairingInstructions.textContent = "Please check your iPhone and confirm the pairing code matches, then tap \"Pair\" on your device.";
    } else {
      pairingCodeDisplay.style.display = "none";
      pairingInstructions.textContent = "Please check your iPhone and accept the pairing request, then tap \"Yes, I've Confirmed\" below.";
    }
    
    // Show modal
    pairingModal.classList.add("active");
    
    // Set timeout for pairing (60 seconds)
    pairingTimeout = setTimeout(() => {
      showPairingError("Pairing timed out. Please try again.");
    }, 60000);
  }

  // Hide the pairing modal
  function hidePairingModal() {
    pairingModal.classList.remove("active");
    currentPairingAddress = null;
    currentPairingDeviceName = null;
    
    if (pairingTimeout) {
      clearTimeout(pairingTimeout);
      pairingTimeout = null;
    }
  }

  // Show error in pairing modal
  function showPairingError(message) {
    pairingError.textContent = message;
    confirmPairingBtn.disabled = false;
    confirmPairingBtn.textContent = "Yes, I've Confirmed";
  }

  // Two-step pairing process
  async function initiatePairing(connectButton, address, deviceName, originalText) {
    try {
      // Step 1: Initiate pairing and get code
      const result = await window.api.initiateBluetoothPairing(address, deviceName);
      console.log("Initiate pairing result:", result);
      
      if (result.success) {
        if (result.alreadyConnected) {
          // Already connected
          connectButton.textContent = "Connected";
          connectButton.style.backgroundColor = "#4CAF50";
          alert(`Successfully connected to ${deviceName}!`);
          return;
        }
        
        if (result.alreadyPaired) {
          // Already paired, just connect
          const connectResult = await window.api.connectBluetooth(address);
          if (connectResult.success) {
            connectButton.textContent = "Connected";
            connectButton.style.backgroundColor = "#4CAF50";
            alert(`Successfully connected to ${deviceName}!`);
          } else {
            connectButton.textContent = "Failed";
            connectButton.style.backgroundColor = "#f44336";
            alert(`Failed to connect: ${connectResult.message}`);
            setTimeout(() => {
              connectButton.textContent = originalText;
              connectButton.style.backgroundColor = "";
              connectButton.disabled = false;
            }, 3000);
          }
          return;
        }
        
        // NEW: Handle manual pairing required
        if (result.needsManualPairing) {
          // Show manual pairing instructions
          const instructions = `Manual pairing required for ${deviceName}.\n\nPlease follow these steps:\n1. Open System Settings → Bluetooth\n2. Find "${deviceName}" in the list\n3. Click the "i" icon next to the device\n4. Tap "Connect" to pair\n5. Accept the pairing request on your ${deviceName}\n\nOnce paired, click OK and try connecting again.`;
          
          alert(instructions);
          
          // Show "Trying to connect..." state
          connectButton.textContent = "Connecting...";
          connectButton.disabled = true;
          
          // Try to connect after user acknowledges
          try {
            const connectResult = await window.api.connectBluetooth(address);
            console.log("Connect result:", connectResult);
            
            if (connectResult && connectResult.success) {
              connectButton.textContent = "Connected";
              connectButton.style.backgroundColor = "#4CAF50";
              alert(`Successfully connected to ${deviceName}!`);
            } else {
              connectButton.textContent = "Retry";
              connectButton.style.backgroundColor = "";
              connectButton.disabled = false;
              const errorMsg = connectResult?.message || "Unknown error";
              alert(`Connection failed: ${errorMsg}`);
            }
          } catch (err) {
            console.error("Connect error:", err);
            connectButton.textContent = "Retry";
            connectButton.style.backgroundColor = "";
            connectButton.disabled = false;
            alert(`Connection error: ${err.message}`);
          }
          return;
        }
        
        if (result.needsConfirmation) {
          // Show pairing modal
          showPairingModal(address, deviceName, result.pairingCode);
          
          // Setup confirm button handler
          const confirmHandler = async () => {
            confirmPairingBtn.disabled = true;
            confirmPairingBtn.textContent = "Connecting...";
            
            try {
              // Step 2: Confirm pairing after user accepts on phone
              const confirmResult = await window.api.confirmBluetoothPairing(address);
              console.log("Confirm pairing result:", confirmResult);
              
              hidePairingModal();
              
              if (confirmResult.success) {
                connectButton.textContent = "Connected";
                connectButton.style.backgroundColor = "#4CAF50";
                alert(`Successfully connected to ${deviceName}!`);
              } else {
                connectButton.textContent = "Failed";
                connectButton.style.backgroundColor = "#f44336";
                alert(`Failed to connect: ${confirmResult.message}`);
                setTimeout(() => {
                  connectButton.textContent = originalText;
                  connectButton.style.backgroundColor = "";
                  connectButton.disabled = false;
                }, 3000);
              }
            } catch (confirmError) {
              console.error("Confirm pairing error:", confirmError);
              showPairingError(`Error: ${confirmError.message}`);
            }
          };
          
          // Setup cancel button handler
          const cancelHandler = () => {
            hidePairingModal();
            connectButton.textContent = originalText;
            connectButton.disabled = false;
          };
          
          // Remove old listeners and add new ones
          confirmPairingBtn.onclick = confirmHandler;
          cancelPairingBtn.onclick = cancelHandler;
          
          // Don't proceed further, wait for user confirmation
          return;
        }
        
        // If we get here, pairing succeeded without needing confirmation
        if (result.paired) {
          // Try to connect
          const connectResult = await window.api.connectBluetooth(address);
          if (connectResult.success) {
            connectButton.textContent = "Connected";
            connectButton.style.backgroundColor = "#4CAF50";
            alert(`Successfully connected to ${deviceName}!`);
          } else {
            connectButton.textContent = "Failed";
            connectButton.style.backgroundColor = "#f44336";
            alert(`Failed to connect: ${connectResult.message}`);
            setTimeout(() => {
              connectButton.textContent = originalText;
              connectButton.style.backgroundColor = "";
              connectButton.disabled = false;
            }, 3000);
          }
        }
      } else {
        // Initiate pairing failed
        connectButton.textContent = "Failed";
        connectButton.style.backgroundColor = "#f44336";
        alert(`Failed to pair: ${result.message}`);
        setTimeout(() => {
          connectButton.textContent = originalText;
          connectButton.style.backgroundColor = "";
          connectButton.disabled = false;
        }, 3000);
      }
    } catch (error) {
      console.error("Pairing error:", error);
      connectButton.textContent = "Error";
      connectButton.style.backgroundColor = "#f44336";
      alert(`Error pairing with device: ${error.message}`);
      setTimeout(() => {
        connectButton.textContent = originalText;
        connectButton.style.backgroundColor = "";
        connectButton.disabled = false;
      }, 3000);
    }
  }

  // Helper function to escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});
