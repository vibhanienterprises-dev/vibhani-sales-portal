import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useGetLeadsKanban, useUpdateLeadStage } from "@workspace/api-client-react";
import { getGetLeadsKanbanQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LEAD_STAGES } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Building2, ChevronRight, MapPin, IndianRupee } from "lucide-react";
import { UpdateLeadStageBodyStage } from "@workspace/api-client-react";

export default function Pipeline() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: kanban, isLoading } = useGetLeadsKanban();
  const updateLeadStage = useUpdateLeadStage();

  const handleStageChange = (leadId: number, newStage: UpdateLeadStageBodyStage) => {
    updateLeadStage.mutate({ id: leadId, data: { stage: newStage } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadsKanbanQueryKey() });
        toast({ title: "Lead moved" });
      }
    });
  };

  const getStageColor = (stage: string) => {
    switch(stage) {
      case 'new': return 'border-blue-500 bg-blue-500/10 text-blue-500';
      case 'contacted': return 'border-yellow-500 bg-yellow-500/10 text-yellow-500';
      case 'quotation_sent': return 'border-purple-500 bg-purple-500/10 text-purple-500';
      case 'converted': return 'border-green-500 bg-green-500/10 text-green-500';
      case 'lost': return 'border-red-500 bg-red-500/10 text-red-500';
      default: return 'border-gray-500 bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold text-foreground">Pipeline</h1>
          <p className="text-muted-foreground mt-1 text-sm">Visual sales process tracking.</p>
        </div>

        <div className="flex-1 overflow-x-auto p-8 pt-4 flex gap-4 h-full pb-8">
          {isLoading ? (
            Array.from({length: 5}).map((_, i) => (
              <div key={i} className="flex flex-col gap-4 w-80 shrink-0">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))
          ) : (
            LEAD_STAGES.map((stageInfo) => {
              const stageKey = stageInfo.value as keyof typeof kanban;
              const leadsInStage: any[] = (kanban?.[stageKey] as unknown as any[]) || [];
              const totalValue = leadsInStage.reduce((sum: number, lead: any) => sum + (parseFloat(lead.dealValue) || 0), 0);

              return (
                <div key={stageInfo.value} className="flex flex-col w-80 shrink-0 h-full">
                  <div className={`mb-4 p-3 rounded-lg border ${getStageColor(stageInfo.value)} flex justify-between items-center`}>
                    <h3 className="font-semibold">{stageInfo.label} <span className="opacity-70 font-normal">({leadsInStage.length})</span></h3>
                    <div className="font-mono text-sm font-semibold">
                      ₹{(totalValue / 1000).toFixed(1)}k
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                    {leadsInStage.map((lead) => (
                      <Card key={lead.id} className="border-border hover:border-primary/50 transition-colors shadow-sm bg-card">
                        <CardContent className="p-4">
                          <Link href={`/leads/${lead.id}`} className="block mb-3">
                            <div className="font-bold text-foreground hover:text-primary transition-colors mb-1">{lead.companyName}</div>
                            {lead.contactName && <div className="text-sm text-muted-foreground">{lead.contactName}</div>}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {lead.state && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.state}</span>}
                              {lead.dealValue ? <span className="flex items-center gap-0.5 text-foreground font-medium"><IndianRupee className="w-3 h-3" />{lead.dealValue.toLocaleString('en-IN')}</span> : null}
                            </div>
                          </Link>

                          <div className="flex gap-2 mt-4 flex-wrap">
                            {LEAD_STAGES.map((s) => {
                              if (s.value === lead.stage) return null;
                              return (
                                <Button 
                                  key={s.value} 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => handleStageChange(lead.id, s.value as UpdateLeadStageBodyStage)}
                                  disabled={updateLeadStage.isPending}
                                >
                                  {s.label}
                                </Button>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {leadsInStage.length === 0 && (
                      <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                        No leads
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
