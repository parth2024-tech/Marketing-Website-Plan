import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import Features from "@/pages/Features";
import HowItWorks from "@/pages/HowItWorks";
import WhatItMonitors from "@/pages/WhatItMonitors";
import FAQ from "@/pages/FAQ";
import Waitlist from "@/pages/Waitlist";
import HealthTest from "@/pages/HealthTest";
import SampleReport from "@/pages/SampleReport";
import WhySentinel from "@/pages/WhySentinel";
import Compare from "@/pages/Compare";
import Pricing from "@/pages/Pricing";
import Dashboard from "@/pages/Dashboard";
import OEMFailures from "@/pages/OEMFailures";
import HabitAudit from "@/pages/HabitAudit";
import RiskCalculator from "@/pages/RiskCalculator";
import Report from "@/pages/Report";
import MyReports from "@/pages/MyReports";
import Troubleshoot from "@/pages/Troubleshoot";
import GetStarted from "@/pages/GetStarted";
import Pair from "@/pages/Pair";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const [location] = useLocation();
  const reducedMotion = useReducedMotion();

  // Navigation should feel intentional: start each page at the top (unless using an anchor).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);

  /** Smooth ease-out that matches the site's motion language */
  const PAGE_TRANSITION = reducedMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, y: 18, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -10, filter: "blur(4px)" },
        transition: { duration: 0.34, ease: [0.21, 0.47, 0.32, 0.98] as const },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        {...PAGE_TRANSITION}
        // Ensure the motion div doesn't constrain layout
        style={{ willChange: "opacity, transform" }}
      >
        <Switch>
          <Route path="/"                component={Home} />
          <Route path="/features"        component={Features} />
          <Route path="/how-it-works"    component={HowItWorks} />
          <Route path="/what-it-monitors"component={WhatItMonitors} />
          <Route path="/faq"             component={FAQ} />
          <Route path="/waitlist"        component={Waitlist} />
          <Route path="/health-test"     component={HealthTest} />
          <Route path="/dashboard"       component={Dashboard} />
          <Route path="/sample-report"   component={SampleReport} />
          <Route path="/why"             component={WhySentinel} />
          <Route path="/compare"         component={Compare} />
          <Route path="/pricing"         component={Pricing} />
          <Route path="/oem-failures"    component={OEMFailures} />
          <Route path="/habit-audit"     component={HabitAudit} />
          <Route path="/risk-calculator" component={RiskCalculator} />
          <Route path="/troubleshoot"    component={Troubleshoot} />
          <Route path="/r/:id"           component={Report} />
          <Route path="/my-reports"      component={MyReports} />
          <Route path="/get-started"     component={GetStarted} />
          <Route path="/pair"            component={Pair} />
          <Route                         component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function Router() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <AnimatedRoutes />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
