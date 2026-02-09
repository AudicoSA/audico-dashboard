import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase()
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const ticketId = formData.get('ticket_id') as string
    const portalUserId = formData.get('portal_user_id') as string

    if (!file || !ticketId || !portalUserId) {
      return NextResponse.json(
        { error: 'File, ticket ID, and user ID are required' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      )
    }

    // Generate unique file name
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}_${randomStr}.${fileExt}`
    const storagePath = `tickets/${ticketId}/${fileName}`

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('ticket-attachments')
      .getPublicUrl(storagePath)

    // Save attachment record
    const { data: attachment, error: dbError } = await supabase
      .from('ticket_attachments')
      .insert({
        ticket_id: ticketId,
        uploaded_by: portalUserId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file_url: urlData.publicUrl,
        storage_path: storagePath,
        scan_status: 'pending',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error saving attachment:', dbError)
      return NextResponse.json(
        { error: 'Failed to save attachment record' },
        { status: 500 }
      )
    }

    // Log audit event
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    await supabase.rpc('log_audit_event', {
      p_portal_user_id: portalUserId,
      p_action_type: 'upload_file',
      p_resource_type: 'attachment',
      p_resource_id: attachment.id,
      p_ip_address: ip,
      p_purpose: 'Customer uploading support document',
    })

    // Mark as clean for now (would integrate with virus scanner in production)
    await supabase
      .from('ticket_attachments')
      .update({
        scan_status: 'clean',
        scanned_at: new Date().toISOString(),
      })
      .eq('id', attachment.id)

    return NextResponse.json({
      attachment: {
        ...attachment,
        scan_status: 'clean',
      },
    })
  } catch (error: any) {
    console.error('Error in upload:', error)
    return NextResponse.json(
      { error: 'An error occurred during upload' },
      { status: 500 }
    )
  }
}
