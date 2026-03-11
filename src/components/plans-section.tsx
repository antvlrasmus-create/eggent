"use client";

import { useState, useEffect } from "react";
import { 
  Workflow, 
  Play, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Loader2, 
  ChevronRight,
  ChevronDown,
  Clock,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBackgroundSync } from "@/hooks/use-background-sync";

interface SubTask {
  id: string;
  title: string;
  description: string;
  role: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  result?: string;
  error?: string;
}

interface TaskPlan {
  id: string;
  goal: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  tasks: SubTask[];
}

export function PlansSection() {
  const [plans, setPlans] = useState<TaskPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  
  // Sync with background updates (e.g. when agents complete tasks)
  const tick = useBackgroundSync({ topics: ["global"] });

  useEffect(() => {
    loadPlans();
  }, [tick]);

  async function loadPlans() {
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlans(data);
      }
    } catch (error) {
      console.error("Failed to load plans:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute(id: string) {
    try {
      await fetch(`/api/plans/${id}`, { method: "POST" });
      loadPlans();
    } catch (error) {
      console.error("Failed to execute plan:", error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    try {
      await fetch(`/api/plans/${id}`, { method: "DELETE" });
      loadPlans();
    } catch (error) {
      console.error("Failed to delete plan:", error);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'executing': return 'bg-sky-500/10 text-sky-500 border-sky-500/20 animate-pulse';
      case 'failed': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground border-transparent';
    }
  }

  function getTaskIcon(status: string) {
    switch (status) {
      case 'completed': return <CheckCircle2 className="size-4 text-emerald-500" />;
      case 'in_progress': return <Loader2 className="size-4 text-sky-500 animate-spin" />;
      case 'failed': return <AlertCircle className="size-4 text-destructive" />;
      default: return <Circle className="size-4 text-muted-foreground" />;
    }
  }

  function calculateProgress(plan: TaskPlan) {
    if (plan.tasks.length === 0) return 0;
    const completed = plan.tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / plan.tasks.length) * 100);
  }

  if (loading && plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="size-8 animate-spin mb-4" />
        <p>Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Workflow className="size-6 text-primary" />
            Multi-Agent Plans
          </h2>
          <p className="text-muted-foreground">
            Track and manage autonomous orchestration workflows.
          </p>
        </div>
      </div>

      {plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Zap className="size-12 mb-4 opacity-10" />
            <p className="text-lg font-medium">No plans found</p>
            <p className="text-sm">Start an autonomous orchestration from chat to see it here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="overflow-hidden border-sidebar-border/50 hover:border-sidebar-border transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getStatusColor(plan.status)}>
                        {plan.status.toUpperCase()}
                      </Badge>
                      <CardDescription className="font-mono text-[10px]">
                        ID: {plan.id}
                      </CardDescription>
                    </div>
                    <CardTitle className="text-lg line-clamp-2">{plan.goal}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {plan.status === 'planning' && (
                      <Button size="sm" onClick={() => handleExecute(plan.id)} className="gap-2">
                        <Play className="size-3.5" />
                        Execute
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(plan.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Progress</span>
                    <span>{calculateProgress(plan)}%</span>
                  </div>
                  <Progress value={calculateProgress(plan)} className="h-1.5" />
                </div>
              </CardContent>
              <CardFooter className="p-0 border-t flex flex-col">
                <Button 
                  variant="ghost" 
                  className="w-full justify-between h-10 px-6 rounded-none text-xs font-normal"
                  onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-3.5" />
                    {plan.tasks.length} tasks total
                  </span>
                  {expandedPlanId === plan.id ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </Button>
                
                {expandedPlanId === plan.id && (
                  <div className="w-full border-t bg-muted/30 divide-y divide-sidebar-border/30">
                    {plan.tasks.map((task) => (
                      <div key={task.id} className="p-4 flex gap-4 text-sm">
                        <div className="mt-0.5 shrink-0">
                          {getTaskIcon(task.status)}
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{task.title}</span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase opacity-70">
                              {task.role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                          {task.error && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="size-3" />
                              {task.error}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
