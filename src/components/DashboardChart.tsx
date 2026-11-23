import React from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface DashboardChartProps {
  kind: 'line' | 'bar';
  data: any;
  options: any;
  plugins?: any[];
}

export const DashboardChart: React.FC<DashboardChartProps> = ({ kind, data, options, plugins = [] }) => {
  if (kind === 'bar') return <Bar data={data} options={options} plugins={plugins} />;
  return <Line data={data} options={options} plugins={plugins} />;
};
