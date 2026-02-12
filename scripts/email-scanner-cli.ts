#!/usr/bin/env tsx
/**
 * CLI tool for Email Intelligence Scanner
 * 
 * Usage:
 *   npx tsx scripts/email-scanner-cli.ts scan --days 30
 *   npx tsx scripts/email-scanner-cli.ts resume --job scan_123_abc
 *   npx tsx scripts/email-scanner-cli.ts jobs
 *   npx tsx scripts/email-scanner-cli.ts stats
 *   npx tsx scripts/email-scanner-cli.ts suppliers --days 7
 *   npx tsx scripts/email-scanner-cli.ts products --days 7
 *   npx tsx scripts/email-scanner-cli.ts duplicates
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
const CRON_SECRET = process.env.CRON_SECRET

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET environment variable is required')
  process.exit(1)
}

const headers = {
  'Authorization': `Bearer ${CRON_SECRET}`,
  'Content-Type': 'application/json',
}

async function scan(daysBack: number = 30) {
  console.log(`🔍 Starting email scan for last ${daysBack} days...\n`)

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  const response = await fetch(`${BASE_URL}/api/agents/email/scan-intelligence`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'start',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('❌ Scan failed:', result.error || result.details)
    process.exit(1)
  }

  console.log('✅ Scan started successfully!\n')
  console.log(`Job ID: ${result.job_id}`)
  console.log('Status:', result.state.status)
  console.log('Total Emails:', result.state.total_emails)
  console.log('\nUse this command to resume if interrupted:')
  console.log(`  npx tsx scripts/email-scanner-cli.ts resume --job ${result.job_id}\n`)
}

async function resumeScan(jobId: string) {
  console.log(`🔄 Resuming scan job: ${jobId}\n`)

  const response = await fetch(`${BASE_URL}/api/agents/email/scan-intelligence`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'resume',
      resume_job_id: jobId,
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('❌ Resume failed:', result.error || result.details)
    process.exit(1)
  }

  console.log('✅ Scan resumed successfully!\n')
  console.log('Status:', result.state.status)
  console.log('Processed:', `${result.state.processed_count}/${result.state.total_emails}`)
  console.log('Suppliers:', result.state.suppliers_found)
  console.log('Products:', result.state.products_found)
}

async function listJobs(limit: number = 10) {
  console.log(`📋 Recent scan jobs (limit: ${limit})\n`)

  const response = await fetch(
    `${BASE_URL}/api/agents/email/scan-intelligence/stats?action=jobs&limit=${limit}`,
    { headers }
  )

  const result = await response.json()

  if (!response.ok) {
    console.error('❌ Failed to fetch jobs:', result.error)
    process.exit(1)
  }

  if (result.jobs.length === 0) {
    console.log('No scan jobs found.\n')
    return
  }

  for (const job of result.jobs) {
    console.log(`Job: ${job.job_id}`)
    console.log(`  Status: ${job.status}`)
    console.log(`  Progress: ${job.processed_count}/${job.total_emails} emails`)
    console.log(`  Found: ${job.suppliers_found} suppliers, ${job.products_found} products`)
    console.log(`  Started: ${new Date(job.started_at).toLocaleString()}`)
    console.log(`  Updated: ${new Date(job.last_updated).toLocaleString()}`)
    console.log()
  }
}

async function showStats() {
  console.log('📊 Email Intelligence Statistics\n')

  const response = await fetch(
    `${BASE_URL}/api/agents/email/scan-intelligence/stats?action=statistics`,
    { headers }
  )

  const result = await response.json()

  if (!response.ok) {
    console.error('❌ Failed to fetch statistics:', result.error)
    process.exit(1)
  }

  const stats = result.statistics

  console.log('Overall Totals:')
  console.log('─────────────────────────────────────')
  console.log(`Suppliers:     ${stats.total_suppliers}`)
  console.log(`Products:      ${stats.total_products}`)
  console.log(`Contacts:      ${stats.total_contacts}`)
  console.log(`Interactions:  ${stats.total_interactions}`)
  console.log()

  if (stats.suppliers_by_specialty.length > 0) {
    console.log('Top Supplier Specialties:')
    console.log('─────────────────────────────────────')
    stats.suppliers_by_specialty.slice(0, 5).forEach((s: any) => {
      console.log(`  ${s.specialty}: ${s.count}`)
    })
    console.log()
  }

  if (stats.products_by_category.length > 0) {
    console.log('Top Product Categories:')
    console.log('─────────────────────────────────────')
    stats.products_by_category.slice(0, 5).forEach((p: any) => {
      console.log(`  ${p.category}: ${p.count}`)
    })
    console.log()
  }

  if (stats.interactions_by_type.length > 0) {
    console.log('Interactions by Type:')
    console.log('─────────────────────────────────────')
    stats.interactions_by_type.forEach((i: any) => {
      console.log(`  ${i.type}: ${i.count}`)
    })
    console.log()
  }
}

async function listSuppliers(daysBack: number = 30) {
  console.log(`👥 Suppliers discovered in last ${daysBack} days\n`)

  const response = await fetch(
    `${BASE_URL}/api/agents/email/scan-intelligence/stats?action=suppliers&days_back=${daysBack}`,
    { headers }
  )

  const result = await response.json()

  if (!response.ok) {
    console.error('❌ Failed to fetch suppliers:', result.error)
    process.exit(1)
  }

  console.log(`Found ${result.count} suppliers\n`)

  for (const supplier of result.suppliers.slice(0, 20)) {
    console.log(`${supplier.company}`)
    console.log(`  Contact: ${supplier.name}`)
    console.log(`  Email: ${supplier.email}`)
    if (supplier.phone) console.log(`  Phone: ${supplier.phone}`)
    if (supplier.specialties?.length > 0) {
      console.log(`  Specialties: ${supplier.specialties.join(', ')}`)
    }
    console.log(`  Relationship: ${supplier.relationship_strength}/100`)
    console.log()
  }

  if (result.count > 20) {
    console.log(`... and ${result.count - 20} more`)
  }
}

async function listProducts(daysBack: number = 30) {
  console.log(`📦 Products discovered in last ${daysBack} days\n`)

  const response = await fetch(
    `${BASE_URL}/api/agents/email/scan-intelligence/stats?action=products&days_back=${daysBack}`,
    { headers }
  )

  const result = await response.json()

  if (!response.ok) {
    console.error('❌ Failed to fetch products:', result.error)
    process.exit(1)
  }

  console.log(`Found ${result.count} products\n`)

  for (const product of result.products.slice(0, 20)) {
    console.log(`${product.product_name}`)
    if (product.manufacturer) console.log(`  Manufacturer: ${product.manufacturer}`)
    if (product.model_number) console.log(`  Model: ${product.model_number}`)
    if (product.product_category) console.log(`  Category: ${product.product_category}`)
    console.log(`  Supplier: ${product.supplier.company}`)
    if (product.last_quoted_price) {
      console.log(`  Last Price: ${product.last_quoted_price}`)
    }
    console.log(`  Stock Reliability: ${product.stock_reliability}`)
    console.log()
  }

  if (result.count > 20) {
    console.log(`... and ${result.count - 20} more`)
  }
}

async function findDuplicates() {
  console.log('🔍 Finding duplicate suppliers...\n')

  const response = await fetch(
    `${BASE_URL}/api/agents/email/scan-intelligence/stats?action=duplicates`,
    { headers }
  )

  const result = await response.json()

  if (!response.ok) {
    console.error('❌ Failed to find duplicates:', result.error)
    process.exit(1)
  }

  console.log(`Email Duplicates: ${result.email_duplicates_count}`)
  console.log(`Company Duplicates: ${result.company_duplicates_count}\n`)

  if (result.duplicates.email_duplicates.length > 0) {
    console.log('Duplicate Emails:')
    console.log('─────────────────────────────────────')
    for (const group of result.duplicates.email_duplicates) {
      console.log(`Email: ${group[0].email}`)
      group.forEach((s: any) => {
        console.log(`  - ${s.company} (ID: ${s.id})`)
      })
      console.log()
    }
  }

  if (result.duplicates.company_duplicates.length > 0) {
    console.log('Duplicate Companies:')
    console.log('─────────────────────────────────────')
    for (const group of result.duplicates.company_duplicates) {
      console.log(`Company: ${group[0].company}`)
      group.forEach((s: any) => {
        console.log(`  - ${s.email} (ID: ${s.id})`)
      })
      console.log()
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0]

const getArg = (flag: string): string | undefined => {
  const index = args.indexOf(flag)
  return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined
}

const getArgInt = (flag: string, defaultValue: number): number => {
  const value = getArg(flag)
  return value ? parseInt(value) : defaultValue
}

// Execute command
async function main() {
  try {
    switch (command) {
      case 'scan':
        await scan(getArgInt('--days', 30))
        break
      
      case 'resume':
        const jobId = getArg('--job')
        if (!jobId) {
          console.error('❌ --job parameter is required for resume')
          process.exit(1)
        }
        await resumeScan(jobId)
        break
      
      case 'jobs':
        await listJobs(getArgInt('--limit', 10))
        break
      
      case 'stats':
        await showStats()
        break
      
      case 'suppliers':
        await listSuppliers(getArgInt('--days', 30))
        break
      
      case 'products':
        await listProducts(getArgInt('--days', 30))
        break
      
      case 'duplicates':
        await findDuplicates()
        break
      
      default:
        console.log('Email Intelligence Scanner CLI\n')
        console.log('Usage:')
        console.log('  scan [--days N]           Start new scan (default: 30 days)')
        console.log('  resume --job JOB_ID       Resume interrupted scan')
        console.log('  jobs [--limit N]          List recent scan jobs')
        console.log('  stats                     Show overall statistics')
        console.log('  suppliers [--days N]      List discovered suppliers')
        console.log('  products [--days N]       List discovered products')
        console.log('  duplicates                Find duplicate suppliers')
        console.log()
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
