import { useState, useEffect } from "react";
import { getSourceCredentials, updateSource } from "@/lib/api";
import type { PostgresCreds, MysqlCreds, SqliteCreds, UpdateSourceRequest } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface EditSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
}

export const EditSourceDialog = ({ open, onOpenChange, sourceId }: EditSourceDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(false);
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
  const [sqliteConfig, setSqliteConfig] = useState<SqliteCreds>({
    path: ""
  });

  // Load source credentials when dialog opens
  useEffect(() => {
    if (open && sourceId) {
      const loadSourceCredentials = async () => {
        try {
          setLoadingCreds(true);
          const sourceData = await getSourceCredentials(sourceId);

          // Set form values from source data
          setSourceName(sourceData.name);
          setSourceType(sourceData.dbtype as "postgres" | "mysql" | "sqlite");

          // Set config based on database type
          if (sourceData.dbtype === "postgres") {
            const creds = sourceData.creds as PostgresCreds;
            setPostgresConfig({
              host: creds.host || "",
              port: creds.port || 5432,
              user: creds.user || "",
              password: "", // Password is not returned by API for security
              dbname: creds.dbname || ""
            });
          } else if (sourceData.dbtype === "mysql") {
            const creds = sourceData.creds as MysqlCreds;
            setMysqlConfig({
              host: creds.host || "",
              port: creds.port || 3306,
              user: creds.user || "",
              password: "", // Password is not returned by API for security
              dbname: creds.dbname || ""
            });
          } else if (sourceData.dbtype === "sqlite") {
            const creds = sourceData.creds as SqliteCreds;
            setSqliteConfig({
              path: creds.path || ""
            });
          }
        } catch (error) {
          console.error("Failed to load source credentials:", error);
          setFormError("Failed to load source credentials");
          toast.error("Failed to load source credentials");
        } finally {
          setLoadingCreds(false);
        }
      };

      loadSourceCredentials();
    }
  }, [open, sourceId]);

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
    setSqliteConfig({
      path: ""
    });
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // Test function implementation would go here
      toast.info("Test functionality not implemented in this dialog");
    } finally {
      setTesting(false);
    }
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
      const { host, user, dbname } = postgresConfig;
      if (!host || !user || !dbname) {
        setFormError("All PostgreSQL fields except password are required");
        isValid = false;
      }
      credentials = postgresConfig;
    } else if (sourceType === "mysql") {
      const { host, user, dbname } = mysqlConfig;
      if (!host || !user || !dbname) {
        setFormError("All MySQL fields except password are required");
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

      // For update operation
      const updateData: UpdateSourceRequest = {
        name: sourceName,
        dbtype: sourceType as "postgres" | "mysql" | "sqlite",
        creds: { ...credentials! } // Create a copy
      };

      // For updates, only include password if it was changed
      if (sourceType === "postgres" && !postgresConfig.password && updateData.creds) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...restCreds } = updateData.creds as PostgresCreds;
        updateData.creds = restCreds as PostgresCreds;
      } else if (sourceType === "mysql" && !mysqlConfig.password && updateData.creds) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...restCreds } = updateData.creds as MysqlCreds;
        updateData.creds = restCreds as MysqlCreds;
      }

      await updateSource(sourceId, updateData);
      toast.success(`Source "${sourceName}" updated successfully`);

      // Invalidate sources query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["sources"] });

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Failed to update source:", error);
      setFormError("Failed to update source");
      toast.error("Failed to update source");
    } finally {
      setLoading(false);
    }
  };

  const isFormDisabled = loading || testing;

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // When dialog is closed, trigger onOpenChange
        onOpenChange(newOpen);

        // If dialog is being closed, reset form after short delay
        if (!newOpen) {
          setTimeout(resetForm, 100);
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Database Source</DialogTitle>
          <DialogDescription>Update your database connection details.</DialogDescription>
        </DialogHeader>

        {loadingCreds ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading source details...</span>
          </div>
        ) : (
          <>
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
                  disabled={true} // Always disable type change when editing
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
                    onChange={(e) => setSqliteConfig({ path: e.target.value })}
                    placeholder="/path/to/database.db"
                    disabled={isFormDisabled}
                  />
                </div>
              )}

              {formError && <p className="text-destructive text-sm mt-2">{formError}</p>}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  resetForm();
                }}
                disabled={isFormDisabled}
              >
                Cancel
              </Button>
              <Button onClick={handleTest} disabled={isFormDisabled}>
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button onClick={handleSave} disabled={isFormDisabled}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Update"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
