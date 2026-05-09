import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Cpu, Battery, HardDrive, Thermometer, Wifi, Zap, Loader2, Sparkles, RotateCcw, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import AnimateIn from "@/components/AnimateIn";

// ── Knowledge Base ──────────────────────────────────────────────────────────

interface Solution {
  title: string;
  steps: string[];
  urgency: "low" | "medium" | "high";
  component: string;
  relatedTip?: string;
}

interface KBEntry {
  keywords: string[];
  solution: Solution;
}

const KB: KBEntry[] = [
  {
    keywords: ["battery", "drain", "fast", "dies", "quick", "lasting", "charge", "life", "short", "hours"],
    solution: {
      title: "Battery draining faster than expected",
      steps: [
        "Open Settings → System → Power & battery and check which apps consume the most power.",
        "Reduce screen brightness to 60-70% — display is the #1 battery consumer.",
        "Disable background apps: Settings → Apps → Installed apps → toggle off background activity for non-essential apps.",
        "Switch power mode to 'Best power efficiency' when on battery.",
        "Check battery health: open CMD as admin and run `powercfg /batteryreport`. Look at 'Design Capacity' vs 'Full Charge Capacity'.",
        "If capacity is below 70%, the battery is degraded and may need replacement.",
      ],
      urgency: "medium",
      component: "Battery",
      relatedTip: "Run Sentinel's Health Test to get an exact battery wear percentage and cycle count.",
    },
  },
  {
    keywords: ["overheat", "hot", "heat", "thermal", "temperature", "warm", "burn", "fan", "loud", "throttle", "throttling"],
    solution: {
      title: "Laptop overheating or running hot",
      steps: [
        "Ensure vents are not blocked — never use the laptop on a bed, pillow, or soft surface.",
        "Use a laptop stand or cooling pad to improve airflow (can reduce temps by 10-15°C).",
        "Clean dust from vents using compressed air — hold the can 6 inches away and spray in short bursts.",
        "Check Task Manager (Ctrl+Shift+Esc) → Processes tab for apps using high CPU. End unnecessary ones.",
        "Update your BIOS from the manufacturer's website — newer versions often improve thermal management.",
        "If the laptop is 2+ years old, consider having a technician replace the thermal paste.",
      ],
      urgency: "high",
      component: "Thermals",
      relatedTip: "Sustained temps above 85°C accelerate component degradation. Sentinel tracks your thermal patterns over time.",
    },
  },
  {
    keywords: ["slow", "lag", "sluggish", "freeze", "freezing", "hang", "unresponsive", "stuck", "loading", "performance"],
    solution: {
      title: "Laptop running slow or freezing",
      steps: [
        "Press Ctrl+Shift+Esc to open Task Manager. Check if any process is using >80% CPU or memory.",
        "Check disk usage: if it's at 100%, your SSD/HDD may be the bottleneck.",
        "Free up storage — keep at least 15-20% of your drive free. Run Disk Cleanup from the Start menu.",
        "Disable startup programs: Task Manager → Startup tab → disable non-essential items.",
        "Run Windows Update to ensure you have the latest performance patches.",
        "If you have an HDD (not SSD), upgrading to an SSD is the single biggest speed improvement you can make.",
      ],
      urgency: "medium",
      component: "Storage",
    },
  },
  {
    keywords: ["blue screen", "bsod", "crash", "restart", "reboot", "unexpected", "shutdown", "stop code", "dump"],
    solution: {
      title: "Blue Screen of Death (BSOD) crashes",
      steps: [
        "Note the stop code displayed on the blue screen (e.g., IRQL_NOT_LESS_OR_EQUAL).",
        "Run Windows Memory Diagnostic: search 'Windows Memory Diagnostic' in Start and restart to test RAM.",
        "Update all drivers — especially GPU and chipset. Visit your manufacturer's support page.",
        "Open CMD as admin and run: `sfc /scannow` to check for corrupted system files.",
        "Then run: `DISM /Online /Cleanup-Image /RestoreHealth` to repair the Windows image.",
        "Check Event Viewer (eventvwr.msc) → Windows Logs → System for critical errors around the crash time.",
        "If crashes persist, run `chkdsk /f /r` on your boot drive (requires a restart).",
      ],
      urgency: "high",
      component: "CPU",
      relatedTip: "Frequent BSODs can indicate failing RAM or storage. Sentinel's diagnostic script checks both.",
    },
  },
  {
    keywords: ["wifi", "internet", "disconnect", "network", "connection", "drop", "slow internet", "no wifi", "cant connect"],
    solution: {
      title: "Wi-Fi disconnecting or unstable",
      steps: [
        "Restart your router by unplugging it for 30 seconds, then plugging it back in.",
        "Forget and reconnect: Settings → Network → Wi-Fi → click your network → Forget → reconnect.",
        "Update the Wi-Fi driver: Device Manager → Network adapters → right-click your adapter → Update driver.",
        "Disable power saving for the adapter: Device Manager → Network adapters → Properties → Power Management → uncheck 'Allow the computer to turn off this device'.",
        "Reset network stack: open CMD as admin and run `netsh winsock reset` then `netsh int ip reset`, then restart.",
        "If on 5GHz, try switching to 2.4GHz (better range) or vice versa (less congestion).",
      ],
      urgency: "medium",
      component: "Network",
    },
  },
  {
    keywords: ["storage", "disk", "space", "full", "ssd", "hdd", "drive", "capacity", "cleanup", "gb"],
    solution: {
      title: "Running out of storage space",
      steps: [
        "Run Disk Cleanup: search it in Start, select your drive, check all boxes, and click 'Clean up system files'.",
        "Empty the Recycle Bin — deleted files still take up space until you empty it.",
        "Check for large files: Settings → System → Storage → click 'Temporary files' and clean them.",
        "Move large folders (Downloads, Videos, Photos) to an external drive or cloud storage.",
        "Uninstall unused applications: Settings → Apps → Installed apps → sort by size.",
        "SSDs need 10-15% free space to maintain performance and longevity. Below this, write amplification increases wear.",
      ],
      urgency: "medium",
      component: "Storage",
      relatedTip: "Sentinel monitors your SSD wear level and warns you before endurance limits are reached.",
    },
  },
  {
    keywords: ["screen", "display", "flicker", "black", "blank", "dim", "bright", "resolution", "monitor", "graphics", "gpu"],
    solution: {
      title: "Display issues (flickering, black screen, artifacts)",
      steps: [
        "Update your GPU driver: visit nvidia.com/drivers or amd.com/drivers for the latest version.",
        "Try a different refresh rate: Settings → Display → Advanced display → choose a different rate.",
        "If screen flickers, check if it stops in Safe Mode (hold Shift while clicking Restart → Troubleshoot → Safe Mode). If it stops, it's a driver issue.",
        "For external monitor issues: try a different cable (HDMI/DisplayPort), and check the cable is fully seated.",
        "Reset display settings: Win+Ctrl+Shift+B to restart the graphics driver.",
        "If you see artifacts (visual glitches), the GPU may be overheating — check thermals.",
      ],
      urgency: "medium",
      component: "GPU",
    },
  },
  {
    keywords: ["keyboard", "key", "type", "typing", "stuck", "repeat", "not working", "touchpad", "trackpad", "mouse", "click"],
    solution: {
      title: "Keyboard or touchpad not responding correctly",
      steps: [
        "Restart the laptop — many input issues are resolved by a simple reboot.",
        "Check for debris under keys — use compressed air to clean between the keys.",
        "Update the input driver: Device Manager → Keyboards (or Mice) → right-click → Update driver.",
        "For touchpad: Settings → Bluetooth & devices → Touchpad → ensure it's enabled and check sensitivity.",
        "If specific keys are stuck, gently pry the keycap off and clean underneath with isopropyl alcohol.",
        "For external keyboards/mice, try a different USB port or re-pair Bluetooth.",
      ],
      urgency: "low",
      component: "Input",
    },
  },
  {
    keywords: ["sound", "audio", "speaker", "headphone", "volume", "mute", "no sound", "crackling", "static"],
    solution: {
      title: "Audio problems (no sound, crackling, static)",
      steps: [
        "Check volume isn't muted: click the speaker icon in the taskbar and verify volume level.",
        "Right-click the speaker icon → Sound settings → ensure the correct output device is selected.",
        "Run the audio troubleshooter: Settings → System → Troubleshoot → Other troubleshooters → Playing Audio.",
        "Update audio driver: Device Manager → Sound → right-click your audio device → Update driver.",
        "If you hear crackling, try changing the audio format: right-click speaker icon → Sound settings → your device → Properties → change sample rate to 24-bit, 48000 Hz.",
        "Restart Windows Audio service: Win+R → services.msc → find 'Windows Audio' → right-click → Restart.",
      ],
      urgency: "low",
      component: "Audio",
    },
  },
  {
    keywords: ["boot", "startup", "start", "turn on", "power", "wont start", "no boot", "black screen on startup", "bios"],
    solution: {
      title: "Laptop won't boot or start properly",
      steps: [
        "Hard reset: hold the power button for 15 seconds to force shutdown, wait 30 seconds, then try again.",
        "If plugged in, try removing the charger and holding power for 30 seconds to drain residual charge.",
        "Listen for beeps or check for blinking LEDs — these are diagnostic codes (check your manufacturer's site).",
        "Try booting into Safe Mode: hold Shift while clicking Restart → Troubleshoot → Startup Settings → Safe Mode.",
        "If you see the manufacturer logo but Windows doesn't load, try Automatic Repair: restart 3 times during boot to trigger it.",
        "Check if an external USB drive is plugged in — remove it, as the BIOS may be trying to boot from it.",
        "If nothing appears on screen at all, try connecting an external monitor to check if it's a display issue vs a boot issue.",
      ],
      urgency: "high",
      component: "System",
    },
  },
  {
    keywords: ["update", "windows update", "failed", "error", "install", "pending", "stuck update"],
    solution: {
      title: "Windows Update failing or stuck",
      steps: [
        "Run the Windows Update troubleshooter: Settings → System → Troubleshoot → Other troubleshooters → Windows Update.",
        "Clear the update cache: open CMD as admin, run `net stop wuauserv`, then `del /f /s /q C:\\Windows\\SoftwareDistribution\\*`, then `net start wuauserv`.",
        "Ensure you have at least 20GB free space — updates need room to download and install.",
        "Try installing updates manually from the Microsoft Update Catalog (catalog.update.microsoft.com).",
        "If stuck at a percentage, leave it for at least 2 hours before force-restarting — some updates are slow.",
        "Run `sfc /scannow` and `DISM /Online /Cleanup-Image /RestoreHealth` to fix corrupted components.",
      ],
      urgency: "medium",
      component: "System",
    },
  },
  {
    keywords: ["ram", "memory", "usage", "high memory", "out of memory", "16gb", "8gb", "4gb", "upgrade"],
    solution: {
      title: "High memory usage or running out of RAM",
      steps: [
        "Open Task Manager (Ctrl+Shift+Esc) → Memory column to identify which apps use the most RAM.",
        "Close unnecessary browser tabs — each Chrome tab can use 100-300MB of RAM.",
        "Disable startup programs that run in the background: Task Manager → Startup tab.",
        "Check for memory leaks: if a process keeps growing in memory over time, restart it or update the app.",
        "Adjust virtual memory: Settings → System → About → Advanced system settings → Performance → Advanced → Virtual Memory → set to system managed.",
        "If you consistently use >85% RAM, consider upgrading — 16GB is the recommended minimum for productivity work in 2026.",
      ],
      urgency: "medium",
      component: "Memory",
      relatedTip: "Sentinel's memory diagnostic detects early signs of RAM module degradation and unusual pressure patterns.",
    },
  },
];

