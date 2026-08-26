import { Commitment, isCommitmentActive, monthToVal, valToMonth, formatMonthReadable } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, HelpCircle, AlertCircle } from 'lucide-react';

interface ProjectionChartProps {
  commitments: Commitment[];
  selectedMonth: string;
}

export default function ProjectionChart({ commitments, selectedMonth }: ProjectionChartProps) {
  // Generate the next 12 months starting from selectedMonth
  const startVal = monthToVal(selectedMonth);
  const next12Months = Array.from({ length: 12 }, (_, i) => valToMonth(startVal + i));

  // Build the chart data
  const data = next12Months.map(month => {
    const activeComs = commitments.filter(c => isCommitmentActive(c, month));
    const total = activeComs.reduce((sum, c) => sum + c.amount, 0);
    
    // Group by category for stacked visual or detailed notes
    const breakdown = activeComs.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + c.amount;
      return acc;
    }, {} as Record<string, number>);

    // Get simple month name like "Jul 26"
    const [year, monthIndex] = month.split('-');
    const date = new Date(Number(year), Number(monthIndex) - 1, 1);
    const shortLabel = date.toLocaleDateString('default', { month: 'short', year: '2-digit' });

    return {
      month,
      shortLabel,
      total,
      breakdown,
      commitments: activeComs.map(c => ({ name: c.name, amount: c.amount, category: c.category })),
    };
  });

  const formatCurrency = (val: number) => {
    return 'RM ' + Math.round(val).toLocaleString('en-US');
  };

  // Calculate some analytics
  const firstMonthTotal = data[0]?.total || 0;
  const lastMonthTotal = data[11]?.total || 0;
  const reduction = firstMonthTotal - lastMonthTotal;
  const percentReduction = firstMonthTotal > 0 ? Math.round((reduction / firstMonthTotal) * 100) : 0;

  // Custom tooltip to display active commitments
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-xl max-w-xs text-xs space-y-2 font-sans font-medium">
          <p className="font-bold border-b border-slate-800 pb-1.5 text-indigo-300">
            {formatMonthReadable(dataPoint.month)}
          </p>
          <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            Active Commitments ({dataPoint.commitments.length})
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800">
            {dataPoint.commitments.map((c: any, index: number) => (
              <div key={index} className="flex justify-between gap-4 pt-1.5 first:pt-0">
                <span className="truncate text-slate-300">{c.name}</span>
                <span className="font-bold text-slate-100 shrink-0">{formatCurrency(c.amount)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-indigo-400 text-sm">
            <span>Total:</span>
            <span>{formatCurrency(dataPoint.total)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6" id="projection-chart-section">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800 font-sans tracking-tight">12-Month Commitment Projection</h3>
          <p className="text-xs text-slate-400 mt-0.5">Visualize how your monthly commitment decreases as installments expire</p>
        </div>

        {/* Analytics Card */}
        {reduction > 0 && (
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center gap-3 self-start md:self-auto" id="projection-reduction-badge">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <TrendingDown size={16} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Projected Debt Relief</p>
              <p className="text-xs font-bold text-indigo-800">
                Decreases by {formatCurrency(reduction)} (-{percentReduction}%) by {formatMonthReadable(data[11].month)}
              </p>
            </div>
          </div>
        )}
      </div>

      {commitments.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-200" id="empty-chart-state">
          <AlertCircle className="text-slate-400 mb-2" size={24} />
          <p className="text-xs text-slate-400 font-semibold">Add commitments to view your 12-month timeline projection</p>
        </div>
      ) : (
        <div className="space-y-4" id="projection-chart-container">
          {/* Recharts Area Chart */}
          <div className="h-72 w-full animate-fade-in" id="responsive-recharts-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="shortLabel" 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed max-w-2xl bg-slate-50 p-3 rounded-2xl border border-slate-200/60 font-medium">
            <HelpCircle size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <span>
              This graph displays your aggregate obligations over the next 12 months. Short-term contracts (such as 6-month or 12-month credit card payments, Shopee Pay, and Grab installments) will expire and drop out of the totals, demonstrating how your disposable income increases over time.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
