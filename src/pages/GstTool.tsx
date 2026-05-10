import { Sidebar } from "@/components/layout/Sidebar";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useValidateGstin, useCalculateGst } from "@workspace/api-client-react";
import { getValidateGstinQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { INDIAN_STATES } from "@/lib/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calculator, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const validateSchema = z.object({
  gstin: z.string().min(15, "GSTIN must be 15 characters").max(15, "GSTIN must be 15 characters"),
});

const calcSchema = z.object({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  gstRate: z.coerce.number().min(0, "Rate cannot be negative"),
  sellerStateCode: z.string().min(2, "Select seller state"),
  buyerStateCode: z.string().min(2, "Select buyer state"),
});

export default function GstTool() {
  const [gstinToValidate, setGstinToValidate] = useState("");
  
  const { data: validationResult, isLoading: isValidating, error: validationError } = useValidateGstin(
    gstinToValidate,
    { query: { enabled: !!gstinToValidate && gstinToValidate.length === 15 } } as any,
  );

  // Let's use fetch directly for the validation if the hook wrapper is tricky with Tanstack Query directly,
  // actually I can just use the hook if it's a standard useQuery wrapper.
  // Wait, orval generated hooks: `const { data } = useValidateGstin(gstin, { query: { enabled: !!gstin } })`
  
  const validateForm = useForm<z.infer<typeof validateSchema>>({
    resolver: zodResolver(validateSchema),
    defaultValues: {
      gstin: "",
    },
  });

  const onValidate = (values: z.infer<typeof validateSchema>) => {
    setGstinToValidate(values.gstin.toUpperCase());
  };

  // For calculate, it's typically a mutation or a query. If it's a query, we'd enable it. Let's assume it's a mutation because it's a POST body.
  // Wait, the API spec says `useCalculateGst` - it's a mutation.
  const calculateGst = useCalculateGst();
  const [calcResult, setCalcResult] = useState<any>(null);

  const calcForm = useForm<z.infer<typeof calcSchema>>({
    resolver: zodResolver(calcSchema),
    defaultValues: {
      amount: 0,
      gstRate: 18,
      sellerStateCode: "",
      buyerStateCode: "",
    },
  });

  const onCalculate = (values: z.infer<typeof calcSchema>) => {
    calculateGst.mutate({ data: values }, {
      onSuccess: (data) => {
        setCalcResult(data);
      }
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold text-foreground">GST Tool</h1>
          <p className="text-muted-foreground mt-1 text-sm">Validate GSTINs and calculate IGST/CGST/SGST.</p>
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          <Tabs defaultValue="validate" className="max-w-3xl">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="validate">Validate GSTIN</TabsTrigger>
              <TabsTrigger value="calculate">Calculate Tax</TabsTrigger>
            </TabsList>
            
            <TabsContent value="validate">
              <Card>
                <CardHeader>
                  <CardTitle>GSTIN Verification</CardTitle>
                  <CardDescription>Enter a 15-character GSTIN to check its validity and details.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...validateForm}>
                    <form onSubmit={validateForm.handleSubmit(onValidate)} className="flex gap-4 items-end mb-8">
                      <FormField control={validateForm.control} name="gstin" render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>GSTIN</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 27AAAAA0000A1Z5" className="uppercase font-mono" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" disabled={isValidating}>
                        {isValidating ? "Validating..." : "Validate"}
                      </Button>
                    </form>
                  </Form>

                  {validationResult && (
                    <div className="space-y-4 animate-in fade-in">
                      {validationResult.isValid ? (
                        <Alert className="bg-green-500/10 border-green-500/50 text-green-500">
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertTitle>Valid GSTIN</AlertTitle>
                          <AlertDescription>The GSTIN format is valid.</AlertDescription>
                        </Alert>
                      ) : (
                        <Alert className="bg-red-500/10 border-red-500/50 text-red-500">
                          <XCircle className="h-4 w-4" />
                          <AlertTitle>Invalid GSTIN</AlertTitle>
                          <AlertDescription>
                            {validationResult.errors?.join(", ") || "The GSTIN format is incorrect."}
                          </AlertDescription>
                        </Alert>
                      )}

                      {validationResult.isValid && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                          <div>
                            <div className="text-sm text-muted-foreground">State</div>
                            <div className="font-medium text-foreground">{validationResult.stateName} ({validationResult.stateCode})</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">PAN Number</div>
                            <div className="font-medium text-foreground font-mono">{validationResult.panNumber}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Entity Type</div>
                            <div className="font-medium text-foreground">{validationResult.entityType}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="calculate">
              <Card>
                <CardHeader>
                  <CardTitle>GST Calculator</CardTitle>
                  <CardDescription>Calculate IGST vs CGST/SGST based on seller and buyer states.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...calcForm}>
                    <form onSubmit={calcForm.handleSubmit(onCalculate)} className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={calcForm.control} name="amount" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Taxable Amount (₹)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={calcForm.control} name="gstRate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>GST Rate (%)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value.toString()}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="0">0%</SelectItem>
                                <SelectItem value="5">5%</SelectItem>
                                <SelectItem value="12">12%</SelectItem>
                                <SelectItem value="18">18%</SelectItem>
                                <SelectItem value="28">28%</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={calcForm.control} name="sellerStateCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seller State (Origin)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={calcForm.control} name="buyerStateCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Buyer State (Destination)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      
                      <Button type="submit" disabled={calculateGst.isPending} className="w-full">
                        <Calculator className="w-4 h-4 mr-2" /> Calculate Tax
                      </Button>
                    </form>
                  </Form>

                  {calcResult && (
                    <div className="mt-8 pt-8 border-t border-border animate-in fade-in">
                      <h3 className="text-lg font-semibold text-foreground mb-4">Calculation Result</h3>
                      
                      <div className="bg-muted/30 p-6 rounded-lg border border-border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-muted-foreground">Transaction Type:</span>
                          <Badge variant="outline" className={calcResult.isInterState ? "text-blue-500 border-blue-500/30" : "text-amber-500 border-amber-500/30"}>
                            {calcResult.isInterState ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}
                          </Badge>
                        </div>
                        
                        <div className="space-y-3 mt-6">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Taxable Value:</span>
                            <span className="font-medium text-foreground">₹{calcResult.baseAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                          </div>
                          
                          {calcResult.isInterState ? (
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">IGST ({calcResult.gstRate}%):</span>
                              <span className="font-medium text-foreground">₹{calcResult.igst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">CGST ({calcResult.gstRate / 2}%):</span>
                                <span className="font-medium text-foreground">₹{calcResult.cgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">SGST ({calcResult.gstRate / 2}%):</span>
                                <span className="font-medium text-foreground">₹{calcResult.sgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                              </div>
                            </>
                          )}
                          
                          <div className="border-t border-border my-2"></div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-foreground font-semibold">Total Invoice Value:</span>
                            <span className="text-xl font-bold text-primary">₹{calcResult.totalAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
