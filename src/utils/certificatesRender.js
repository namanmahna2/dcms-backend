const { createCanvas, loadImage, registerFont } = require("canvas");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

// ---------------------
// FONT REGISTRATION
// ---------------------
const fontsDir = path.join(__dirname, "fonts");

registerFont(path.join(fontsDir, "Cinzel-Bold.ttf"), { family: "DiplomaTitle" });
registerFont(path.join(fontsDir, "EBGaramond-Regular.ttf"), { family: "DiplomaBody" });
registerFont(path.join(fontsDir, "GreatVibes-Regular.ttf"), { family: "SignatureFont" });
registerFont(path.join(fontsDir, "Roboto-VariableFont_wdth,wght.ttf"), { family: "Sans" });

// ---------------------
// HELPER TO LOAD BORDER IMAGE (Optional)
// ---------------------
async function loadBorder() {
   const borderPath = path.join(__dirname, "borders", "harvard_border.png");
   if (fs.existsSync(borderPath)) {
      return await loadImage(borderPath);
   }
   return null;
}

// ---------------------
// COVENTRY UNIVERSITY SEAL (Cosmos style)
// ---------------------
function drawCoventrySeal(ctx, centerX, centerY, radius) {
   // Outer gold gradient
   const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius);
   grad.addColorStop(0, "#fff7c0"); // light gold
   grad.addColorStop(1, "#bfa34a"); // darker gold

   ctx.beginPath();
   ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
   ctx.fillStyle = grad;
   ctx.fill();
   ctx.lineWidth = 8;
   ctx.strokeStyle = "#8b5e3c";
   ctx.stroke();

   // Inner decorative circles
   ctx.lineWidth = 3;
   ctx.beginPath();
   ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
   ctx.stroke();
   ctx.beginPath();
   ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
   ctx.stroke();

   // Radial rays (cosmos effect)
   const lines = 36;
   for (let i = 0; i < lines; i++) {
      const angle = (i * 2 * Math.PI) / lines;
      const innerR = radius * 0.5 + Math.random() * radius * 0.1;
      const outerR = radius * 0.95;
      const x1 = centerX + innerR * Math.cos(angle);
      const y1 = centerY + innerR * Math.sin(angle);
      const x2 = centerX + outerR * Math.cos(angle);
      const y2 = centerY + outerR * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "#bfa34a";
      ctx.lineWidth = 2;
      ctx.stroke();
   }

   // Circular text
   const text = "COVENTRY UNIVERSITY";
   ctx.save();
   ctx.translate(centerX, centerY);
   ctx.rotate(-Math.PI / 2);
   ctx.font = `${radius * 0.12}px DiplomaBody`;
   ctx.fillStyle = "#8b5e3c";
   ctx.textAlign = "center";

   const charSpacing = (2 * Math.PI) / text.length;
   for (let i = 0; i < text.length; i++) {
      ctx.save();
      ctx.rotate(i * charSpacing);
      ctx.fillText(text[i], 0, -radius * 0.85);
      ctx.restore();
   }
   ctx.restore();
}

// ---------------------
// MAIN RENDER FUNCTION
// ---------------------
async function renderCertificateWithQR({
   studentName,
   degreeName,
   issuerName = "Coventry University",
   issueDate,
   qrPayload,
   ownerName,
   registrarName = "James Cook",
   outDir = path.join(__dirname, "../generated_certificates")
}) {
   if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

   const width = 2480;
   const height = 3508;
   const canvas = createCanvas(width, height);
   const ctx = canvas.getContext("2d");

   // Background
   ctx.fillStyle = "#fffef8"; // off-white paper
   ctx.fillRect(0, 0, width, height);

   // Border
   const borderImg = await loadBorder();
   if (borderImg) ctx.drawImage(borderImg, 0, 0, width, height);
   else {
      ctx.strokeStyle = "#bfa34a";
      ctx.lineWidth = 15;
      ctx.strokeRect(50, 50, width - 100, height - 100);
   }

   ctx.textAlign = "center";
   ctx.fillStyle = "#222";

   // Title
   ctx.font = "bold 150px DiplomaTitle";
   ctx.fillText("DEGREE CERTIFICATE", width / 2, 420);

   // University line
   ctx.font = "65px DiplomaBody";
   ctx.fillText("This is to certify that", width / 2, 550);

   // Student name
   ctx.font = "bold 140px DiplomaTitle";
   ctx.fillText(studentName, width / 2, 730);

   // Degree line
   ctx.font = "60px DiplomaBody";
   ctx.fillText("has successfully completed the requirements for the degree of", width / 2, 880);

   ctx.font = "bold 120px DiplomaTitle";
   ctx.fillText(degreeName, width / 2, 1050);

   // Issuer
   ctx.font = "55px DiplomaBody";
   ctx.fillText(`Given at ${issuerName}`, width / 2, 1200);
   ctx.fillText(`Date of Issue: ${issueDate}`, width / 2, 1280);

   // Seal
   const sealX = width / 2;
   const sealY = 1600;
   const sealRadius = 180;
   drawCoventrySeal(ctx, sealX, sealY, sealRadius);

   // Signatures
   const sigY = sealY + 350;

   // Left signature
   ctx.font = "95px SignatureFont";
   ctx.fillText(registrarName, width * 0.25, sigY - 60);
   ctx.font = "50px DiplomaBody";
   ctx.fillText("_________________________", width * 0.25, sigY);
   ctx.font = "45px DiplomaBody";
   ctx.fillText("Registrar", width * 0.25, sigY + 70);

   // Right signature
   ctx.font = "95px SignatureFont";
   ctx.fillText(ownerName, width * 0.75, sigY - 60);

   ctx.font = "50px DiplomaBody";
   ctx.fillText("_________________________", width * 0.75, sigY);
   ctx.font = "45px DiplomaBody";
   ctx.fillText("Dean of Graduate Studies", width * 0.75, sigY + 70);

   // QR Code
   const qrSize = 480;
   const qrX = width * 0.15;
   const qrY = sigY + 150;
   const qrData = JSON.stringify(qrPayload);
   const qrDataURL = await QRCode.toDataURL(qrData);
   const qrImg = await loadImage(qrDataURL);
   ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

   ctx.font = "40px Sans";
   ctx.textAlign = "left";
   ctx.fillText("Scan to verify", qrX, qrY - 20);
   ctx.fillText("authenticity", qrX, qrY + qrSize + 55);

   // Footnote
   ctx.font = "35px Sans";
   ctx.textAlign = "center";
   ctx.fillStyle = "#555";
   ctx.fillText(
      "This certificate has been digitally issued through the Decentralised Credential Management System (DCMS).",
      width / 2,
      height - 200
   );

   return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

module.exports = { renderCertificateWithQR };
