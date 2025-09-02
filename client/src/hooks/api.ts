import { useQuery, useMutation } from '@tanstack/react-query';

//
// 🔹 Fetch companies
//
export function useCompanies() {
  return useQuery({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch companies');
      return res.json();
    },
  });
}

//
// 🔹 Fetch departments (filtered by companyId)
//
export function useDepartments(companyId?: string) {
  return useQuery({
    queryKey: ['/api/departments', { company_id: companyId }],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/departments?company_id=${companyId}` , { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch departments');
      return res.json();
    },
    enabled: !!companyId,
  });
}

//
// 🔹 Fetch systems (filtered by departmentId)
//
export function useSystems(departmentId?: string) {
  return useQuery({
    queryKey: ['/api/target-systems', { department_id: departmentId }],
    queryFn: async () => {
      if (!departmentId) return [];
      const res = await fetch(`/api/target-systems?department_id=${departmentId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch systems');
      return res.json();
    },
    enabled: !!departmentId,
  });
}

//
// 🔹 Create ticket mutation
//
export function useCreateTicket() {
  return useMutation({
    mutationFn: async (data: FormData | Record<string, any>) => {
      const formData = data instanceof FormData ? data : (() => {
        const fd = new FormData();
        Object.entries(data).forEach(([key, value]) => {
          if (key === 'attachments' && Array.isArray(value)) {
            (value as File[]).forEach((file: File) => fd.append('attachments', file));
          } else if (value != null) {
            fd.append(key, String(value));
          }
        });
        return fd;
      })();

      const res = await fetch('/api/tickets', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to create ticket');
      return res.json();
    },
  });
}
