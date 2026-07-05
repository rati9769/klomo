import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import SplashScreen from '../screens/SplashScreen';
import HomeScreen from '../screens/HomeScreen';
import LocalPulseScreen from '../screens/LocalPulseScreen';
import AccountScreen from '../screens/AccountScreen';
import CategoryResultsScreen from '../screens/CategoryResultsScreen';
import VendorDetailScreen from '../screens/VendorDetailScreen';
import VendorMapScreen from '../screens/VendorMapScreen';
import SignInScreen from '../screens/SignInScreen';
import VendorOnboardingScreen from '../screens/VendorOnboardingScreen';
import AppTabBar from '../components/AppTabBar';
import { VerificationProvider } from '../context/VerificationContext';
import { addNotificationTapListener } from '../services/notifications';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// The persistent bottom-tab shell: Home, Pulse (Local Availability Graph —
// see AGENTS.md rule #5, this feature gets a permanent tab, not just a
// home-screen card), and Account. Vendor onboarding is deliberately NOT a
// tab or a floating button — its only entry point is a quiet link inside
// the Account tab (see AGENTS.md product rules).
function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="Pulse">{(props) => <LocalPulseScreen {...props} hideBack />}</Tab.Screen>
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const navigationRef = useNavigationContainerRef();

  // Tapping a "confirm your shop's status" push notification (background
  // or killed-state launch) jumps straight to the Account tab, where the
  // actual verification card lives. See docs/PUSH_NOTIFICATIONS.md.
  useEffect(() => {
    const unsubscribe = addNotificationTapListener(() => {
      navigationRef.current?.navigate('Main', { screen: 'Account' });
    });
    return unsubscribe;
  }, []);

  return (
    <VerificationProvider>
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Splash" component={SplashScreen} />
          <RootStack.Screen name="Main" component={MainTabs} />
          <RootStack.Screen name="CategoryResults" component={CategoryResultsScreen} />
          <RootStack.Screen name="VendorDetail" component={VendorDetailScreen} />
          <RootStack.Screen name="VendorMap" component={VendorMapScreen} />
          <RootStack.Screen name="SignIn" component={SignInScreen} options={{ presentation: 'modal' }} />
          <RootStack.Screen name="VendorOnboarding" component={VendorOnboardingScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    </VerificationProvider>
  );
}
