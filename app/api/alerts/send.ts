import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentName, logLevel, eventType, message, errorDetails } = body

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromPhone = process.env.TWILIO_PHONE_NUMBER
    const alertPhone = process.env.ALERT_PHONE_NUMBER
    const alertEmail = process.env.ALERT_EMAIL

    if (!accountSid || !authToken || !fromPhone) {
      console.error('Twilio credentials not configured')
      return NextResponse.json({ 
        success: false, 
        error: 'Twilio not configured' 
      }, { status: 500 })
    }

    const alertMessage = `[${logLevel.toUpperCase()}] Agent: ${agentName}\nEvent: ${eventType}\n${message}`

    const responses = []

    if (alertPhone && fromPhone) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        
        const smsResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: alertPhone,
            From: fromPhone,
            Body: alertMessage
          })
        })

        const smsResult = await smsResponse.json()
        responses.push({ type: 'sms', success: smsResponse.ok, result: smsResult })
      } catch (error: any) {
        console.error('SMS alert failed:', error)
        responses.push({ type: 'sms', success: false, error: error.message })
      }
    }

    if (alertEmail) {
      try {
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: alertEmail,
            subject: `[${logLevel.toUpperCase()}] Agent Alert: ${agentName}`,
            body: `
              <h2>Agent Alert</h2>
              <p><strong>Level:</strong> ${logLevel}</p>
              <p><strong>Agent:</strong> ${agentName}</p>
              <p><strong>Event Type:</strong> ${eventType}</p>
              <p><strong>Message:</strong> ${message}</p>
              ${errorDetails ? `<p><strong>Details:</strong> <pre>${JSON.stringify(errorDetails, null, 2)}</pre></p>` : ''}
            `
          })
        })

        responses.push({ type: 'email', success: emailResponse.ok })
      } catch (error: any) {
        console.error('Email alert failed:', error)
        responses.push({ type: 'email', success: false, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Alerts sent',
      responses
    })
  } catch (error: any) {
    console.error('Alert error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send alert', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
