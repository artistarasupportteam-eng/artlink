import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDay } from "@/lib/format";

export function ActivityChart({ days }: { days: { day: string; views: number; clicks: number }[] }) {
  const [accent, setAccent] = useState("#d4a45a");
  const [muted, setMuted] = useState("#a39e94");
  const [grid, setGrid] = useState("#3c4046");
  const [surface, setSurface] = useState("#26292e");
  const [fg, setFg] = useState("#f3f0e8");
  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      setAccent(style.getPropertyValue("--color-accent").trim() || "#d4a45a");
      setMuted(style.getPropertyValue("--color-muted").trim() || "#a39e94");
      setGrid(style.getPropertyValue("--color-border").trim() || "#3c4046");
      setSurface(style.getPropertyValue("--color-surface").trim() || "#26292e");
      setFg(style.getPropertyValue("--color-fg").trim() || "#f3f0e8");
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days.map((day) => ({ ...day, label: formatDay(day.day) }))}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: muted, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: muted, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip contentStyle={{ background: surface, border: `1px solid ${grid}`, color: fg, borderRadius: 8 }} />
          <Bar dataKey="views" fill={accent} radius={[4, 4, 0, 0]} />
          <Bar dataKey="clicks" fill={muted} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
