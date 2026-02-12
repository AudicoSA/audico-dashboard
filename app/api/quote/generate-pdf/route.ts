import { NextRequest, NextResponse } from 'next/server'
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface QuoteDetails {
  quoteId: string
  quoteNumber: string
  customerName: string
  customerEmail: string
  companyName?: string
  items: Array<{
    id: string
    product_name: string
    description?: string
    quantity: number
    unit_price: number
    total_price: number
    supplier?: string
    lead_time?: string
  }>
  subtotal: number
  tax?: number
  shipping?: number
  total: number
  currency: string
  validUntil: string
  notes?: string
  terms?: string
  metadata?: any
}

function sanitizeText(str: string | undefined | null): string {
  if (!str) return ''
  return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

function generateQuotePdf(quoteDetails: QuoteDetails): Buffer {
  const { jsPDF } = require('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const date = new Date().toLocaleDateString('en-ZA', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
  const validUntilDate = new Date(quoteDetails.validUntil).toLocaleDateString('en-ZA', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  // --- Header ---
  doc.setFontSize(28)
  doc.setTextColor(0, 123, 255)
  doc.text('AUDICO', margin, y + 8)
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text('Professional Audio & Visual Solutions', margin, y + 14)
  doc.text('Email: sales@audico.co.za | Phone: +27 11 123 4567', margin, y + 19)

  // Right side: QUOTATION
  doc.setFontSize(20)
  doc.setTextColor(51, 51, 51)
  doc.text('QUOTATION', pageWidth - margin, y + 8, { align: 'right' })
  doc.setFontSize(12)
  doc.setTextColor(0, 123, 255)
  doc.text(sanitizeText(quoteDetails.quoteNumber), pageWidth - margin, y + 15, { align: 'right' })
  doc.setFontSize(10)
  doc.setTextColor(51, 51, 51)
  doc.text(`Date: ${date}`, pageWidth - margin, y + 21, { align: 'right' })
  doc.text(`Valid Until: ${validUntilDate}`, pageWidth - margin, y + 26, { align: 'right' })

  y += 30
  // Blue divider
  doc.setDrawColor(0, 123, 255)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // --- Bill To ---
  doc.setFillColor(248, 249, 250)
  doc.rect(margin, y, contentWidth, 22, 'F')
  doc.setFontSize(12)
  doc.setTextColor(0, 123, 255)
  doc.text('Bill To:', margin + 5, y + 7)
  doc.setFontSize(11)
  doc.setTextColor(51, 51, 51)
  doc.setFont('helvetica', 'bold')
  doc.text(sanitizeText(quoteDetails.customerName), margin + 5, y + 13)
  doc.setFont('helvetica', 'normal')
  let billY = y + 18
  if (quoteDetails.companyName) {
    doc.setFontSize(10)
    doc.text(sanitizeText(quoteDetails.companyName), margin + 5, billY)
    billY += 5
  }
  doc.setFontSize(10)
  doc.text(sanitizeText(quoteDetails.customerEmail), margin + 5, billY)
  y += 28

  // --- Items Table ---
  const colWidths = [contentWidth * 0.40, contentWidth * 0.15, contentWidth * 0.20, contentWidth * 0.25]
  const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]]
  const rowHeight = 10

  // Table header
  doc.setFillColor(0, 123, 255)
  doc.rect(margin, y, contentWidth, rowHeight, 'F')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('Product / Description', colX[0] + 3, y + 7)
  doc.text('Qty', colX[1] + colWidths[1] / 2, y + 7, { align: 'center' })
  doc.text('Unit Price', colX[2] + colWidths[2] - 3, y + 7, { align: 'right' })
  doc.text('Total', colX[3] + colWidths[3] - 3, y + 7, { align: 'right' })
  y += rowHeight

  // Table rows
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 51, 51)
  quoteDetails.items.forEach((item, idx) => {
    // Check for page break
    if (y > 260) {
      doc.addPage()
      y = margin
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 249, 250)
      doc.rect(margin, y, contentWidth, rowHeight, 'F')
    }

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(sanitizeText(item.product_name).substring(0, 45), colX[0] + 3, y + 7)
    doc.setFont('helvetica', 'normal')
    doc.text(String(item.quantity), colX[1] + colWidths[1] / 2, y + 7, { align: 'center' })
    doc.text(`${quoteDetails.currency} ${item.unit_price.toFixed(2)}`, colX[2] + colWidths[2] - 3, y + 7, { align: 'right' })
    doc.text(`${quoteDetails.currency} ${item.total_price.toFixed(2)}`, colX[3] + colWidths[3] - 3, y + 7, { align: 'right' })

    // Row border
    doc.setDrawColor(222, 226, 230)
    doc.setLineWidth(0.2)
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight)
    y += rowHeight

    // Description sub-row
    if (item.description) {
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(sanitizeText(item.description).substring(0, 60), colX[0] + 3, y + 5)
      y += 6
      doc.setTextColor(51, 51, 51)
    }
  })

  y += 8

  // --- Totals ---
  const totalsX = pageWidth - margin - 80
  const totalsValX = pageWidth - margin - 3

  doc.setFontSize(10)
  doc.setTextColor(51, 51, 51)
  doc.text('Subtotal:', totalsX, y + 5)
  doc.text(`${quoteDetails.currency} ${quoteDetails.subtotal.toFixed(2)}`, totalsValX, y + 5, { align: 'right' })
  doc.setDrawColor(222, 226, 230)
  doc.line(totalsX, y + 7, pageWidth - margin, y + 7)
  y += 10

  if (quoteDetails.tax) {
    doc.text('VAT (15%):', totalsX, y + 5)
    doc.text(`${quoteDetails.currency} ${quoteDetails.tax.toFixed(2)}`, totalsValX, y + 5, { align: 'right' })
    doc.line(totalsX, y + 7, pageWidth - margin, y + 7)
    y += 10
  }

  if (quoteDetails.shipping && quoteDetails.shipping > 0) {
    doc.text('Shipping:', totalsX, y + 5)
    doc.text(`${quoteDetails.currency} ${quoteDetails.shipping.toFixed(2)}`, totalsValX, y + 5, { align: 'right' })
    doc.line(totalsX, y + 7, pageWidth - margin, y + 7)
    y += 10
  }

  // Total row (blue background)
  doc.setFillColor(0, 123, 255)
  doc.rect(totalsX - 2, y, 82, 10, 'F')
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL:', totalsX, y + 7)
  doc.text(`${quoteDetails.currency} ${quoteDetails.total.toFixed(2)}`, totalsValX, y + 7, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 18

  // --- Notes ---
  if (quoteDetails.notes) {
    if (y > 250) { doc.addPage(); y = margin }
    doc.setFontSize(11)
    doc.setTextColor(133, 100, 4)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', margin, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const noteLines = doc.splitTextToSize(sanitizeText(quoteDetails.notes), contentWidth - 10)
    doc.text(noteLines, margin + 5, y + 11)
    y += 12 + noteLines.length * 4
  }

  // --- Terms ---
  if (quoteDetails.terms) {
    if (y > 250) { doc.addPage(); y = margin }
    doc.setFontSize(11)
    doc.setTextColor(51, 51, 51)
    doc.setFont('helvetica', 'bold')
    doc.text('Terms & Conditions:', margin, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    const termLines = doc.splitTextToSize(sanitizeText(quoteDetails.terms), contentWidth - 10)
    doc.text(termLines, margin + 5, y + 11)
    y += 12 + termLines.length * 3.5
  }

  // --- Footer ---
  if (y > 260) { doc.addPage(); y = margin }
  y = Math.max(y + 10, 265)
  doc.setDrawColor(222, 226, 230)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'bold')
  doc.text('Thank you for your business!', pageWidth / 2, y, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('For any questions regarding this quote, please contact us at sales@audico.co.za', pageWidth / 2, y + 5, { align: 'center' })
  doc.text('AUDICO | Professional Audio & Visual Solutions', pageWidth / 2, y + 10, { align: 'center' })

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

async function uploadPdfToSupabase(
  pdfBuffer: Buffer,
  quoteNumber: string
): Promise<string | null> {
  try {
    const fileName = `quotes/${quoteNumber}.pdf`
    
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })
    
    if (error) {
      console.error('Error uploading PDF to Supabase:', error)
      return null
    }
    
    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)
    
    return publicUrlData.publicUrl
  } catch (error) {
    console.error('Error in uploadPdfToSupabase:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  try {
    const quoteDetails: QuoteDetails = await request.json()
    
    if (!quoteDetails.quoteNumber || !quoteDetails.items || quoteDetails.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid quote details provided' },
        { status: 400 }
      )
    }
    
    const pdfBuffer = generateQuotePdf(quoteDetails)

    const pdfUrl = await uploadPdfToSupabase(pdfBuffer, quoteDetails.quoteNumber)
    
    if (!pdfUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to upload PDF to storage' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      pdfUrl,
      quoteNumber: quoteDetails.quoteNumber
    })
    
  } catch (error: any) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
