import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { 
  Cpu, Thermometer, HardDrive, Battery, Wifi, Activity, 
  AlertTriangle, Shield, CheckCircle, Clock, Zap, Server, Search
} from "lucide-react";

// --- Types & Constants ---
type DataPoint = { time: number; cpu: number; tempCpu: number; tempChassis: number; ram: number };
type LogEvent = { id: number; time: string; msg: string; type: 'info' | 'warn' | 'alert' };

const INITIAL_DATA_POINTS = 30;
const CHART_COLOR_CYAN = "hsl(185, 85%, 55%)";
const CHART_COLOR_VIOLET = "hsl(265, 70%, 65%)";
const CHART_COLOR_RED = "hsl(0, 72%, 60%)";

const componentScores = [
  { name: "CPU", score: 94 },
  { name: "GPU", score: 96 },
  { name: "RAM", score: 88 },
  { name: "SSD", score: 85 },
  { name: "BATT", score: 78 },
  { name: "NET", score: 99 },
  { name: "THERM", score: 62 },
  { name: "FANS", score: 71 },
  { name: "BOARD", score: 90 },
];

function getScoreColor(score: number) {
  if (score >= 80) return CHART_COLOR_CYAN;
  if (score >= 60) return "hsl(38, 92%, 60%)"; // Amber
  return CHART_COLOR_RED;
}

const AI_FINDINGS = [
  {
    id: 1,
    severity: "warning",
    title: "Thermal limits breached",
    desc: "CPU hit 94°C triggering 3 thermal throttle events this week.",
    icon: Thermometer,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/30"
  },
  {
    id: 2,
    severity: "info",
    title: "Battery degrading",
    desc: "Discharge rate is higher than baseline. Capacity down to 78%.",
    icon: Battery,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10 border-cyan-400/30"
  },
  {
    id: 3,
    severity: "critical",
    title: "SSD space critical",
    desc: "12% free space remaining. Wear leveling efficiency reduced.",
    icon: HardDrive,
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/30"
  }
];

const LOG_MESSAGES = [
  { msg: "Polling thermal sensors...", type: "info" as const },
  { msg: "Network latency spike detected (124ms)", type: "warn" as const },
  { msg: "Memory page fault rate normal", type: "info" as const },
  { msg: "SSD SMART data verified", type: "info" as const },
  { msg: "Background indexer process consuming 14% CPU", type: "warn" as const },
  { msg: "Battery discharge rate holding at -8.2W", type: "info" as const },
  { msg: "Cross-referencing telemetry with baseline...", type: "info" as const },
  { msg: "Vcore voltage stable at 1.12V", type: "info" as const },
];

