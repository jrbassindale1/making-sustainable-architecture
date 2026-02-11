/**
 * Canvas-based overlay renderer for video export.
 * Draws metrics, status, and mini-chart directly to canvas.
 */

// Colors matching the app's design system
const COLORS = {
  background: "#f5f3ee",
  panelBg: "rgba(255, 255, 255, 0.95)",
  text: "#1e293b",
  textMuted: "#64748b",
  indoor: "#0f766e", // teal-700
  outdoor: "#2563eb", // blue-600
  solar: "#f59e0b", // amber-500
  heatLoss: "#dc2626", // red-600
  ventilation: "#7c3aed", // violet-600
  comfortable: "#16a34a", // green-600
  heating: "#dc2626", // red-600
  cooling: "#0ea5e9", // sky-500
  chartGrid: "#e2e8f0",
  chartMarker: "#1e293b",
};

/**
 * Draw a rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw the time display panel
 */
export function drawTimePanel(ctx, timeLabel, x, y, width = 140, height = 50) {
  // Panel background
  ctx.fillStyle = COLORS.panelBg;
  roundRect(ctx, x, y, width, height, 8);
  ctx.fill();

  // Time text
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(timeLabel, x + width / 2, y + height / 2);
}

/**
 * Draw a single metric row
 */
function drawMetricRow(ctx, label, value, unit, color, x, y, width) {
  const labelWidth = 80;
  const valueX = x + labelWidth;

  // Label
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);

  // Value
  ctx.fillStyle = color;
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(value, x + width - 30, y);

  // Unit
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(unit, x + width - 25, y);
}

/**
 * Draw the metrics panel
 */
export function drawMetricsPanel(ctx, data, x, y, width = 200, height = 340) {
  // Panel background
  ctx.fillStyle = COLORS.panelBg;
  roundRect(ctx, x, y, width, height, 12);
  ctx.fill();

  const padding = 16;
  const rowHeight = 32;
  let currentY = y + padding + 10;

  // Temperature section
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("TEMPERATURE", x + padding, currentY);
  currentY += 22;

  drawMetricRow(
    ctx,
    "Inside",
    data.T_in?.toFixed(1) ?? "--",
    "°C",
    COLORS.indoor,
    x + padding,
    currentY,
    width - padding * 2
  );
  currentY += rowHeight;

  drawMetricRow(
    ctx,
    "Outside",
    data.T_out?.toFixed(1) ?? "--",
    "°C",
    COLORS.outdoor,
    x + padding,
    currentY,
    width - padding * 2
  );
  currentY += rowHeight + 12;

  // Energy section
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("ENERGY", x + padding, currentY);
  currentY += 22;

  drawMetricRow(
    ctx,
    "Solar gain",
    Math.round(data.Q_solar ?? 0).toString(),
    "W",
    COLORS.solar,
    x + padding,
    currentY,
    width - padding * 2
  );
  currentY += rowHeight;

  const totalLoss = (data.Q_loss_fabric ?? 0) + (data.Q_loss_vent ?? 0);
  drawMetricRow(
    ctx,
    "Heat loss",
    Math.round(totalLoss).toString(),
    "W",
    COLORS.heatLoss,
    x + padding,
    currentY,
    width - padding * 2
  );
  currentY += rowHeight + 12;

  // Ventilation section
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("VENTILATION", x + padding, currentY);
  currentY += 22;

  drawMetricRow(
    ctx,
    "Air changes",
    (data.achTotal ?? 0).toFixed(1),
    "ACH",
    COLORS.ventilation,
    x + padding,
    currentY,
    width - padding * 2
  );
  currentY += rowHeight + 12;

  // Status section
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("STATUS", x + padding, currentY);
  currentY += 22;

  // Status badge
  const status = data.status ?? "comfortable";
  const statusColor =
    status === "comfortable"
      ? COLORS.comfortable
      : status === "heating"
        ? COLORS.heating
        : COLORS.cooling;
  const statusLabel =
    status === "comfortable"
      ? "Comfortable"
      : status === "heating"
        ? "Needs Heating"
        : "Needs Cooling";

  // Badge background
  ctx.fillStyle = statusColor;
  roundRect(ctx, x + padding, currentY - 10, width - padding * 2, 28, 6);
  ctx.fill();

  // Badge text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(statusLabel, x + width / 2, currentY + 4);
}

/**
 * Draw the mini chart with temperature, solar gain, heat loss, and ventilation
 */
