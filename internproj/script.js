// script.js

fetch('RawData.csv')
  .then(res => res.text())
  .then(text => {
    // 1) Parse CSV 
    const lines     = text.trim().split('\n');
    const dataLines = lines.slice(1);
    const timestamps = [];
    const values     = [];

    dataLines.forEach(line => {
      const [ts, lvl] = line.split(';');
      const date      = new Date(ts);
      timestamps.push(date);
      values.push(+lvl);
    });

    // 2) Basic stats
    const sum   = values.reduce((a, b) => a + b, 0);
    const mean  = sum / values.length;
    const avg   = mean.toFixed(2);
    const maxV  = Math.max(...values);
    const minV  = Math.min(...values);
    const curV  = values[values.length - 1].toFixed(2);

    // 3) Pump cycles & runtime
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

    // 4) Update stat cards
    document.getElementById('currentLevel').textContent = `Current Level: ${curV} ft`;
    document.getElementById('avgLevel').textContent     = `Average Level: ${avg} ft`;
    document.getElementById('maxLevel').textContent     = `Max Level: ${maxV.toFixed(2)} ft`;
    document.getElementById('minLevel').textContent     = `Min Level: ${minV.toFixed(2)} ft`;
    document.getElementById('cycleCount').textContent   = `Pump Cycles: ${cycles}`;
    document.getElementById('runtime').textContent      = `Pump Runtime: ${runtimeHrs} hrs`;

    // 5) 7-point moving average (trend)
    const maWindow = 7;
    const trendData = values.map((_, i) => {
      if (i < maWindow - 1) return null;
      const slice = values.slice(i - maWindow + 1, i + 1);
      const m     = slice.reduce((a, b) => a + b, 0) / maWindow;
      return { x: timestamps[i], y: m };
    }).filter(pt => pt !== null);

    // 6) Rolling-window anomaly detection (local ±2σ)
    const anomalyWindow = 24;
    const anomalies = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(anomalyWindow / 2));
      const end   = Math.min(values.length, i + Math.ceil(anomalyWindow / 2));
      const slice = values.slice(start, end);
      const localMean = slice.reduce((a, v) => a + v, 0) / slice.length;
      const localStd  = Math.sqrt(
        slice.reduce((a, v) => a + Math.pow(v - localMean, 2), 0) / slice.length
      );

      if (Math.abs(values[i] - localMean) > 2 * localStd) {
        anomalies.push({ x: timestamps[i], y: values[i] });
      }
    }

    // 7) Raw data for time-axis
    const rawData = timestamps.map((t, i) => ({ x: t, y: values[i] }));

    // 8) Daily pump-cycle counts (bar chart)
    const dailyCounts = {};
    cycleStarts.forEach(d => {
      const day = d.toLocaleDateString();
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });
    const barLabels = Object.keys(dailyCounts);
    const barData   = barLabels.map(day => dailyCounts[day]);

    // 9) Render the time-series line chart
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    new Chart(ctxLine, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Water Level',
            data: rawData,
            borderColor: '#2563eb',
            borderWidth: 1.5,
            tension: 0.3,
            fill: false,
            pointRadius: 0
          },
          {
            label: '7-pt MA',
            data: trendData,
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
            data: anomalies,
            type: 'scatter',
            backgroundColor: 'red',
            pointRadius: 5
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
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
            padding: 8
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              tooltipFormat: 'MMM d, yyyy HH:mm',
              displayFormats: {
                hour: 'MMM d HH:mm',
                day: 'MMM d'
              }
            },
            title: {
              display: true,
              text: 'Timestamp'
            },
            grid: { display: false },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            }
          },
          y: {
            grid: {
              color: '#e5e7eb',
              borderDash: [2, 2]
            }
          }
        }
      }
    });

    // 10) Render the daily cycles bar chart
    const ctxBar = document.getElementById('barChart').getContext('2d');
    new Chart(ctxBar, {
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
          x: { ticks: { autoSkip: true, maxTicksLimit: 8 } },
          y: { beginAtZero: true }
        }
      }
    });
  })
  .catch(err => console.error('Failed to load CSV:', err));
