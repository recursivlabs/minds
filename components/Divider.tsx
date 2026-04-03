import { View } from 'react-native';
import { colors, spacing } from '../constants/theme';

interface Props {
  marginVertical?: number;
}

export function Divider({ marginVertical = spacing.lg }: Props) {
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: colors.borderSubtle,
        marginVertical,
      }}
    />
  );
}
