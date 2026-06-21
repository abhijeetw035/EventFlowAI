import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { getAnalyticsSummary } from "../api/client.js";

const COLORS = ["#006e1c", "#0061a4", "#8b5000", "#6750a4", "#006a6a", "#ba1a1a"];

const HeatmapGrid = ({ data }) => {
  if (!data || data.length === 0) return <div className="text-sm text-on-surface-var">No data available</div>;
  
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Find max count to scale colors
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  const getValue = (day, hour) => {
    const entry = data.find(d => d.day_of_week === day && d.hour === hour);
    return entry ? entry.count : 0;
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="flex text-[10px] text-on-surface-var mb-1 ml-16">
          {hours.map(h => (
            <div key={h} className="flex-1 text-center">{h}h</div>
          ))}
        </div>
        {days.map(day => (
          <div key={day} className="flex items-center mb-1">
            <div className="w-16 text-[10px] font-medium text-on-surface-var truncate pr-2 text-right">
              {day.substring(0, 3)}
            </div>
            <div className="flex flex-1 gap-1">
              {hours.map(hour => {
                const count = getValue(day, hour);
                const intensity = count / maxCount;
                // Using primary color with varying opacity for heatmap
                return (
                  <div 
                    key={hour} 
                    className="flex-1 h-6 rounded-sm transition-opacity hover:ring-1 hover:ring-on-surface"
                    style={{ 
                      backgroundColor: count > 0 ? '#6750a4' : '#e5e7eb', // e5e7eb is gray-200 for 0
                      opacity: count > 0 ? Math.max(0.15, intensity) : 0.3 
                    }}
                    title={`${day} ${hour}h: ${count} incidents`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AnalyticsPanel({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAnalyticsSummary(startDate, endDate);
        setData(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchData();
    }, 300);

    return () => clearTimeout(timer);
  }, [startDate, endDate]);

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-on-surface-var">
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-error">
        <p>Error loading analytics: {error}</p>
      </div>
    );
  }

  if (!data || data.incident_count_in_window === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-on-surface-var text-center">
        <div>
          <h2 className="text-xl font-bold mb-2">No Data Found</h2>
          <p>No incidents occurred within the selected time window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-on-surface">Analytics Summary</h2>
        <div className="bg-primary-container px-4 py-2 rounded-xl text-primary-on-cont font-medium">
          Total Incidents: {data.incident_count_in_window}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Incident Volume over Time */}
        <section className="card-organic p-5">
          <h3 className="font-display text-sm font-bold text-on-surface mb-4">Incident Volume over Time</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.incident_volume_timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#4b5563'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 10, fill: '#4b5563'}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="count" name="Incidents" fill="#0061a4" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Avg Personnel & Barricades Trend */}
        <section className="card-organic p-5">
          <h3 className="font-display text-sm font-bold text-on-surface mb-4">Personnel & Barricades Trend</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.avg_personnel_barricades_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#4b5563'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 10, fill: '#4b5563'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                <Line type="monotone" dataKey="recommended_personnel" name="Personnel" stroke="#6750a4" strokeWidth={3} dot={{r: 3}} activeDot={{r: 5}} />
                <Line type="monotone" dataKey="recommended_barricades" name="Barricades" stroke="#8b5000" strokeWidth={3} dot={{r: 3}} activeDot={{r: 5}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Severity Tier Distribution */}
        <section className="card-organic p-5">
          <h3 className="font-display text-sm font-bold text-on-surface mb-4">Severity Tier Distribution</h3>
          <div className="h-[250px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.severity_tier_distribution}
                  dataKey="count"
                  nameKey="deployment_tier"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.severity_tier_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Incident Type Breakdown */}
        <section className="card-organic p-5">
          <h3 className="font-display text-sm font-bold text-on-surface mb-4">Incident Type Breakdown</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.incident_type_breakdown} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{fontSize: 10, fill: '#4b5563'}} axisLine={false} tickLine={false} />
                <YAxis dataKey="event_cause" type="category" width={80} tick={{fontSize: 10, fill: '#4b5563'}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="count" name="Incidents" fill="#006e1c" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {data.incident_type_breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Top Hotspot Corridors */}
        <section className="card-organic p-5 lg:col-span-2">
          <h3 className="font-display text-sm font-bold text-on-surface mb-4">Top Congestion Hotspots (Corridors)</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_hotspot_corridors} layout="vertical" margin={{ top: 0, right: 20, left: 100, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{fontSize: 10, fill: '#4b5563'}} axisLine={false} tickLine={false} />
                <YAxis dataKey="corridor" type="category" tick={{fontSize: 10, fill: '#4b5563'}} axisLine={false} tickLine={false} width={120} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="count" name="Incidents" fill="#ba1a1a" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Temporal Pattern Heatmap */}
        <section className="card-organic p-5 lg:col-span-2">
          <h3 className="font-display text-sm font-bold text-on-surface mb-4">Temporal Congestion Pattern (Day vs Hour)</h3>
          <HeatmapGrid data={data.temporal_pattern_heatmap} />
        </section>

      </div>
    </div>
  );
}
