import { Commitment, isCommitmentActive, monthToVal, valToMonth, formatMonthReadable } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, HelpCircle, AlertCircle, Sparkles } from 'lucide-react';

interface ProjectionChartProps {
  commitments: Commitment[];
  selectedMonth: string;
}

export default function ProjectionChart({ commitments, selectedMonth }: ProjectionChartProps) {
  const startVal = monthToVal(selectedMonth);
  const next12Months = Array.from({ length: 12 }, (_, i) => valToMonth(startVal + i));

  const data = next12Months.map(month => {
    const activeComs = commitments.filter(c => isCommitmentActive(c, month));
    const total = activeComs.reduce((sum, c) => sum + c.amount, 0);
    
    const [year, monthIndex] = month.split('-');
    const date = new Date(Number(year), Number(monthIndex) - 1, 1);
    const shortLabel = date.toLocaleDateString('default', { month: 'short' });

    return {
      month,
      shortLabel,
      total,
      commitments: activeComs.map(c => ({ name: c.name, amount: c.amount, category: c.category })),
    };
  });

  const formatCurrency = (val: number) => {
    return 'RM ' + Math.round(val).toLocaleString('en-US');
  };

  const firstMonthTotal = data[0]?.total || 0;
  const lastMonthTotal = data[11]?.total || 0;
  const reduction = firstMonthTotal - lastMonthTotal;
  const percentReduction = firstMonthTotal > 0 ? Math.round((reduction / firstMonthTotal) * 100) : 0;

  // Custom iOS Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-black/90 backdrop-blur-xl text-white p-3.5 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.3)] max-w-xs text-xs space-y-2 font-sans animate-ios-sheet">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-bold text-[#007AFF]">{formatMonthReadable(dataPoint.month)}</span>
            <span className="font-bold text-white tabular-nums">{formatCurrency(dataPoint.total)}</span>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 divide-y divide-white/5">
            {dataPoint.commitments.map((c: any, index: number) => (
              <div key={index} className="flex justify-between gap-3 pt-1 first:pt-0 text-[11px]">
                <span className="truncate text-slate-300">{c.name}</span>
                <span className="font-semibold text-white shrink-0 tabular-nums">{formatCurrency(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4" id="projection-chart-section">
      
      {/* Section Title & Analytics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1C1C1E] tracking-tight">
            12-Month Projections
          </h2>
          <p className="text-xs text-[#8E8E93] mt-0.5">
            Forecasted obligations as installments reach completion
          </p>
        </div>

        {reduction > 0 && (
          <div className="bg-white px-3.5 py-2 rounded-xl border border-black/[0.06] shadow-2xs flex items-center gap-2.5 self-start sm:self-auto" id="projection-reduction-badge">
            <div className="w-7 h-7 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center shrink-0">
              <TrendingDown size={15} strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block">Projected Savings</span>
              <span className="text-xs font-bold text-[#34C759]">
                -{formatCurrency(reduction)} (-{percentReduction}%) by {formatMonthReadable(data[11].month)}
              </span>
            </div>
          </div>
        )}
      </div>

      {commitments.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center bg-white rounded-2xl border border-black/[0.06] p-6 shadow-2xs" id="empty-chart-state">
          <AlertCircle className="text-[#8E8E93] mb-2" size={24} />
          <p className="text-xs text-[#8E8E93] font-medium">Add commitments to generate your 12-month timeline projection</p>
        </div>
      ) : (
        /* Apple Health/Stocks Style Inset Card */
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 sm:p-6 space-y-4" id="projection-chart-container">
          
          <div className="h-60 sm:h-72 w-full" id="responsive-recharts-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007AFF" stopOpacity={0.28}/>
                    <stop offset="95%" stopColor="#007AFF" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F2F7" />
                <XAxis 
                  dataKey="shortLabel" 
                  tick={{ fontSize: 11, fill: '#8E8E93', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 10, fill: '#8E8E93', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#007AFF" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 bg-[#F2F2F7] rounded-xl text-xs text-[#8E8E93] flex items-start gap-2 border border-[#E5E5EA]">
            <HelpCircle size={14} className="text-[#007AFF] mt-0.5 shrink-0" />
            <span>
              This chart estimates your aggregate monthly obligations. As shorter installment cycles conclude (Grab, Shopee PayLater, short-term installments), monthly totals decrease, reflecting an increase in disposable cash flow.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
