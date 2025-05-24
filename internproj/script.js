// script.js

fetch('RawData.csv')
  .then(res => res.text())
  .then(text => {
    // Parse CSV (skip header)
    const lines     = text.trim().split('\n');
    const dataLines = lines.slice(1);
    const timestamps = [];
    const labels     = [];
    const values     = [];

    dataLines.forEach(line => {
      const [ts, lvl] = line.split(';');
      const d = new Date(ts);
      timestamps.push(d);
      labels.push(d.toLocaleDateString());
      values.push(Number(lvl));
    });

    // 1) Basic stats
    const sum   = values.reduce((a, b) => a + b, 0);
    const mean  = sum / values.length;
    const avg   = mean.toFixed(2);
    const maxV  = Math.max(...values);
    const minV  = Math.min(...values);
    const curV  = values[values.length - 1].toFixed(2);

    // 2) Pump cycles & runtime
    let cycles    = 0;
    let runtimeMs = 0;
    let pumping   = false;
    let startTime = null;
    const cycleStarts = [];

    for (let i = 1; i < values.length; i++) {
      const delta = values[i] - values[i - 1];
      const tPrev = timestamps[i - 1];

      if (!pumping && delta > 0.5) {
        pumping   = true;
        startTime = tPrev;
        cycles++;
        cycleStarts.push(tPrev);
      }
      if (pumping && delta <= 0) {
        pumping   = false;
        runtimeMs += (tPrev - startTime);
      }
    }
    if (pumping && startTime) {
      runtimeMs += (timestamps[timestamps.length - 1] - startTime);
    }
    const runtimeHrs = (runtimeMs / 1000 / 3600).toFixed(2);

    // 3) Update stat cards
    document.getElementById('currentLevel').textContent = `Current Level: ${curV} ft`;
    document.getElementById('avgLevel').    textContent = `Average Level: ${avg} ft`;
    document.getElementById('maxLevel').    textContent = `Max Level: ${maxV.toFixed(2)} ft`;
    document.getElementById('minLevel').    textContent = `Min Level: ${minV.toFixed(2)} ft`;
    document.getElementById('cycleCount').  textContent = `Pump Cycles: ${cycles}`;
    document.getElementById('runtime').     textContent = `Pump Runtime: ${runtimeHrs} hrs`;

    // 4) 7-point moving average (trend)
    const maWindow = 7;
    const trend = values.map((_, i) => {
      if (i < maWindow - 1) return null;
      const slice = values.slice(i - maWindow + 1, i + 1);
      return slice.reduce((a, b) => a + b, 0) / maWindow;
    });

    // 5) Rolling-window anomaly detection (local ±2σ)
    const anomalyWindow = 24;
    const pointRadii  = [];
    const pointColors = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(anomalyWindow / 2));
      const end   = Math.min(values.length, i + Math.ceil(anomalyWindow / 2));
      const slice = values.slice(start, end);
      const localMean = slice.reduce((a, v) => a + v, 0) / slice.length;
      const localStd  = Math.sqrt(
        slice.reduce((a, v) => a + Math.pow(v - localMean, 2), 0) / slice.length
      );

      if (Math.abs(values[i] - localMean) > 2 * localStd) {
        pointRadii[i]  = 5;
        pointColors[i] = 'red';
      } else {
        pointRadii[i]  = 0;
        pointColors[i] = 'transparent';
      }
    }

    // 6) Daily pump-cycle counts (bar chart)
    const dailyCounts = {};
    cycleStarts.forEach(d => {
      const day = d.toLocaleDateString();
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });
    const barLabels = Object.keys(dailyCounts);
    const barData   = barLabels.map(d => dailyCounts[d]);

    // 7) Render line + trend + anomalies
    new Chart(document.getElementById('lineChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Water Level',
            data: values,
            borderColor: '#2563eb',
            borderWidth: 1.5,
            tension: 0.3,
            fill: false,
            pointRadius: 0
          },
          {
            label: '7-pt MA',
            data: trend,
            borderColor: '#4b5563',
            borderDash: [4, 4],
            borderWidth: 1.5,
            tension: 0.3,
            fill: false,
            pointRadius: 0,
            spanGaps: true
          },
          {
            label: 'Anomalies',
            data: labels.map((l, i) => ({ x: l, y: values[i] })),
            type: 'scatter',
            pointRadius: pointRadii,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        layout: { padding: { left: 0, right: 0, top: 0, bottom: 0 } },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              boxWidth: 10,
              padding: 12
            }
          },
          tooltip: {
            mode: 'nearest',
            intersect: false,
            padding: 8,
            titleMarginBottom: 6,
            bodyFont: { size: 12 }
          }
        },
        scales: {
          x: {
            display: false,
            grid: { display: false }
          },
          y: {
            grid: {
              color: '#e5e7eb',
              borderDash: [2, 2]
            },
            ticks: {
              padding: 4,
              maxTicksLimit: 6
            },
            border: { dash: [2, 2] }
          }
        }
      }
    });

    // 8) Render bar chart of daily cycles
    new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: [{
          label: 'Pump Cycles',
          data: barData,
          backgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { autoSkip: true, maxTicksLimit: 10 } },
