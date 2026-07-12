# Guardian Tactical App - Functions Code Library

This file contains all core functions from the Guardian Tactical application for quick reference and reuse.

---

## 🔌 WEBSOCKET CONNECTION FUNCTION

```typescript
const connect = () => {
  try {
    ws.current = new WebSocket(WS_URL);
    ws.current.onopen = () => {
      console.log('✅ WebSocket connected');
      setStatus('CONNECTED');
    };
    ws.current.onclose = () => { 
      console.log('WS closed'); 
      setStatus('OFFLINE'); 
      setTimeout(connect, 3000); 
    };
    ws.current.onerror = (err) => { 
      console.log('❌ WS error:', err); 
      setStatus('ERROR'); 
    };
    ws.current.onmessage = (msg) => { 
      console.log('WS message:', msg.data); 
    };
  } catch (e) {
    console.log('❌ WebSocket connection error:', e);
    setStatus('ERROR');
  }
};
```

**Parameters**: None  
**Returns**: void  
**Purpose**: Establish WebSocket connection to Hub server at `ws://192.168.1.3:8001/ws/victim`

---

## 📤 SEND DATA PACKET FUNCTION

```typescript
const sendPacket = (type: string, level: string, loc: LocationData | null) => {
  try {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type, 
        threat_level: level,
        lat: loc?.coords.latitude || 0,
        lon: loc?.coords.longitude || 0,
        battery: batteryLevel,
        blockchain_id: blockchainId
      }));
      console.log(`📤 Packet sent: ${type}`);
    }
  } catch (e) {
    console.log('❌ Send packet error:', e);
  }
};
```

**Parameters**:
- `type: string` - Packet type ("SYNC", "SECURE", "SOS", "AI_SCAN")
- `level: string` - Threat level ("LOW", "MEDIUM", "HIGH", "CRITICAL")
- `loc: LocationData | null` - Current location coordinates

**Returns**: void  
**Purpose**: Transmit location data and system state to Hub server

---

## 📍 LOCATION TRACKING SETUP

```typescript
useEffect(() => {
  // Connect WebSocket
  connect();

  let watcher: any;
  (async () => {
    try {
      let { status: res } = await Location.requestForegroundPermissionsAsync();
      console.log('📍 Location permission status:', res);
      if (res !== 'granted') {
        console.log('⚠️ Location permission denied');
        return;
      }
      
      watcher = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation, 
        timeInterval: 3000, 
        distanceInterval: 1, 
      }, (loc) => {
        try {
          const newLoc = { coords: { latitude: loc.coords.latitude, longitude: loc.coords.longitude } };
          setLocation(newLoc);
          if (mapRef.current && isAutoLocateRef.current) {
            mapRef.current.animateToRegion({
              ...newLoc.coords,
              latitudeDelta: 0.0012, 
              longitudeDelta: 0.0012,
            }, 1000); 
          }

          const modeType = isSosRef.current ? "SOS" : (isSecureRef.current ? "SECURE" : "SYNC");
          const modeLevel = isSosRef.current ? "CRITICAL" : (isSecureRef.current ? "MEDIUM" : "LOW");
          sendPacket(modeType, modeLevel, newLoc);
        } catch (e) {
          console.log('❌ Location update error:', e);
        }
      });
    } catch (e) {
      console.log('❌ Location setup error:', e);
    }
  })();
  return () => {
    try {
      watcher?.remove();
    } catch (e) {
      console.log('Error removing watcher:', e);
    }
  };
}, []);
```

**Triggers**: Component mount  
**Updates**: Every 3 seconds or 1m movement  
**Purpose**: Continuous GPS tracking with WebSocket packet transmission

---

## ⚡ AI SCAN FUNCTION

