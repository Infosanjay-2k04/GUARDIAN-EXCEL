from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import json
import random
import os
import csv
from datetime import datetime

app = FastAPI()

LOCATION_HISTORY_FILE = "location_history.json"
LOG_CSV_FILE = "guardian_logs.csv"  # Permanent record file
MAX_HISTORY = 5

# --- NEW: EMERGENCY LOCK STATE ---
class SystemState:
    is_emergency = False

state = SystemState()

def log_to_csv(packet):
    """Records every action into a CSV file for Excel."""
    file_exists = os.path.isfile(LOG_CSV_FILE)
    
    row = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "type": packet.get("type"),
        "lat": packet.get("lat"),
        "lon": packet.get("lon"),
        "battery": packet.get("battery"),
        "threat_score": packet.get("threat_score"),
        "status_msg": packet.get("status_msg", "N/A")
    }

    try:
        with open(LOG_CSV_FILE, mode='a', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=row.keys())
            if not file_exists:
                writer.writeheader()
            writer.writerow(row)
    except Exception as e:
        print(f"⚠️ [CSV LOG ERROR] {e}")

def update_history(new_packet):
    history = []
    if os.path.exists(LOCATION_HISTORY_FILE):
        try:
            with open(LOCATION_HISTORY_FILE, "r") as f:
                history = json.load(f)
        except:
            history = []
    
    history.insert(0, {
        "type": new_packet.get("type"),
        "lat": new_packet.get("lat"),
        "lon": new_packet.get("lon"),
        "battery": new_packet.get("battery"),
        "threat_score": new_packet.get("threat_score")
    })
    history = history[:MAX_HISTORY]
    
    with open(LOCATION_HISTORY_FILE, "w") as f:
        json.dump(history, f)

# --- NEW: RESET ROUTE FOR DASHBOARD ---
@app.get("/reset_sos")
async def reset_sos():
    state.is_emergency = False
    print("🔓 [SYSTEM] SOS Emergency Lock Released manually.")
    return {"status": "Emergency Lock Released"}

@app.websocket("/ws/victim")
async def victim_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("📱 [CONNECTED] Guardian App linked to Hub.")
    
    try:
        while True:
            try:
                # Receive data from phone
                data = await websocket.receive_text()
                if not data:
                    continue

                packet = json.loads(data)
                
                # --- THREAT LEVEL CALCULATION - Based on packet type ---
                if packet.get("type") == "SOS":
                    # SOS: Maximum threat
                    packet["threat_score"] = 100.00
                    packet["status_msg"] = "EMERGENCY_ACTIVE"
                    state.is_emergency = True  # Track that emergency occurred
                elif packet.get("type") == "AI_SCAN":
                    # AI_SCAN: High threat detection
                    packet["threat_score"] = round(random.uniform(75.5, 99.2), 2)
                    packet["status_msg"] = "SCANNING_ENVIRONMENT"
                elif packet.get("type") == "SECURE":
                    # SECURE: Safe monitoring
                    packet["threat_score"] = round(random.uniform(0.1, 2.0), 2)
                    packet["status_msg"] = "SECURE_MODE"
                else:
                    # Default: Normal operation
                    packet["threat_score"] = round(random.uniform(2.1, 15.5), 2)
                    packet["status_msg"] = "SYSTEM_IDLE"

                # --- FILE RECORDING ---
                try:
                    with open("live_data.json", "w") as f:
                        json.dump(packet, f)
                    update_history(packet)
                    log_to_csv(packet)
                except Exception as e:
                    print(f"⚠️ [FILE ERROR] {e}")
                
                print(f"[📡] {packet['type']} | BATT: {packet['battery']}% | THREAT: {packet['threat_score']}")

                # --- SECURE SEND ---
                await websocket.send_text(json.dumps({
                    "server_status": "LOCKED" if state.is_emergency else "ACTIVE",
                    "received_type": packet['type']
                }))

            except Exception as inner_error:
                # This catches the Tornado WebSocketClosedError and breaks the loop quietly
                print(f"⚠️ [COMM-LINK] Connection interrupted: {inner_error}")
                break

    except WebSocketDisconnect:
        print("📱 [DISCONNECTED] App went offline safely.")
    finally:
        print("清理 [CLEANUP] Connection closed. Hub standing by for next uplink.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)  # Using 8001 instead of 8000