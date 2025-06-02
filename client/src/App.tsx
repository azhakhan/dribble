import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter as Router, Routes, Route, useNavigate, Link } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import logo from "@/assets/logo.png";
import { IdePage, SettingsPage } from "@/pages";
import { SettingsIcon } from "lucide-react";
function TopMenu() {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate("/");
  };

  return (
    <div className="h-8 border-b flex items-center justify-between px-3 bg-background">
      <div className="flex items-center gap-2">
        <img
          src={logo}
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
          <Routes>
            <Route path="/" element={<IdePage />} />
            <Route path="/ide" element={<IdePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