```typescript
const handleAiScan = () => {
  try {
    setIsAiScanning(true);
    Vibration.vibrate(50);
    sendPacket("AI_SCAN", "HIGH", location);
    scanOpacity.value = withTiming(1, { duration: 200 });
    scanY.value = withSequence(withTiming(MAP_FRAME_HEIGHT - 5, { duration: 1500 }), withTiming(0, { duration: 1500 }));
    setTimeout(() => {
      setIsAiScanning(false);
      scanOpacity.value = withTiming(0, { duration: 300 });
    }, 3200);
  } catch (e) {
    console.log('❌ AI Scan error:', e);
    setIsAiScanning(false);
  }
};
```

**Parameters**: None  
**Returns**: void  
**Purpose**: Trigger AI scan animation, send HIGH threat packet, vibrate device

---

## 🆘 SOS EMERGENCY TRIGGER FUNCTION

```typescript
const triggerSOS = () => {
  try {
    setIsSosActive(true);
    generateTxHash();
    Vibration.vibrate([0, 500, 100, 500]);
    sendPacket("SOS", "CRITICAL", location);
    setTimeout(() => setIsSosActive(false), 15000);
  } catch (e) {
    console.log('❌ SOS trigger error:', e);
    setIsSosActive(false);
  }
};
```

**Parameters**: None  
**Returns**: void  
**Purpose**: Activate SOS mode, generate transaction hash, send CRITICAL packet, vibrate alarm pattern

---

## 🔐 GENERATE BLOCKCHAIN HASH FUNCTION

```typescript
const generateTxHash = () => {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 12; i++) { 
    hash += chars[Math.floor(Math.random() * chars.length)]; 
  }
  setBlockchainId(hash + '...');
};
```

**Parameters**: None  
**Returns**: void  
**Purpose**: Generate random hexadecimal blockchain transaction ID

---

## 🔋 BATTERY LEVEL FUNCTION

```typescript
useEffect(() => {
  const getBatt = async () => {
    try {
      const level = await Battery.getBatteryLevelAsync();
      setBatteryLevel(Math.round(level * 100));
    } catch (e) {
      console.log('⚠️ Battery error:', e);
      setBatteryLevel(50);
    }
  };
  getBatt();
}, []);
```

**Triggers**: Component mount  
**Returns**: void  
**Purpose**: Fetch device battery percentage with 50% fallback

---

## 📡 RADAR PULSE ANIMATIONS

```typescript
useEffect(() => {
  pulse1.value = withRepeat(withTiming(1, { duration: 2000 }), -1, false);
  pulse2.value = withDelay(1000, withRepeat(withTiming(1, { duration: 2000 }), -1, false));
  slowBlink.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
}, []);

const radarPulseStyle1 = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(pulse1.value, [0, 1], [1, 4]) }],
  opacity: interpolate(pulse1.value, [0, 0.7, 1], [0, 0.5, 0]),
}));

const radarPulseStyle2 = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(pulse2.value, [0, 1], [1, 4]) }],
  opacity: interpolate(pulse2.value, [0, 0.7, 1], [0, 0.5, 0]),
}));

const sideGlowStyle = useAnimatedStyle(() => ({
  opacity: slowBlink.value,
  backgroundColor: isSosActive ? '#ff0000' : '#00d4ff',
}));
```

**Triggers**: Component mount  
**Returns**: Animated style objects  
**Purpose**: Create looping pulse animations for radar marker

---

## 🖐️ GESTURE HANDLER - SOS SLIDER

```typescript
const gesture = Gesture.Pan()
  .onUpdate((event) => {
    if (event.translationX >= 0 && event.translationX <= END_POSITION) {
      translateX.value = event.translationX;
    }
  })
  .onEnd(() => { 
    if (translateX.value > END_POSITION - 30) {
      runOnJS(triggerSOS)();
    }
    translateX.value = withSpring(0); 
  });

const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
const laserStyle = useAnimatedStyle(() => ({ width: translateX.value + THUMB_SIZE / 2 }));
```

**Triggers**: User pan gesture on slider  
**Returns**: Animated style objects  
**Purpose**: Handle SOS slider drag, trigger SOS if >90% dragged, spring back to origin

---

## 📍 MANUAL LOCATE BUTTON

