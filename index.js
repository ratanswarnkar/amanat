import '@expo/metro-runtime';

import React from 'react';
import { Platform } from 'react-native';
import { ExpoRoot } from 'expo-router';
import { ctx } from 'expo-router/_ctx';
import { Head } from 'expo-router/build/head';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

import AdminApp from './src/admin/AdminApp';

function App() {
  if (Platform.OS === 'web') {
    return <AdminApp />;
  }

  return (
    <Head.Provider>
      <ExpoRoot context={ctx} />
    </Head.Provider>
  );
}

renderRootComponent(App);
