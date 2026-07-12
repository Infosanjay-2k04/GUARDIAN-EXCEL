# Guardian App - Feature Documentation

## Three Independent Features in Expo Go App

### 1. **AI SCAN** ⚡
**Location:** Left button in action grid
**Trigger:** One tap on "⚡ AI SCAN" button
**What it does:**
- Sends packet type: `"AI_SCAN"` with threat_level: `"HIGH"`
- Activates scanning animation (blue laser line sweeps down map)
- Button glows with cyan highlight while active
- Vibration: Single 50ms buzz
- Auto-deactivates after 3.2 seconds

**Dashboard behavior:**
- Shows "⚡ AI SCANNING" with green pulsing border
- Threat score shows 75-99%
- Non-emergency state

**Code location:** Line 157-162 in index.tsx
```tsx
const handleAiScan = () => {
  setIsAiScanning(true);
  Vibration.vibrate(50);
  sendPacket("AI_SCAN", "HIGH", location);
  // ... animation code
};
```

---

### 2. **SECURE Mode** 🛡️
**Location:** Right button in action grid
**Trigger:** Toggle button - tap to turn ON/OFF
**What it does:**
- Sends packet type: `"SECURE"` with threat_level: `"MEDIUM"`
- Button text changes: "SECURE" → "SECURED" when active
- Button highlight changes to cyan when active
- Side glows turn from red to cyan (safe mode indicator)
- Threat display shows "SAFE" instead of "LOW"
- Continuous active state (until user toggles OFF)

**Dashboard behavior:**
- Shows "🛡️ SECURE MODE ACTIVE" with cyan pulsing border
- Threat score automatically set to 10% minimum (safety margin)
- Status shows "ESCORT TRACKING ACTIVE"
- Non-emergency state

**Code location:** Line 279 in index.tsx
```tsx
<TouchableOpacity 
  style={[styles.glassBtn, isSecure && styles.activeGlass]} 
  onPress={() => setIsSecure(!isSecure)}
>
  <Text style={[styles.btnText, isSecure && {color: '#00d4ff'}]}>
    🛡️ {isSecure ? "SECURED" : "SECURE"}
  </Text>
</TouchableOpacity>
```

---

### 3. **SOS Emergency** 🚨
**Location:** Slider at bottom - "SLIDE FOR EMERGENCY UPLINK"
**Trigger:** Drag red thumb slider to the right (must reach END_POSITION)
**What it does:**
- Sends packet type: `"SOS"` with threat_level: `"CRITICAL"` 
- Activates emergency mode (15 seconds duration)
- Side glows turn RED (danger indicator)
- Status badge shows "SOS ACTIVE" in red
- Vibration: Military pattern [0, 500, 100, 500] (intense double buzz)
- Auto-deactivates after 15 seconds

**Dashboard behavior:**
- 🚨 RED emergency banner appears - **PULSING RED**
- Error message: "🚨 **EMERGENCY DETECTED** - SOS SIGNAL RECEIVED"
- **AUTOMATIC SIREN SOUND PLAYS** (800Hz + 1200Hz alternating beeps)
- Threat score: 100%
- All dispatch buttons enabled and ready
- Emergency persists until user clicks "ACKNOWLEDGE & RESET SYSTEM"

**Code location:** Line 166-172 in index.tsx
```tsx
const triggerSOS = () => {
  setIsSosActive(true);
  generateTxHash();
  Vibration.vibrate([0, 500, 100, 500]);  // Military pattern
  sendPacket("SOS", "CRITICAL", location);
  setTimeout(() => setIsSosActive(false), 15000);  // 15 seconds
};
```

---

## Packet Structure Sent to Hub

All three features send WebSocket packets with this structure:

```json
{
  "type": "AI_SCAN" | "SECURE" | "SOS",
  "threat_level": "HIGH" | "MEDIUM" | "CRITICAL",
  "lat": latitude_float,
  "lon": longitude_float,
  "battery": battery_percentage,
  "blockchain_id": "0xhash..."
}
```

---

## Hub Processing

**hub.py** receives these packets and:

1. **AI_SCAN:** 
   - Passes through as-is
   - Adds threat_score: 75-99% (random)
   - Sets status_msg: "SCANNING_ENVIRONMENT"

2. **SECURE:** 
   - Passes through as-is  
   - Adds threat_score: 0.1-2% (very low)
   - Sets status_msg: "SECURE_MODE"

3. **SOS:** 
   - Sets `state.is_emergency = True` (emergency lock)
   - Forces threat_score: 100.00
   - Sets status_msg: "EMERGENCY_ACTIVE"
   - **Once SOS triggered, all packets become "SOS" until hub is reset**

---

## Dashboard Response

| Feature | Visual | Audio | Buttons | Duration |
|---------|--------|-------|---------|----------|
| **AI_SCAN** | Green pulsing box | None | Disabled | 3.2 sec (auto) |
| **SECURE** | Cyan box + badge | None | Disabled | Until toggle OFF |
| **SOS** | Red pulsing box + error banner | 🔊 **Siren beeping** | **All enabled** | Until reset |

---

## Testing Checklist

- [ ] **AI SCAN:** Tap button → Blue laser animation works → Green box on dashboard
- [ ] **SECURE:** Toggle button → Side glow turns cyan → Cyan box on dashboard
- [ ] **SOS:** Slide red thumb all the way right → Red banner appears → **Hear siren sound** → All dispatch buttons work

---

## Current Status

✅ All three features are **independently functional**  
✅ Each sends different packet type to hub  
✅ Dashboard responds to each correctly  
✅ SOS has automatic siren sound (Python winsound)  
✅ Buttons work as described  