```typescript
{location && (
  <TouchableOpacity
    style={styles.locateButton}
    onPress={() => {
      if (mapRef.current && location) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0012,
          longitudeDelta: 0.0012,
        }, 800);
        Vibration.vibrate(30);
      }
    }}
  >
    <MaterialCommunityIcons name="crosshairs-gps" size={20} color={isAutoLocate ? '#00d4ff' : '#fff'} />
  </TouchableOpacity>
)}
```

**Parameters**: None  
**Returns**: JSX Component  
**Purpose**: Button to manually recenter map to current location

---

## 🗺️ MAPVIEW COMPONENT

```typescript
<MapView 
  ref={mapRef} 
  provider={PROVIDER_GOOGLE} 
  mapType="satellite"
  customMapStyle={cleanMapStyle} 
  style={styles.map} 
  rotateEnabled={false} 
  pitchEnabled={false}
  initialRegion={{
    latitude: location?.coords.latitude || 37.78825,
    longitude: location?.coords.longitude || -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }}
>
  {location && (
    <Marker coordinate={location.coords} anchor={{x: 0.5, y: 0.5}}>
      <View style={styles.radarWrapper}>
        <Animated.View style={[styles.radarCircle, radarPulseStyle1, { borderColor: isSosActive ? '#f00' : '#00d4ff' }]} />
        <Animated.View style={[styles.radarCircle, radarPulseStyle2, { borderColor: isSosActive ? '#f00' : '#00d4ff' }]} />
        <View style={[styles.markerCore, { backgroundColor: isSosActive ? '#f00' : '#00d4ff' }]}>
          <View style={styles.markerInner} />
        </View>
      </View>
    </Marker>
  )}
</MapView>
```

**Features**: 
- Satellite map view with clean street/POI filtering
- Current location marker with pulsing radar
- Changes color (cyan/red) based on SOS state
- Auto-centers when location updates (if enabled)

---

## 🔧 STARTUP COMMANDS

### Terminal 1: Hub Server
```bash
cd c:\Users\SHANJITH\OneDrive\Desktop\GuardianProject; python hub.py
```
**Port**: 8001 | **WebSocket**: `ws://192.168.1.3:8001/ws/victim`

### Terminal 2: Streamlit Dashboard
```bash
cd c:\Users\SHANJITH\OneDrive\Desktop\GuardianProject; python -m streamlit run streamlit_dashboard.py
```
**Port**: 8501 | **Access**: `http://localhost:8501`

### Terminal 3: Expo Dev Server
```bash
cd c:\Users\SHANJITH\OneDrive\Desktop\GuardianProject\GuardianApp; npx expo start
```
**Port**: 8082-8083 | **Action**: Scan QR code with Expo Go

---

## 📊 STATE VARIABLES SUMMARY

```typescript
const [status, setStatus] = useState<string>('CONNECTING...');
const [location, setLocation] = useState<LocationData | null>(null);
const [isSecure, setIsSecure] = useState<boolean>(false);
const [isAiScanning, setIsAiScanning] = useState<boolean>(false);
const [isSosActive, setIsSosActive] = useState<boolean>(false);
const [isAutoLocate, setIsAutoLocate] = useState<boolean>(true);
const [batteryLevel, setBatteryLevel] = useState<number>(0);
const [blockchainId, setBlockchainId] = useState<string>('0x7a2...f9e1');
```

---

## 📱 QUICK INTEGRATION GUIDE

### To integrate these functions into another React Native project:

1. **Copy interface definitions** (LocationData)
2. **Copy all useEffect hooks and functions**
3. **Install dependencies**:
   ```bash
   npm install react-native-maps react-native-reanimated expo-location expo-battery
   ```
4. **Update constants**: Change `LAPTOP_IP` and `WS_URL` to match your server
5. **Add permissions** to `app.json`:
   ```json
   {
     "permissions": [
       "android.permission.ACCESS_FINE_LOCATION",
       "android.permission.ACCESS_COARSE_LOCATION"
     ]
   }
   ```

---

**Last Updated**: February 25, 2026  
**Version**: 1.0 (Production)
