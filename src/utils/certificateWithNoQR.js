const { createCanvas, loadImage, registerFont } = require("canvas");
const fs = require("fs");
const path = require("path");

try {
    registerFont(path.join(__dirname, "../fonts/PlayfairDisplay-Bold.ttf"), { family: "Playfair" });
    registerFont(path.join(__dirname, "../fonts/Roboto-Regular.ttf"), { family: "Roboto" });
} catch {}

async function renderCertificateNoQR({
    studentName,
    degreeName,
    issuerName,
    issueDate,
    outDir = path.join(__dirname, "../generated_certificates")
}) {

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const width = 2480;
    const height = 3508;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // BACKGROUND
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0c1024");
    bg.addColorStop(1, "#16213e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // BORDER
    ctx.strokeStyle = "#00eaff";
    ctx.lineWidth = 25;
    ctx.shadowColor = "#00eaff";
    ctx.shadowBlur = 60;
    ctx.strokeRect(100, 100, width - 200, height - 200);
    ctx.shadowBlur = 0;

    // TITLE
    ctx.fillStyle = "#00eaff";
    ctx.font = "bold 150px Playfair";
    ctx.fillText("Degree Certificate", 350, 350);

    ctx.strokeStyle = "rgba(0,234,255,0.5)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(350, 380);
    ctx.lineTo(width - 350, 380);
    ctx.stroke();

    // STUDENT INFO
    let y = 700;
    const left = 400;
    ctx.fillStyle = "#fff";

    ctx.font = "72px Playfair";
    ctx.fillText("Awarded to", left, y); y += 120;

    ctx.font = "bold 100px Playfair";
    ctx.fillText(studentName, left, y); y += 160;

    ctx.font = "72px Roboto";
    ctx.fillText("For successfully completing", left, y); y += 100;

    ctx.font = "bold 90px Playfair";
    ctx.fillText(degreeName, left, y); y += 160;

    ctx.font = "60px Roboto";
    ctx.fillText(`Issued by: ${issuerName}`, left, y); y += 80;
    ctx.fillText(`Issued on: ${issueDate}`, left, y);

    // SAVE FILE
    const fileName = `degree_no_qr_${studentName.replace(/\s+/g, "_")}_${Date.now()}.jpg`;
    const outPath = path.join(outDir, fileName);

    const out = fs.createWriteStream(outPath);
    const stream = canvas.createJPEGStream({ quality: 0.95 });

    await new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on("finish", resolve);
        out.on("error", reject);
    });

    return outPath;
}

module.exports = { renderCertificateNoQR };
