(() => {
  "use strict";

  const QR_SIZE = 260;
  const BORDER_THICKNESS = 10;
  const FRAME_PADDING = 14; // distance from outer edge to the QR code
  const FINAL_SIZE = QR_SIZE + FRAME_PADDING * 2;
  const OUTER_RADIUS = 40;
  const INNER_RADIUS = 26;

  const form = document.getElementById("qr-form");
  const ssidInput = document.getElementById("ssid");
  const passwordInput = document.getElementById("wifi-password");
  const togglePasswordBtn = document.getElementById("toggle-password");
  const logoInput = document.getElementById("logo");
  const colorInput = document.getElementById("color");
  const errorEl = document.getElementById("form-error");
  const downloadBtn = document.getElementById("download-btn");
  const previewCanvas = document.getElementById("preview-canvas");
  const previewCtx = previewCanvas.getContext("2d");

  previewCanvas.width = FINAL_SIZE;
  previewCanvas.height = FINAL_SIZE;

  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePasswordBtn.textContent = isPassword ? "🙈" : "👁️";
    togglePasswordBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const ssid = ssidInput.value.trim();
    if (!ssid) {
      showError("Please enter a network name (SSID).");
      return;
    }

    try {
      await generateQrCode({
        ssid,
        password: passwordInput.value,
        color: colorInput.value,
        background: form.querySelector('input[name="background"]:checked').value,
        logoFile: logoInput.files[0] || null,
      });
      downloadBtn.disabled = false;
    } catch (err) {
      console.error(err);
      showError("Something went wrong while generating the QR code. Please try again.");
    }
  });

  downloadBtn.addEventListener("click", () => {
    previewCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wifi-qr.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  });

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  function escapeWifiValue(value) {
    return value.replace(/([\\;,":])/g, "\\$1");
  }

  function buildWifiString(ssid, password) {
    const escapedSsid = escapeWifiValue(ssid);
    if (!password) {
      return `WIFI:T:nopass;S:${escapedSsid};;`;
    }
    return `WIFI:T:WPA;S:${escapedSsid};P:${escapeWifiValue(password)};;`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function isSvgFile(file) {
    return file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  }

  function recolorSvg(svgText, color) {
    let result = svgText
      .replace(/fill\s*=\s*"(?!none)[^"]*"/gi, `fill="${color}"`)
      .replace(/fill\s*=\s*'(?!none)[^']*'/gi, `fill='${color}'`)
      .replace(/stroke\s*=\s*"(?!none)[^"]*"/gi, `stroke="${color}"`)
      .replace(/stroke\s*=\s*'(?!none)[^']*'/gi, `stroke='${color}'`)
      .replace(/fill:\s*(?!none)[^;"']+/gi, `fill:${color}`)
      .replace(/stroke:\s*(?!none)[^;"']+/gi, `stroke:${color}`);

    if (!/<svg[^>]*\sfill\s*=/i.test(result)) {
      result = result.replace(/<svg/i, `<svg fill="${color}"`);
    }

    return `data:image/svg+xml;utf8,${encodeURIComponent(result)}`;
  }

  async function readLogoAsDataUrl(file, color) {
    if (isSvgFile(file)) {
      const svgText = await readFileAsText(file);
      return recolorSvg(svgText, color);
    }
    return readFileAsDataUrl(file);
  }

  function createFallbackCenterImage(size, color, background) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (background === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, size * 0.22);
      ctx.fill();
    }

    ctx.fillStyle = color;
    ctx.font = `bold ${Math.round(size * 0.21)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CONNECT", size / 2, size / 2 - size * 0.15);
    ctx.fillText("TO WIFI", size / 2, size / 2 + size * 0.15);

    return canvas.toDataURL("image/png");
  }

  function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  async function renderStyledQrImage({ data, color, background, imageDataUrl, imageSize }) {
    const qrCode = new QRCodeStyling({
      width: QR_SIZE,
      height: QR_SIZE,
      type: "canvas",
      data,
      image: imageDataUrl,
      margin: 4,
      qrOptions: { errorCorrectionLevel: "H" },
      dotsOptions: { type: "dots", color },
      cornersSquareOptions: { type: "extra-rounded", color },
      cornersDotOptions: { type: "dot", color },
      backgroundOptions: {
        color: background === "white" ? "#ffffff" : "rgba(0,0,0,0)",
      },
      imageOptions: {
        margin: 6,
        imageSize,
        hideBackgroundDots: true,
      },
    });

    const blob = await qrCode.getRawData("png");
    return blobToImage(blob);
  }

  function drawFrame(ctx, size, frameColor, background) {
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, OUTER_RADIUS);
    ctx.roundRect(
      BORDER_THICKNESS,
      BORDER_THICKNESS,
      size - BORDER_THICKNESS * 2,
      size - BORDER_THICKNESS * 2,
      INNER_RADIUS
    );
    ctx.fillStyle = frameColor;
    ctx.fill("evenodd");
    ctx.restore();

    if (background === "white") {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        BORDER_THICKNESS,
        BORDER_THICKNESS,
        size - BORDER_THICKNESS * 2,
        size - BORDER_THICKNESS * 2,
        INNER_RADIUS
      );
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
    }
  }

  async function generateQrCode({ ssid, password, color, background, logoFile }) {
    const wifiString = buildWifiString(ssid, password);
    const imageDataUrl = logoFile
      ? await readLogoAsDataUrl(logoFile, color)
      : createFallbackCenterImage(240, color, background);

    const qrImage = await renderStyledQrImage({
      data: wifiString,
      color,
      background,
      imageDataUrl,
      imageSize: logoFile ? 0.32 : 0.46,
    });

    drawFrame(previewCtx, FINAL_SIZE, color, background);

    const offset = (FINAL_SIZE - QR_SIZE) / 2;
    previewCtx.save();
    previewCtx.beginPath();
    previewCtx.roundRect(
      BORDER_THICKNESS,
      BORDER_THICKNESS,
      FINAL_SIZE - BORDER_THICKNESS * 2,
      FINAL_SIZE - BORDER_THICKNESS * 2,
      INNER_RADIUS
    );
    previewCtx.clip();
    previewCtx.drawImage(qrImage, offset, offset, QR_SIZE, QR_SIZE);
    previewCtx.restore();
  }
})();