export function drawMiniChart(
  ctx,
  daySeries,
  currentIndex,
  x,
  y,
  width,
  height
) {
  const padding = { top: 20, right: 60, bottom: 45, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const chartX = x + padding.left;
  const chartY = y + padding.top;

  // Background
  ctx.fillStyle = COLORS.panelBg;
  roundRect(ctx, x, y, width, height, 12);
  ctx.fill();

  if (!daySeries || daySeries.length === 0) return;

  // Calculate ranges for all metrics
  let minTemp = Infinity, maxTemp = -Infinity;
  let maxPower = 0;
  let maxAch = 0;

  for (const point of daySeries) {
    // Temperature range
    if (point.T_in < minTemp) minTemp = point.T_in;
    if (point.T_in > maxTemp) maxTemp = point.T_in;
    if (point.T_out < minTemp) minTemp = point.T_out;
    if (point.T_out > maxTemp) maxTemp = point.T_out;

    // Power range (solar gain and heat loss)
    const solar = point.Q_solar ?? 0;
    const loss = (point.Q_loss_fabric ?? 0) + (point.Q_loss_vent ?? 0);
    if (solar > maxPower) maxPower = solar;
    if (loss > maxPower) maxPower = loss;

    // Ventilation range
    const ach = point.achTotal ?? 0;
    if (ach > maxAch) maxAch = ach;
  }

  // Add padding to ranges
  const tempRange = maxTemp - minTemp;
  minTemp = Math.floor(minTemp - tempRange * 0.1);
  maxTemp = Math.ceil(maxTemp + tempRange * 0.1);
  maxPower = Math.ceil(maxPower * 1.1 / 100) * 100; // Round to nearest 100W
  maxAch = Math.ceil(maxAch * 1.1);

  // Ensure minimums
  if (maxPower < 100) maxPower = 100;
  if (maxAch < 1) maxAch = 1;

  // Draw grid lines
  ctx.strokeStyle = COLORS.chartGrid;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  // Horizontal grid lines
  for (let i = 0; i <= 4; i++) {
    const yPos = chartY + (i / 4) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(chartX, yPos);
    ctx.lineTo(chartX + chartWidth, yPos);
    ctx.stroke();
  }

  // Vertical grid lines (time)
  for (let hour = 0; hour <= 24; hour += 6) {
    const xPos = chartX + (hour / 24) * chartWidth;
    ctx.beginPath();
    ctx.moveTo(xPos, chartY);
    ctx.lineTo(xPos, chartY + chartHeight);
    ctx.stroke();

    // Time label
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${hour}:00`, xPos, chartY + chartHeight + 6);
  }

  ctx.setLineDash([]);

  // Left Y-axis labels (Temperature)
  ctx.fillStyle = COLORS.indoor;
  ctx.font = "10px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const tempStep = (maxTemp - minTemp) / 4;
  for (let i = 0; i <= 4; i++) {
    const temp = minTemp + (4 - i) * tempStep;
    const yPos = chartY + (i / 4) * chartHeight;
    ctx.fillText(`${Math.round(temp)}°C`, chartX - 6, yPos);
  }

  // Right Y-axis labels (Power in W)
  ctx.fillStyle = COLORS.solar;
  ctx.textAlign = "left";
  const powerStep = maxPower / 4;
  for (let i = 0; i <= 4; i++) {
    const power = (4 - i) * powerStep;
    const yPos = chartY + (i / 4) * chartHeight;
    ctx.fillText(`${Math.round(power)}W`, chartX + chartWidth + 6, yPos);
  }

  // Helper functions for coordinate conversion
  const toCanvasX = (index) => chartX + (index / (daySeries.length - 1)) * chartWidth;
  const toTempY = (temp) => chartY + chartHeight - ((temp - minTemp) / (maxTemp - minTemp)) * chartHeight;
  const toPowerY = (power) => chartY + chartHeight - (power / maxPower) * chartHeight;
  const toAchY = (ach) => chartY + chartHeight - (ach / maxAch) * chartHeight;

  // Draw heat loss line (red, dashed)
  ctx.strokeStyle = COLORS.heatLoss;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let i = 0; i < daySeries.length; i++) {
    const px = toCanvasX(i);
    const loss = (daySeries[i].Q_loss_fabric ?? 0) + (daySeries[i].Q_loss_vent ?? 0);
    const py = toPowerY(loss);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw solar gain line (amber, solid)
  ctx.strokeStyle = COLORS.solar;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < daySeries.length; i++) {
    const px = toCanvasX(i);
    const py = toPowerY(daySeries[i].Q_solar ?? 0);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw ventilation line (purple, dotted)
  ctx.strokeStyle = COLORS.ventilation;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  for (let i = 0; i < daySeries.length; i++) {
    const px = toCanvasX(i);
    const py = toAchY(daySeries[i].achTotal ?? 0);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw outdoor temperature line (blue, dashed)
  ctx.strokeStyle = COLORS.outdoor;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  for (let i = 0; i < daySeries.length; i++) {
    const px = toCanvasX(i);
    const py = toTempY(daySeries[i].T_out);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw indoor temperature line (teal, solid, thicker)
  ctx.strokeStyle = COLORS.indoor;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < daySeries.length; i++) {
    const px = toCanvasX(i);
    const py = toTempY(daySeries[i].T_in);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw current time marker
  if (currentIndex >= 0 && currentIndex < daySeries.length) {
    const markerX = toCanvasX(currentIndex);

    // Vertical line
    ctx.strokeStyle = COLORS.chartMarker;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(markerX, chartY);
    ctx.lineTo(markerX, chartY + chartHeight);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Dot on indoor temp line
    const dotY = toTempY(daySeries[currentIndex].T_in);
    ctx.fillStyle = COLORS.indoor;
    ctx.beginPath();
    ctx.arc(markerX, dotY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Legend (bottom of chart)
  const legendY = y + height - 12;
  let legendX = x + padding.left;
  const legendSpacing = 140;

  ctx.font = "10px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.setLineDash([]);

  // Indoor temp legend
  ctx.fillStyle = COLORS.indoor;
  ctx.fillRect(legendX, legendY - 8, 14, 3);
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText("Indoor °C", legendX + 18, legendY);
  legendX += legendSpacing;

  // Outdoor temp legend
  ctx.strokeStyle = COLORS.outdoor;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY - 6);
  ctx.lineTo(legendX + 14, legendY - 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText("Outdoor °C", legendX + 18, legendY);
  legendX += legendSpacing;

  // Solar gain legend
  ctx.fillStyle = COLORS.solar;
  ctx.fillRect(legendX, legendY - 8, 14, 3);
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText("Solar W", legendX + 18, legendY);
  legendX += legendSpacing;

  // Heat loss legend
  ctx.strokeStyle = COLORS.heatLoss;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY - 6);
  ctx.lineTo(legendX + 14, legendY - 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText("Heat loss W", legendX + 18, legendY);
  legendX += legendSpacing;

  // Ventilation legend
  ctx.strokeStyle = COLORS.ventilation;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY - 6);
  ctx.lineTo(legendX + 14, legendY - 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText("Vent ACH", legendX + 18, legendY);
}

/**
 * Draw all overlays onto the capture canvas
 */
export function drawOverlays(ctx, frameData, daySeries, currentIndex, layout) {
  const {
    width,
    height,
    sceneWidth,
    sceneHeight,
    panelX,
    panelY,
    chartX,
    chartY,
    chartWidth,
    chartHeight,
  } = layout;

  // Time panel (top right of scene area)
  drawTimePanel(ctx, frameData.timeLabel ?? "--:--", panelX, panelY);

  // Metrics panel (right side)
  drawMetricsPanel(ctx, frameData, panelX, panelY + 60);

  // Mini chart (bottom)
  drawMiniChart(ctx, daySeries, currentIndex, chartX, chartY, chartWidth, chartHeight);
}

/**
 * Calculate the layout for a given output resolution
 */
export function calculateLayout(outputWidth, outputHeight) {
  const panelWidth = 220;
  const chartHeight = 180;
  const paddingTop = 30;
  const paddingSide = 30;
  const paddingBottom = 150; // Extra padding for video controls

  return {
    width: outputWidth,
    height: outputHeight,
    sceneWidth: outputWidth - panelWidth - paddingSide * 2,
    sceneHeight: outputHeight - chartHeight - paddingTop - paddingBottom,
    panelX: outputWidth - panelWidth - paddingSide,
    panelY: paddingTop,
    chartX: paddingSide,
    chartY: outputHeight - chartHeight - paddingBottom,
    chartWidth: outputWidth - paddingSide * 2,
    chartHeight: chartHeight,
  };
}
