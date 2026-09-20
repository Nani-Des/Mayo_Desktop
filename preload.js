const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  login: (credentials) => ipcRenderer.invoke("login", credentials),
  scanBluetooth: () => ipcRenderer.invoke("scan-bluetooth"),
  // Two-step pairing process
  initiateBluetoothPairing: (address, deviceName) => 
    ipcRenderer.invoke("initiate-bluetooth-pairing", { address, deviceName }),
  confirmBluetoothPairing: (address) => 
    ipcRenderer.invoke("confirm-bluetooth-pairing", { address }),
  // Legacy single-step connect (kept for backward compatibility)
  connectBluetooth: (address) => ipcRenderer.invoke("connect-bluetooth", { address }),
  getBluetoothStatus: (address) => ipcRenderer.invoke("bluetooth-status", { address }),
  // QR Code / Hospital Data Transfer
  generateQRCode: (doctorId, doctorName, patientName) => 
    ipcRenderer.invoke("generate-qr-code", { doctorId, doctorName, patientName }),
  getSessionInfo: (sessionToken) => 
    ipcRenderer.invoke("get-session-info", { sessionToken }),
  addConsultation: (sessionToken, diagnosis, treatment, notes, prescriptions, doctorId, doctorName) =>
    ipcRenderer.invoke("add-consultation", { sessionToken, diagnosis, treatment, notes, prescriptions, doctorId, doctorName }),
  completeSession: (sessionToken) => 
    ipcRenderer.invoke("complete-session", { sessionToken }),
  getConsultationHistory: (doctorId) => 
    ipcRenderer.invoke("get-consultation-history", { doctorId }),
  // Patient data transfer (for simulation)
  patientSendData: (sessionToken, patientId, patientName, medicalRecords) =>
    ipcRenderer.invoke("patient-send-data", { sessionToken, patientId, patientName, medicalRecords }),
  patientGetData: (sessionToken) =>
    ipcRenderer.invoke("patient-get-data", { sessionToken }),
});
