import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth/auth-context.jsx";
import GoogleAuth from "./auth/GoogleAuth.jsx";
import Editor from "./editor/Editor.jsx";
import CaptureScreen from "./capture/CaptureScreen.jsx";
import KanbanScreen from "./kanban/KanbanScreen.jsx";
import MobileShell from "./mobile/MobileShell.jsx";

function AppInner() {
  const { accessToken } = useAuth();
  const [screen, setScreen] = useState("editor");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  if (!accessToken) return <GoogleAuth />;

  // Mobile: dedicated shell with tab bar + FAB navigation
  if (isMobile) return <MobileShell />;

  // Desktop: existing screen switching unchanged
  if (screen === "capture") {
    return (
      <CaptureScreen
        onOpenEditor={() => setScreen("editor")}
        onOpenKanban={() => setScreen("kanban")}
      />
    );
  }

  if (screen === "kanban") {
    return (
      <KanbanScreen
        onOpenEditor={() => setScreen("editor")}
        onOpenCapture={() => setScreen("capture")}
      />
    );
  }

  return (
    <Editor
      onOpenCapture={() => setScreen("capture")}
      onOpenKanban={() => setScreen("kanban")}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
