import { getServerSupabase } from './supabase'
import { headers } from 'next/headers'
import crypto from 'crypto'

export interface TenantContext {
  id: string
  slug: string
  subdomain: string
  companyName: string
  brandingConfig: any
  featuresEnabled: any
  status: string
}

export async function getTenantFromRequest(): Promise<TenantContext | null> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  
  const supabase = getServerSupabase()
  
  if (host.includes('.audico-platform.com') || host.includes('.localhost')) {
    const subdomain = host.split('.')[0]
    
    if (subdomain && subdomain !== 'www' && subdomain !== 'audico-platform') {
      const { data, error } = await supabase
        .rpc('get_tenant_by_subdomain', { p_subdomain: subdomain })
        .single()
      
      if (data && !error) {
        return {
          id: data.tenant_id,
          slug: data.tenant_slug,
          subdomain: subdomain,
          companyName: data.company_name,
          brandingConfig: data.branding_config,
          featuresEnabled: data.features_enabled,
          status: data.status,
        }
      }
    }
  } else {
    const { data, error } = await supabase
      .rpc('get_tenant_by_domain', { p_domain: host })
      .single()
    
    if (data && !error) {
      return {
        id: data.tenant_id,
        slug: data.tenant_slug,
        subdomain: host,
        companyName: data.company_name,
        brandingConfig: data.branding_config,
        featuresEnabled: data.features_enabled,
        status: data.status,
      }
    }
  }
  
  return null
}

export async function getTenantById(tenantId: string): Promise<TenantContext | null> {
  const supabase = getServerSupabase()
  
  const { data, error } = await supabase
    .from('reseller_tenants')
    .select('*')
    .eq('id', tenantId)
    .single()
  
  if (error || !data) return null
  
  return {
    id: data.id,
    slug: data.tenant_slug,
    subdomain: data.subdomain,
    companyName: data.company_name,
    brandingConfig: data.branding_config,
    featuresEnabled: data.features_enabled,
    status: data.status,
  }
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const randomBytes = crypto.randomBytes(32)
  const key = `tk_${randomBytes.toString('base64url')}`
  const prefix = key.substring(0, 12)
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  
  return { key, prefix, hash }
}

export async function validateApiKey(apiKey: string): Promise<{ tenantId: string; permissions: any } | null> {
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex')
  const supabase = getServerSupabase()
  
  const { data, error } = await supabase
    .rpc('validate_tenant_api_key', { p_key_hash: hash })
    .single()
  
  if (error || !data) return null
  
  await supabase
    .from('tenant_api_keys')
    .update({ 
      last_used_at: new Date().toISOString(),
      usage_count: (data.usage_count || 0) + 1 
    })
    .eq('id', data.key_id)
  
  return {
    tenantId: data.tenant_id,
    permissions: data.permissions,
  }
}

export async function recordTenantUsage(
  tenantId: string,
  metricType: 'api_call' | 'agent_action' | 'order',
  count: number = 1
): Promise<void> {
  const supabase = getServerSupabase()
  
  await supabase.rpc('record_tenant_usage', {
    p_tenant_id: tenantId,
    p_metric_type: metricType,
    p_count: count,
  })
}

export async function logTenantAudit(
  tenantId: string,
  userId: string | null,
  actionType: string,
  resourceType: string | null,
  resourceId: string | null,
  actionDetails: any,
  success: boolean = true,
  errorMessage: string | null = null
): Promise<void> {
  const supabase = getServerSupabase()
  const headersList = await headers()
  
  await supabase.from('tenant_audit_log').insert({
    tenant_id: tenantId,
    user_id: userId,
    action_type: actionType,
    resource_type: resourceType,
    resource_id: resourceId,
    action_details: actionDetails,
    ip_address: headersList.get('x-forwarded-for') || headersList.get('x-real-ip'),
    user_agent: headersList.get('user-agent'),
    success,
    error_message: errorMessage,
  })
}

export function hasFeatureAccess(tenant: TenantContext, feature: string): boolean {
  return tenant.featuresEnabled[feature] === true
}

export function getTenantProductPrice(basePrice: number, markupPercentage: number, customPrice?: number): number {
  if (customPrice) return customPrice
  return basePrice * (1 + markupPercentage / 100)
}