export default function Dashboard() {
  // --- State ---
  const [data, setData] = useState<DataPoint[]>([]);
  const [tick, setTick] = useState(0);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  
  // Live metric values
  const [liveMetrics, setLiveMetrics] = useState({
    cpu: 22,
    temp: 68,
    ram: 45,
    pageFaults: 12,
    ssdFree: 12.4,
    batt: 78,
    discharge: -8.2,
    netLat: 18
  });

  // --- Refs ---
  const timeRef = useRef(0);
  const logIdRef = useRef(0);

  // --- Initialization ---
  useEffect(() => {
    // Generate initial history
    const initialData: DataPoint[] = [];
    let curCpu = 25;
    let curTemp = 65;
    let curRam = 45;
    
    for (let i = -INITIAL_DATA_POINTS; i <= 0; i++) {
      curCpu = Math.max(5, Math.min(100, curCpu + (Math.random() - 0.5) * 15));
      curTemp = Math.max(40, Math.min(100, curTemp + (Math.random() - 0.5) * 5));
      curRam = Math.max(30, Math.min(90, curRam + (Math.random() - 0.5) * 3));
      
      initialData.push({
        time: i,
        cpu: curCpu,
        tempCpu: curTemp,
        tempChassis: curTemp - 15 + (Math.random() - 0.5) * 2,
        ram: curRam
      });
    }
    setData(initialData);
    
    // Initial logs
    const initialLogs = Array.from({length: 4}).map((_, i) => {
      const e = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
      logIdRef.current++;
      return { id: logIdRef.current, time: new Date(Date.now() - i*4000).toLocaleTimeString('en-US', {hour12:false}), msg: e.msg, type: e.type };
    });
    setLogs(initialLogs);
  }, []);

  // --- Live Data Loop (2s tick) ---
  useEffect(() => {
    const interval = setInterval(() => {
      timeRef.current++;
      setTick(t => t + 1);
      
      setLiveMetrics(prev => {
        const cpu = Math.max(5, Math.min(100, prev.cpu + (Math.random() - 0.5) * 20));
        const temp = Math.max(45, Math.min(95, prev.temp + (Math.random() - 0.5) * 8 + (cpu > 60 ? 2 : -2)));
        const ram = Math.max(30, Math.min(90, prev.ram + (Math.random() - 0.5) * 4));
        const netLat = Math.max(8, Math.min(150, prev.netLat + (Math.random() - 0.5) * 15));
        const discharge = -8.2 + (Math.random() - 0.5) * 1.5;
        
        setData(d => {
          const newData = [...d.slice(1), {
            time: timeRef.current,
            cpu,
            tempCpu: temp,
            tempChassis: temp - 15 + (Math.random() - 0.5) * 2,
            ram
          }];
          return newData;
        });
        
        return {
          cpu: Math.round(cpu),
          temp: Math.round(temp),
          ram: Math.round(ram),
          pageFaults: Math.floor(Math.random() * 40),
          ssdFree: prev.ssdFree,
          batt: prev.batt,
          discharge: Number(discharge.toFixed(1)),
          netLat: Math.round(netLat)
        };
      });
      
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // --- Log Loop (4s tick) ---
  useEffect(() => {
    const logInterval = setInterval(() => {
      const e = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
      logIdRef.current++;
      const newLog = {
        id: logIdRef.current,
        time: new Date().toLocaleTimeString('en-US', {hour12:false}),
        msg: e.msg,
        type: e.type
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
    }, 4000);
    return () => clearInterval(logInterval);
  }, []);

  // --- Formatters ---
  const uptime = `${Math.floor((tick + 14200) / 3600)}h ${Math.floor(((tick + 14200) % 3600) / 60)}m`;

  return (
    <div className="min-h-screen bg-[#06080d] text-foreground font-sans selection:bg-primary/30 pb-20">
      
      {/* Top Status Bar */}
      <header className="sticky top-0 z-40 bg-[#0a0e1a]/80 backdrop-blur-xl border-b border-primary/20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group mr-4">
              <Shield className="w-6 h-6 text-primary group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all" />
            </Link>
            <div className="h-6 w-px bg-border/40 hidden md:block" />
            <div>
              <h1 className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-2">
                DELL-XPS15-9520
                <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/30 uppercase tracking-widest">Online</span>
              </h1>
              <p className="text-xs text-muted-foreground font-mono">System Telemetry & AI Diagnostics</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm font-mono">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>Uptime: <span className="text-primary">{uptime}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span>Last scan: <span className="text-white">Live</span></span>
            </div>
            <div className="flex items-center gap-3 bg-card border border-border/50 px-3 py-1.5 rounded-lg shadow-sm">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
                  <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="100" strokeDashoffset="21" className="text-cyan-400" />
                </svg>
                <span className="text-[10px] font-bold text-cyan-400">79</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">Health Score</span>
                <span className="text-xs font-bold text-white">Nominal</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* Metric Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricTile 
            title="CPU Usage" icon={Cpu} value={`${liveMetrics.cpu}%`} 
            subValue={`${(liveMetrics.cpu * 0.04).toFixed(1)} GHz`} 
            color="text-cyan-400" 
          />
          <MetricTile 
            title="Temperature" icon={Thermometer} value={`${liveMetrics.temp}°C`} 
            subValue="3 throttle events" 
            color={liveMetrics.temp > 85 ? "text-red-400" : liveMetrics.temp > 75 ? "text-amber-400" : "text-cyan-400"} 
          />
          <MetricTile 
            title="RAM Usage" icon={Server} value={`${liveMetrics.ram}%`} 
            subValue={`${liveMetrics.pageFaults} faults/s`} 
            color="text-cyan-400" 
          />
          <MetricTile 
            title="SSD Health" icon={HardDrive} value="88%" 
            subValue={`${liveMetrics.ssdFree}% free space`} 
            color="text-amber-400" 
          />
          <MetricTile 
            title="Battery" icon={Battery} value={`${liveMetrics.batt}%`} 
            subValue={`${liveMetrics.discharge}W drain`} 
            color="text-cyan-400" 
          />
          <MetricTile 
            title="Network" icon={Wifi} value={`${liveMetrics.netLat}ms`} 
            subValue="0% packet loss" 
            color="text-cyan-400" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Charts Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* CPU & Temp Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CPU Chart */}
              <div className="bg-[#0a0e1a] border border-primary/20 rounded-xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-1">CPU Load History</h3>
                    <div className="text-2xl font-bold font-mono text-white">{liveMetrics.cpu}%</div>
                  </div>
                  <div className="text-xs font-mono text-cyan-400/70 bg-cyan-400/10 px-2 py-1 rounded border border-cyan-400/20 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> LIVE
                  </div>
                </div>
                <div className="h-48 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLOR_CYAN} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={CHART_COLOR_CYAN} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.2)" fontSize={10} tickFormatter={(v)=>`${v}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="cpu" stroke={CHART_COLOR_CYAN} strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Thermal Chart */}
              <div className="bg-[#0a0e1a] border border-primary/20 rounded-xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-1">Thermal Profile</h3>
                    <div className="flex gap-4">
                      <div className="text-2xl font-bold font-mono text-white">{liveMetrics.temp}°C</div>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400" /> CPU</span>
                    <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-muted-foreground" /> Chassis</span>
                  </div>
                </div>
                <div className="h-48 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis domain={[30, 100]} stroke="rgba(255,255,255,0.2)" fontSize={10} tickFormatter={(v)=>`${v}°`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="tempCpu" stroke="hsl(38, 92%, 60%)" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="tempChassis" stroke="hsl(215, 20%, 55%)" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* RAM History & Component Health Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* RAM Chart */}
              <div className="bg-[#0a0e1a] border border-primary/20 rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">Memory Allocation</h3>
                <div className="h-40 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLOR_VIOLET} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={CHART_COLOR_VIOLET} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.2)" fontSize={10} tickFormatter={(v)=>`${v}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="ram" stroke={CHART_COLOR_VIOLET} strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Component Health Scores */}
              <div className="bg-[#0a0e1a] border border-primary/20 rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">Subsystem Scores</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={componentScores} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0a0e1a', borderColor: 'rgba(34,211,238,0.2)', fontSize: '12px'}} />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={12}>
                        {componentScores.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

          </div>

          {/* Right Column: AI Panel & Log */}
          <div className="flex flex-col gap-6">
            
            {/* AI Findings */}
            <div className="bg-[#0a0e1a] border border-primary/20 rounded-xl overflow-hidden shadow-lg flex flex-col">
              <div className="px-5 py-4 border-b border-primary/20 bg-primary/5 flex justify-between items-center">
                <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  AI ANOMALY DETECTION
                </h3>
                <div className="text-[10px] font-mono text-cyan-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> ANALYZING...
                </div>
              </div>
              <div className="p-5 flex flex-col gap-4">
                {AI_FINDINGS.map(finding => (
                  <div key={finding.id} className={`p-4 rounded-lg border ${finding.bg} flex gap-4`}>
                    <div className="mt-0.5">
                      <finding.icon className={`w-5 h-5 ${finding.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${finding.color}`}>
                          {finding.severity}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white mb-1">{finding.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{finding.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal Log */}
            <div className="bg-[#0a0e1a] border border-primary/20 rounded-xl flex flex-col shadow-lg flex-1 min-h-[300px] overflow-hidden">
              <div className="px-4 py-2 border-b border-primary/20 bg-black/40 flex items-center justify-between gap-4">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest shrink-0">System Event Log</span>
                <div className="flex-1 max-w-[200px] relative group">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Filter logs..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black/20 border border-primary/10 rounded pl-7 pr-2 py-0.5 text-[10px] font-mono focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
              </div>
              <div className="p-4 flex flex-col gap-2 overflow-hidden relative">
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-[#0a0e1a] z-10" />
                <AnimatePresence initial={false}>
                  {logs
                    .filter(log => log.msg.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((log) => (
                    <motion.div 
                      key={log.id}
                      layout="position"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex items-start gap-3 font-mono text-xs"
                    >
                      <span className="text-muted-foreground/50 shrink-0 w-16">{log.time}</span>
                      <span className={`shrink-0 ${
                        log.type === 'warn' ? 'text-amber-400' : 
                        log.type === 'alert' ? 'text-red-400' : 
                        'text-cyan-400'
                      }`}>
                        {log.type === 'warn' ? 'WARN' : log.type === 'alert' ? 'ALRT' : 'INFO'}
                      </span>
                      <span className="text-muted-foreground truncate">{log.msg}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// --- Subcomponents ---

function MetricTile({ title, icon: Icon, value, subValue, color }: { title: string, icon: any, value: string, subValue: string, color: string }) {
  return (
    <div className="bg-[#0a0e1a] border border-primary/20 rounded-xl p-4 flex flex-col gap-3 shadow-lg group hover:border-primary/40 transition-colors">
      <div className="flex items-center justify-between">
        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary group-hover:animate-pulse" />
      </div>
      <div>
        <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">{title}</h4>
        <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{subValue}</div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0e1a] border border-primary/30 p-3 rounded shadow-xl font-mono text-xs">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 my-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.stroke }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="text-white font-bold">{p.value.toFixed ? p.value.toFixed(1) : p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};