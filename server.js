const express = require('express');
const os = require('os');
const cors = require('cors'); // Use this to prevent "Blocked by CORS" errors
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors()); // Allows your frontend UI to talk to this server

// --- TEMPORARY IN-MEMORY STORAGE ---
let currentSession = {
    token: null,
    status: 'pending',
    patientId: null,
    patientName: null,
    medicalRecords: null
};

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    let ip = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Check for IPv4 (handles string 'IPv4' or number 4)
            if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
                if (iface.address.startsWith('172.') || iface.address.startsWith('192.')) {
                    return iface.address;
                }
                ip = iface.address;
            }
        }
    }
    return ip;
}

const PC_IP = getLocalIp();

// 1. HANDSHAKE (Used by Mobile App)
app.get('/handshake', (req, res) => {
    console.log('🤝 Mobile App connected for handshake');
    res.send({ status: 'ok', message: 'Doctor Station Ready' });
});

// 2. DATA TRANSFER (Receives data from Mobile App)
app.post('/transfer', (req, res) => {
    const { patientId, patientName, medicalRecords } = req.body;
    
    console.log(`\n📥 DATA RECEIVED from ${patientName} (${patientId})`);
    
    // Store data in our "session" so the UI can see it
    currentSession = {
        token: "session_" + Date.now(),
        status: 'data_shared',
        patientId,
        patientName,
        medicalRecords
    };

    res.send({ status: 'success', message: 'Data logged on PC' });
});

// 3. SESSION POLLING (Used by your Frontend JS)
app.get('/getSessionInfo', (req, res) => {
    // If we have data, send it back to the UI
    if (currentSession.status === 'data_shared') {
        res.json({ success: true, session: currentSession });
    } else {
        res.json({ success: false, message: 'Waiting for patient...' });
    }
});

// 4. COMPLETE/WIPE SESSION (Triggered by your "Save" button)
app.post('/completeSession', (req, res) => {
    console.log('🧹 Wiping session data...');
    currentSession = { token: null, status: 'pending', patientId: null, patientName: null, medicalRecords: null };
    res.json({ success: true });
});

// 5. ROOT UI
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Doctor Station</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <style>
                body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f1f5f9; margin: 0; }
                .card { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; }
                #qrcode { margin: 20px auto; padding: 10px; background: white; border-radius: 10px; }
                .ip { font-weight: bold; color: #0284c7; background: #e0f2fe; padding: 10px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Workstation Sync</h1>
                <p>Scan this with the Doctor App</p>
                <div id="qrcode"></div>
                <p>IP Address: <span class="ip">${PC_IP}</span></p>
            </div>
            <script>
                const qrData = JSON.stringify({ ip: "${PC_IP}", port: ${PORT} });
                new QRCode(document.getElementById("qrcode"), {
                    text: qrData,
                    width: 250,
                    height: 250
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ SERVER RUNNING');
    console.log('📍 IP:', PC_IP);
    console.log('🔗 URL: http://localhost:' + PORT);
});