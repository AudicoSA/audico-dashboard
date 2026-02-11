import { NextRequest, NextResponse } from 'next/server'
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

function generateQuotePdfHtml(quoteDetails: QuoteDetails): string {
  const date = new Date().toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const validUntilDate = new Date(quoteDetails.validUntil).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quote ${quoteDetails.quoteNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 40px;
      background: #fff;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #007bff;
    }
    
    .company-info h1 {
      color: #007bff;
      font-size: 32px;
      margin-bottom: 5px;
    }
    
    .company-info p {
      color: #666;
      font-size: 14px;
    }
    
    .quote-info {
      text-align: right;
    }
    
    .quote-info h2 {
      color: #333;
      font-size: 24px;
      margin-bottom: 10px;
    }
    
    .quote-info p {
      font-size: 14px;
      margin: 5px 0;
    }
    
    .quote-info .quote-number {
      font-weight: bold;
      color: #007bff;
      font-size: 16px;
    }
    
    .customer-section {
      margin-bottom: 30px;
      padding: 20px;
      background-color: #f8f9fa;
      border-radius: 5px;
    }
    
    .customer-section h3 {
      color: #007bff;
      margin-bottom: 10px;
      font-size: 18px;
    }
    
    .customer-section p {
      margin: 5px 0;
      font-size: 14px;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    .items-table thead {
      background-color: #007bff;
      color: white;
    }
    
    .items-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
    }
    
    .items-table tbody tr {
      border-bottom: 1px solid #dee2e6;
    }
    
    .items-table tbody tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    
    .items-table td {
      padding: 12px;
      font-size: 14px;
    }
    
    .items-table td.right-align {
      text-align: right;
    }
    
    .items-table td.description {
      color: #666;
      font-size: 12px;
    }
    
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    
    .totals-table {
      width: 350px;
    }
    
    .totals-table tr {
      border-bottom: 1px solid #dee2e6;
    }
    
    .totals-table td {
      padding: 10px;
      font-size: 14px;
    }
    
    .totals-table td:last-child {
      text-align: right;
    }
    
    .totals-table tr.total-row {
      background-color: #007bff;
      color: white;
      font-weight: bold;
      font-size: 16px;
    }
    
    .totals-table tr.total-row td {
      padding: 15px 10px;
    }
    
    .notes-section {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 3px;
    }
    
    .notes-section h4 {
      color: #856404;
      margin-bottom: 10px;
      font-size: 16px;
    }
    
    .notes-section p {
      color: #856404;
      font-size: 14px;
    }
    
    .terms-section {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 3px;
    }
    
    .terms-section h4 {
      color: #333;
      margin-bottom: 10px;
      font-size: 16px;
    }
    
    .terms-section p {
      color: #666;
      font-size: 13px;
      line-height: 1.8;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #dee2e6;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    
    .footer p {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>AUDICO</h1>
      <p>Professional Audio & Visual Solutions</p>
      <p>Email: sales@audico.co.za | Phone: +27 11 123 4567</p>
    </div>
    <div class="quote-info">
      <h2>QUOTATION</h2>
      <p class="quote-number">${quoteDetails.quoteNumber}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Valid Until:</strong> ${validUntilDate}</p>
    </div>
  </div>
  
  <div class="customer-section">
    <h3>Bill To:</h3>
    <p><strong>${quoteDetails.customerName}</strong></p>
    ${quoteDetails.companyName ? `<p>${quoteDetails.companyName}</p>` : ''}
    <p>${quoteDetails.customerEmail}</p>
  </div>
  
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 40%;">Product / Description</th>
        <th style="width: 15%; text-align: center;">Qty</th>
        <th style="width: 20%; text-align: right;">Unit Price</th>
        <th style="width: 25%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${quoteDetails.items.map(item => `
        <tr>
          <td>
            <strong>${item.product_name}</strong>
            ${item.description ? `<div class="description">${item.description}</div>` : ''}
            ${item.supplier ? `<div class="description">Supplier: ${item.supplier}</div>` : ''}
            ${item.lead_time ? `<div class="description">Lead Time: ${item.lead_time}</div>` : ''}
          </td>
          <td style="text-align: center;">${item.quantity}</td>
          <td class="right-align">${quoteDetails.currency} ${item.unit_price.toFixed(2)}</td>
          <td class="right-align">${quoteDetails.currency} ${item.total_price.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="totals-section">
    <table class="totals-table">
      <tr>
        <td><strong>Subtotal:</strong></td>
        <td>${quoteDetails.currency} ${quoteDetails.subtotal.toFixed(2)}</td>
      </tr>
      ${quoteDetails.tax ? `
        <tr>
          <td><strong>VAT (15%):</strong></td>
          <td>${quoteDetails.currency} ${quoteDetails.tax.toFixed(2)}</td>
        </tr>
      ` : ''}
      ${quoteDetails.shipping && quoteDetails.shipping > 0 ? `
        <tr>
          <td><strong>Shipping:</strong></td>
          <td>${quoteDetails.currency} ${quoteDetails.shipping.toFixed(2)}</td>
        </tr>
      ` : ''}
      <tr class="total-row">
        <td><strong>TOTAL:</strong></td>
        <td>${quoteDetails.currency} ${quoteDetails.total.toFixed(2)}</td>
      </tr>
    </table>
  </div>
  
  ${quoteDetails.notes ? `
    <div class="notes-section">
      <h4>Notes:</h4>
      <p>${quoteDetails.notes}</p>
    </div>
  ` : ''}
  
  ${quoteDetails.terms ? `
    <div class="terms-section">
      <h4>Terms & Conditions:</h4>
      <p>${quoteDetails.terms}</p>
    </div>
  ` : ''}
  
  <div class="footer">
    <p><strong>Thank you for your business!</strong></p>
    <p>For any questions regarding this quote, please contact us at sales@audico.co.za</p>
    <p>AUDICO | Professional Audio & Visual Solutions</p>
  </div>
</body>
</html>
  `
}

async function convertHtmlToPdf(_html: string): Promise<Buffer> {
  // TODO: Phase 3 replaces this with jspdf implementation
  throw new Error('PDF generation not yet available - Phase 3 will add jspdf implementation')
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
  try {
    const quoteDetails: QuoteDetails = await request.json()
    
    if (!quoteDetails.quoteNumber || !quoteDetails.items || quoteDetails.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid quote details provided' },
        { status: 400 }
      )
    }
    
    const html = generateQuotePdfHtml(quoteDetails)
    
    const pdfBuffer = await convertHtmlToPdf(html)
    
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
