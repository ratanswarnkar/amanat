import { Redirect } from 'expo-router';

export default function OtpLoginLegacyRoute() {
  // Legacy duplicate Firebase OTP screen disabled to avoid multiple login implementations.
  return <Redirect href="/mobile" />;
}