// ── Quick issue buttons ─────────────────────────────────────────────────────

const QUICK_ISSUES = [
  { label: "Battery draining fast", icon: Battery, query: "My battery drains very fast" },
  { label: "Laptop overheating", icon: Thermometer, query: "My laptop gets very hot" },
  { label: "Running slow", icon: Cpu, query: "My laptop is very slow and laggy" },
  { label: "Wi-Fi dropping", icon: Wifi, query: "My wifi keeps disconnecting" },
  { label: "Storage full", icon: HardDrive, query: "I'm running out of disk space" },
  { label: "Won't turn on", icon: Zap, query: "My laptop won't start or boot" },
];

// ── Matching engine ─────────────────────────────────────────────────────────

function findSolutions(query: string): Solution[] {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/);

  const scored = KB.map((entry) => {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score += 3;
      for (const w of words) {
        if (w.length > 2 && kw.startsWith(w)) score += 1;
      }
    }
    return { solution: entry.solution, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map((s) => s.solution);
}

// ── Message types ───────────────────────────────────────────────────────────

interface Message {
  id: number;
  role: "user" | "assistant";
  text?: string;
  solutions?: Solution[];
  timestamp: Date;
}

const URGENCY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-cyan-500/10 border-cyan-500/30", text: "text-cyan-400", label: "Low" },
  medium: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", label: "Medium" },
  high: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", label: "High" },
};

