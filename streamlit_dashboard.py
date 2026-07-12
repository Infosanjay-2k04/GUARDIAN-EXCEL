import streamlit as st
import pandas as pd
import json
import os
from datetime import datetime
from collections import deque
import time
import urllib.parse
import numpy as np
from io import BytesIO
import wave
import subprocess
import platform
import wave

# Page Config
st.set_page_config(page_title="Guardian Command", layout="wide", initial_sidebar_state="collapsed")

# --- FUNCTION TO GENERATE ALARM SOUND ---
@st.cache_data
def generate_alarm_sound(duration=2):
    """Generate a WAV alarm sound (800Hz tone with modulation)"""
    sample_rate = 22050
    samples = []
    
    for i in range(int(sample_rate * duration)):
        t = i / sample_rate
        # 800Hz tone with amplitude modulation
        frequency = 800
        tone = np.sin(2 * np.pi * frequency * t)
        # Modulate to create on-off pattern
        modulation = 0.5 + 0.5 * np.sin(2 * np.pi * 4 * t)  # 4Hz modulation
        sample = int(tone * modulation * 32767 * 0.3)
        samples.append(sample.to_bytes(2, byteorder='little', signed=True))
    
    wav_buffer = BytesIO()
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b''.join(samples))
    
    wav_buffer.seek(0)
    return wav_buffer.read()

# --- RESTORED ORIGINAL INTERFACE CSS ---
st.markdown("""
    <style>
    .main { background-color: #000000; color: #ffffff; }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.4); }
      70% { box-shadow: 0 0 0 20px rgba(0, 255, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0); }
    }
    @keyframes pulse-red {
      0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.4); }
      70% { box-shadow: 0 0 0 20px rgba(255, 0, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
    }
    .scanning-box {
        border: 2px solid #0f0;
        padding: 20px;
        border-radius: 15px;
        text-align: center;
        /* animation disabled to prevent blinking */
        background-color: rgba(0, 50, 0, 0.2);
        margin-bottom: 20px;
    }
    .emergency-box-active {
        border: 2px solid #f00;
        padding: 20px;
        border-radius: 15px;
        text-align: center;
        /* animation disabled to prevent blinking */
        background-color: rgba(100, 0, 0, 0.3);
        margin-bottom: 20px;
    }
    .secure-box {
        border: 2px solid #00d4ff;
        padding: 20px;
        border-radius: 15px;
        text-align: center;
        background-color: rgba(0, 40, 100, 0.3);
        margin-bottom: 20px;
        color: #00d4ff;
        font-weight: bold;
    }
    .dispatch-container {
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #333;
        margin-bottom: 10px;
        background: linear-gradient(145deg, #0a0a0a, #1a1a1a);
    }
    .stMetric { background-color: #0a0a0a; border: 1px solid #222; padding: 10px; border-radius: 10px; }
    div.stButton > button { width: 100%; border-radius: 5px; font-weight: bold; }
    
    .wa-link {
        display: block;
        text-align: center;
        color: #25D366;
        font-weight: bold;
        text-decoration: none;
        border: 1px solid #25D366;
        padding: 5px;
        margin-top: 10px;
        border-radius: 5px;
    }
    
    .reset-btn button {
        background-color: #ff4b4b !important;
        color: white !important;
        border: none !important;
        padding: 20px !important;
        font-size: 20px !important;
    }
    </style>
    """, unsafe_allow_html=True)

