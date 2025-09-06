import { useEffect, useState } from "react";
import { syncLogs } from "../services/storage";  // 👈 import syncLogs

const ConnectivityBanner = () => {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  // 👇 Trigger sync automatically when online
  useEffect(() => {
    if (online) {
      console.log("🌐 Back online → syncing logs...");
      syncLogs();   // <-- this will push pending logs to server
    }
  }, [online]);

  if (online) return null;

  return (
    <div
      style={{
        backgroundColor: "#ffc107",
        color: "#333",
        textAlign: "center",
        padding: "8px",
        fontWeight: "bold",
      }}
    >
      ⚠️ You are offline. Logs will sync when you reconnect.
    </div>
  );
};

export default ConnectivityBanner;
