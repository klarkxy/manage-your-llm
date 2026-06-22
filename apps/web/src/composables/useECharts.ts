import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart, RadarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  MarkLineComponent,
  DatasetComponent,
} from 'echarts/components';

let registered = false;

/**
 * ECharts treeshaking registration. Importing from `echarts/core` and pulling
 * only the chart types and components we actually use keeps the bundle small
 * (the full echarts package is ~1MB; this subset is ~150KB gzipped).
 */
export function ensureECharts(): void {
  if (registered) return;
  use([
    CanvasRenderer,
    LineChart,
    BarChart,
    RadarChart,
    PieChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    DataZoomComponent,
    MarkLineComponent,
    DatasetComponent,
  ]);
  registered = true;
}
