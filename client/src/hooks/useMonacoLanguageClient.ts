import { useEffect, useRef } from "react";
import type { MessageConnection } from "@codingame/monaco-jsonrpc";
import { MonacoLanguageClient } from "monaco-languageclient";
import normalizeUrl from "normalize-url";
import { listen } from "@codingame/monaco-jsonrpc";

interface UseMonacoLanguageClientProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function useMonacoLanguageClient({
  onConnectionChange,
}: UseMonacoLanguageClientProps = {}) {
  const languageClientRef = useRef<MonacoLanguageClient | null>(null);
  const connectionRef = useRef<MessageConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const url = normalizeUrl("ws://localhost:3001");

    function createWebSocket(url: string): WebSocket {
      const socket = new WebSocket(url);
      socket.binaryType = "arraybuffer"; // Important for binary messages

      socket.onopen = () => {
        console.log("WebSocket opened");
        onConnectionChange?.(true);
      };

      socket.onclose = () => {
        console.log("WebSocket closed");
        onConnectionChange?.(false);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        onConnectionChange?.(false);
      };

      return socket;
    }

    function createLanguageClient(
      connection: MessageConnection
    ): MonacoLanguageClient {
      return new MonacoLanguageClient({
        name: "SQL Language Client",
        clientOptions: {
          documentSelector: [{ language: "sql" }],
          errorHandler: {
            error: () => ({ action: 1 }), // ErrorAction.Continue
            closed: () => ({ action: 2 }), // CloseAction.DoNotRestart
          },
        },
        connectionProvider: {
          get: () => Promise.resolve(connection as any),
        },
      });
    }

    // Create WebSocket connection
    socketRef.current = createWebSocket(url);

    // Set up language client
    listen({
      webSocket: socketRef.current,
      onConnection: (connection) => {
        console.log("Language server connection established");
        connectionRef.current = connection;
        languageClientRef.current = createLanguageClient(connection);
        languageClientRef.current.start();
        connection.onClose(() => {
          console.log("Language server connection closed");
          languageClientRef.current?.stop();
          languageClientRef.current = null;
          connectionRef.current = null;
        });
      },
    });

    // Cleanup function
    return () => {
      if (languageClientRef.current) {
        languageClientRef.current.stop();
      }
      if (connectionRef.current) {
        connectionRef.current.dispose();
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [onConnectionChange]);

  return {
    isConnected: !!languageClientRef.current,
  };
}
