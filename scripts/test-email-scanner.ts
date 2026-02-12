/**
 * Test script for Email Intelligence Scanner
 * 
 * Usage:
 *   npx tsx scripts/test-email-scanner.ts
 */

import { EmailIntelligenceScanner } from '../lib/email-intelligence-scanner'

async function testScanner() {
  console.log('🔍 Email Intelligence Scanner Test\n')

  try {
    const scanner = new EmailIntelligenceScanner()
    
    // Scan last 7 days
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)

    console.log(`📅 Scanning emails from ${startDate.toISOString()} to ${endDate.toISOString()}\n`)

    const result = await scanner.scanHistoricalEmails(startDate, endDate)

    console.log('\n✅ Scan Complete!\n')
    console.log('Results:')
    console.log('─────────────────────────────────────')
    console.log(`Job ID:           ${result.job_id}`)
    console.log(`Status:           ${result.status}`)
    console.log(`Total Emails:     ${result.total_emails}`)
    console.log(`Processed:        ${result.processed_count}`)
    console.log(`Suppliers Found:  ${result.suppliers_found}`)
    console.log(`Products Found:   ${result.products_found}`)
    console.log(`Contacts Found:   ${result.contacts_found}`)
    console.log(`Interactions:     ${result.interactions_logged}`)
    console.log('─────────────────────────────────────\n')

    if (result.error_message) {
      console.log(`❌ Error: ${result.error_message}\n`)
    }

    // Display state for resume
    if (result.status === 'paused') {
      console.log(`⏸️  Job paused. Resume with job_id: ${result.job_id}`)
      console.log(`   Last processed: ${result.last_processed_email_id}\n`)
    }

  } catch (error: any) {
    console.error('❌ Scanner Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Handle resume from command line
const args = process.argv.slice(2)
const resumeJobId = args.find(arg => arg.startsWith('--resume='))?.split('=')[1]

if (resumeJobId) {
  console.log(`🔄 Resuming job: ${resumeJobId}\n`)
  const scanner = new EmailIntelligenceScanner()
  scanner.scanHistoricalEmails(new Date(), new Date(), resumeJobId)
    .then((result) => {
      console.log('\n✅ Resume Complete!')
      console.log(`Status: ${result.status}`)
      console.log(`Processed: ${result.processed_count}/${result.total_emails}`)
    })
    .catch((error) => {
      console.error('❌ Resume Error:', error.message)
      process.exit(1)
    })
} else {
  testScanner()
}
