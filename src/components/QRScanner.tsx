import React, { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

interface QRScannerProps {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onResult, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();

    const startScanner = async () => {
      try {
        await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, err) => {
            if (result) {
              const text = result.getText();
              console.log("✅ QR scanned (camera):", text.slice(0, 200));
              onResult(text);
            }
            if (err && !(err.name === "NotFoundException")) {
              console.error("QR scan error:", err);
              onError?.(err.message || "QR scan error");
            }
          }
        );
      } catch (err) {
        console.warn("⚠️ No camera available.");
        setCameraError("⚠️ Could not access camera.");
      }
    };

    startScanner();

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onResult, onError]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const file = e.target.files[0];
    const url = URL.createObjectURL(file);

    const codeReader = new BrowserQRCodeReader();
    try {
      const result = await codeReader.decodeFromImageUrl(url);
      if (result) {
        const text = result.getText();
        console.log("✅ QR scanned (file):", text.slice(0, 200));
        onResult(text);
      } else {
        onError?.("❌ No QR code found in image.");
      }
    } catch (err: any) {
      console.error("QR decode error:", err);
      onError?.("❌ Failed to decode QR from image.");
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        marginTop: 16,
      }}
    >
      {/* Camera Scanner Card */}
      <div
        style={{
          border: "2px solid #1a73e8",
          borderRadius: 12,
          overflow: "hidden",
          textAlign: "center",
          background: "#f9fafb",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ margin: 0, padding: "10px", background: "#1a73e8", color: "white" }}>
          Live Camera
        </h3>
        {cameraError ? (
          <div style={{ padding: 20, color: "red", fontWeight: 500 }}>{cameraError}</div>
        ) : (
          <video ref={videoRef} style={{ width: "100%", height: "auto" }} autoPlay />
        )}
      </div>

      {/* Upload Card */}
      <div
        style={{
          border: "2px solid #1a73e8",
          borderRadius: 12,
          textAlign: "center",
          background: "#f9fafb",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 16, color: "#1a73e8" }}>Upload QR</h3>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        <button
          onClick={triggerFileSelect}
          style={{
            backgroundColor: "#1a73e8",
            color: "white",
            padding: "12px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          📂 Upload QR Code
        </button>
      </div>
    </div>
  );
};

export default QRScanner;
