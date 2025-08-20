import React from 'react';
import { View, Text } from 'react-native';
import { useBle } from '../ble/useBle';
import { PrimaryButton } from '../components/PrimaryButton';

type Props = { ble: ReturnType<typeof useBle> };

export const DeviceScreen: React.FC<Props> = ({ ble }) => {
	return (
		<View style={{ flex: 1, padding: 16, gap: 12 }}>
			<View
				style={{
					backgroundColor: '#111827',
					padding: 14,
					borderRadius: 14,
					borderWidth: 1,
					borderColor: '#1f2937',
					gap: 10,
				}}
			>
				<Text style={{ color: 'white', fontWeight: '800' }}>
					Connected: {ble.connectedName}
				</Text>

				<View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
					<View style={{
						backgroundColor: ble.streaming ? '#059669' : '#6b7280',
						paddingHorizontal: 8,
						paddingVertical: 4,
						borderRadius: 6
					}}>
						<Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
							{ble.streaming ? '🟢 Streaming' : '⚪ Not Streaming'}
						</Text>
					</View>
					<View style={{
						backgroundColor: ble.recording ? '#dc2626' : '#6b7280',
						paddingHorizontal: 8,
						paddingVertical: 4,
						borderRadius: 6
					}}>
						<Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
							{ble.recording ? '🔴 Recording' : '⚪ Not Recording'}
						</Text>
					</View>
				</View>

				<View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
					<PrimaryButton title="Discover & Log Services" onPress={ble.logServices} />
					<PrimaryButton
						title={ble.streaming ? "Stop Notifications" : "Start Notifications"}
						onPress={ble.streaming ? ble.stopNotifications : ble.startNotifications}
						active={ble.streaming}
					/>
					<PrimaryButton title="Disconnect" onPress={ble.disconnect} danger />
				</View>
				<View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
					<PrimaryButton title="Send Start (0x01)" onPress={() => ble.sendStartCommand(1)} />
					<PrimaryButton title="Send Start (0x02)" onPress={() => ble.sendStartCommand(2)} />
					<PrimaryButton title="Send Start (0xFF)" onPress={() => ble.sendStartCommand(255)} />
				</View>
			</View>

			<View
				style={{
					backgroundColor: '#111827',
					padding: 14,
					borderRadius: 14,
					borderWidth: 1,
					borderColor: '#1f2937',
				}}
			>
				<Text style={{ color: 'white', fontWeight: '800', marginBottom: 8 }}>Current Accel</Text>
				<View style={{ flexDirection: 'row', gap: 18 }}>
					<Text style={{ color: '#e5e7eb' }}>X: {ble.accel ? ble.accel.x.toFixed(4) : '--'}</Text>
					<Text style={{ color: '#e5e7eb' }}>Y: {ble.accel ? ble.accel.y.toFixed(4) : '--'}</Text>
					<Text style={{ color: '#e5e7eb' }}>Z: {ble.accel ? ble.accel.z.toFixed(4) : '--'}</Text>
				</View>
				{!ble.accel && (
					<Text style={{ color: '#9ca3af', marginTop: 8, fontSize: 12 }}>
						Start notifications to see live data
					</Text>
				)}
			</View>

			<View
				style={{
					backgroundColor: '#111827',
					padding: 14,
					borderRadius: 14,
					borderWidth: 1,
					borderColor: '#1f2937',
					gap: 10,
				}}
			>
				<View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
					<PrimaryButton
						title={ble.recording ? 'Stop Recording' : 'Start Recording'}
						onPress={ble.toggleRecording}
						disabled={!ble.accel && !ble.recording}
						active={ble.recording}
					/>
					<PrimaryButton
						title="Clear"
						onPress={ble.clearRecording}
						disabled={ble.rows.length === 0}
					/>
					<PrimaryButton
						title="Export CSV"
						onPress={ble.exportCsv}
						disabled={ble.rows.length === 0}
					/>
				</View>
				<Text style={{ color: '#9ca3af' }}>
					Recorded rows: {ble.rows.length}{ble.rows.length > 0 ? ' • Ready to export' : ''}
				</Text>
			</View>

			{ble.error && (
				<Text style={{ color: '#f87171' }} onPress={ble.clearError}>
					{ble.error} (tap to dismiss)
				</Text>
			)}
		</View>
	);
};


