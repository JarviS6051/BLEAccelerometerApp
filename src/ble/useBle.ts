import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Share } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import RNFS from 'react-native-fs';
import { base64ToBytes, bytesToBase64 } from '../utils/base64';

const manager = new BleManager();

export type UiDevice = {
	id: string;
	name: string;
	isSample?: boolean;
	device?: Device;
};

export type Accel = { x: number; y: number; z: number };
export type AccelRow = { t: number; x: number; y: number; z: number };

const DEVICE_NAME_PREFIX = '';
const PAYLOAD_FORMAT: 'int16' | 'float32' = 'int16';

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
	const subscribingRef = useRef(false);
	const disconnectRequestedRef = useRef(false);
	const reconnectAttemptsRef = useRef(0);
	const connectionMonitorRef = useRef<{ remove: () => void } | null>(null);
	const shouldResumeStreamingRef = useRef(false);

	const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const mockStartEpochRef = useRef<number>(0);
	const recordingRef = useRef(false);
	const lastUiUpdateRef = useRef(0);

	function updateAccel(value: Accel) {
		// Throttle UI updates to ~30 Hz to keep UI responsive
		const now = Date.now();
		if (now - lastUiUpdateRef.current >= 33) {
			lastUiUpdateRef.current = now;
			setAccel(value);
		}
		if (recordingRef.current) {
			setRows(prev => [...prev, { t: Date.now(), x: value.x, y: value.y, z: value.z }]);
		}
	}

	useEffect(() => {
		recordingRef.current = recording;
	}, [recording]);

	useEffect(() => {
		return () => {
			// Keep manager alive across re-renders/fast refresh to avoid cancellations
			stopNotifications();
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
			const bleState = await manager.state();
			console.log('🔍 BLE State:', bleState);
			if (bleState !== 'PoweredOn') {
				setErrorText('Bluetooth is OFF. Please enable Bluetooth and try again.');
				return;
			}
			
			// Clear previous devices and start fresh
			setDevices([]);
			setIsScanning(true);
			setErrorText(null);
			
			let foundAny = false;
			let totalScanned = 0;
			let addedToUI = 0;
			let allDevices: any[] = [];

			console.log('🔍 Starting BLE scan...');
			manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
				if (error) {
					console.log('❌ Scan error:', error);
					setErrorText(String(error?.message ?? error));
					setIsScanning(false);
					return;
				}
				if (!device) return;

				totalScanned++;
				const dName = device.name ?? '(no name)';
				const dId = device.id;
				const rssi = device.rssi;
				console.log(`📱 Found device ${totalScanned}: "${dName}" (${dId}) RSSI: ${rssi}`);
				
				// Store all devices for debugging
				allDevices.push({ name: dName, id: dId, rssi });
				
				// Show ALL devices regardless of filter
				foundAny = true;
				setDevices(prev => {
					// Check if device already exists
					if (prev.some(d => d.id === device.id)) {
						console.log(`⏭️ Device already in list: "${dName}"`);
						return prev;
					}
					
					const ui: UiDevice = { 
						id: device.id, 
						name: device.name ?? '(no name)', 
						device 
					};
					console.log(`✅ Added to list: "${ui.name}" (total: ${prev.length + 1})`);
					addedToUI++;
					return [...prev, ui];
				});
			});

			setTimeout(() => {
				console.log(`🔍 Scan complete. Found ${totalScanned} total devices, added ${addedToUI} to UI`);
				console.log('📋 All discovered devices:', allDevices.map(d => `${d.name} (${d.id}) RSSI: ${d.rssi}`));
				stopScan();
				if (!foundAny) {
					console.log('⚠️ No devices found, showing sample device');
					setDevices([{ id: 'sample-device', name: 'Sample Accelerometer', isSample: true }]);
				}
			}, 15000); // 15 seconds scan duration
		} catch (e: any) {
			console.log('❌ Scan setup error:', e);
			setErrorText(e?.message ?? String(e));
			setIsScanning(false);
		}
	}, []);

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
			disconnectRequestedRef.current = false;
			reconnectAttemptsRef.current = 0;
			// Prefer autoConnect on Android for better stability
			const d = await manager.connectToDevice(item.device.id, { autoConnect: Platform.OS === 'android' });
			// small stabilization delay helps some devices
			await new Promise(r => setTimeout(r, 300));
			// Try to improve reliability on Android by increasing MTU and connection priority
			try {
				// @ts-ignore - available on Android
				await (d as any)?.requestMTU?.(185);
				// @ts-ignore - available on Android
				await (d as any)?.requestConnectionPriority?.(2); // CONNECTION_PRIORITY_HIGH
			} catch {}
			await d.discoverAllServicesAndCharacteristics();
			setConnected(d);
			setMockConnected(null);
			// monitor unexpected disconnections and attempt auto-reconnect
			try { connectionMonitorRef.current?.remove?.(); } catch {}
			connectionMonitorRef.current = manager.onDeviceDisconnected(d.id, async (error, dev) => {
				console.log('📴 Disconnected from device', dev?.id, error ? `error: ${String(error?.message ?? error)}` : '');
				if (disconnectRequestedRef.current) return;
				// Remember if we were streaming to resume later
				shouldResumeStreamingRef.current = isStreamingRef.current;
				isStreamingRef.current = false;
				// Backoff attempts
				const delays = [500, 1000, 2000, 4000, 8000];
				if (reconnectAttemptsRef.current >= delays.length) {
					setErrorText('Connection lost. Reconnect attempts exceeded.');
					return;
				}
				const attempt = reconnectAttemptsRef.current++;
				const delay = delays[attempt];
				console.log(`↻ Attempting reconnect #${attempt + 1} in ${delay}ms...`);
				setTimeout(async () => {
					try {
						const re = await manager.connectToDevice(item.device!.id, { autoConnect: Platform.OS === 'android' });
						await new Promise(r => setTimeout(r, 300));
						try {
							// @ts-ignore
							await (re as any)?.requestMTU?.(185);
							// @ts-ignore
							await (re as any)?.requestConnectionPriority?.(2);
						} catch {}
						await re.discoverAllServicesAndCharacteristics();
						setConnected(re);
						reconnectAttemptsRef.current = 0;
						console.log('✅ Reconnected');
						if (shouldResumeStreamingRef.current) {
							// give the stack a moment, then resume
							setTimeout(() => {
								startNotifications();
							}, 300);
						}
					} catch (e) {
						console.log('❌ Reconnect failed:', e);
						// will trigger next onDeviceDisconnected callback and schedule next retry
					}
				}, delay);
			});
		} catch (e: any) {
			setErrorText(e?.message ?? String(e));
		}
	}, [stopScan]);

	const disconnect = useCallback(async () => {
		try {
			disconnectRequestedRef.current = true;
			if (connected) await manager.cancelDeviceConnection(connected.id);
		} catch {}
		setConnected(null);
		setMockConnected(null);
		stopNotifications();
		setAccel(null);
		setRecording(false);
		try { connectionMonitorRef.current?.remove?.(); } catch {}
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
							notifiable: (c as any).isNotifiable || (c as any).isIndicatable || false,
							readable: c.isReadable,
							writable: c.isWritableWithResponse || c.isWritableWithoutResponse,
						};
						console.log(`  CHAR: ${c.uuid}`, props, props.notifiable ? '⭐ notifiable' : '');
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

	const parseAccel = (bytes: Uint8Array): Accel => {
		console.log('🔍 Parsing bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
		// Helpers
		const toFloat32 = (off: number, le: boolean) => {
			const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			return [dv.getFloat32(off, le), dv.getFloat32(off + 4, le), dv.getFloat32(off + 8, le)];
		};
		const toInt16Triplet = (b: Uint8Array, off: number, le: boolean) => {
			const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
			return [dv.getInt16(off, le), dv.getInt16(off + 2, le), dv.getInt16(off + 4, le)];
		};
		const normalizeInt16 = (xyz: number[]) => {
			const divisors = [16384, 8192, 4096, 2048]; // ±2g, ±4g, ±8g, ±16g
			for (const d of divisors) {
				const [x, y, z] = xyz.map(v => v / d);
				// choose first scale that yields reasonable range
				if ([x, y, z].every(v => Number.isFinite(v) && Math.abs(v) <= 32)) return { x, y, z };
			}
			const [x, y, z] = xyz.map(v => v / 16384);
			return { x, y, z };
		};

		// 1) Float32 triplet LE then BE
		if (bytes.byteLength >= 12) {
			try {
				let [x, y, z] = toFloat32(0, true);
				if (x || y || z) { console.log('✅ float32 LE'); return { x, y, z }; }
				[x, y, z] = toFloat32(0, false);
				if (x || y || z) { console.log('✅ float32 BE'); return { x, y, z }; }
			} catch {}
		}

		// 2) Int16 triplet from start (LE, then BE)
		if (bytes.byteLength >= 6) {
			try {
				let raw = toInt16Triplet(bytes, 0, true);
				if (raw.some(v => v !== 0)) { const v = normalizeInt16(raw); console.log('✅ int16 LE @0', raw, v); return v; }
				raw = toInt16Triplet(bytes, 0, false);
				if (raw.some(v => v !== 0)) { const v = normalizeInt16(raw); console.log('✅ int16 BE @0', raw, v); return v; }
			} catch {}
		}

		// 3) Int16 triplet from last 6 bytes
		if (bytes.byteLength >= 6) {
			try {
				const tail = bytes.slice(bytes.byteLength - 6);
				let raw = toInt16Triplet(tail, 0, true);
				if (raw.some(v => v !== 0)) { const v = normalizeInt16(raw); console.log('✅ int16 LE tail', raw, v); return v; }
				raw = toInt16Triplet(tail, 0, false);
				if (raw.some(v => v !== 0)) { const v = normalizeInt16(raw); console.log('✅ int16 BE tail', raw, v); return v; }
			} catch {}
		}

		// 4) Heuristic: 2-byte header then 3x int16
		if (bytes.byteLength >= 8) {
			try {
				let raw = toInt16Triplet(bytes, 2, true);
				if (raw.some(v => v !== 0)) { const v = normalizeInt16(raw); console.log('✅ int16 LE @2', raw, v); return v; }
				raw = toInt16Triplet(bytes, 2, false);
				if (raw.some(v => v !== 0)) { const v = normalizeInt16(raw); console.log('✅ int16 BE @2', raw, v); return v; }
			} catch {}
		}

		// 5) Fallback to byte triples
		if (bytes.byteLength >= 3) {
			const sx = bytes[0] > 127 ? bytes[0] - 256 : bytes[0];
			const sy = bytes[1] > 127 ? bytes[1] - 256 : bytes[1];
			const sz = bytes[2] > 127 ? bytes[2] - 256 : bytes[2];
			if (sx || sy || sz) { const v = { x: sx / 128, y: sy / 128, z: sz / 128 }; console.log('✅ signed bytes', { sx, sy, sz }, v); return v; }
			const ux = bytes[0], uy = bytes[1], uz = bytes[2];
			if (ux || uy || uz) { const v = { x: (ux - 128) / 128, y: (uy - 128) / 128, z: (uz - 128) / 128 }; console.log('✅ unsigned bytes', { ux, uy, uz }, v); return v; }
		}

		console.log('❌ All parsing attempts resulted in zeros or failed');
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
			updateAccel({ x, y, z });
		}, 100);
	}, []);

	const stopMock = useCallback(() => {
		if (mockTimerRef.current) {
			clearInterval(mockTimerRef.current);
			mockTimerRef.current = null;
		}
	}, []);

	const trySubscribeOnce = useCallback(async (device: Device, svcUuid: string, charUuid: string, charsInSvc: any[]) => {
		// Returns true if at least one notification arrives within timeout, otherwise false
		return await new Promise<boolean>((resolve) => {
			let gotMeaningful = false;
			let cleaned = false;
			const onCleanup = () => {
				if (!cleaned) {
					cleaned = true;
					tempSub?.remove?.();
				}
			};

			const tempSub = device.monitorCharacteristicForService(
				svcUuid,
				charUuid,
				(error, characteristic) => {
					if (error) {
						const msg = String(error?.message ?? error);
						if (msg.includes('Operation was cancelled')) {
							console.log('Monitor cancelled during attempt.');
							return;
						}
						console.log('Monitor error on attempt:', error);
						return;
					}
					if (!characteristic?.value) return;
					const bytes = base64ToBytes(characteristic.value);
					// Treat all-zero payloads as not meaningful so we can try other candidates
					const isAllZero = bytes.length > 0 && bytes.every(b => b === 0);
					if (isAllZero) {
						console.log('Received all-zero payload; waiting for meaningful data...');
						return;
					}
					const v = parseAccel(bytes);
					updateAccel(v);
					if (!gotMeaningful) {
						gotMeaningful = true;
						// Promote this temp subscription to active one and stop timeout cleanup
						subscriptionRef.current?.remove?.();
						subscriptionRef.current = tempSub as any;
						isStreamingRef.current = true;
						resolve(true);
					}
				},
			);

			// Try sending a burst of common opcodes to all writers in this service
			const writers = charsInSvc.filter(c => c.isWritableWithResponse || c.isWritableWithoutResponse);
			const opcodes = [1, 2, 255, 0];
			if (writers.length > 0) {
				let delay = 0;
				for (const op of opcodes) {
					for (const w of writers) {
						const b64 = bytesToBase64(new Uint8Array([op]));
						setTimeout(() => {
							(device as any)[w.isWritableWithoutResponse ? 'writeCharacteristicWithoutResponseForService' : 'writeCharacteristicWithResponseForService'](
								svcUuid,
								w.uuid,
								b64,
							).then(() => console.log(`▶️ Sent start command 0x${op.toString(16)} to ${w.uuid}`)).catch((e: any) => console.log('Start command write failed (non-fatal):', e));
						}, delay);
					}
					// 250ms gap between bursts
					delay += 250;
				}
			}

			// If no meaningful data arrives within 8000ms, consider this a miss
			setTimeout(() => {
				if (!gotMeaningful) {
					onCleanup();
					resolve(false);
				}
			}, 8000);
		});
	}, []);

	const subscribeAuto = useCallback(async (device: Device) => {
		try {
			const services = await device.services();
			console.log('🔍 Auto-discovering notifiable/indicatable characteristics...');
			// Build a list of candidate pairs (service, char) with preference scoring
			const candidates: Array<{ svc: string; chr: string; score: number; chars: any[] }> = [];
			for (const service of services) {
				let chars: any[] = [];
				try {
					chars = await device.characteristicsForService(service.uuid);
				} catch (e) {
					continue;
				}
				const svcLower = service.uuid.toLowerCase();
				// Skip common GAP/GATT/DeviceInfo/HID/Battery services that are unlikely to be our data stream
				const skipServices = ['00001800', '00001801', '0000180a', '00001812', '0000180f'];
				if (skipServices.some(s => svcLower.includes(s))) {
					continue;
				}
				const hasWritable = chars.some(c => c.isWritableWithResponse || c.isWritableWithoutResponse);
				for (const c of chars) {
					const noti = (c as any).isNotifiable || (c as any).isIndicatable || false;
					if (!noti) continue;
					let score = 0;
					if (hasWritable) score += 2;
					const u = c.uuid.toLowerCase();
					// Skip known system chars
					const skipChars = ['00002a05', '00002a22', '00002a4d'];
					if (skipChars.some(s => u.includes(s))) {
						continue;
					}
					// Prefer vendor-specific or common sensor notifications
					if (u.includes('ff') || u.includes('fe') || u.includes('fee1') || u.includes('fee3') || u.includes('2a37')) score += 1;
					candidates.push({ svc: service.uuid, chr: c.uuid, score, chars });
				}
			}
			candidates.sort((a, b) => b.score - a.score);
			console.log('Candidates (best first):', candidates.map(c => `${c.chr}@${c.svc}[${c.score}]`).join(', '));

			for (const cand of candidates) {
				// Cancel any lingering subscription before trying
				subscriptionRef.current?.remove?.();
				subscriptionRef.current = null;
				const ok = await trySubscribeOnce(device, cand.svc, cand.chr, cand.chars);
				if (ok) {
					console.log(`✅ Subscribed successfully to ${cand.chr}`);
					return true;
				}
				console.log(`Skipping ${cand.chr}, no data within timeout`);
			}
			return false;
		} catch (e) {
			console.error('❌ Auto-discovery error:', e);
			return false;
		}
	}, [trySubscribeOnce]);

	const startNotifications = useCallback(async () => {
		if (isStreamingRef.current || subscribingRef.current) return;
		subscribingRef.current = true;

		if (mockConnected) {
			startMock();
			isStreamingRef.current = true;
			subscribingRef.current = false;
			return;
		}
		if (!connected) {
			setErrorText('Not connected. Connect to a device first.');
			subscribingRef.current = false;
			return;
		}

		try {
			// ensure no previous monitor is active
			subscriptionRef.current?.remove?.();
			subscriptionRef.current = null;
			// slight delay to let stack settle
			await new Promise(r => setTimeout(r, 200));
			await connected.discoverAllServicesAndCharacteristics();
			const success = await subscribeAuto(connected);
			if (!success) {
				setErrorText('No notifiable characteristics produced data.');
				isStreamingRef.current = false;
			}
		} catch (e: any) {
			setErrorText(e?.message ?? String(e));
			isStreamingRef.current = false;
		} finally {
			subscribingRef.current = false;
		}
	}, [connected, mockConnected, startMock, subscribeAuto]);

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

	const sendStartCommand = useCallback(async (opcode: number = 1) => {
		if (!connected) {
			setErrorText('Not connected to a device.');
			return;
		}
		
		try {
			const services = await connected.services();
			for (const service of services) {
				const chars = await connected.characteristicsForService(service.uuid);
				const writer = chars.find(c => c.isWritableWithResponse || c.isWritableWithoutResponse);
				if (writer) {
					const payload = new Uint8Array([opcode]);
					const payloadB64 = bytesToBase64(payload);
					try {
						if (writer.isWritableWithoutResponse) {
						await connected.writeCharacteristicWithoutResponseForService(
							service.uuid,
							writer.uuid,
							payloadB64,
						);
						} else {
							await connected.writeCharacteristicWithResponseForService(
							service.uuid,
							writer.uuid,
							payloadB64,
						);
						}
					} catch (err: any) {
						const msg = err?.message ?? String(err);
						setErrorText(`Start command failed: ${msg}${msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('insufficient') ? ' • Device may require pairing. Pair it in system Bluetooth settings, then reconnect.' : ''}`);
						return;
					}
					console.log(`▶️ Sent start command 0x${opcode.toString(16)} to ${writer.uuid} in ${service.uuid}`);
					return;
				}
			}
			setErrorText('No writable characteristics found. The device may require pairing. Pair it in Bluetooth settings, then reconnect.');
		} catch (e: any) {
			const msg = e?.message ?? String(e);
			setErrorText(`Start command failed: ${msg}${msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('insufficient') ? ' • Device may require pairing. Pair it in Bluetooth settings, then reconnect.' : ''}`);
		}
	}, [connected]);

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
		sendStartCommand,
	};
}


