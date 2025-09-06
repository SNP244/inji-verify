// generate-vp-qr.mjs
import fs from "fs";
import { generateKeyPair, SignJWT } from "jose";
import pixelpass from "@mosip/pixelpass";
import qrcode from "qrcode";

// Extract helpers from pixelpass
const { generateQRData, decode } = pixelpass;

(async () => {
  console.log("🔑 Generating keypair (RS256)...");

  const { privateKey } = await generateKeyPair("RS256");

  // =======================
  // 1. Create VP Payload (with filler text for testing)
  // =======================
  const vpPayload = {
    vp: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiablePresentation"],
      holder: "did:example:holder123",
      verifiableCredential: [
        {
          "@context": ["https://www.w3.org/2018/credentials/v1"],
          id: "urn:uuid:12345",
          type: ["VerifiableCredential"],
          issuer: "did:example:issuer123",
          credentialSubject: {
            id: "did:example:subject123",
            name: "Hackathon Demo VC",
            // Add filler text to increase QR size
            description: "x".repeat(12000), // ~12 KB of dummy text
          },
        },
      ],
    },
  };

  // =======================
  // 2. Sign VP as JWT
  // =======================
  console.log("🖊️  Signing VP as JWT...");
  const vpJwt = await new SignJWT(vpPayload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(privateKey);

  console.log("JWT starts with:", vpJwt.slice(0, 40)); // eyJhb...

  // =======================
  // 3. PixelPass Encode
  // =======================
  console.log("🗜️ PixelPass encoding using generateQRData...");

  // Wrap JWT inside an object → stringify → pass to PixelPass
  const payload = { vpJwt };
  const ppString = generateQRData(JSON.stringify(payload));

  fs.writeFileSync("vp-pixelpass.txt", ppString);
  console.log("PixelPass string starts with:", ppString.slice(0, 40));

  // =======================
  // 4. Test Decode
  // =======================
  console.log("🔄 Decoding PixelPass back to JSON...");
  const decodedJson = decode(ppString);
  console.log("Decoded object:", decodedJson.slice(0, 100), "...");

  // JWT recovery test
  try {
    const parsed = JSON.parse(decodedJson);
    if (parsed?.vpJwt) {
      console.log("Decoded JWT starts with:", parsed.vpJwt.slice(0, 40));
    }
  } catch (err) {
    console.error("❌ Failed to parse decoded output:", err.message);
  }

  // =======================
  // 5. Generate QR Code
  // =======================
  console.log("🧾 Generating QR code...");
  await qrcode.toFile("vp-pixelpass-qr.png", ppString, { width: 600, margin: 2 });

  // Check file size
  const stats = fs.statSync("vp-pixelpass-qr.png");
  console.log("QR file size:", (stats.size / 1024).toFixed(2), "KB");

  console.log("✅ Done. Files created:");
  console.log("   vp-pixelpass.txt     (PixelPass string)");
  console.log("   vp-pixelpass-qr.png  (QR image)");
})();
