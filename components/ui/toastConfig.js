import { BaseToast, ErrorToast } from 'react-native-toast-message';
import { colors } from '../../theme/colors';

const baseProps = {
  style: {
    borderLeftWidth: 0,
    borderRadius: 14,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    minHeight: 64,
    width: '92%',
  },
  contentContainerStyle: {
    paddingHorizontal: 14,
  },
  text1Style: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  text2Style: {
    color: colors.textSecondary,
    fontSize: 13,
  },
};

export const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      {...baseProps}
      style={[
        baseProps.style,
        {
          borderColor: 'rgba(34,197,94,0.55)',
        },
      ]}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      {...baseProps}
      style={[
        baseProps.style,
        {
          borderColor: 'rgba(248,113,113,0.58)',
        },
      ]}
    />
  ),
};
