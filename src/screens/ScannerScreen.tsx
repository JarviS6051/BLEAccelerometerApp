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

			<View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10 }}>
				{ble.isScanning && (
					<View style={{ 
						backgroundColor: '#1e40af', 
						padding: 12, 
						borderRadius: 10, 
						marginBottom: 10,
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8
					}}>
						<Text style={{ color: '#93c5fd', fontWeight: '600' }}>🔍</Text>
						<Text style={{ color: '#93c5fd', fontWeight: '600' }}>
							Scanning for devices... ({ble.devices.length} found)
						</Text>
					</View>
				)}
				
				{ble.devices.length > 0 && (
					<Text style={{ 
						color: '#9ca3af', 
						marginBottom: 10, 
						fontSize: 14,
						fontWeight: '500'
					}}>
						Found {ble.devices.length} device{ble.devices.length !== 1 ? 's' : ''}:
					</Text>
				)}
				
				<FlatList
					style={{ flex: 1 }}
					keyboardShouldPersistTaps="always"
					data={ble.devices}
					keyExtractor={(d) => d.id}
					contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
					renderItem={({ item }) => (
						<DeviceListItem item={item as any} onPress={ble.connectTo} />
					)}
					ListEmptyComponent={
						<View style={{ alignItems: 'center', marginTop: 16 }}>
							<Text style={{ color: '#9ca3af', textAlign: 'center', marginBottom: 16 }}>
								{ble.isScanning ? 'Scanning for nearby devices...' : 'No devices found. Tap Scan to discover devices.'}
							</Text>
							<TouchableOpacity 
								onPress={() => ble.connectTo({ id: 'sample-device', name: 'Sample Accelerometer', isSample: true })} 
								style={{ 
									backgroundColor: '#22c55e',
									paddingHorizontal: 20,
									paddingVertical: 12,
									borderRadius: 10
								}}
							>
								<Text style={{ color: 'white', fontWeight: '700' }}>Use Sample Device</Text>
							</TouchableOpacity>
						</View>
					}
				/>
			</View>
		</View>
	);
};


