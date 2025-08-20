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
				padding: 14,
				borderWidth: 1,
				borderColor: item.isSample ? '#22c55e55' : '#1f2937',
			}}
		>
			<Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>
				{item.name ?? '(no name)'}
			</Text>
			<Text selectable style={{ color: '#9ca3af', marginTop: 4, fontSize: 12 }}>
				{item.id}
			</Text>
			{item.isSample && (
				<Text style={{ color: '#86efac', marginTop: 8 }}>
					No devices? Use this sample to simulate data.
				</Text>
			)}
		</TouchableOpacity>
	);
};


