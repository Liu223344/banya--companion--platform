(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  function makeChart(id) {
    var el = document.getElementById(id);
    if (!el || !window.echarts) return null;
    return echarts.init(el, null, { renderer: 'svg' });
  }

  function axisText() {
    return {
      color: muted,
      fontFamily: 'Instrument Sans',
      fontSize: 12
    };
  }

  var charts = [];

  var scenes = makeChart('chart-scenes');
  if (scenes) {
    scenes.setOption({
      animation: false,
      color: [accent, accent2, muted, accent + '99', accent2 + '99'],
      tooltip: {
        trigger: 'item',
        appendToBody: true
      },
      legend: {
        bottom: 0,
        textStyle: axisText()
      },
      series: [{
        name: '使用场景',
        type: 'pie',
        radius: ['44%', '70%'],
        center: ['50%', '43%'],
        avoidLabelOverlap: true,
        label: {
          color: ink,
          formatter: '{b}\n{d}%'
        },
        labelLine: {
          lineStyle: { color: rule }
        },
        data: [
          { value: 46, name: '日常放学后' },
          { value: 20, name: '周末加班' },
          { value: 14, name: '临时托底' },
          { value: 12, name: '专项成长' },
          { value: 8, name: '兴趣陪伴' }
        ]
      }]
    });
    charts.push(scenes);
  }

  var health = makeChart('chart-health');
  if (health) {
    health.setOption({
      animation: false,
      color: [accent, accent2],
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: 12,
        right: 18,
        top: 26,
        bottom: 18,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: axisText(),
        splitLine: { lineStyle: { color: rule } },
        axisLine: { lineStyle: { color: rule } }
      },
      yAxis: {
        type: 'category',
        data: ['情绪稳定', '运动习惯', '阅读表达', '社交互动', '作业节奏'],
        axisLabel: axisText(),
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      series: [{
        name: '贡献度设想',
        type: 'bar',
        data: [90, 82, 76, 72, 68],
        barWidth: 16,
        itemStyle: {
          borderRadius: [0, 999, 999, 0],
          color: accent
        },
        label: {
          show: true,
          position: 'right',
          color: ink,
          formatter: '{c}'
        }
      }]
    });
    charts.push(health);
  }

  var change = makeChart('chart-change');
  if (change) {
    change.setOption({
      animation: false,
      color: [accent2, accent],
      tooltip: {
        trigger: 'axis',
        appendToBody: true
      },
      legend: {
        top: 0,
        textStyle: axisText()
      },
      grid: {
        left: 18,
        right: 24,
        top: 46,
        bottom: 24,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['安全感', '情绪表达', '户外活动', '屏幕替代', '家长安心'],
        axisLabel: axisText(),
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: axisText(),
        splitLine: { lineStyle: { color: rule } },
        axisLine: { lineStyle: { color: rule } }
      },
      series: [
        {
          name: '真空期',
          type: 'bar',
          data: [42, 35, 28, 82, 30],
          barWidth: 18,
          itemStyle: {
            color: accent2,
            borderRadius: [8, 8, 0, 0]
          }
        },
        {
          name: '成长陪伴后',
          type: 'bar',
          data: [86, 78, 74, 36, 88],
          barWidth: 18,
          itemStyle: {
            color: accent,
            borderRadius: [8, 8, 0, 0]
          }
        }
      ]
    });
    charts.push(change);
  }

  window.addEventListener('resize', function() {
    charts.forEach(function(chart) {
      chart.resize();
    });
  });
})();
