import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  FlatList,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Linking,
} from 'react-native';
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import RNFS from 'react-native-fs';

const manager = new BleManager();

/**
 * ===== Replace these on interview day =====
 * If you don't know them, set ACCEL_SERVICE_UUID/ACCEL_CHAR_UUID to null,
 * connect, and press "Discover & Log Services" to print everything to Console.
 * Then copy the right UUIDs here and restart the app.
 */
const ACCEL_SERVICE_UUID: string | null = 'YOUR_SERVICE_UUID';         // e.g. '0000181a-0000-1000-8000-00805f9b34fb'
const ACCEL_CHAR_UUID: string | null = 'YOUR_CHARACTERISTIC_UUID';     // e.g. '00002a58-0000-1000-8000-00805f9b34fb'

// Optional: filter by device name/prefix so the list is cleaner
const DEVICE_NAME_PREFIX = 'Accel'; // change or set '' to show all

// Choose how firmware packs X/Y/Z
const PAYLOAD_FORMAT: 'int16' | 'float32' = 'int16'; // switch to 'float32' if needed

type AccelRow = {
  t: number; // epoch ms
  x: number;
  y: number;
  z: number;
};

export default function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [connected, setConnected] = useState<Device | null>(null);
  const [accel, setAccel] = useState<{ x: number; y: number; z: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [rows, setRows] = useState<AccelRow[]>([]);
  const [nameFilter, setNameFilter] = useState(DEVICE_NAME_PREFIX);

  const devicesArr = useMemo(() => Object.values(devices), [devices]);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      manager.destroy();
    };
  }, []);

  // --- Permissions (Android) ---
  async function ensurePermissions() {
    if (Platform.OS === 'android') {
      const api = Platform.Version as number;

      if (api >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          'android.permission.BLUETOOTH_SCAN',
          'android.permission.BLUETOOTH_CONNECT',
        ] as any);
        const ok = Object.values(results).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
        if (!ok) throw new Error('Bluetooth permissions denied');
      } else {
        const fine = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Location permission denied');
        }
      }
    } else {
      // iOS permission (optional – iOS prompts automatically on first use)
      const res = await check(PERMISSIONS.IOS.BLUETOOTH);
      if (res !== RESULTS.GRANTED) {
        await request(PERMISSIONS.IOS.BLUETOOTH);
      }
    }
  }

  // --- Scan ---
  const startScan = async () => {
    try {
      await ensurePermissions();
      setDevices({});
      setIsScanning(true);

      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          console.error('scan error', error);
          setIsScanning(false);
          return;
        }
        if (!device) return;

        const dName = device.name ?? '';
        const passesFilter =
          !nameFilter || dName.toLowerCase().startsWith(nameFilter.toLowerCase());

        if (passesFilter) {
          setDevices(prev => (prev[device.id] ? prev : { ...prev, [device.id]: device }));
        }
      });

      // Auto stop after 10 seconds
      setTimeout(stopScan, 10000);
    } catch (e: any) {
      Alert.alert('Scan error', e?.message ?? String(e));
    }
  };

  const stopScan = () => {
    manager.stopDeviceScan();
    setIsScanning(false);
  };

  // --- Connect ---
  const connectTo = async (device: Device) => {
    try {
      stopScan();
      const d = await manager.connectToDevice(device.id, { autoConnect: false });
      await d.discoverAllServicesAndCharacteristics();
      setConnected(d);
      Alert.alert('Connected', d.name || d.id);
    } catch (e: any) {
      Alert.alert('Connect error', e?.message ?? String(e));
    }
  };

  const disconnect = async () => {
    try {
      if (connected) {
        await manager.cancelDeviceConnection(connected.id);
      }
    } catch {}
    setConnected(null);
    setAccel(null);
    setRecording(false);
  };

  // --- Discover & log UUIDs (when you don't know them) ---
  const logServices = async () => {
    if (!connected) return;
    try {
      const services = await connected.services();
      for (const s of services) {
        const chars = await connected.characteristicsForService(s.uuid);
        console.log('SERVICE', s.uuid);
        for (const c of chars) {
          console.log('  CHAR', c.uuid, ' props=', {
            notifiable: c.isNotifiable,
            readable: c.isReadable,
            writable: c.isWritableWithResponse || c.isWritableWithoutResponse,
          });
        }
      }
      Alert.alert('Check Metro logs', 'Services & characteristics printed to console.');
    } catch (e: any) {
      Alert.alert('Discover error', e?.message ?? String(e));
    }
  };

  // --- Subscribe to accelerometer notifications ---
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);

  const startAccel = async () => {
    if (!connected) return;

    try {
      if (!ACCEL_SERVICE_UUID || !ACCEL_CHAR_UUID) {
        Alert.alert(
          'UUIDs missing',
          'Set ACCEL_SERVICE_UUID and ACCEL_CHAR_UUID at the top of App.tsx or use "Discover & Log Services" to find them.',
        );
        return;
      }

      // Ensure discovered
      await connected.discoverAllServicesAndCharacteristics();

      // Subscribe
      subscriptionRef.current = connected.monitorCharacteristicForService(
        normalizeUuid(ACCEL_SERVICE_UUID),
        normalizeUuid(ACCEL_CHAR_UUID),
        (error, char) => {
          if (error) {
            console.error('Notify error', error);
            return;
          }
          if (!char?.value) return;

          const bytes = base64ToBytes(char.value);
          const { x, y, z } = parseAccel(bytes);
          setAccel({ x, y, z });

          if (recording) {
            setRows(prev => [...prev, { t: Date.now(), x, y, z }]);
          }
        },
      );

      Alert.alert('Subscribed', 'Receiving accelerometer values…');
    } catch (e: any) {
      Alert.alert('Subscribe error', e?.message ?? String(e));
    }
  };

  const stopAccel = () => {
    subscriptionRef.current?.remove?.();
    subscriptionRef.current = null;
  };

  // --- Recording ---
  const toggleRecording = () => {
    if (!accel && !recording) {
      Alert.alert('No data yet', 'Connect and start notifications first.');
      return;
    }
    setRecording(r => !r);
  };

  const clearRecording = () => setRows([]);

  const exportCsv = async () => {
    try {
      const header = 'timestamp_ms,x,y,z\n';
      const body = rows.map(r => `${r.t},${r.x},${r.y},${r.z}`).join('\n');
      const csv = header + body + '\n';
      const path = `${RNFS.DownloadDirectoryPath}/accel_${Date.now()}.csv`;
      await RNFS.writeFile(path, csv, 'utf8');
      Alert.alert('Saved', `CSV saved to:\n${path}`, [
        { text: 'Open Folder', onPress: () => Linking.openSettings() },
        { text: 'OK' },
      ]);
    } catch (e: any) {
      Alert.alert('Export error', e?.message ?? String(e));
    }
  };

  // --- Helpers ---
  function base64ToBytes(b64: string): Uint8Array {
    const bin = global.atob ? global.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function parseAccel(bytes: Uint8Array): { x: number; y: number; z: number } {
    if (PAYLOAD_FORMAT === 'float32' && bytes.byteLength >= 12) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const x = dv.getFloat32(0, true);
      const y = dv.getFloat32(4, true);
      const z = dv.getFloat32(8, true);
      return { x, y, z };
    }
    // default int16[3]
    if (bytes.byteLength >= 6) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const x = dv.getInt16(0, true);
      const y = dv.getInt16(2, true);
      const z = dv.getInt16(4, true);
      // Scale factor may vary by firmware; adjust if needed
      return { x: x / 16384, y: y / 16384, z: z / 16384 };
    }
    return { x: 0, y: 0, z: 0 };
  }

  function normalizeUuid(u: string) {
    // accepts short UUIDs like '2A58' or full 128-bit UUIDs
    const s = u.toLowerCase();
    if (s.length === 4 || s.length === 8) {
      return `0000${s.slice(0, 4)}-0000-1000-8000-00805f9b34fb`;
    }
    return u;
  }

  // --- UI ---
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>BLE Accelerometer</Text>

      {!connected && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            placeholder="Filter by device name prefix"
            value={nameFilter}
            onChangeText={setNameFilter}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#ccc',
              padding: 8,
              borderRadius: 8,
            }}
          />
          <Button title={isScanning ? 'Stop' : 'Scan'} onPress={isScanning ? stopScan : startScan} />
        </View>
      )}

      {!connected && (
        <FlatList
          data={devicesArr}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => connectTo(item)}
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                padding: 12,
                borderRadius: 10,
              }}
            >
              <Text style={{ fontWeight: '600' }}>{item.name ?? '(no name)'}</Text>
              <Text selectable>{item.id}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ color: '#777' }}>
              {isScanning ? 'Scanning…' : 'No devices. Tap Scan.'}
            </Text>
          }
        />
      )}

      {connected && (
        <View style={{ gap: 10 }}>
          <Text style={{ fontWeight: '600' }}>
            Connected: {connected.name ?? connected.id}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button title="Discover & Log Services" onPress={logServices} />
            <Button title="Start Notifications" onPress={startAccel} />
            <Button title="Stop Notifications" onPress={stopAccel} />
            <Button title="Disconnect" onPress={disconnect} />
          </View>

          <View style={{ marginTop: 8, padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10 }}>
            <Text style={{ fontWeight: '700', marginBottom: 6 }}>Current Accel</Text>
            <Text>X: {accel ? accel.x.toFixed(4) : '--'}</Text>
            <Text>Y: {accel ? accel.y.toFixed(4) : '--'}</Text>
            <Text>Z: {accel ? accel.z.toFixed(4) : '--'}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button title={recording ? 'Stop Recording' : 'Start Recording'} onPress={toggleRecording} />
            <Button title="Clear" onPress={clearRecording} />
            <Button title="Export CSV" onPress={exportCsv} />
          </View>

          <Text style={{ color: '#777' }}>
            Recorded rows: {rows.length}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
