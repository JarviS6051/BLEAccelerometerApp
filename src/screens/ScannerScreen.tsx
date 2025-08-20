import React from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useBle } from '../ble/useBle';
import { DeviceListItem } from '../components/DeviceListItem';

type Props = { ble: ReturnType<typeof useBle> };

export const ScannerScreen: React.FC<Props> = ({ ble }) => {
	return (
		<View style={{ flex: 1 }}>
			<View style={{ paddingHorizontal: 16, gap: 12 }}>
				<View
					style={{
						backgroundColor: '#111827',
						borderRadius: 14,
						padding: 12,
						borderWidth: 1,
						borderColor: '#1f2937',
						gap: 10,
						zIndex: 2,
						elevation: 1,
					}}
				>
					<View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
						<TextInput
							placeholder="Filter by device name prefix"
							placeholderTextColor="#9ca3af"
							value={ble.filter}
							onChangeText={ble.setFilter}
							style={{
								flex: 1,
								borderWidth: 1,
								borderColor: '#374151',
								paddingHorizontal: 12,
								paddingVertical: 10,
								borderRadius: 10,
								color: 'white',
							}}
						/>
						<TouchableOpacity
							onPress={ble.isScanning ? ble.stopScan : ble.startScan}
							style={{
								backgroundColor: ble.isScanning ? '#ef4444' : '#22c55e',
								paddingHorizontal: 16,
								paddingVertical: 12,
								borderRadius: 10,
							}}
						>
							<Text style={{ color: 'white', fontWeight: '700' }}>
								{ble.isScanning ? 'Stop' : 'Scan'}
							</Text>
						</TouchableOpacity>
					</View>
					<Text style={{ color: '#9ca3af' }}>
						{ble.isScanning ? 'Scanning…' : 'Tap Scan to discover nearby devices'}
					</Text>
					{ble.error && (
						<Text style={{ color: '#f87171' }} onPress={ble.clearError}>
							{ble.error} (tap to dismiss)
						</Text>
					)}
				</View>
			</View>

			<FlatList
				style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10 }}
				keyboardShouldPersistTaps="always"
				data={
					ble.devices.length > 0
						? ble.devices
						: [{ id: 'sample-device', name: 'Sample Accelerometer', isSample: true }]
				}
				keyExtractor={(d) => d.id}
				contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
				renderItem={({ item }) => (
					<DeviceListItem item={item as any} onPress={ble.connectTo} />
				)}
				ListEmptyComponent={
					<View style={{ alignItems: 'center', marginTop: 16 }}>
						<Text style={{ color: '#9ca3af' }}>{ble.isScanning ? 'Scanning…' : 'No devices found.'}</Text>
						<TouchableOpacity onPress={() => ble.connectTo({ id: 'sample-device', name: 'Sample Accelerometer', isSample: true })} style={{ padding: 10 }}>
							<Text style={{ color: '#22c55e', fontWeight: '700' }}>Use Sample Device</Text>
						</TouchableOpacity>
					</View>
				}
			/>
		</View>
	);
};


