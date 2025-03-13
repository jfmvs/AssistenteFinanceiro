const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

function generateColors(size) {
  const cores = [];
  for (let i = 0; i < size; i++) {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    cores.push(`rgba(${r}, ${g}, ${b}, 0.8)`);
  }
  return cores;
}

async function generateChart(data) {
  const categorias = data.map((item) => item.categoria);
  const valores = data.map((item) => item.valor);

  const width = 800;
  const height = 800;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const configuration = {
    type: 'pie',
    data: {
      labels: categorias,
      datasets: [
        {
          label: 'Valores',
          data: valores,
          backgroundColor: generateColors(data.length),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: 'Gráfico de Pizza - Transações Financeiras',
        },
      },
    },
  };

  return await chartJSNodeCanvas.renderToBuffer(configuration);
}

module.exports = {
  generateChart,
};
