(() => {
  "use strict";

  const QR_SIZE = 260;
  const BORDER_THICKNESS = 10;
  const FRAME_PADDING = 14; // distance from outer edge to the QR code
  const FINAL_SIZE = QR_SIZE + FRAME_PADDING * 2;
  const OUTER_RADIUS = 40;
  const INNER_RADIUS = 26;
  const DOWNLOAD_SCALE = 2;

  const form = document.getElementById("qr-form");
  const ssidInput = document.getElementById("ssid");
  const passwordInput = document.getElementById("wifi-password");
  const togglePasswordBtn = document.getElementById("toggle-password");
  const logoInput = document.getElementById("logo");
  const logoStatusEl = document.getElementById("logo-status");
  const colorInput = document.getElementById("color");
  const errorEl = document.getElementById("form-error");
  const downloadBtn = document.getElementById("download-btn");
  const previewCanvas = document.getElementById("preview-canvas");
  const previewCtx = previewCanvas.getContext("2d");

  previewCanvas.width = FINAL_SIZE;
  previewCanvas.height = FINAL_SIZE;

  let lastGenerationInput = null;

  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePasswordBtn.textContent = isPassword ? "🙈" : "👁️";
    togglePasswordBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });

  autoLoadLogoFromUrl();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const ssid = ssidInput.value.trim();
    if (!ssid) {
      showError("Please enter a network name (SSID).");
      return;
    }

    const generationInput = {
      ssid,
      password: passwordInput.value,
      color: colorInput.value,
      background: form.querySelector('input[name="background"]:checked').value,
      logoFile: logoInput.files[0] || null,
    };

    try {
      await renderQrToCanvas(previewCtx, 1, generationInput);
      lastGenerationInput = generationInput;
      downloadBtn.disabled = false;
    } catch (err) {
      console.error(err);
      showError("Something went wrong while generating the QR code. Please try again.");
    }
  });

  downloadBtn.addEventListener("click", async () => {
    if (!lastGenerationInput) return;

    const downloadCanvas = document.createElement("canvas");
    downloadCanvas.width = FINAL_SIZE * DOWNLOAD_SCALE;
    downloadCanvas.height = FINAL_SIZE * DOWNLOAD_SCALE;
    const downloadCtx = downloadCanvas.getContext("2d");

    try {
      await renderQrToCanvas(downloadCtx, DOWNLOAD_SCALE, lastGenerationInput);
    } catch (err) {
      console.error(err);
      showError("Something went wrong while preparing the download. Please try again.");
      return;
    }

    downloadCanvas.toBlob((blob) => {
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

  function getRequestedLogoName() {
    // If we were bounced here from 404.html (GitHub Pages/http-server have
    // no server-side routing), the real requested path is stashed here.
    const redirectPath = sessionStorage.getItem("redirectPath");
    sessionStorage.removeItem("redirectPath");
    const path = redirectPath || location.pathname;

    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment || lastSegment.toLowerCase() === "index.html") return null;

    return decodeURIComponent(lastSegment).replace(/\.[^.]+$/, "");
  }

  async function fetchLogoFile(name) {
    const candidates = [`logos/${name}.svg`, `logos/${name}-logo.svg`];
    for (const url of candidates) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const blob = await response.blob();
        return new File([blob], url.split("/").pop(), { type: "image/svg+xml" });
      } catch {
        // try next candidate
      }
    }
    return null;
  }

  async function autoLoadLogoFromUrl() {
    const name = getRequestedLogoName();
    if (!name) return;

    const file = await fetchLogoFile(name);
    if (!file) return;

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    logoInput.files = dataTransfer.files;

    history.replaceState(null, "", `${location.pathname.replace(/\/[^/]*$/, "/")}${name}`);

    logoStatusEl.textContent = `✓ Loaded "${name}" logo automatically.`;
    logoStatusEl.hidden = false;
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

  async function renderStyledQrImage({ width, data, color, background, imageDataUrl, imageSize }) {
    const qrCode = new QRCodeStyling({
      width,
      height: width,
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

  function drawFrame(ctx, size, frameColor, background, scale = 1) {
    const borderThickness = BORDER_THICKNESS * scale;
    const outerRadius = OUTER_RADIUS * scale;
    const innerRadius = INNER_RADIUS * scale;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, outerRadius);
    ctx.roundRect(
      borderThickness,
      borderThickness,
      size - borderThickness * 2,
      size - borderThickness * 2,
      innerRadius
    );
    ctx.fillStyle = frameColor;
    ctx.fill("evenodd");
    ctx.restore();

    if (background === "white") {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        borderThickness,
        borderThickness,
        size - borderThickness * 2,
        size - borderThickness * 2,
        innerRadius
      );
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
    }
  }

  async function renderQrToCanvas(ctx, scale, { ssid, password, color, background, logoFile }) {
    const qrSize = QR_SIZE * scale;
    const borderThickness = BORDER_THICKNESS * scale;
    const finalSize = FINAL_SIZE * scale;
    const innerRadius = INNER_RADIUS * scale;

    const wifiString = buildWifiString(ssid, password);
    const imageDataUrl = logoFile
      ? await readLogoAsDataUrl(logoFile, color)
      : createFallbackCenterImage(240 * scale, color, background);

    const qrImage = await renderStyledQrImage({
      width: qrSize,
      data: wifiString,
      color,
      background,
      imageDataUrl,
      imageSize: logoFile ? 0.32 : 0.46,
    });

    drawFrame(ctx, finalSize, color, background, scale);

    const offset = (finalSize - qrSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      borderThickness,
      borderThickness,
      finalSize - borderThickness * 2,
      finalSize - borderThickness * 2,
      innerRadius
    );
    ctx.clip();
    ctx.drawImage(qrImage, offset, offset, qrSize, qrSize);
    ctx.restore();
  }
})();
