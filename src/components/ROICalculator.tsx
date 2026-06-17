import React, { useState, useMemo } from 'react';

export default function ROICalculator() {
  const [monthlySpend, setMonthlySpend] = useState<number>(5000);
  const [growthRate, setGrowthRate] = useState<number>(10);
  const [optimizationRate, setOptimizationRate] = useState<number>(20);

  const results = useMemo(() => {
    const data: { year: number; monthlySpend: number; annualSavings: number; cumulativeSavings: number }[] = [];
    let currentSpend = monthlySpend;
    let cumulative = 0;
    const opt = optimizationRate / 100;
    const growth = growthRate / 100;

    for (let y = 1; y <= 5; y++) {
      const yearSavings = currentSpend * opt * 12;
      cumulative += yearSavings;
      data.push({
        year: y,
        monthlySpend: Math.round(currentSpend),
        annualSavings: Math.round(yearSavings),
        cumulativeSavings: Math.round(cumulative),
      });
      currentSpend = currentSpend * (1 + growth);
    }
    return data;
  }, [monthlySpend, growthRate, optimizationRate]);

  const maxCumulative = results[4].cumulativeSavings;
  const barHeight = (val: number) => Math.max(8, (val / maxCumulative) * 220);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Inputs */}
      <div className="card-blur rounded-xl p-6 sm:p-8 mb-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6">Your SaaS Stack Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Monthly SaaS Spend ($)</label>
            <input type="number" value={monthlySpend} onChange={e => setMonthlySpend(Number(e.target.value))} min={100} max={1000000}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Annual Growth Rate (%)</label>
            <input type="number" value={growthRate} onChange={e => setGrowthRate(Number(e.target.value))} min={0} max={100}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Optimization Savings (%)</label>
            <input type="number" value={optimizationRate} onChange={e => setOptimizationRate(Number(e.target.value))} min={5} max={50}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* SVG Bar Chart */}
        <div className="card-blur rounded-xl p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">Cumulative Savings Projection</h3>
          <svg viewBox="0 0 400 280" className="w-full">
            <defs>
              <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#177245" />
                <stop offset="100%" stopColor="#0d4a2c" />
              </linearGradient>
            </defs>
            {[results[0], results[2], results[4]].map((d, i) => {
              const h = barHeight(d.cumulativeSavings);
              const x = 60 + i * 130;
              const y = 250 - h;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={80} height={h} fill="url(#emeraldGradient)" rx={4} />
                  <text x={x + 40} y={y - 8} textAnchor="middle" className="text-xs fill-zinc-300" fontSize="11">
                    ${(d.cumulativeSavings / 1000).toFixed(0)}K
                  </text>
                  <text x={x + 40} y={268} textAnchor="middle" className="text-xs fill-zinc-500" fontSize="11">
                    Year {d.year}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Data Table */}
        <div className="card-blur rounded-xl p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">5-Year Projection</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-2 px-3 text-zinc-500 font-medium">Year</th>
                <th className="text-right py-2 px-3 text-zinc-500 font-medium">Monthly Spend</th>
                <th className="text-right py-2 px-3 text-zinc-500 font-medium">Annual Savings</th>
                <th className="text-right py-2 px-3 text-zinc-500 font-medium">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {results.map(d => (
                <tr key={d.year} className="border-b border-zinc-800/50">
                  <td className="py-2 px-3 text-zinc-200">{d.year}</td>
                  <td className="py-2 px-3 text-right text-zinc-300">${d.monthlySpend.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-emerald-400">${d.annualSavings.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-semibold">${d.cumulativeSavings.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total */}
      <div className="card-blur rounded-xl p-8 text-center border border-emerald-400/10 bg-emerald-400/5">
        <div className="text-sm text-zinc-500 mb-2">5-Year Total Savings Potential</div>
        <div className="text-5xl font-bold text-emerald-400">
          ${results[4].cumulativeSavings.toLocaleString()}
        </div>
        <div className="text-sm text-zinc-500 mt-2">
          With {optimizationRate}% optimization on ${monthlySpend.toLocaleString()}/mo at {growthRate}% annual growth
        </div>
      </div>
    </div>
  );
}
