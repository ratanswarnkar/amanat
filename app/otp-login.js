import React, { useRef, useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { getAuth, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { app } from "../firebaseConfig";

export default function OTPLogin() {
  const recaptchaVerifier = useRef(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationId, setVerificationId] = useState(null);
  const [code, setCode] = useState("");

  const auth = getAuth(app);

  const sendOTP = async () => {
    try {
      const confirmation = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        recaptchaVerifier.current
      );
      setVerificationId(confirmation.verificationId);
      alert("OTP Sent 🔥");
    } catch (error) {
      console.log(error);
      alert("Error sending OTP");
    }
  };

  const verifyOTP = async () => {
    try {
      const credential = PhoneAuthProvider.credential(
        verificationId,
        code
      );
      await signInWithCredential(auth, credential);
      alert("Login Success ✅");
    } catch (error) {
      console.log(error);
      alert("Invalid OTP ❌");
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={app.options}
      />

      <Text>Enter Phone Number</Text>
      <TextInput
        placeholder="+91XXXXXXXXXX"
        onChangeText={setPhoneNumber}
        style={{ borderWidth: 1, marginBottom: 10 }}
      />

      <Button title="Send OTP" onPress={sendOTP} />

      <Text>Enter OTP</Text>
      <TextInput
        placeholder="123456"
        onChangeText={setCode}
        style={{ borderWidth: 1, marginBottom: 10 }}
      />

      <Button title="Verify OTP" onPress={verifyOTP} />
    </View>
  );
}