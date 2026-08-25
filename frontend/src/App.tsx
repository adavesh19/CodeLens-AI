import { AppProvider, useApp } from './context/AppContext';
import { StatusBar } from './components/StatusBar';
import { WorkspacePanel } from './components/WorkspacePanel';
import { HomeScreen } from './screens/HomeScreen';
import { CameraScreen } from './screens/CameraScreen';
import { VoiceScreen } from './screens/VoiceScreen';
import { InputScreen } from './screens/InputScreen';
import { AnalysisScreen } from './screens/AnalysisScreen';
import { PatchScreen } from './screens/PatchScreen';
import { TestScreen } from './screens/TestScreen';
import { SuccessScreen } from './screens/SuccessScreen';

function PhoneNotch() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, flexShrink: 0 }}>
      <div className="phone-notch">
        <div className="phone-notch-dot" />
      </div>
    </div>
  );
}

function AppContent() {
  const { screen, aiAvailable } = useApp();
  const screens: Record<string, React.ReactNode> = {
    home: <HomeScreen />,
    camera: <CameraScreen />,
    voice: <VoiceScreen />,
    input: <InputScreen />,
    analysis: <AnalysisScreen />,
    patch: <PatchScreen />,
    tests: <TestScreen />,
    success: <SuccessScreen />,
  };
  return (
    <div className="app-shell">
      <div className="phone-frame">
        <PhoneNotch />
        <StatusBar aiAvailable={aiAvailable} />
        {screens[screen] || <HomeScreen />}
      </div>
      <WorkspacePanel />
    </div>
  );
}

export default function App() {
  return <AppProvider><AppContent /></AppProvider>;
}
