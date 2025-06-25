import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { BrowserRouter as Router, Routes, Route, useNavigate, Link } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import logoLight from "@/assets/logo-light.svg";
import logoDark from "@/assets/logo-dark.svg";
import { Suspense, lazy } from "react";

import { SettingsIcon } from "lucide-react";

// Route-based code splitting
const IdePage = lazy(() => import("@/pages/IdePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

// Loading component for suspense fallback
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
    </div>
  );
}

function TopMenu() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();

  const handleLogoClick = () => {
    navigate("/");
  };

  return (
    <div className="h-8 border-b flex items-center justify-between px-3 bg-background">
      <div className="flex items-center gap-2">
        <img
          src={resolvedTheme === "dark" ? logoDark : logoLight}
          alt="Dribble IDE"
          className="w-5 h-5 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleLogoClick}
        />
      </div>
      <div className="flex items-center gap-2">
        <Link className="text-sm " to="/settings">
          <SettingsIcon className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <ModeToggle />
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <div className="h-screen flex flex-col overflow-hidden">
          <TopMenu />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<IdePage />} />
              <Route path="/ide" element={<IdePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
