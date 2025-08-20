import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Share } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import RNFS from 'react-native-fs';
import { base64ToBytes } from '../utils/base64';

const manager = new BleManager();

export type UiDevice = {
	id: string;
	name: string;
	isSample?: boolean;
	device?: Device;
};

export type Accel = { x: number; y: number; z: number };
export type AccelRow = { t: number; x: number; y: number; z: number };

const DEVICE_NAME_PREFIX = 'Accel';
const PAYLOAD_FORMAT: 'int16' | 'float32' = 'int16';

// Replace on interview day
const ACCEL_SERVICE_UUID: string | null = 'YOUR_SERVICE_UUID';
const ACCEL_CHAR_UUID: string | null = 'YOUR_CHARACTERISTIC_UUID';

export function useBle() {
	const [isScanning, setIsScanning] = useState(false);
	const [devices, setDevices] = useState<UiDevice[]>([]);
	const [filter, setFilter] = useState(DEVICE_NAME_PREFIX);

	const [connected, setConnected] = useState<Device | null>(null);
	const [mockConnected, setMockConnected] = useState<UiDevice | null>(null);
	const isConnected = !!connected || !!mockConnected;

	const [accel, setAccel] = useState<Accel | null>(null);
	const [recording, setRecording] = useState(false);
	const [rows, setRows] = useState<AccelRow[]>([]);
	const [errorText, setErrorText] = useState<string | null>(null);

	const isStreamingRef = useRef(false);
	const subscriptionRef = useRef<{ remove: () => void } | null>(null);

	const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const mockStartEpochRef = useRef<number>(0);
	const recordingRef = useRef(false);

	useEffect(() => {
		recordingRef.current = recording;
	}, [recording]);

	useEffect(() => {
		return () => {
			stopNotifications();
			manager.destroy();
		};
	}, []);

	const uiDevices = useMemo(() => devices, [devices]);

	async function ensurePermissions() {
		if (Platform.OS !== 'android') return;
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
	}

	const startScan = useCallback(async () => {
		try {
			await ensurePermissions();
			setDevices([]);
			setIsScanning(true);
			let foundAny = false;

			manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
				if (error) {
					setErrorText(String(error?.message ?? error));
					setIsScanning(false);
					return;
				}
				if (!device) return;

				const dName = device.name ?? '';
				const passes =
					!filter || dName.toLowerCase().startsWith(filter.toLowerCase());

				if (passes) {
					foundAny = true;
					setDevices(prev => {
						if (prev.some(d => d.id === device.id)) return prev;
						const ui: UiDevice = { id: device.id, name: device.name ?? '(no name)', device };
						return [...prev, ui];
					});
				}
			});

			setTimeout(() => {
				stopScan();
				if (!foundAny) {
					setDevices([{ id: 'sample-device', name: 'Sample Accelerometer', isSample: true }]);
				}
			}, 8000);
		} catch (e: any) {
			setErrorText(e?.message ?? String(e));
			setIsScanning(false);
		}
	}, [filter]);

	const stopScan = useCallback(() => {
		manager.stopDeviceScan();
		setIsScanning(false);
	}, []);

	const connectTo = useCallback(async (item: UiDevice) => {
		try {
			stopScan();
			if (item.isSample) {
				setMockConnected(item);
				setConnected(null);
				return;
			}
			if (!item.device) throw new Error('Invalid device');
			const d = await manager.connectToDevice(item.device.id, { autoConnect: false });
			await d.discoverAllServicesAndCharacteristics();
			setConnected(d);
			setMockConnected(null);
		} catch (e: any) {
			setErrorText(e?.message ?? String(e));
		}
	}, [stopScan]);

	const disconnect = useCallback(async () => {
		try {
			if (connected) await manager.cancelDeviceConnection(connected.id);
		} catch {}
		setConnected(null);
		setMockConnected(null);
		stopNotifications();
		setAccel(null);
		setRecording(false);
	}, [connected]);

	const logServices = useCallback(async () => {
		if (mockConnected) {
			setErrorText('Sample device has no GATT services. Use a real device to discover UUIDs.');
			return;
		}
		if (!connected) {
			setErrorText('Not connected. Connect to a device first.');
			return;
		}

		try {
			const services = await connected.services();
			console.log('=== DISCOVERED SERVICES ===');
			for (const s of services) {
				console.log(`SERVICE: ${s.uuid}`);
				try {
					const chars = await connected.characteristicsForService(s.uuid);
					for (const c of chars) {
						const props = {
							notifiable: c.isNotifiable,
							readable: c.isReadable,
							writable: c.isWritableWithResponse || c.isWritableWithoutResponse,
						};
						console.log(`  CHAR: ${c.uuid}`, props, c.isNotifiable ? '⭐ notifiable' : '');
					}
				} catch (err) {
					console.log('  Error loading characteristics', err);
				}
			}
			console.log('=== END SERVICES ===');
		} catch (e: any) {
			setErrorText(e?.message ?? String(e));
		}
	}, [connected, mockConnected]);

	const normalizeUuid = (u: string) => {
		const s = u.toLowerCase();
		if (s.length === 4 || s.length === 8) {
			return `0000${s.slice(0, 4)}-0000-1000-8000-00805f9b34fb`;
		}
		return u;
	};

	const parseAccel = (bytes: Uint8Array): Accel => {
		if (PAYLOAD_FORMAT === 'float32' && bytes.byteLength >= 12) {
			const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			return { x: dv.getFloat32(0, true), y: dv.getFloat32(4, true), z: dv.getFloat32(8, true) };
		}
		if (bytes.byteLength >= 6) {
			const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			const x = dv.getInt16(0, true);
			const y = dv.getInt16(2, true);
			const z = dv.getInt16(4, true);
			return { x: x / 16384, y: y / 16384, z: z / 16384 };
		}
		return { x: 0, y: 0, z: 0 };
	};

	const startMock = useCallback(() => {
		if (mockTimerRef.current) return;
		mockStartEpochRef.current = Date.now();
		mockTimerRef.current = setInterval(() => {
			const t = (Date.now() - mockStartEpochRef.current) / 1000;
			const x = Math.sin(t * 1.2) * 0.9 + ((Math.random() - 0.5) * 0.04);
			const y = Math.cos(t * 0.9) * 0.8 + ((Math.random() - 0.5) * 0.04);
			const z = 0.98 + Math.sin(t * 0.5) * 0.1 + ((Math.random() - 0.5) * 0.04);
			setAccel({ x, y, z });
			if (recordingRef.current) {
				setRows(prev => [...prev, { t: Date.now(), x, y, z }]);
			}
		}, 100);
	}, []);

	const stopMock = useCallback(() => {
		if (mockTimerRef.current) {
			clearInterval(mockTimerRef.current);
			mockTimerRef.current = null;
		}
	}, []);

	const startNotifications = useCallback(async () => {
		if (isStreamingRef.current) return;

		if (mockConnected) {
			startMock();
			isStreamingRef.current = true;
			return;
		}
		if (!connected) {
			setErrorText('Not connected. Connect to a device first.');
			return;
		}
		if (!ACCEL_SERVICE_UUID || !ACCEL_CHAR_UUID) {
			setErrorText('Set ACCEL_SERVICE_UUID and ACCEL_CHAR_UUID at top of useBle.ts');
			return;
		}

		try {
			await connected.discoverAllServicesAndCharacteristics();
			subscriptionRef.current = connected.monitorCharacteristicForService(
				normalizeUuid(ACCEL_SERVICE_UUID),
				normalizeUuid(ACCEL_CHAR_UUID),
				(error, char) => {
					if (error) {
						setErrorText(String(error?.message ?? error));
						isStreamingRef.current = false;
						return;
					}
					if (!char?.value) return;
					const bytes = base64ToBytes(char.value);
					const v = parseAccel(bytes);
					setAccel(v);
					if (recordingRef.current) {
						setRows(prev => [...prev, { t: Date.now(), x: v.x, y: v.y, z: v.z }]);
					}
				},
			);
			isStreamingRef.current = true;
		} catch (e: any) {
			setErrorText(e?.message ?? String(e));
			isStreamingRef.current = false;
		}
	}, [connected, mockConnected, startMock]);

	const stopNotifications = useCallback(() => {
		subscriptionRef.current?.remove?.();
		subscriptionRef.current = null;
		stopMock();
		isStreamingRef.current = false;
	}, [stopMock]);

	const toggleRecording = useCallback(() => {
		if (!accel && !recording) {
			setErrorText('Start notifications first to receive data.');
			return;
		}
		setRecording(r => !r);
	}, [accel, recording]);

	const clearRecording = useCallback(() => {
		if (rows.length === 0) return;
		setRows([]);
	}, [rows.length]);

	const exportCsv = useCallback(async () => {
		if (rows.length === 0) {
			setErrorText('No recorded data to export.');
			return;
		}
		try {
			const header = 'timestamp_ms,x,y,z\n';
			const body = rows.map(r => `${r.t},${r.x},${r.y},${r.z}`).join('\n');
			const csv = header + body + '\n';
			const path = `${RNFS.DocumentDirectoryPath}/accel_${Date.now()}.csv`;
			await RNFS.writeFile(path, csv, 'utf8');

			await Share.share({
				title: 'Accelerometer CSV',
				message: Platform.OS === 'android' ? 'CSV saved. Share or open with a compatible app.' : '',
				url: Platform.OS === 'ios' ? path : `file://${path}`,
			});
		} catch (e: any) {
			setErrorText(e?.message ?? String(e));
		}
	}, [rows]);

	const error = errorText;
	const clearError = () => setErrorText(null);

	return {
		// state
		isScanning,
		devices: uiDevices,
		filter, setFilter,
		isConnected,
		connectedName: mockConnected ? mockConnected.name : (connected?.name ?? connected?.id ?? ''),
		accel,
		recording,
		rows,
		streaming: isStreamingRef.current,
		error, clearError,

		// actions
		startScan, stopScan,
		connectTo, disconnect,
		logServices,
		startNotifications, stopNotifications,
		toggleRecording, clearRecording, exportCsv,
	};
}


