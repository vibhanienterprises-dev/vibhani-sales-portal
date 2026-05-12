// Triggering redeploy for Task & Communication updates - Frontend
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";

import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import LeadsList from "@/pages/LeadsList";
import LeadDetail from "@/pages/LeadDetail";
import Pipeline from "@/pages/Pipeline";
import Tasks from "@/pages/Tasks";
import GstTool from "@/pages/GstTool";
import WhatsappTemplates from "@/pages/WhatsappTemplates";
import EmailTemplates from "@/pages/EmailTemplates";
import Settings from "@/pages/Settings";
import AdminPanel from "@/pages/AdminPanel";
import Quotations from "@/pages/Quotations";
import QuotationPrint from "@/pages/QuotationPrint";

const queryClient = new QueryClient();

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={LeadsList} />
      <Route path="/leads/:id" component={LeadDetail} />
      <Route path="/pipeline" component={Pipeline} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/gst" component={GstTool} />
      <Route path="/whatsapp" component={WhatsappTemplates} />
      <Route path="/email" component={EmailTemplates} />
      <Route path="/settings" component={Settings} />
      <Route path="/quotations" component={Quotations} />
      <Route path="/quotations/:id/print" component={QuotationPrint} />
      <Route path="/admin" component={AdminPanel} />
      <Route component={NotFound} />
    </Switch>
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
