document.addEventListener("DOMContentLoaded", () => {
  // Existing Dashboard Elements
  const dataSharingBtn = document.getElementById("dataSharingBtn");
  const dataSharingSection = document.getElementById("dataSharingSection");
  const userNameSpan = document.getElementById("userName");
  const bluetoothBtn = document.getElementById("bluetoothBtn");
  const deviceListContainer = document.getElementById("bluetoothDeviceList");

  // QR Session modal elements
  const qrSessionModal = document.getElementById("qrSessionModal");
  const qrCodeImage = document.getElementById("qrCodeImage");
  const qrCodeLoading = document.getElementById("qrCodeLoading");
  const sessionStatus = document.getElementById("sessionStatus");
  const patientDataSection = document.getElementById("patientDataSection");
  const patientInfo = document.getElementById("patientInfo");
  const patientRecords = document.getElementById("patientRecords");
  const consultationForm = document.getElementById("consultationForm");
  const closeQrBtn = document.getElementById("closeQrBtn");
  const qrSessionError = document.getElementById("qrSessionError");

  // Current state
  let currentSessionToken = null;
  let sessionPollInterval = null;
  const SERVER_URL = "http://localhost:3000"; // Your Node.js Server

  const loggedInUser = localStorage.getItem("loggedInUserName") || "Dr. User";
  userNameSpan.textContent = loggedInUser;

  // --- 1. QR Code Button Integration ---
  document.getElementById("qrCodeBtn").addEventListener("click", () => {
    // Instead of calling a mock API, we simply show the modal.
    // The server.js '/' route already handles the QR generation.
    // We will just point our iframe or image to the server's UI.
    
    showQRModal();
    startSessionPolling();
  });

  function showQRModal() {
    // We point the image source to the root of your server which shows the QR
    // Note: If you want just the QR image, it's better to use a library like 
    // QRCode.js directly in this dashboard too.
    qrCodeLoading.style.display = "none";
    qrCodeImage.style.display = "none"; 
    
    // UI Feedback
    sessionStatus.innerHTML = `<span class="status-pending">Server active at ${SERVER_URL}. Waiting for scan...</span>`;
    patientDataSection.style.display = "none";
    qrSessionModal.classList.add("active");
  }

  // --- 2. Real-Time Polling Integration ---
  function startSessionPolling() {
    console.log("🔍 Polling Node.js server for patient data...");
    
    sessionPollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${SERVER_URL}/getSessionInfo`);
        const result = await response.json();
        
        if (result.success && result.session) {
          currentSessionToken = result.session.token;
          updateSessionUI(result.session);
          // Optional: stopSessionPolling(); // Stop once data is found
        }
      } catch (error) {
        console.error("Polling error: Ensure server.js is running.", error);
      }
    }, 3000);
  }

  function stopSessionPolling() {
    if (sessionPollInterval) {
      clearInterval(sessionPollInterval);
      sessionPollInterval = null;
    }
  }

  function updateSessionUI(session) {
    if (session.status === 'data_shared') {
      sessionStatus.innerHTML = '<span class="status-connected">✅ Patient Data Received!</span>';
      patientDataSection.style.display = "block";
      
      patientInfo.innerHTML = `
        <strong>Patient:</strong> ${escapeHtml(session.patientName)}<br>
        <strong>ID:</strong> ${escapeHtml(session.patientId)}
      `;
      
      // Display medical records from the server
      if (session.medicalRecords) {
        let recordsHtml = "";
        for (const [key, value] of Object.entries(session.medicalRecords)) {
          recordsHtml += `<strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}<br>`;
        }
        patientRecords.innerHTML = recordsHtml;
      }
    }
  }

  // --- 3. Complete Session (Wipe Data) ---
  consultationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitBtn = consultationForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving & Wiping...";

    try {
      // Tell the server to wipe the memory
      const response = await fetch(`${SERVER_URL}/completeSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert("Consultation Saved. Patient data has been wiped from server memory.");
        hideQRModal();
      }
    } catch (error) {
      console.error("Error completing session:", error);
      qrSessionError.textContent = "Failed to finalize session on server.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Consultation";
    }
  });

  function hideQRModal() {
    qrSessionModal.classList.remove("active");
    stopSessionPolling();
    patientDataSection.style.display = "none";
    consultationForm.reset();
  }

  closeQrBtn.addEventListener("click", hideQRModal);

  // Helper for XSS protection
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  
  // (Keep your existing Bluetooth and History functions below this)
});
  // History button
  const historyBtn = document.getElementById("historyBtn");
  if (historyBtn) {
    historyBtn.addEventListener("click", async () => {
      try {
        const result = await window.api.getConsultationHistory("doctor_" + Date.now());
        
        if (result.success && result.consultations) {
          if (result.consultations.length === 0) {
            consultationHistory.innerHTML = "<p>No consultations yet.</p>";
          } else {
            consultationHistory.innerHTML = result.consultations.map(c => `
              <div class="consultation-item">
                <h4>${escapeHtml(c.patientName || "Unknown Patient")}</h4>
                <div class="meta">
                  Date: ${new Date(c.createdAt).toLocaleString()}<br>
                  Doctor: ${escapeHtml(c.doctorName)}
                </div>
                <div class="content">
                  <strong>Diagnosis:</strong> ${escapeHtml(c.diagnosis || "N/A")}<br>
                  <strong>Treatment:</strong> ${escapeHtml(c.treatment || "N/A")}<br>
                  <strong>Notes:</strong> ${escapeHtml(c.notes || "N/A")}<br>
                  <strong>Prescriptions:</strong> ${escapeHtml(c.prescriptions || "N/A")}
                </div>
              </div>
            `).join("");
          }
        } else {
          consultationHistory.innerHTML = "<p>No consultations found.</p>";
        }
      } catch (error) {
        console.error("Error loading history:", error);
        consultationHistory.innerHTML = "<p>Error loading consultation history.</p>";
      }
      
      historyModal.classList.add("active");
    });
  }

  // Close history modal
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener("click", () => {
      historyModal.classList.remove("active");
    });
  }

  // Patient simulation - simulates what happens when patient scans QR code
  const simulateScanBtn = document.getElementById("simulateScanBtn");
  const simulationStatus = document.getElementById("simulationStatus");
  
  if (simulateScanBtn) {
    simulateScanBtn.addEventListener("click", async () => {
      console.log("[SIM] Button clicked, currentSessionToken:", currentSessionToken);
      
      if (!currentSessionToken) {
        simulationStatus.innerHTML = "<span style='color: red;'>No active QR session. Generate a QR code first.</span>";
        return;
      }

      simulationStatus.innerHTML = "<span style='color: blue;'>Simulating patient scan...</span>";
      console.log("[SIM] Using session token:", currentSessionToken);
      
      // Simulate patient data that would be sent from patient's phone
      const patientData = {
        patientId: "PAT-" + Math.floor(Math.random() * 10000),
        patientName: "John Doe",
        medicalRecords: {
          "Blood Type": "O+",
          "Allergies": "Penicillin",
          "Conditions": "Hypertension",
          "Medications": "Lisinopril 10mg",
          "Last Visit": "2024-01-15",
          "Notes": "Regular checkup - blood pressure controlled"
        }
      };

      try {
        const result = await window.api.patientSendData(
          currentSessionToken,
          patientData.patientId,
          patientData.patientName,
          patientData.medicalRecords
        );
        
        if (result.success) {
          simulationStatus.innerHTML = "<span style='color: green;'>Patient data sent successfully! Doctor can now view the data.</span>";
        } else {
          simulationStatus.innerHTML = `<span style='color: red;'>Error: ${result.message}</span>`;
        }
      } catch (error) {
        console.error("Simulation error:", error);
        simulationStatus.innerHTML = "<span style='color: red;'>Error sending patient data</span>";
      }
    });
  }

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

