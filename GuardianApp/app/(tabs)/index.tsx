import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MapComponent } from './MapComponent';

// --- CONFIGURATION ---
const LAPTOP_IP = Platform.select({
  default: '10.112.52.87',
  web: typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1',
});
const WS_URL = `ws://${LAPTOP_IP}:8001/ws/victim`;

interface LocationData {
  coords: {
    latitude: number;
    longitude: number;
  };
}

const { width } = Dimensions.get('window');
const SLIDER_WIDTH = width * 0.9;
const THUMB_SIZE = 55;
const END_POSITION = SLIDER_WIDTH - THUMB_SIZE - 10;
const MAP_FRAME_HEIGHT = 210;

export default function GuardianTacticalApp() {
  const [status, setStatus] = useState<string>('CONNECTING...');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isSecure, setIsSecure] = useState<boolean>(false);
  const [isAiScanning, setIsAiScanning] = useState<boolean>(false);
  const [isSosActive, setIsSosActive] = useState<boolean>(false);
  const [isAutoLocate, setIsAutoLocate] = useState<boolean>(true);
  const [batteryLevel, setBatteryLevel] = useState<number>(0);
  const [blockchainId, setBlockchainId] = useState<string>('0x7a2...f9e1');
  
  const ws = useRef<WebSocket | null>(null);
  const mapRef = useRef<any>(null);
  const translateX = useSharedValue(0);

  // Refs to hold latest mode flags for use inside callbacks
  const isSecureRef = useRef<boolean>(isSecure);
  const isSosRef = useRef<boolean>(isSosActive);
  const isAutoLocateRef = useRef<boolean>(isAutoLocate);

  // Keep refs in sync with state
  useEffect(() => { isSecureRef.current = isSecure; isSosRef.current = isSosActive; isAutoLocateRef.current = isAutoLocate; });
  
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const slowBlink = useSharedValue(0.2);
  const scanY = useSharedValue(-10);
  const scanOpacity = useSharedValue(0);

  const generateTxHash = () => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 12; i++) { hash += chars[Math.floor(Math.random() * chars.length)]; }
    setBlockchainId(hash + '...');
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    pulse1.value = withRepeat(withTiming(1, { duration: 2000 }), -1, false);
    pulse2.value = withDelay(1000, withRepeat(withTiming(1, { duration: 2000 }), -1, false));
    slowBlink.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
    
    const getBatt = async () => {

      try {
        const level = await Battery.getBatteryLevelAsync();
        setBatteryLevel(Math.round(level * 100));
      } catch (e) {
        console.log('⚠️ Battery error:', e);
        setBatteryLevel(50); // Default fallback
      }
    };
    getBatt();
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

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
    opacity: scanOpacity.value,
  }));

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Connect once when component mounts
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

            // Use refs to read latest flags (avoids stale closures)
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

  // --- TRIGGER SOS FUNCTION ---
  const triggerSOS = () => {
    try {
      setIsSosActive(true);
      generateTxHash();
      Vibration.vibrate([0, 500, 100, 500]);
      // Send immediate SOS packet with current location
      sendPacket("SOS", "CRITICAL", location);
      // Keep SOS active for longer to ensure it reaches the dashboard
      setTimeout(() => setIsSosActive(false), 15000);
    } catch (e) {
      console.log('❌ SOS trigger error:', e);
      setIsSosActive(false);
    }
  };

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <Animated.View style={[styles.sideLightLeft, sideGlowStyle]} />
          <Animated.View style={[styles.sideLightRight, sideGlowStyle]} />

          <View style={styles.header}>
            <View style={styles.headerTopRow}>
                <Text style={styles.brand}>GUARDIAN EXCEL</Text>
                <MaterialCommunityIcons name={status === 'CONNECTED' ? "wifi" : "wifi-off"} size={22} color={status === 'CONNECTED' ? "#00d4ff" : "#f00"} />
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
              <TouchableOpacity onPress={() => { setIsAutoLocate(!isAutoLocate); Vibration.vibrate(30); }} style={{padding:6, borderRadius:8, backgroundColor: isAutoLocate ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)', marginRight:8}}>
                <MaterialCommunityIcons name={isAutoLocate ? 'crosshairs-gps' : 'crosshairs-question'} size={18} color={isAutoLocate ? '#00d4ff' : '#888'} />
              </TouchableOpacity>
              <Text style={{color: isAutoLocate ? '#00d4ff' : '#777', fontSize: 12}}>{isAutoLocate ? 'Auto-Locate ON' : 'Auto-Locate OFF'}</Text>
            </View>
            <View style={styles.statusBadge}>
               <Text style={[styles.subStatus, isSosActive && {color: '#f00'}]}>● {isSosActive ? "SOS ACTIVE" : "RADAR LINKED"}</Text>
               <Text style={styles.coordText}>{location ? `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}` : "ACQUIRING..."}</Text>
            </View>
          </View>

          <View style={styles.glassContainerMap}>
            <MapComponent 
              location={location}
              mapRef={mapRef}
              isSosActive={isSosActive}
              radarPulseStyle1={radarPulseStyle1}
              radarPulseStyle2={radarPulseStyle2}
              styles={styles}
            />
            <Animated.View style={[styles.scannerBeam, scanLineStyle]} />

            {/* Manual locate button - recenters map to current device location (native only) */}
            {location && Platform.OS !== 'web' && (
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
          </View>

          <Text style={styles.sectionLabel}>LIVE METRICS</Text>
          <View style={styles.glassMetrics}>
            <View style={[styles.metricItem, {borderLeftWidth: 0}]}>
              <Text style={styles.mLabel}>BATT</Text>
              <Text style={[styles.mVal, {color: batteryLevel < 20 ? '#f00' : '#0f0'}]}>{batteryLevel}%</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.mLabel, {color: '#00d4ff'}]}>THREAT</Text>
              <Text style={styles.mVal}>{isSosActive ? "SOS" : (isSecure ? "SAFE" : "LOW")}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.mLabel}>UPLINK</Text>
              <Text style={[styles.mVal, {color: '#00d4ff'}]}>{status}</Text>
            </View>
          </View>

          <View style={styles.actionGrid}>
            <TouchableOpacity style={[styles.glassBtn, isAiScanning && styles.activeGlass]} onPress={handleAiScan}><Text style={styles.btnText}>⚡ AI SCAN</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.glassBtn, isSecure && styles.activeGlass]} onPress={() => setIsSecure(!isSecure)}><Text style={[styles.btnText, isSecure && {color: '#00d4ff'}]}>🛡️ {isSecure ? "SECURED" : "SECURE"}</Text></TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>ENCRYPTED_TELEMETRY</Text>
          <View style={styles.glassTerminal}>
            <Text style={styles.termText}>{`> STATUS: POSITION_LOCKED`}</Text>
            <Text style={styles.termText}>{`> TX_HASH: ${blockchainId}`}</Text>
            <Text style={styles.termText}>{`> MAP: CLEAN_SATELLITE`}</Text>
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderTrackGlass}>
              <Animated.View style={[styles.laserFill, laserStyle]} />
              <GestureDetector gesture={gesture}>
                <Animated.View style={[styles.sliderThumb, animatedStyle]}><Text style={{color: '#fff', fontSize: 20, fontWeight: 'bold'}}>→</Text></Animated.View>
              </GestureDetector>
              <Text style={styles.sliderLabel}>⚠️ SLIDE FOR EMERGENCY UPLINK</Text>
            </View>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 22 },
  sideLightLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  sideLightRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 5 },
  header: { marginTop: 10, marginBottom: 15 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  subStatus: { color: '#00d4ff', fontSize: 10, fontWeight: 'bold', marginRight: 10 },
  coordText: { color: '#444', fontSize: 10, fontFamily: 'monospace' },
  glassContainerMap: { height: MAP_FRAME_HEIGHT, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0, 212, 255, 0.4)' },
  map: { flex: 1 },
  scannerBeam: { position: 'absolute', width: '100%', height: 4, backgroundColor: '#00d4ff' },
  sectionLabel: { color: '#00d4ff', fontSize: 9, fontWeight: 'bold', marginTop: 18, marginBottom: 6, letterSpacing: 2 },
  glassMetrics: { flexDirection: 'row', backgroundColor: 'rgba(10, 25, 45, 0.7)', borderRadius: 15, borderWidth: 1.2, borderColor: 'rgba(0, 212, 255, 0.3)', height: 65 },
  metricItem: { flex: 1, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(0, 212, 255, 0.1)' },
  mLabel: { color: '#555', fontSize: 8, fontWeight: 'bold' },
  mVal: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  glassBtn: { width: '48%', height: 65, backgroundColor: 'rgba(0, 40, 80, 0.4)', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0, 212, 255, 0.3)' },
  activeGlass: { borderColor: '#00d4ff', backgroundColor: 'rgba(0, 60, 120, 0.5)' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  glassTerminal: { flex: 1, backgroundColor: 'rgba(5, 15, 30, 0.85)', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.2)', marginBottom: 20 },
  termText: { color: '#00d4ff', fontSize: 11, fontFamily: 'monospace', marginBottom: 5, opacity: 0.7 },
  sliderContainer: { marginBottom: 20 },
  sliderTrackGlass: { height: 75, backgroundColor: 'rgba(15, 15, 15, 0.95)', borderRadius: 40, justifyContent: 'center', padding: 5, borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.1)' },
  laserFill: { position: 'absolute', height: 65, backgroundColor: 'rgba(255, 0, 0, 0.3)', borderRadius: 35, left: 5 },
  sliderThumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE/2, backgroundColor: '#f33', justifyContent: 'center', alignItems: 'center' },
  sliderLabel: { position: 'absolute', width: '100%', textAlign: 'center', color: '#333', fontSize: 9, fontWeight: 'bold' },
  radarWrapper: { alignItems: 'center', justifyContent: 'center', width: 160, height: 160 },
  radarCircle: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, backgroundColor: 'transparent' },
  markerCore: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  locateButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  markerInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }
});