export const mockGmailMessages = [
  {
    id: 'msg-001',
    threadId: 'thread-001',
    labelIds: ['INBOX', 'UNREAD'],
    snippet: 'I would like to request a quote for 100 smart LED bulbs...',
    payload: {
      headers: [
        { name: 'From', value: 'customer@example.com' },
        { name: 'To', value: 'sales@audico.com' },
        { name: 'Subject', value: 'Quote Request - Smart LED Bulbs' },
        { name: 'Date', value: new Date().toISOString() }
      ],
      body: {
        data: Buffer.from('I would like to request a quote for 100 smart LED bulbs for my office. Please provide pricing and availability.').toString('base64')
      }
    },
    internalDate: Date.now().toString()
  },
  {
    id: 'msg-002',
    threadId: 'thread-002',
    labelIds: ['INBOX'],
    snippet: 'Your order #12345 has been shipped...',
    payload: {
      headers: [
        { name: 'From', value: 'vendor@supplier.com' },
        { name: 'To', value: 'orders@audico.com' },
        { name: 'Subject', value: 'Order Shipped - #12345' },
        { name: 'Date', value: new Date().toISOString() }
      ],
      body: {
        data: Buffer.from('Your order #12345 has been shipped and will arrive in 2-3 business days.').toString('base64')
      }
    },
    internalDate: Date.now().toString()
  },
  {
    id: 'msg-003',
    threadId: 'thread-003',
    labelIds: ['INBOX', 'SPAM'],
    snippet: 'Congratulations! You have won a prize...',
    payload: {
      headers: [
        { name: 'From', value: 'spam@spammer.com' },
        { name: 'To', value: 'info@audico.com' },
        { name: 'Subject', value: 'You Won!!!' },
        { name: 'Date', value: new Date().toISOString() }
      ],
      body: {
        data: Buffer.from('Congratulations! You have won a prize. Click here to claim.').toString('base64')
      }
    },
    internalDate: Date.now().toString()
  },
  {
    id: 'msg-004',
    threadId: 'thread-004',
    labelIds: ['INBOX'],
    snippet: 'Technical support needed for installation...',
    payload: {
      headers: [
        { name: 'From', value: 'customer2@example.com' },
        { name: 'To', value: 'support@audico.com' },
        { name: 'Subject', value: 'Installation Help Needed' },
        { name: 'Date', value: new Date().toISOString() }
      ],
      body: {
        data: Buffer.from('I need help installing my smart door lock. The app is not connecting to the device.').toString('base64')
      }
    },
    internalDate: Date.now().toString()
  }
]

export const mockEmailClassifications = {
  'msg-001': {
    category: 'sales_inquiry',
    priority: 'high',
    requires_response: true,
    suggested_reply: 'Thank you for your inquiry. We would be happy to provide a quote for 100 smart LED bulbs.'
  },
  'msg-002': {
    category: 'vendor',
    priority: 'low',
    requires_response: false
  },
  'msg-003': {
    category: 'spam',
    priority: 'low',
    requires_response: false
  },
  'msg-004': {
    category: 'support',
    priority: 'high',
    requires_response: true,
    suggested_reply: 'Thank you for contacting us. Our support team will help you with the installation.'
  }
}
