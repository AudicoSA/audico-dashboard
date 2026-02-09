# Customer Portal - Quick Start Guide

## Setup Instructions

### 1. Database Migration

Apply the customer portal migration:

```bash
# Using psql
psql -h your-supabase-host -d your-database -U postgres -f supabase/migrations/008_customer_portal.sql

# Or using Supabase CLI
supabase db push
```

### 2. Supabase Storage Setup

Create the storage bucket for ticket attachments:

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `ticket-attachments`
3. Set as public bucket
4. Configure policies:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments');

-- Allow users to view their uploads
CREATE POLICY "Users can view uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-attachments');
```

### 3. Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 4. Seed Knowledge Base

Run the knowledge base seeder:

```bash
npm run tsx scripts/seed-knowledge-base.ts
```

Or manually insert articles through Supabase Dashboard.

### 5. Test the Portal

1. Navigate to `http://localhost:3001/portal`
2. Register a test account
3. Verify email (if email sending is configured)
4. Explore the portal features

## Portal Features

### Customer Dashboard (`/portal/dashboard`)
- Overview statistics
- Recent activity
- Quick action buttons

### Support Tickets (`/portal/tickets`)
- Create new tickets
- View all tickets
- Filter and search
- AI-generated status updates

### Order History (`/portal/orders`)
- View all orders
- Track shipments
- Download invoices

### Quote Requests (`/portal/quotes`)
- View quote requests
- Track progress
- Download PDFs

### Scheduled Calls (`/portal/calls`)
- Schedule calls
- View upcoming appointments
- Access transcripts

### AI Chatbot (`/portal/chat`)
- Ask questions
- Get instant help
- Context-aware responses

### Profile Management (`/portal/profile`)
- Update information
- View reseller status
- POPIA data controls

## API Endpoints Reference

### Authentication
```typescript
// Login
POST /api/portal/auth/login
Body: { email, password }

// Register
POST /api/portal/auth/register
Body: { email, password, full_name, company_name, phone }
```

### Tickets
```typescript
// Get user tickets
GET /api/portal/tickets?userId={userId}

// Create ticket
POST /api/portal/tickets
Body: { portal_user_id, subject, description, category, priority }

// Get ticket messages
GET /api/portal/tickets/[id]/messages

// Add message
POST /api/portal/tickets/[id]/messages
Body: { portal_user_id, message }
```

### Orders
```typescript
// Get orders
GET /api/portal/orders?userId={userId}
```

### Chatbot
```typescript
// Send message
POST /api/portal/chatbot
Body: { session_id, portal_user_id, message }
```

### File Upload
```typescript
// Upload file
POST /api/portal/uploads
FormData: { file, ticket_id, portal_user_id }
```

## Customization

### Branding
Update colors in `app/portal/layout.tsx`:
- Primary color: `bg-lime-500` → `bg-your-color`
- Update logo in layout

### Email Templates
Configure Supabase Auth email templates:
1. Go to Authentication → Email Templates
2. Customize confirmation, password reset templates

### Knowledge Base
Add your own articles:
```sql
INSERT INTO knowledge_base (category, title, content, keywords, status)
VALUES (
  'faq',
  'Your Question',
  'Your detailed answer...',
  ARRAY['keyword1', 'keyword2'],
  'active'
);
```

## Security Checklist

- [ ] Enable RLS on all portal tables
- [ ] Configure proper CORS settings
- [ ] Enable email verification
- [ ] Set up rate limiting on API routes
- [ ] Configure file upload validation
- [ ] Enable 2FA for sensitive accounts
- [ ] Set up audit log monitoring
- [ ] Configure POPIA-compliant data retention

## Troubleshooting

### Users can't register
- Check Supabase Auth settings
- Verify email sending is configured
- Check RLS policies

### Chatbot not responding
- Verify ANTHROPIC_API_KEY is set
- Check Claude API credits
- Review error logs

### Files not uploading
- Check storage bucket exists
- Verify bucket policies
- Check file size limits

### Can't see orders
- Ensure `opencart_orders_cache` is populated
- Verify customer email matches
- Check RLS policies

## Next Steps

1. **Integrate with Email System**
   - Send ticket notifications
   - Call reminders
   - Order updates

2. **Add More Knowledge Base Articles**
   - Product documentation
   - Troubleshooting guides
   - Company policies

3. **Set Up Analytics**
   - Track portal usage
   - Monitor chatbot effectiveness
   - Measure ticket resolution times

4. **Configure Notifications**
   - Email notifications
   - SMS reminders
   - Push notifications (future)

5. **Add Custom Features**
   - Live chat escalation
   - Video call support
   - Product recommendations

## Support

For issues or questions:
- Review documentation: `CUSTOMER_PORTAL.md`
- Check error logs
- Contact development team

## Production Checklist

Before going live:

- [ ] Run all migrations on production database
- [ ] Set up production environment variables
- [ ] Configure email sending (SendGrid, etc.)
- [ ] Set up monitoring and alerts
- [ ] Configure backup schedule
- [ ] Test all user flows
- [ ] Review security settings
- [ ] Set up SSL/TLS
- [ ] Configure rate limiting
- [ ] Test file upload limits
- [ ] Review and update privacy policy
- [ ] Set up analytics
- [ ] Train support team
- [ ] Create user documentation
- [ ] Set up help desk integration