# --- ALERT SOUND GENERATOR ---
def generate_and_play_alert():
    """Generate a siren-like alert sound and play it automatically"""
    try:
        # Generate alert sound data
        sample_rate = 44100
        duration = 0.5  # 500ms
        
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        
        # Create a siren effect: alternating frequencies
        freq1, freq2 = 800, 1200
        # Alternate between two frequencies every 0.1 seconds
        sound = np.where((t % 0.2) < 0.1, 
                        np.sin(2 * np.pi * freq1 * t),
                        np.sin(2 * np.pi * freq2 * t))
        
        # Add envelope to avoid clicks
        envelope = np.exp(-3 * t)  # Exponential decay
        sound = (sound * envelope * 0.3).astype(np.float32)
        
        # Convert to WAV format
        buffer = BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes((sound * 32767).astype(np.int16).tobytes())
        
        buffer.seek(0)
        audio_data = buffer.getvalue()
        
        # Save to temporary file and play
        temp_audio = "temp_alert.wav"
        with open(temp_audio, "wb") as f:
            f.write(audio_data)
        
        # Play sound based on OS
        if platform.system() == "Windows":
            import winsound
            winsound.PlaySound(temp_audio, winsound.SND_FILENAME)
        elif platform.system() == "Darwin":  # macOS
            subprocess.run(["afplay", temp_audio])
        else:  # Linux
            subprocess.run(["paplay", temp_audio])
        
        # Clean up
        if os.path.exists(temp_audio):
            time.sleep(1)
            os.remove(temp_audio)
    except Exception as e:
        print(f"⚠️ [AUDIO ERROR] {e}")

# --- SESSION STATE ---
if 'history' not in st.session_state: st.session_state.history = deque(maxlen=5) 
if 'path_history' not in st.session_state: st.session_state.path_history = []
if 'emergency' not in st.session_state: st.session_state.emergency = False
if 'ai_scanning' not in st.session_state: st.session_state.ai_scanning = False
if 'secure_mode' not in st.session_state: st.session_state.secure_mode = False
if 'sos_notified' not in st.session_state: st.session_state.sos_notified = False
if 'status_msg' not in st.session_state: st.session_state.status_msg = "SYSTEM READY - STANDBY"
if 'session_report' not in st.session_state: st.session_state.session_report = None

# --- DATA LOADING ---
data = {"lat": 11.2099, "lon": 78.1887, "battery": 100, "type": "IDLE", "threat_score": 0}
try:
    if os.path.exists("live_data.json"):
        with open("live_data.json", "r") as f: 
            data = json.load(f)
        
        # DEBUG: Print SOS status
        if data.get("type") == "SOS":
            print(f"[🚨 SOS DETECTED] Type: {data.get('type')}, Threat: {data.get('threat_score')}")
        
        current_pos = {"lat": data['lat'], "lon": data['lon']}
        
        # Breadcrumb Track Logic (Unchanged)
        if not st.session_state.path_history or (st.session_state.path_history[-1] != current_pos):
            st.session_state.path_history.append(current_pos)
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        if not st.session_state.history or st.session_state.history[0]['Time'] != timestamp:
             st.session_state.history.appendleft({
                "Time": timestamp, "Event": data.get("type"), "Threat": f"{data.get('threat_score', 0)}%"
            })
        
        # ---- CRITICAL: DETECT TYPE AND SET STATE ----
        current_type = data.get("type")
        
        if current_type == "AI_SCAN":
            st.session_state.ai_scanning = True
            st.session_state.secure_mode = False
            st.session_state.emergency = False
            st.session_state.status_msg = "AI SCANNING - HIGH THREAT DETECTED"
        elif current_type == "SECURE":
            st.session_state.secure_mode = True
            st.session_state.ai_scanning = False
            st.session_state.emergency = False
            st.session_state.status_msg = "SECURE MODE - MONITORING ACTIVE"
        elif current_type == "SOS": 
            st.session_state.emergency = True
            st.session_state.ai_scanning = False
            st.session_state.secure_mode = False
            st.session_state.status_msg = "CRITICAL SOS UPLINK DETECTED"
            # Play alert sound and show notification when SOS first detected
            if not hasattr(st.session_state, 'sos_notified') or not st.session_state.sos_notified:
                # Play alert sound in background
                try:
                    generate_and_play_alert()
                except Exception as e:
                    print(f"⚠️ [SOUND ERROR] {e}")
                
                st.toast("🚨 CRITICAL: SOS SIGNAL RECEIVED FROM VICTIM", icon="🚨")
                st.session_state.sos_notified = True
        else:
            # Default: idle state
            st.session_state.ai_scanning = False
            st.session_state.secure_mode = False
            if not st.session_state.emergency:
                st.session_state.status_msg = "SYSTEM READY - STANDBY"
        # Keep emergency state PERSISTENT - don't reset it just because data type changed
        # Only reset when user clicks the acknowledge button
