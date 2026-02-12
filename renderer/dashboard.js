document.addEventListener("DOMContentLoaded", () => {
  const dataSharingBtn = document.getElementById("dataSharingBtn");
  const dataSharingSection = document.getElementById("dataSharingSection");
  const userNameSpan = document.getElementById("userName");
  const bluetoothBtn = document.getElementById("bluetoothBtn");
  const deviceListContainer = document.getElementById("bluetoothDeviceList");

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
    
    // Start scanning
    isScanning = true;
    bluetoothBtn.textContent = "Scanning...";
    bluetoothBtn.disabled = true;
    deviceListContainer.style.display = "block";
    deviceListContainer.innerHTML = '<div class="loading">Scanning for nearby Bluetooth devices...</div>';

    try {
      const result = await window.api.scanBluetooth();
      
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
                </div>
                <button class="device-connect-btn" data-address="${escapeHtml(device.address)}">Connect</button>
              </div>
            `
            )
            .join("");

          // Add click handlers for connect buttons
          document.querySelectorAll(".device-connect-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              const address = e.target.getAttribute("data-address");
              alert(`Connecting to device: ${address}`);
            });
          });
        } else {
          deviceListContainer.innerHTML = '<div class="no-devices">No Bluetooth devices found nearby</div>';
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

  // Helper function to escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});
