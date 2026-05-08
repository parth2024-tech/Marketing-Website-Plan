import { Switch, Route, Router as WouterRouter } from "wouter";
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
import OEMFailures from "@/pages/OEMFailures";
import HabitAudit from "@/pages/HabitAudit";
import RiskCalculator from "@/pages/RiskCalculator";
import Report from "@/pages/Report";
import MyReports from "@/pages/MyReports";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/features" component={Features} />
          <Route path="/how-it-works" component={HowItWorks} />
          <Route path="/what-it-monitors" component={WhatItMonitors} />
          <Route path="/faq" component={FAQ} />
          <Route path="/waitlist" component={Waitlist} />
          <Route path="/health-test" component={HealthTest} />
          <Route path="/sample-report" component={SampleReport} />
          <Route path="/why" component={WhySentinel} />
          <Route path="/compare" component={Compare} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/oem-failures" component={OEMFailures} />
          <Route path="/habit-audit" component={HabitAudit} />
          <Route path="/risk-calculator" component={RiskCalculator} />
          <Route path="/r/:id" component={Report} />
          <Route path="/my-reports" component={MyReports} />
          <Route component={NotFound} />
        </Switch>
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
