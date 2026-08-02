import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ViewAllScreen from './src/screens/ViewAllScreen';
import MenuSectionScreen from './src/screens/MenuSectionScreen';
import MyProfileScreen from './src/screens/MyProfileScreen';
import AboutUsScreen from './src/screens/AboutUsScreen';
import ContactUsScreen from './src/screens/ContactUsScreen';
import RateUsScreen from './src/screens/RateUsScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import UtilityScreen from './src/screens/UtilityScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProspectManagementScreen from './src/screens/ProspectManagementScreen';
import ScanScreen from './src/screens/ScanScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import NFCSmartCardScreen from './src/screens/NFCSmartCardScreen';
import SmartCardStyleScreen from './src/screens/SmartCardStyleScreen';
import GoogleNFCReviewScreen from './src/screens/GoogleNFCReviewScreen';
import ClientListScreen from './src/screens/ClientListScreen';
import DueListScreen from './src/screens/DueListScreen';
import SmartCardReviewScreen from './src/screens/SmartCardReviewScreen';
import PremiumCalendarScreen from './src/screens/PremiumCalendarScreen';
import DataEntryScreen from './src/screens/DataEntryScreen';
import MediaViewerScreen from './src/screens/MediaViewerScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import { getSubscriptionInfo } from './src/services/appData';

const Stack = createStackNavigator();

const PaymentWebViewRoute = (props) => {
  const Screen = require('./src/screens/PaymentWebViewScreen').default;
  return <Screen {...props} />;
};

const SubscriptionRoute = (props) => {
  const Screen = require('./src/screens/SubscriptionPlansScreen').default;
  return <Screen {...props} />;
};

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.log('POLICYBHANDAR startup error', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.errorRoot}>
        <Text style={styles.errorTitle}>POLICYBHANDAR</Text>
        <Text style={styles.errorText}>App could not load this screen. Please try again.</Text>
        <TouchableOpacity style={styles.errorButton} onPress={() => this.setState({ hasError: false })}>
          <Text style={styles.errorButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const RootNavigator = () => {
  const { user, authLoading } = useAuth() || {};
  const hasActiveMembership = user ? getSubscriptionInfo(user).active : false;

  if (authLoading) {
    return (
      <Stack.Navigator
        key="loading"
        initialRouteName="Splash"
        screenOptions={{ headerShown: false, gestureEnabled: false }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={!user ? 'Login' : !hasActiveMembership ? 'Subscription' : 'Home'}
      screenOptions={{ headerShown: false, gestureEnabled: true }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={slideFromRight}
      />
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          gestureEnabled: false,
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: { opacity: current.progress },
          }),
        }}
      />
      <Stack.Screen name="Search" component={SearchScreen} options={slideFromRight} />
      <Stack.Screen name="ViewAll" component={ViewAllScreen} options={slideFromRight} />
      <Stack.Screen name="MediaViewer" component={MediaViewerScreen} options={slideFromRight} />
      <Stack.Screen name="Training" component={TrainingScreen} options={slideFromRight} />
      <Stack.Screen name="MenuSection" component={MenuSectionScreen} options={slideFromRight} />
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={slideFromRight} />
      <Stack.Screen name="AboutUs" component={AboutUsScreen} options={slideFromRight} />
      <Stack.Screen name="ContactUs" component={ContactUsScreen} options={slideFromRight} />
      <Stack.Screen name="RateUs" component={RateUsScreen} options={slideFromRight} />
      <Stack.Screen name="Terms" component={TermsScreen} options={slideFromRight} />
      <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} options={slideFromRight} />
      <Stack.Screen name="Utility" component={UtilityScreen} options={slideFromRight} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={slideFromRight} />
      <Stack.Screen name="ProspectManagement" component={ProspectManagementScreen} options={slideFromRight} />
      <Stack.Screen name="Scan" component={ScanScreen} options={slideFromRight} />
      <Stack.Screen name="Subscription" component={SubscriptionRoute} options={slideFromRight} />
      <Stack.Screen name="PaymentWebView" component={PaymentWebViewRoute} options={slideFromRight} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false, cardStyleInterpolator: ({ current }) => ({ cardStyle: { opacity: current.progress } }) }} />
      <Stack.Screen name="SmartCardReview" component={SmartCardReviewScreen} options={slideFromRight} />
      <Stack.Screen name="PremiumCalendar" component={PremiumCalendarScreen} options={slideFromRight} />
      <Stack.Screen name="DataEntry" component={DataEntryScreen} options={slideFromRight} />
      <Stack.Screen name="NFCSmartCard" component={NFCSmartCardScreen} options={slideFromRight} />
      <Stack.Screen name="SmartCardStyle" component={SmartCardStyleScreen} options={slideFromRight} />
      <Stack.Screen name="GoogleNFCReview" component={GoogleNFCReviewScreen} options={slideFromRight} />
      <Stack.Screen name="ClientList" component={ClientListScreen} options={slideFromRight} />
      <Stack.Screen name="DueList" component={DueListScreen} options={slideFromRight} />
    </Stack.Navigator>
  );
};

const slideFromRight = {
  transitionSpec: {
    open: { animation: 'timing', config: { duration: 280 } },
    close: { animation: 'timing', config: { duration: 240 } },
  },
  cardStyleInterpolator: ({ current, layouts }) => ({
    cardStyle: {
      transform: [{
        translateX: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [layouts.screen.width, 0],
        }),
      }],
    },
  }),
};

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
      <AppErrorBoundary>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  errorRoot: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#C0392B',
    fontSize: 24,
    fontWeight: '900',
  },
  errorText: {
    color: '#666',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#C0392B',
    borderRadius: 10,
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
