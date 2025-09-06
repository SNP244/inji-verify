import React, { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

interface QRScannerProps {
  onScan: (text: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();

    const startScanner = async () => {
      try {
        await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result?: any) => {
            if (result) {
              const text = result.getText();
              console.log("✅ QR scanned (camera) typeof:", typeof text);
              console.log("✅ QR scanned content (first 200 chars):", text.slice(0, 200));
              onScan(text);
            }
          }
        );
      } catch (err) {
        console.warn("⚠️ No camera available, switching to file upload mode.");
        setHasCamera(false);
      }
    };

    startScanner();

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onScan]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const file = e.target.files[0];
    const url = URL.createObjectURL(file);

    const codeReader = new BrowserQRCodeReader();
    try {
      const result = await codeReader.decodeFromImageUrl(url);
      if (result) {
        const text = result.getText();
        console.log("✅ QR scanned (file) typeof:", typeof text);
        console.log("✅ QR scanned content (first 200 chars):", text.slice(0, 200));
        onScan(text);
      } else {
        alert("❌ No QR code found in image.");
      }
    } catch (err) {
      console.error("QR decode error:", err);
      alert("❌ Failed to decode QR from image.");
    }
  };

  return (
    <div>
      {hasCamera ? (
        <video ref={videoRef} style={{ width: "100%" }} autoPlay />
      ) : (
        <div>
          <p>📷 No camera found. Upload a QR image instead:</p>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
        </div>
      )}
    </div>
  );
};

export default QRScanner;