// ── Component ───────────────────────────────────────────────────────────────

export default function Troubleshoot() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let msgId = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  function handleSubmit(query: string) {
    if (!query.trim()) return;
    const userMsg: Message = { id: ++msgId.current, role: "user", text: query, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const solutions = findSolutions(query);
      const assistantMsg: Message = {
        id: ++msgId.current,
        role: "assistant",
        text: solutions.length === 0
          ? "I couldn't find a specific match for that issue. Try describing the problem differently, or use one of the quick-issue buttons below. For a comprehensive hardware check, run our free diagnostic script on the Health Test page."
          : undefined,
        solutions: solutions.length > 0 ? solutions : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 600);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-16 px-6 border-b border-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-background to-accent/4 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/3 blur-[120px] pointer-events-none" />
        <AnimateIn>
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              INTELLIGENT ASSISTANT
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Describe your problem.{" "}
              <span className="gradient-text">Get the fix.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              No more digging through forums. Describe your laptop issue in plain English and get step-by-step solutions instantly.
            </p>
          </div>
        </AnimateIn>
      </section>

      {/* Chat area */}
      <section className="px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <AnimateIn delay={0.05}>
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden shadow-xl flex flex-col" style={{ height: "min(70vh, 620px)" }}>
 
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-cyan">
                      <MessageCircle className="w-7 h-7 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground mb-1">What's wrong with your laptop?</p>
                      <p className="text-xs text-muted-foreground">Describe your issue or pick a common problem below</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                      {QUICK_ISSUES.map((q) => (
                        <button
                          key={q.label}
                          onClick={() => handleSubmit(q.query)}
                          className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border/50 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
                        >
                          <q.icon className="w-3.5 h-3.5" />
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "user" ? (
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md bg-primary/15 border border-primary/30 text-sm text-foreground">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="max-w-[90%] space-y-3">
                      {msg.text && (
                        <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-card border border-border/50 text-sm text-muted-foreground leading-relaxed">
                          {msg.text}
                        </div>
                      )}
                      {msg.solutions?.map((sol, i) => {
                        const urg = URGENCY_COLORS[sol.urgency];
                        return (
                          <div key={i} className="rounded-xl border border-border/50 bg-card/80 overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground/50 bg-muted/20 px-1.5 py-0.5 rounded">{sol.component}</span>
                                <h3 className="text-sm font-semibold text-foreground">{sol.title}</h3>
                              </div>
                              <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${urg.bg} ${urg.text}`}>
                                {urg.label}
                              </span>
                            </div>
                            <div className="px-4 py-3 space-y-2">
                              {sol.steps.map((step, j) => (
                                <div key={j} className="flex items-start gap-3">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full border border-primary/30 text-primary text-xs flex items-center justify-center font-mono mt-0.5">
                                    {j + 1}
                                  </span>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                            {sol.relatedTip && (
                              <div className="px-4 py-2.5 border-t border-border/30 bg-primary/3">
                                <p className="text-xs text-primary/80 leading-relaxed flex items-start gap-2">
                                  <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                                  {sol.relatedTip}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {msg.solutions && msg.solutions.length > 0 && (
                        <div className="flex items-center gap-3 pt-1">
                          <Link
                            href="/health-test"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                          >
                            Run a full diagnostic <ChevronRight className="w-3 h-3" />
                          </Link>
                          <Link
                            href="/risk-calculator"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Check failure risk <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-card border border-border/50 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">Analyzing your issue…</span>
                  </div>
                </div>
              )}
            </div>

              {/* Input bar */}
              <div className="border-t border-border/50 px-4 py-3 bg-card/60">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
                  className="flex items-center gap-3"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe your laptop problem…"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                    disabled={isTyping}
                  />
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setMessages([]); setInput(""); }}
                      className="p-2 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/20 transition-all"
                      title="Clear conversation"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className="p-2.5 rounded-xl bg-primary text-background hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all glow-cyan"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </AnimateIn>

          {/* Bottom quick issues (visible after conversation starts) */}
          {messages.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {QUICK_ISSUES.map((q) => (
                <button
                  key={q.label}
                  onClick={() => handleSubmit(q.query)}
                  disabled={isTyping}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-30 transition-all"
                >
                  <q.icon className="w-3 h-3" />
                  {q.label}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground/40 text-center mt-4 leading-relaxed">
            This assistant uses a local knowledge base — no data is sent to any server. For hardware-level analysis, run the{" "}
            <Link href="/health-test" className="text-primary/60 hover:text-primary transition-colors">Health Test</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
