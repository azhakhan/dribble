export function SettingsPage() {
  return (
    <div className="flex-1 min-h-0 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">General Settings</h2>
            <p className="text-muted-foreground">Settings configuration will be available here.</p>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Data Sources</h2>
            <p className="text-muted-foreground">
              Manage your data source connections and configurations.
            </p>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Preferences</h2>
            <p className="text-muted-foreground">Customize your IDE experience and preferences.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
