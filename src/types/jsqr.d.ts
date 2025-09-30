declare module "jsqr" {
  interface QRCodeLocation {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  }

  interface QRCode {
    data: string;
    binaryData: Uint8ClampedArray;
    location: QRCodeLocation;
  }

  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): QRCode | null;
}
