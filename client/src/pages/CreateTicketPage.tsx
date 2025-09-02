import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useCompanies,
  useDepartments,
  useSystems,
  useCreateTicket,
} from "@/hooks/api";
import {
  CloudUpload,
  Ticket,
  X,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import SimpleLayout from "@/components/SimpleLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  fadeInUp,
  staggerChildren,
  pageTransition,
} from "@/lib/animations";

// ✅ Validation schema
const ticketSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  companyId: z.string().min(1, "Please select a company"),
  departmentId: z.string().min(1, "Please select a department"),
  priority: z.string().min(1, "Please select a priority"),
  targetSystemId: z.string().min(1, "Please select a target system"),
});

type TicketForm = z.infer<typeof ticketSchema>;

export default function CreateTicketPage() {
  const [attachments, setAttachments] = useState<File[]>([]);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const form = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
  });

  // Watch selected values
  const selectedCompanyId = form.watch("companyId");
  const selectedDepartmentId = form.watch("departmentId");

  // Queries
  const companiesQuery = useCompanies();
  const departmentsQuery = useDepartments(selectedCompanyId);
  const systemsQuery = useSystems(selectedDepartmentId);
  const createTicketMutation = useCreateTicket();

  // Reset dependent fields
  useEffect(() => {
    form.setValue("departmentId", "");
    form.setValue("targetSystemId", "");
  }, [selectedCompanyId, form]);

  useEffect(() => {
    form.setValue("targetSystemId", "");
  }, [selectedDepartmentId, form]);

  const onSubmit = (data: TicketForm) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) =>
      formData.append(key, value as string)
    );
    attachments.forEach((file) => formData.append("attachments", file));
    createTicketMutation.mutate(formData, {
      onSuccess: (created: any) => {
        toast({
          title: "Ticket created",
          description: `Ticket ${created?.ticketNumber ?? created?.id ?? ''} created successfully`,
        });
        // Invalidate tickets list by forcing navigation; also navigate to detail if id present
        if (created?.id) {
          navigate(`/tickets/${created.id}`);
        } else {
          navigate("/tickets");
        }
      },
      onError: () => {
        toast({ title: "Failed to create ticket", variant: "destructive" });
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  return (
    <SimpleLayout>
      <motion.div
        {...pageTransition}
        className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6"
      >
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-8 flex items-center justify-between"
          >
            <div>
              <motion.h1
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600"
              >
                Create New Ticket
              </motion.h1>
              <motion.p
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-base text-gray-600 dark:text-gray-400"
              >
                Submit a new support request
              </motion.p>
            </div>
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </motion.div>
          </motion.div>

          {/* Form */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-8">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <motion.div
                  variants={staggerChildren}
                  initial="initial"
                  animate="animate"
                  className="space-y-6"
                >
                  {/* Subject */}
                  <motion.div variants={fadeInUp} className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Subject
                    </label>
                    <Input
                      {...form.register("subject")}
                      placeholder="Brief summary of the issue"
                      className="h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {form.formState.errors.subject && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1"
                      >
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.subject.message}
                      </motion.p>
                    )}
                  </motion.div>

                  {/* Description */}
                  <motion.div variants={fadeInUp} className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <Textarea
                      {...form.register("description")}
                      placeholder="Provide detailed information about the issue"
                      className="min-h-[120px] bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {form.formState.errors.description && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1"
                      >
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.description.message}
                      </motion.p>
                    )}
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Company */}
                    <motion.div variants={fadeInUp} className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Company
                      </label>
                      <Select
                        onValueChange={(value) => form.setValue("companyId", value)}
                        value={form.watch("companyId") || ""}
                      >
                        <SelectTrigger className="h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                          <SelectValue placeholder="Select Company" />
                        </SelectTrigger>
                        <SelectContent>
                          {companiesQuery.data?.map((company) => (
                            <SelectItem key={company.id} value={company.id.toString()}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.companyId && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {form.formState.errors.companyId.message}
                        </motion.p>
                      )}
                    </motion.div>

                    {/* Department */}
                    <motion.div variants={fadeInUp} className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Department
                      </label>
                      <Select
                        onValueChange={(value) => form.setValue("departmentId", value)}
                        value={form.watch("departmentId") || ""}
                        disabled={!selectedCompanyId || departmentsQuery.isLoading}
                      >
                        <SelectTrigger className="h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departmentsQuery.data?.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.departmentId && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {form.formState.errors.departmentId.message}
                        </motion.p>
                      )}
                    </motion.div>

                    {/* Priority */}
                    <motion.div variants={fadeInUp} className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Priority
                      </label>
                      <Select
                        onValueChange={(value) => form.setValue("priority", value)}
                        value={form.watch("priority") || ""}
                      >
                        <SelectTrigger className="h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                          <SelectValue placeholder="Select Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.priority && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {form.formState.errors.priority.message}
                        </motion.p>
                      )}
                    </motion.div>

                    {/* Target System */}
                    <motion.div variants={fadeInUp} className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Target System
                      </label>
                      <Select
                        onValueChange={(value) => form.setValue("targetSystemId", value)}
                        value={form.watch("targetSystemId") || ""}
                        disabled={!selectedDepartmentId || systemsQuery.isLoading}
                      >
                        <SelectTrigger className="h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                          <SelectValue placeholder="Select System" />
                        </SelectTrigger>
                        <SelectContent>
                          {systemsQuery.data?.map((sys) => (
                            <SelectItem key={sys.id} value={sys.id.toString()}>
                              {sys.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.targetSystemId && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {form.formState.errors.targetSystemId.message}
                        </motion.p>
                      )}
                    </motion.div>
                  </div>

                  {/* File Upload */}
                  <motion.div variants={fadeInUp} className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Attachments
                    </label>
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center transition-colors hover:border-blue-500 dark:hover:border-blue-400"
                    >
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer flex flex-col items-center justify-center"
                      >
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <CloudUpload className="h-12 w-12 text-blue-500 dark:text-blue-400 mb-3" />
                        </motion.div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Click to upload or drag and drop
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          PNG, JPG, PDF up to 10MB
                        </span>
                      </label>
                    </motion.div>

                    <AnimatePresence>
                      {attachments.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2"
                        >
                          {attachments.map((file, index) => (
                            <motion.div
                              key={file.name}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Card className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <CardContent className="p-3 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                      {file.name}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeFile(index)}
                                    className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Submit */}
                  <motion.div variants={fadeInUp} className="pt-4">
                    <Button
                      type="submit"
                      disabled={createTicketMutation.isPending}
                      className={`w-full h-11 ${
                        createTicketMutation.isPending
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      } text-white font-medium shadow-lg hover:shadow-blue-200/40 dark:hover:shadow-blue-900/40 transition-all duration-200`}
                    >
                      {createTicketMutation.isPending ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="mr-2"
                        >
                          <Loader2 className="h-5 w-5" />
                        </motion.div>
                      ) : (
                        <Ticket className="mr-2 h-5 w-5" />
                      )}
                      {createTicketMutation.isPending
                        ? "Creating..."
                        : "Create Ticket"}
                    </Button>
                  </motion.div>
                </motion.div>
              </form>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </SimpleLayout>
  );
}
