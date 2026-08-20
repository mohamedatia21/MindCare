import WebSocket from 'ws';

async function spotCheckAuth() {
    console.log("=== INDEPENDENT AUDIT: Task 5 Auth Spot Re-Check ===");
    const timestamp = new Date().toISOString();
    console.log(`Timestamp: ${timestamp}`);

    // 1. POST /auth/login
    console.log("\n1. Requesting JWT via POST http://localhost:3000/auth/login");
    const loginRes = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'audit_user_99', role: 'patient' })
    });
    console.log(`   HTTP Status: ${loginRes.status} ${loginRes.statusText}`);
    const loginData = await loginRes.json();
    console.log("   Login Response:", JSON.stringify(loginData));
    if (!loginRes.ok || !loginData.token) throw new Error("Login failed");

    // 2. POST /auth/ticket
    console.log("\n2. Requesting WST via POST http://localhost:3000/auth/ticket");
    const ticketRes = await fetch('http://localhost:3000/auth/ticket', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginData.token}`
        }
    });
    console.log(`   HTTP Status: ${ticketRes.status} ${ticketRes.statusText}`);
    const ticketData = await ticketRes.json();
    console.log("   Ticket Response:", JSON.stringify(ticketData));
    if (!ticketRes.ok || !ticketData.ticket) throw new Error("Ticket acquisition failed");

    // 3. WS Connect & Auth Handshake
    console.log("\n3. Opening WebSocket connection to ws://localhost:3000");
    const ws = new WebSocket('ws://localhost:3000');

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error("WebSocket handshake timed out"));
        }, 5000);

        ws.on('open', () => {
            console.log("   [WS OPEN] Sending auth handshake message...");
            ws.send(JSON.stringify({
                type: 'auth',
                ticket: ticketData.ticket,
                sessionId: 'audit-session-' + Date.now()
            }));
        });

        ws.on('message', (data, isBinary) => {
            if (!isBinary) {
                const msg = JSON.parse(data.toString());
                console.log("   [WS INCOMING MESSAGE]:", JSON.stringify(msg));
                if (msg.type === 'auth_success') {
                    console.log("   [PASS] WebSocket authenticated successfully.");
                    clearTimeout(timeout);
                    ws.close();
                    resolve();
                }
            }
        });

        ws.on('error', (err) => {
            console.error("   [WS ERROR]:", err);
            reject(err);
        });

        ws.on('close', (code, reason) => {
            console.log(`   [WS CLOSED] code=${code} reason=${reason.toString()}`);
        });
    });

    console.log("\n=== AUTH SPOT RE-CHECK COMPLETE AND VERIFIED ===");
}

spotCheckAuth().catch(e => {
    console.error("SPOT CHECK ERROR:", e.message);
    process.exit(1);
});
