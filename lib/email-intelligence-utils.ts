/**
 * Utility functions for Email Intelligence Scanner
 */

import { getServerSupabase } from './supabase'

export interface ScanJobInfo {
  job_id: string
  status: string
  total_emails: number
  processed_count: number
  suppliers_found: number
  products_found: number
  contacts_found: number
  interactions_logged: number
  started_at: string
  last_updated: string
}

/**
 * Get all scan jobs from squad_messages
 */
export async function getScanJobs(limit: number = 10): Promise<ScanJobInfo[]> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('squad_messages')
    .select('data, created_at')
    .eq('from_agent', 'email_intelligence_scanner')
    .not('data->>job_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit * 10)

  if (error) {
    throw new Error(`Failed to fetch scan jobs: ${error.message}`)
  }

  const jobMap = new Map<string, ScanJobInfo>()

  for (const row of data || []) {
    if (!row.data?.state) continue

    const state = row.data.state
    const jobId = state.job_id

    const existing = jobMap.get(jobId)
    if (!existing || new Date(row.created_at) > new Date(existing.last_updated)) {
      jobMap.set(jobId, {
        job_id: jobId,
        status: state.status,
        total_emails: state.total_emails,
        processed_count: state.processed_count,
        suppliers_found: state.suppliers_found,
        products_found: state.products_found,
        contacts_found: state.contacts_found,
        interactions_logged: state.interactions_logged,
        started_at: state.start_date || row.created_at,
        last_updated: row.created_at,
      })
    }
  }

  return Array.from(jobMap.values())
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    .slice(0, limit)
}

/**
 * Get detailed progress for a specific job
 */
export async function getJobProgress(jobId: string): Promise<any[]> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('squad_messages')
    .select('message, data, created_at')
    .eq('from_agent', 'email_intelligence_scanner')
    .eq('data->>job_id', jobId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch job progress: ${error.message}`)
  }

  return data || []
}

/**
 * Get suppliers discovered in a date range
 */
export async function getSuppliersInRange(
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch suppliers: ${error.message}`)
  }

  return data || []
}

/**
 * Get products discovered by a scan
 */
export async function getProductsInRange(
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('supplier_products')
    .select(`
      *,
      supplier:suppliers (
        company,
        email
      )
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`)
  }

  return data || []
}

/**
 * Get interactions logged during a scan
 */
export async function getInteractionsInRange(
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('email_supplier_interactions')
    .select(`
      *,
      supplier:suppliers (
        company,
        email
      ),
      email:email_logs (
        subject,
        from_email,
        created_at
      )
    `)
    .gte('extracted_at', startDate.toISOString())
    .lte('extracted_at', endDate.toISOString())
    .order('extracted_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch interactions: ${error.message}`)
  }

  return data || []
}

/**
 * Get scan statistics summary
 */
export async function getScanStatistics(): Promise<{
  total_suppliers: number
  total_products: number
  total_contacts: number
  total_interactions: number
  suppliers_by_specialty: { specialty: string; count: number }[]
  products_by_category: { category: string; count: number }[]
  interactions_by_type: { type: string; count: number }[]
}> {
  const supabase = getServerSupabase()

  const [
    { count: total_suppliers },
    { count: total_products },
    { count: total_contacts },
    { count: total_interactions },
  ] = await Promise.all([
    supabase.from('suppliers').select('*', { count: 'exact', head: true }),
    supabase.from('supplier_products').select('*', { count: 'exact', head: true }),
    supabase.from('supplier_contacts').select('*', { count: 'exact', head: true }),
    supabase.from('email_supplier_interactions').select('*', { count: 'exact', head: true }),
  ])

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('specialties')

  const specialtyCounts = new Map<string, number>()
  for (const supplier of suppliers || []) {
    for (const specialty of supplier.specialties || []) {
      specialtyCounts.set(specialty, (specialtyCounts.get(specialty) || 0) + 1)
    }
  }

  const { data: products } = await supabase
    .from('supplier_products')
    .select('product_category')

  const categoryCounts = new Map<string, number>()
  for (const product of products || []) {
    if (product.product_category) {
      categoryCounts.set(
        product.product_category,
        (categoryCounts.get(product.product_category) || 0) + 1
      )
    }
  }

  const { data: interactions } = await supabase
    .from('email_supplier_interactions')
    .select('interaction_type')

  const interactionCounts = new Map<string, number>()
  for (const interaction of interactions || []) {
    interactionCounts.set(
      interaction.interaction_type,
      (interactionCounts.get(interaction.interaction_type) || 0) + 1
    )
  }

  return {
    total_suppliers: total_suppliers || 0,
    total_products: total_products || 0,
    total_contacts: total_contacts || 0,
    total_interactions: total_interactions || 0,
    suppliers_by_specialty: Array.from(specialtyCounts.entries())
      .map(([specialty, count]) => ({ specialty, count }))
      .sort((a, b) => b.count - a.count),
    products_by_category: Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    interactions_by_type: Array.from(interactionCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/**
 * Cancel/pause a running job
 */
export async function markJobAsPaused(jobId: string): Promise<void> {
  const supabase = getServerSupabase()

  await supabase
    .from('squad_messages')
    .insert({
      from_agent: 'email_intelligence_scanner',
      to_agent: null,
      message: `Job ${jobId} manually paused`,
      task_id: null,
      data: {
        job_id: jobId,
        action: 'manual_pause',
        timestamp: new Date().toISOString(),
      },
    })
}

/**
 * Find duplicate suppliers that should be merged
 */
export async function findDuplicateSuppliers(): Promise<{
  email_duplicates: any[]
  company_duplicates: any[]
}> {
  const supabase = getServerSupabase()

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('created_at', { ascending: true })

  const emailMap = new Map<string, any[]>()
  const companyMap = new Map<string, any[]>()

  for (const supplier of suppliers || []) {
    const email = supplier.email.toLowerCase()
    const company = supplier.company.toLowerCase().trim()

    if (!emailMap.has(email)) {
      emailMap.set(email, [])
    }
    emailMap.get(email)!.push(supplier)

    if (!companyMap.has(company)) {
      companyMap.set(company, [])
    }
    companyMap.get(company)!.push(supplier)
  }

  const email_duplicates = Array.from(emailMap.values()).filter((s) => s.length > 1)
  const company_duplicates = Array.from(companyMap.values()).filter((s) => s.length > 1)

  return {
    email_duplicates,
    company_duplicates,
  }
}
