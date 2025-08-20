import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

type Props = {
	title: string;
	onPress: () => void;
	danger?: boolean;
	disabled?: boolean;
	active?: boolean;
};

export const PrimaryButton: React.FC<Props> = ({ title, onPress, danger, disabled, active }) => {
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.85}
			disabled={disabled}
			style={{
				backgroundColor: disabled
					? '#6b7280'
					: active
						? '#059669'
						: danger
							? '#ef4444'
							: '#2563eb',
				paddingHorizontal: 14,
				paddingVertical: 10,
				borderRadius: 10,
				opacity: disabled ? 0.6 : 1,
			}}
			hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
		>
			<Text style={{ color: 'white', fontWeight: '700' }}>{title}</Text>
		</TouchableOpacity>
	);
};


