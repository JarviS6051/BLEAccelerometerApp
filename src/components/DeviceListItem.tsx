import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { UiDevice } from '../ble/useBle';

type Props = {
	item: UiDevice;
	onPress: (d: UiDevice) => void;
};

export const DeviceListItem: React.FC<Props> = ({ item, onPress }) => {
	return (
		<TouchableOpacity
			onPress={() => onPress(item)}
			style={{
				backgroundColor: '#111827',
				borderRadius: 14,
				padding: 16,
				borderWidth: 1,
				borderColor: item.isSample ? '#22c55e55' : '#1f2937',
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
			}}
		>
			<View style={{
				width: 40,
				height: 40,
				borderRadius: 20,
				backgroundColor: item.isSample ? '#22c55e' : '#3b82f6',
				alignItems: 'center',
				justifyContent: 'center',
			}}>
				<Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
					{item.isSample ? '📱' : '📶'}
				</Text>
			</View>
			
			<View style={{ flex: 1 }}>
				<Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>
					{item.name ?? '(no name)'}
				</Text>
				<Text selectable style={{ color: '#9ca3af', marginTop: 2, fontSize: 12 }}>
					{item.id}
				</Text>
				{item.isSample && (
					<Text style={{ color: '#86efac', marginTop: 4, fontSize: 12 }}>
						Simulated accelerometer data
					</Text>
				)}
			</View>
			
			<Text style={{ color: '#6b7280', fontSize: 20 }}>›</Text>
		</TouchableOpacity>
	);
};


