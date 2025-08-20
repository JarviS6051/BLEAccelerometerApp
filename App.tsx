import React from 'react';
import { SafeAreaView, StatusBar, View, Text } from 'react-native';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { DeviceScreen } from './src/screens/DeviceScreen';
import { useBle } from './src/ble/useBle';

export default function App() {
	const ble = useBle();

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
			<StatusBar barStyle="light-content" />
			<View style={{ padding: 16, paddingBottom: 8 }}>
				<Text style={{ color: 'white', fontSize: 24, fontWeight: '800' }}>BLE Accelerometer</Text>
				<Text style={{ color: '#cbd5e1' }}>Scan, connect, stream, record, and export CSV</Text>
			</View>

			{ble.isConnected ? (
				<DeviceScreen ble={ble} />
			) : (
				<ScannerScreen ble={ble} />
			)}
		</SafeAreaView>
	);
}