except Exception as e:
    print(f"⚠️ [DASHBOARD ERROR] Failed to load live_data.json: {e}")
    data = {"lat": 11.2099, "lon": 78.1887, "battery": 100, "type": "IDLE", "threat_score": 0}

# --- HELPER: WHATSAPP ---
def get_whatsapp_link(phone, agency, lat, lon):
    map_link = f"https://www.google.com/maps?q={lat},{lon}"
    message = f"🚨 *GUARDIAN EMERGENCY ALERT*\n\n*Agency:* {agency}\n*Status:* CRITICAL\n*Live Location:* {map_link}"
    encoded_msg = urllib.parse.quote(message)
    return f"https://wa.me/91{phone}?text={encoded_msg}"

st.title("🛰️ GUARDIAN COMMAND: GLOBAL UPLINK")
# manual refresh control
if st.button("🔄 Refresh Dashboard"):
    st.rerun()

st.markdown("---")

# --- SIDEBAR: EXPORT LOGS ---
with st.sidebar:
    st.header("📊 Data Management")
    if os.path.exists("guardian_logs.csv"):
        log_df = pd.read_csv("guardian_logs.csv")
        st.download_button(
            label="📥 Download Full Action Log",
            data=log_df.to_csv(index=False),
            file_name=f"Guardian_Logs_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
        st.write(f"Total actions recorded: {len(log_df)}")

# --- ALERT DISPLAYS - Show appropriate alert for each feature ---
if st.session_state.emergency:
    # SOS EMERGENCY ALERT
    st.markdown(f'<div class="emergency-box-active"><h2 style="color: #fff; margin:0;">🚨 CRITICAL ALERT ACTIVE: {st.session_state.status_msg} 🚨</h2></div>', unsafe_allow_html=True)
    st.error("🚨 **EMERGENCY DETECTED** - SOS SIGNAL RECEIVED - DISPATCH UNITS ACTIVATED 🚨")
elif st.session_state.ai_scanning:
    # AI SCAN ALERT
    st.markdown('<div class="scanning-box"><h2 style="color: #0f0; margin:0;">⚡ AI SCANNING MODE ACTIVE ⚡</h2><small style="color: #0f0;">High Threat Environment Detected</small></div>', unsafe_allow_html=True)
    st.success("✅ **AI SCAN ACTIVE** - Environment Analysis in Progress")
elif st.session_state.secure_mode:
    # SECURE MODE ALERT
    st.markdown('<div class="secure-box"><h2 style="color: #00d4ff; margin:0;">🛡️ SECURE MODE ACTIVE 🛡️</h2><small style="color: #00d4ff;">Escort Tracking & Monitoring Enabled</small></div>', unsafe_allow_html=True)
    st.info("🛡️ **SECURE MODE** - Monitoring Person Safety & Location")

col1, col2, col3 = st.columns([1, 2, 1])

with col1:
    if data.get("type") == "AI_SCAN":
        st.markdown('<div class="scanning-box"><h3 style="color: #0f0; margin:0;">⚡ AI SCANNING</h3></div>', unsafe_allow_html=True)
    elif data.get("type") == "SECURE":
        st.markdown('<div class="secure-box"><h3 style="color: #00d4ff; margin:0;">🛡️ SECURE MODE ACTIVE</h3><small>Escort Tracking Active</small></div>', unsafe_allow_html=True)

    st.subheader("📡 Node Health")
    st.metric("POWER SOURCE", f"{data.get('battery', 100)}%")
    
    display_threat = data.get('threat_score', 0)
    if data.get("type") == "SECURE" and display_threat < 10: display_threat = 10.0
    st.metric("THREAT LEVEL", f"{display_threat}%")
    
    st.write("---")
    st.subheader("📋 Log History")
    st.table(pd.DataFrame(list(st.session_state.history)))

with col2:
    st.subheader("🌍 Satellite Tactical Overlay")
    map_df = pd.DataFrame(st.session_state.path_history) if st.session_state.path_history else pd.DataFrame([{"lat": data['lat'], "lon": data['lon']}])
    
    st.map(map_df, zoom=16)
    st.info(f"NODE COORDS: {data['lat']}, {data['lon']} | STATUS: {st.session_state.status_msg}")

with col3:
    st.subheader("🚨 Dispatch Units")
    
    dispatch_list = [
        ("6374162263", "POLICE DEPARTMENT", "🚓 LAW ENFORCEMENT"),
        ("9344003481", "HOSPITAL EMERGENCY", "🏥 MEDICAL RESPONSE"),
        ("6385505984", "RESCUE SQUAD", "🚁 SEARCH & RESCUE")
    ]

    for phone, agency, label in dispatch_list:
        st.markdown('<div class="dispatch-container">', unsafe_allow_html=True)
        st.write(f"**{label}**")
        if st.button(f"DISPATCH {agency.split()[0]}"):
            link = get_whatsapp_link(phone, agency, data['lat'], data['lon'])
            st.markdown(f'<a href="{link}" target="_blank" class="wa-link">Confirm WhatsApp Alert</a>', unsafe_allow_html=True)
            st.session_state.status_msg = f"{agency.split()[0]} ALERT GENERATED"
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="dispatch-container">', unsafe_allow_html=True)
    st.write("🛸 **AERIAL RECON DRONE**")
    if st.button("DEPLOY DRONE"):
        st.session_state.status_msg = "UAV DEPLOYED - SCANNING AREA"
        st.toast("Drone unit launched successfully.")
    st.markdown('</div>', unsafe_allow_html=True)

# --- FOOTER SECTION ---
st.markdown("---")
f_col1, f_col2, f_col3 = st.columns([1, 1, 1])
with f_col2:
    st.markdown('<div class="reset-btn">', unsafe_allow_html=True)
    if st.button("🚨 ACKNOWLEDGE & RESET SYSTEM"):
        # Generate a quick summary from the CSV before resetting
        if os.path.exists("guardian_logs.csv"):
            summary_df = pd.read_csv("guardian_logs.csv").tail(10)
            st.session_state.session_report = {
                "events": len(summary_df),
                "avg_threat": round(summary_df['threat_score'].mean(), 1),
                "final_batt": summary_df['battery'].iloc[-1] if not summary_df.empty else 0
            }
        
        st.session_state.emergency = False
        st.session_state.ai_scanning = False
        st.session_state.secure_mode = False
        st.session_state.sos_notified = False
        st.session_state.status_msg = "SYSTEM READY - STANDBY"
        st.session_state.path_history = []
        if os.path.exists("live_data.json"): os.remove("live_data.json")
        # st.rerun() removed to prevent immediate rerun/flicker; user can refresh manually if needed
    st.markdown('</div>', unsafe_allow_html=True)

# Display Summary Report if it exists
if st.session_state.session_report:
    st.success(f"📊 Last Session: {st.session_state.session_report['events']} Events | Avg Threat: {st.session_state.session_report['avg_threat']}% | Batt: {st.session_state.session_report['final_batt']}%")

# --- AUTO REFRESH FOR LIVE UPDATES ---
# automatic rerun removed to prevent blinking and duplicate sections
# st.markdown('<div style="text-align: center; font-size: 12px; color: #666;">🔄 Live Dashboard - Updating every 2 seconds</div>', unsafe_allow_html=True)
# time.sleep(2)
# st.rerun()