import { useState } from "react";
import { PlusCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { createSource, testSource } from "@/shared/lib/api";
import type { PostgresCreds, MysqlCreds, SqliteCreds, CreateSourceRequest } from "@/shared/lib/api";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AddSourceProps {
  className?: string;
  onSourceAdded?: () => void;
}

export const AddSource = ({ className, onSourceAdded }: AddSourceProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sourceType, setSourceType] = useState<"postgres" | "mysql" | "sqlite" | "">("");
  const [sourceName, setSourceName] = useState("");
  const [formError, setFormError] = useState("");
  const queryClient = useQueryClient();

  // PostgreSQL form state
  const [postgresConfig, setPostgresConfig] = useState<PostgresCreds>({
    host: "",
    port: 5432,
    user: "",
    password: "",
    dbname: ""
  });

  // MySQL form state
  const [mysqlConfig, setMysqlConfig] = useState<MysqlCreds>({
    host: "",
    port: 3306,
    user: "",
    password: "",
    dbname: ""
  });

  // SQLite form state
  const [sqliteConfig, setSquliteConfig] = useState<SqliteCreds>({
    path: ""
  });

  const resetForm = () => {
    setSourceType("");
    setSourceName("");
    setFormError("");
    setPostgresConfig({
      host: "",
      port: 5432,
      user: "",
      password: "",
      dbname: ""
    });
    setMysqlConfig({
      host: "",
      port: 3306,
      user: "",
      password: "",
      dbname: ""
    });
    setSquliteConfig({
      path: ""
    });
  };

  const handleSave = async () => {
    if (!sourceName.trim()) {
      setFormError("Source name is required");
      return;
    }

    if (!sourceType) {
      setFormError("Please select a database type");
      return;
    }

    let isValid = true;
    let credentials: PostgresCreds | MysqlCreds | SqliteCreds;

    // Validate based on source type
    if (sourceType === "postgres") {
      const { host, user, dbname, password } = postgresConfig;
      if (!host || !user || !password || !dbname) {
        setFormError("All PostgreSQL fields are required");
        isValid = false;
      }
      credentials = postgresConfig;
    } else if (sourceType === "mysql") {
      const { host, user, dbname, password } = mysqlConfig;
      if (!host || !user || !password || !dbname) {
        setFormError("All MySQL fields are required");
        isValid = false;
      }
      credentials = mysqlConfig;
    } else {
      // SQLite
      if (!sqliteConfig.path) {
        setFormError("SQLite file path is required");
        isValid = false;
      }
      credentials = sqliteConfig;
    }

    if (!isValid) return;

    try {
      setLoading(true);
      setFormError("");

      // For create operation
      const createData: CreateSourceRequest = {
        name: sourceName,
        dbtype: sourceType as "postgres" | "mysql" | "sqlite",
        creds: credentials!
      };

      await createSource(createData);
      toast.success(`Source "${sourceName}" created successfully`);

      // Invalidate sources query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["sources"] });

      setOpen(false);
      resetForm();

      if (onSourceAdded) {
        onSourceAdded();
      }
    } catch (error) {
      console.error("Failed to save source:", error);
      setFormError("Failed to save source. Please check your connection details.");
      toast.error("Failed to create source");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!sourceType) {
      setFormError("Please select a database type");
      return;
    }

    let credentials: PostgresCreds | MysqlCreds | SqliteCreds;

    // Validate based on source type
    if (sourceType === "postgres") {
      credentials = postgresConfig;
    } else if (sourceType === "mysql") {
      credentials = mysqlConfig;
    } else {
      credentials = sqliteConfig;
    }

    try {
      setTesting(true);
      setFormError("");

      const sourceData: CreateSourceRequest = {
        name: sourceName || "Test Connection",
        dbtype: sourceType,
        creds: credentials!
      };

      await testSource(sourceData);

      toast.success("Connection test successful");
    } catch (error) {
      console.error("Failed to test source:", error);
      toast.error("Connection test failed. Please check your connection details.");
    } finally {
      setTesting(false);
    }
  };

  // Helper for form field disabled state
  const isFormDisabled = loading || testing;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`p-0 h-auto w-auto ${className} cursor-pointer`}
          onClick={() => setOpen(true)}
          data-testid="add-source-button"
        >
          <PlusCircle className="h-4 w-4" />
          <span className="sr-only">Add Source</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Database Source</DialogTitle>
          <DialogDescription>Connect to your database to start querying data.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="name" className="text-right text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="My Database"
              disabled={isFormDisabled}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="type" className="text-right text-sm font-medium">
              Type
            </label>
            <select
              id="type"
              className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={sourceType}
              onChange={(e) =>
                setSourceType(e.target.value as "postgres" | "mysql" | "sqlite" | "")
              }
              disabled={isFormDisabled}
            >
              <option value="">Select database type</option>
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
            </select>
          </div>

          {sourceType === "postgres" && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="host" className="text-right text-sm font-medium">
                  Host
                </label>
                <input
                  id="host"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={postgresConfig.host}
                  onChange={(e) =>
                    setPostgresConfig({
                      ...postgresConfig,
                      host: e.target.value
                    })
                  }
                  placeholder="localhost"
                  disabled={isFormDisabled}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="port" className="text-right text-sm font-medium">
                  Port
                </label>
                <input
                  id="port"
                  type="number"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={postgresConfig.port}
                  onChange={(e) =>
                    setPostgresConfig({
                      ...postgresConfig,
                      port: parseInt(e.target.value, 10) || 5432
                    })
                  }
                  disabled={isFormDisabled}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="username" className="text-right text-sm font-medium">
                  Username
                </label>
                <input
                  id="username"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={postgresConfig.user}
                  onChange={(e) =>
                    setPostgresConfig({
                      ...postgresConfig,
                      user: e.target.value
                    })
                  }
                  placeholder="postgres"
                  disabled={isFormDisabled}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="password" className="text-right text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={postgresConfig.password}
                  onChange={(e) =>
                    setPostgresConfig({
                      ...postgresConfig,
                      password: e.target.value
                    })
                  }
                  disabled={isFormDisabled}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="database" className="text-right text-sm font-medium">
                  Database
                </label>
                <input
                  id="database"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={postgresConfig.dbname}
                  onChange={(e) =>
                    setPostgresConfig({
                      ...postgresConfig,
                      dbname: e.target.value
                    })
                  }
                  disabled={isFormDisabled}
                />
              </div>
            </>
          )}

          {sourceType === "mysql" && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="host" className="text-right text-sm font-medium">
                  Host
                </label>
                <input
                  id="host"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={mysqlConfig.host}
                  onChange={(e) => setMysqlConfig({ ...mysqlConfig, host: e.target.value })}
                  placeholder="localhost"
                  disabled={isFormDisabled}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="port" className="text-right text-sm font-medium">
                  Port
                </label>
                <input
                  id="port"
                  type="number"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={mysqlConfig.port}
                  onChange={(e) =>
                    setMysqlConfig({
                      ...mysqlConfig,
                      port: parseInt(e.target.value, 10) || 3306
                    })
                  }
                  disabled={isFormDisabled}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="username" className="text-right text-sm font-medium">
                  Username
                </label>
                <input
                  id="username"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={mysqlConfig.user}
                  onChange={(e) => setMysqlConfig({ ...mysqlConfig, user: e.target.value })}
                  placeholder="root"
                  disabled={isFormDisabled}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="password" className="text-right text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={mysqlConfig.password}
                  onChange={(e) => setMysqlConfig({ ...mysqlConfig, password: e.target.value })}
                  disabled={isFormDisabled}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="database" className="text-right text-sm font-medium">
                  Database
                </label>
                <input
                  id="database"
                  className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={mysqlConfig.dbname}
                  onChange={(e) => setMysqlConfig({ ...mysqlConfig, dbname: e.target.value })}
                  disabled={isFormDisabled}
                />
              </div>
            </>
          )}

          {sourceType === "sqlite" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="path" className="text-right text-sm font-medium">
                File Path
              </label>
              <input
                id="path"
                className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={sqliteConfig.path}
                onChange={(e) => setSquliteConfig({ path: e.target.value })}
                placeholder="/path/to/database.db"
                disabled={isFormDisabled}
              />
            </div>
          )}

          {formError && <div className="text-sm text-red-500 px-4">{formError}</div>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
            disabled={isFormDisabled}
          >
            Cancel
          </Button>
          <Button onClick={handleTest} disabled={isFormDisabled}>
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          <Button onClick={handleSave} disabled={isFormDisabled}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
